// motor.js — todos los cálculos de préstamos (sección 4 de la especificación).
// Funciones puras: reciben objetos y la fecha `hoy`, devuelven objetos.
// Sin DOM, sin almacenamiento, sin Date.now(). Dinero en enteros.

import * as fechas from './fechas.js';
import { redondear, formatear as formatearDinero } from './dinero.js';

// Para decidir "el peor" estado de un cliente (sección 4.5). Mayor número = peor.
const GRAVEDAD_ESTADO = {
  perdido: 7,
  legal: 6,
  vencido: 5,
  atrasado: 4,
  congelado: 3,
  al_dia: 2,
  familia: 1,
  pagado: 0,
};

// Estados en los que un préstamo ya no cuenta como activo.
const ESTADOS_CERRADOS = ['pagado', 'perdido'];

// Tope de seguridad para los bucles que generan periodos (100 años de meses).
const MAXIMO_PERIODOS = 1200;

/* ----------------------------------------------------------------------- */
/* Ayudas internas                                                          */
/* ----------------------------------------------------------------------- */

/** Número entero no negativo a partir de cualquier valor; lo inválido vale 0. */
function entero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? redondear(n) : 0;
}

/** Compara dos textos para desempatar ordenes (creadoEn, id). */
function compararTexto(a, b) {
  const ta = a == null ? '' : String(a);
  const tb = b == null ? '' : String(b);
  if (ta === tb) return 0;
  return ta < tb ? -1 : 1;
}

/** Regla 4.1.7: los pagos se procesan en orden de fecha (desempate por creadoEn). */
function ordenarPagos(pagos) {
  return [...pagos].sort(
    (a, b) => fechas.comparar(a.fecha, b.fecha) || compararTexto(a.creadoEn, b.creadoEn),
  );
}

/** Deja solo los pagos del préstamo (si traen prestamoId) y con fecha válida. */
function pagosDe(prestamo, pagos) {
  return ordenarPagos(
    (pagos || []).filter(
      (p) => p && (p.prestamoId == null || p.prestamoId === prestamo.id) && fechas.esFechaValida(p.fecha),
    ),
  );
}

/** Monto total de un pago: `monto`, o interés + capital si no trae monto. */
function montoDePago(pago) {
  if (pago.monto != null && pago.monto !== '') return entero(pago.monto);
  return entero(pago.interes) + entero(pago.capital);
}

/** Monto de un perdón: `monto`, o `interes` si solo trae eso. */
function montoDePerdon(pago) {
  const monto = entero(pago.monto);
  return monto > 0 ? monto : entero(pago.interes);
}

/** Suma de `monto` de los pagos tipo 'pago' (plata o especie). Los perdones no cuentan (5.4). */
function totalRecibidoDe(pagos) {
  return pagos.filter((p) => p.tipo === 'pago').reduce((suma, p) => suma + montoDePago(p), 0);
}

/** Tope de intereses del préstamo como entero, o null si no tiene (regla 4.1.10). */
function topeDe(prestamo) {
  if (prestamo.topeInteres == null || prestamo.topeInteres === '') return null;
  return entero(prestamo.topeInteres);
}

/** Vencimiento según regla 4.1.13: fecha + plazoMeses, o null si no hay plazo. */
function vencimientoDe(prestamo) {
  const plazo = entero(prestamo.plazoMeses);
  if (plazo <= 0 || !fechas.esFechaValida(prestamo.fecha)) return null;
  return fechas.sumarMeses(prestamo.fecha, plazo);
}

/**
 * Regla 4.1.15: un préstamo perdido, congelado o marcado pagado no causa más
 * intereses desde `fechaEstado`. Devuelve esa fecha límite, o null si el
 * préstamo sigue causando con normalidad.
 */
function limiteCausacionDe(prestamo) {
  const manual = prestamo.estadoManual;
  const detieneCausacion = manual === 'perdido' || manual === 'congelado' || manual === 'pagado';
  if (detieneCausacion && fechas.esFechaValida(prestamo.fechaEstado)) return prestamo.fechaEstado;
  return null;
}

/** Resultado vacío con la forma de la sección 4.4; cada modalidad lo completa. */
function resultadoBase(prestamo) {
  return {
    prestamoId: prestamo.id,
    clienteId: prestamo.clienteId,
    modalidad: prestamo.modalidad || 'interes_mensual',
    capital: entero(prestamo.capital),
    tasa: Number(prestamo.tasa) || 0,
    fecha: prestamo.fecha,
    capitalPagado: 0,
    capitalPendiente: entero(prestamo.capital),
    interesCausado: 0,
    interesPagado: 0,
    interesPerdonado: 0,
    interesPendiente: 0,
    totalRecibido: 0,
    deudaCliente: 0,
    netoRecuperar: 0,
    ganancia: 0,
    periodos: [],
    mesesAtrasados: 0,
    estado: 'al_dia',
    proximoCobro: null,
    vencimiento: vencimientoDe(prestamo),
    advertencias: [],
  };
}

/* ----------------------------------------------------------------------- */
/* Modalidad interes_mensual (sección 4.1)                                  */
/* ----------------------------------------------------------------------- */

/**
 * Regla 4.1.9: abonos a capital en orden de fecha. Aplica solo hasta cero y
 * reporta el sobrante en advertencias. Devuelve la lista de abonos aplicados.
 */
function aplicarAbonosCapital(resultado, pagos) {
  const abonos = [];
  for (const pago of pagos) {
    if (pago.tipo !== 'pago') continue;
    const capitalDelPago = entero(pago.capital);
    if (capitalDelPago <= 0) continue;
    const aplicado = Math.min(capitalDelPago, resultado.capitalPendiente);
    if (aplicado < capitalDelPago) {
      resultado.advertencias.push(
        `El pago del ${fechas.formatear(pago.fecha)} trae ${formatearDinero(capitalDelPago - aplicado)} ` +
          'de capital de más; solo se aplicó hasta dejar el capital en cero.',
      );
    }
    if (aplicado > 0) {
      abonos.push({ fecha: pago.fecha, monto: aplicado });
      resultado.capitalPendiente -= aplicado;
      resultado.capitalPagado += aplicado;
    }
  }
  return abonos;
}

/** Regla 4.1.4: capital pendiente al inicio del periodo (abonos con fecha ≤ inicio). */
function capitalAlInicio(capital, abonos, desde) {
  let base = capital;
  for (const abono of abonos) {
    if (fechas.comparar(abono.fecha, desde) <= 0) base -= abono.monto;
  }
  return Math.max(0, base);
}

/**
 * Fábrica de periodos de un préstamo (reglas 4.1.1, 4.1.2, 4.1.3, 4.1.10 y 4.1.15).
 * Lleva la cuenta de cuántos periodos van y de lo causado acumulado, para que
 * tanto la generación inicial como la extensión por pagos adelantados creen
 * periodos consistentes.
 * - `esCausado` dice si la fecha de cobro ya llegó (≤ límite). Un periodo no
 *   causado lleva en `causado` el interés proyectado, pero no suma en los totales.
 * - Un préstamo perdido, congelado o marcado pagado no causa después de `fechaEstado`.
 * - Con `topeInteres`, el último periodo se recorta y después no se generan más.
 */
function crearFabricaPeriodos(prestamo, resultado, abonos, hoy) {
  const limiteCausacion = limiteCausacionDe(prestamo);
  const limitado = limiteCausacion != null;
  let limite = hoy;
  if (limitado && fechas.comparar(limiteCausacion, limite) < 0) limite = limiteCausacion;

  const tasa = resultado.tasa;
  const tope = topeDe(prestamo);
  let acumulado = 0;
  let numero = 0;

  return {
    /** Fecha de inicio del periodo que se crearía a continuación. */
    inicioDelSiguiente() {
      return fechas.sumarMeses(prestamo.fecha, numero);
    },

    /**
     * Crea el siguiente periodo, o null si ya no se puede (tope de periodos,
     * tope de intereses o estado que detiene la causación). Con `soloSiCausa`
     * no crea periodos con interés cero (capital ya en cero).
     */
    siguiente(soloSiCausa = false) {
      if (numero >= MAXIMO_PERIODOS) return null;
      const n = numero + 1;
      const desde = fechas.sumarMeses(prestamo.fecha, n - 1);
      const hasta = fechas.sumarMeses(prestamo.fecha, n);
      if (limitado && fechas.comparar(hasta, limite) > 0) return null;
      if (tope != null && acumulado >= tope) return null;

      const capitalBase = capitalAlInicio(resultado.capital, abonos, desde);
      let causado = redondear((capitalBase * tasa) / 100);
      if (tope != null && acumulado + causado > tope) causado = tope - acumulado;
      if (soloSiCausa && causado <= 0) return null;

      acumulado += causado;
      numero = n;
      return {
        numero: n,
        desde,
        hasta,
        mes: fechas.mesDe(hasta),
        capitalBase,
        causado,
        pagado: 0,
        perdonado: 0,
        pendiente: causado,
        atrasado: false,
        esCausado: fechas.comparar(hasta, limite) <= 0,
      };
    },
  };
}

/**
 * Regla 4.1.6: genera periodos hasta cubrir `hoy` y la fecha del último pago,
 * lo que sea mayor (el periodo que contiene esa fecha existe aunque su cobro
 * sea futuro, para que un pago adelantado tenga dónde aplicarse).
 */
function generarPeriodos(fabrica, pagos, hoy) {
  const periodos = [];
  let objetivo = hoy;
  const ultimoPago = pagos.length ? pagos[pagos.length - 1].fecha : null;
  if (ultimoPago && fechas.comparar(ultimoPago, objetivo) > 0) objetivo = ultimoPago;

  while (fechas.comparar(fabrica.inicioDelSiguiente(), objetivo) <= 0) {
    const periodo = fabrica.siguiente();
    if (!periodo) break;
    periodos.push(periodo);
  }
  return periodos;
}

/**
 * Reglas 4.1.7 y 4.1.8: aplica el interés pagado y los perdones.
 * Primero al periodo cuyo mes coincide con el mes del pago; lo que sobre al
 * pendiente más antiguo y así en adelante, incluyendo periodos futuros: si
 * todavía sobra, se crean periodos nuevos (proyectados) hasta agotarlo.
 * Nunca se aplica al capital; el sobrante sin periodo va a advertencias.
 * Si recibe `aplicadoPorPago` (Map), anota en él cuánto interés se aplicó de
 * cada pago (clave: el objeto pago), para que la ganancia del negocio cuente
 * solo lo que de verdad se aplicó a un periodo.
 */
function aplicarIntereses(resultado, periodos, pagos, fabrica, aplicadoPorPago = null) {
  for (const pago of pagos) {
    const esPerdon = pago.tipo === 'perdon';
    let restante = esPerdon ? montoDePerdon(pago) : entero(pago.interes);
    if (aplicadoPorPago) aplicadoPorPago.set(pago, 0);
    if (restante <= 0) continue;

    const campo = esPerdon ? 'perdonado' : 'pagado';
    const aplicar = (periodo) => {
      const cantidad = Math.min(restante, periodo.pendiente);
      if (cantidad <= 0) return;
      periodo[campo] += cantidad;
      periodo.pendiente -= cantidad;
      restante -= cantidad;
      if (esPerdon) resultado.interesPerdonado += cantidad;
      else resultado.interesPagado += cantidad;
      if (aplicadoPorPago) aplicadoPorPago.set(pago, aplicadoPorPago.get(pago) + cantidad);
    };

    const mesDelPago = fechas.mesDe(pago.fecha);
    const periodoDelMes = periodos.find((p) => p.mes === mesDelPago);
    if (periodoDelMes) aplicar(periodoDelMes);

    for (const periodo of periodos) {
      if (restante <= 0) break;
      aplicar(periodo);
    }

    // Periodos futuros que todavía no existen: se crean mientras haya sobrante.
    while (restante > 0) {
      const periodo = fabrica.siguiente(true);
      if (!periodo) break;
      periodos.push(periodo);
      aplicar(periodo);
    }

    if (restante > 0) {
      const que = esPerdon ? 'perdón' : 'pago';
      resultado.advertencias.push(
        `Al ${que} del ${fechas.formatear(pago.fecha)} le sobran ${formatearDinero(restante)} de interés ` +
          'que no tienen periodo pendiente donde aplicarse.',
      );
    }
  }
}

/**
 * Regla 4.4: próximo cobro = periodo pendiente más antiguo, o el siguiente por causar.
 * El siguiente por causar solo se proyecta si la fábrica de periodos lo va a crear:
 * un préstamo congelado (o perdido, o marcado pagado) no causa después de
 * `fechaEstado` (regla 4.1.15), así que no se le proyecta un cobro que nunca llega.
 */
function proximoCobroDe(prestamo, resultado, periodos, hoy) {
  if (ESTADOS_CERRADOS.includes(resultado.estado)) return null;

  const pendiente = periodos.find((p) => p.pendiente > 0);
  if (pendiente) return { fecha: pendiente.hasta, monto: pendiente.pendiente };

  if (resultado.capitalPendiente > 0 && resultado.tasa > 0 && fechas.esFechaValida(prestamo.fecha)) {
    const tope = topeDe(prestamo);
    const causadoTotal = periodos.reduce((suma, p) => suma + p.causado, 0);
    const siguiente = periodos.length + 1;
    const fechaSiguiente = fechas.sumarMeses(prestamo.fecha, siguiente);
    const limiteCausacion = limiteCausacionDe(prestamo);
    const seCausa = limiteCausacion == null || fechas.comparar(fechaSiguiente, limiteCausacion) <= 0;
    if (seCausa && (tope == null || causadoTotal < tope)) {
      let monto = redondear((resultado.capitalPendiente * resultado.tasa) / 100);
      if (tope != null) monto = Math.min(monto, tope - causadoTotal);
      if (monto > 0) return { fecha: fechaSiguiente, monto };
    }
  }

  if (resultado.vencimiento && resultado.capitalPendiente > 0 && fechas.comparar(resultado.vencimiento, hoy) >= 0) {
    return { fecha: resultado.vencimiento, monto: resultado.capitalPendiente };
  }
  return null;
}

/**
 * Sección 4.1 completa. `aplicadoPorPago` (Map opcional) recibe cuánto interés
 * se aplicó de cada pago; lo usa gananciaPorPago.
 */
function calcularInteresMensual(prestamo, pagos, hoy, aplicadoPorPago = null) {
  const resultado = resultadoBase(prestamo);

  const abonos = aplicarAbonosCapital(resultado, pagos);
  let periodos = [];
  if (fechas.esFechaValida(prestamo.fecha)) {
    const fabrica = crearFabricaPeriodos(prestamo, resultado, abonos, hoy);
    periodos = generarPeriodos(fabrica, pagos, hoy);
    aplicarIntereses(resultado, periodos, pagos, fabrica, aplicadoPorPago);
  } else {
    resultado.advertencias.push('El préstamo no tiene una fecha válida; no se calcularon periodos.');
  }

  // Regla 4.1.11 y 4.1.12: pendiente, atraso y totales solo sobre periodos causados.
  for (const periodo of periodos) {
    periodo.pendiente = Math.max(0, periodo.pendiente);
    periodo.atrasado = periodo.esCausado && periodo.pendiente > 0 && fechas.comparar(periodo.hasta, hoy) < 0;
    if (periodo.esCausado) {
      resultado.interesCausado += periodo.causado;
      resultado.interesPendiente += periodo.pendiente;
      if (periodo.atrasado) resultado.mesesAtrasados++;
    }
  }

  resultado.periodos = periodos;
  resultado.totalRecibido = totalRecibidoDe(pagos);
  resultado.deudaCliente = resultado.capitalPendiente + resultado.interesPendiente;
  resultado.netoRecuperar = resultado.capital - resultado.totalRecibido;
  resultado.ganancia = resultado.interesPagado;

  // Prioridad del estado (4.4): manual > pagado > vencido > atrasado > al_dia.
  const hayPagos = pagos.some((p) => p.tipo === 'pago');
  if (prestamo.estadoManual) {
    resultado.estado = prestamo.estadoManual;
  } else if (resultado.capitalPendiente === 0 && resultado.interesPendiente === 0 && hayPagos) {
    resultado.estado = 'pagado'; // regla 4.1.14
  } else if (
    resultado.vencimiento &&
    fechas.comparar(hoy, resultado.vencimiento) > 0 &&
    resultado.capitalPendiente > 0
  ) {
    resultado.estado = 'vencido'; // regla 4.1.13
  } else if (resultado.mesesAtrasados > 0) {
    resultado.estado = 'atrasado'; // regla 4.1.12
  } else {
    resultado.estado = 'al_dia';
  }

  resultado.proximoCobro = proximoCobroDe(prestamo, resultado, periodos, hoy);
  return resultado;
}

/* ----------------------------------------------------------------------- */
/* Modalidad capital_primero (sección 4.2)                                  */
/* ----------------------------------------------------------------------- */

/**
 * Sección 4.2: no hay periodos. Todo lo pagado va primero al capital; cuando el
 * capital llega a cero, lo demás es ganancia. Deuda = totalPactado − recibido
 * (o capital − recibido si no hay total pactado). El `capital` del pago se ignora.
 */
function calcularCapitalPrimero(prestamo, pagos, hoy) {
  const resultado = resultadoBase(prestamo);
  const totalRecibido = totalRecibidoDe(pagos);
  const perdonado = pagos.filter((p) => p.tipo === 'perdon').reduce((suma, p) => suma + montoDePerdon(p), 0);
  const totalPactado = entero(prestamo.totalPactado) > 0 ? entero(prestamo.totalPactado) : resultado.capital;

  resultado.totalRecibido = totalRecibido;
  resultado.capitalPagado = Math.min(resultado.capital, totalRecibido);
  resultado.capitalPendiente = resultado.capital - resultado.capitalPagado;
  resultado.ganancia = Math.max(0, totalRecibido - resultado.capital);
  resultado.interesCausado = Math.max(0, totalPactado - resultado.capital);
  resultado.interesPagado = resultado.ganancia;
  resultado.interesPerdonado = perdonado;
  resultado.deudaCliente = Math.max(0, totalPactado - totalRecibido - perdonado);
  resultado.interesPendiente = Math.max(0, resultado.deudaCliente - resultado.capitalPendiente);
  resultado.netoRecuperar = resultado.capital - totalRecibido;

  if (totalRecibido > totalPactado) {
    resultado.advertencias.push(
      `Recibió ${formatearDinero(totalRecibido - totalPactado)} más que el total pactado de ${formatearDinero(totalPactado)}.`,
    );
  }

  const hayPagos = pagos.some((p) => p.tipo === 'pago');
  if (prestamo.estadoManual) {
    resultado.estado = prestamo.estadoManual;
  } else if (resultado.deudaCliente === 0 && hayPagos) {
    resultado.estado = 'pagado';
  } else if (resultado.vencimiento && fechas.comparar(hoy, resultado.vencimiento) > 0 && resultado.capitalPendiente > 0) {
    resultado.estado = 'vencido';
  } else {
    resultado.estado = 'al_dia';
  }

  if (!ESTADOS_CERRADOS.includes(resultado.estado) && resultado.deudaCliente > 0 && resultado.vencimiento) {
    resultado.proximoCobro = { fecha: resultado.vencimiento, monto: resultado.deudaCliente };
  }
  return resultado;
}

/* ----------------------------------------------------------------------- */
/* Modalidad sin_interes (sección 4.3)                                      */
/* ----------------------------------------------------------------------- */

/** Sección 4.3: familia. Deuda = capital − recibido. Sin intereses, sin atraso. Estado siempre 'familia'. */
function calcularSinInteres(prestamo, pagos) {
  const resultado = resultadoBase(prestamo);
  const totalRecibido = totalRecibidoDe(pagos);
  const perdonado = pagos.filter((p) => p.tipo === 'perdon').reduce((suma, p) => suma + montoDePerdon(p), 0);

  resultado.tasa = 0;
  resultado.totalRecibido = totalRecibido;
  resultado.capitalPagado = Math.min(resultado.capital, totalRecibido + perdonado);
  resultado.capitalPendiente = resultado.capital - resultado.capitalPagado;
  resultado.interesPerdonado = perdonado;
  resultado.deudaCliente = resultado.capitalPendiente;
  resultado.netoRecuperar = resultado.capital - totalRecibido;
  resultado.ganancia = 0;
  resultado.estado = 'familia';

  if (totalRecibido + perdonado > resultado.capital) {
    resultado.advertencias.push(
      `Recibió ${formatearDinero(totalRecibido + perdonado - resultado.capital)} más que el capital prestado.`,
    );
  }
  if (resultado.deudaCliente > 0 && resultado.vencimiento) {
    resultado.proximoCobro = { fecha: resultado.vencimiento, monto: resultado.deudaCliente };
  }
  return resultado;
}

/* ----------------------------------------------------------------------- */
/* Funciones exportadas                                                     */
/* ----------------------------------------------------------------------- */

/**
 * Sección 4.4: calcula un préstamo con sus pagos a la fecha `hoy`.
 * `pagosDelPrestamo` puede traer pagos de otros préstamos; se filtran por prestamoId.
 */
export function calcularPrestamo(prestamo, pagosDelPrestamo, hoy) {
  const pagos = pagosDe(prestamo, pagosDelPrestamo);
  const modalidad = prestamo.modalidad || 'interes_mensual';
  if (modalidad === 'capital_primero') return calcularCapitalPrimero(prestamo, pagos, hoy);
  if (modalidad === 'sin_interes') return calcularSinInteres(prestamo, pagos);
  const resultado = calcularInteresMensual(prestamo, pagos, hoy);
  // Cargado del Excel sin saber qué debe de intereses: no se afirma que esté al día.
  if (prestamo.porConfirmar && resultado.estado === 'al_dia') resultado.estado = 'por_confirmar';
  return resultado;
}

/** Agrupa los pagos por prestamoId. Devuelve un Map. */
export function agruparPagos(pagos) {
  const porPrestamo = new Map();
  for (const pago of pagos || []) {
    if (!porPrestamo.has(pago.prestamoId)) porPrestamo.set(pago.prestamoId, []);
    porPrestamo.get(pago.prestamoId).push(pago);
  }
  return porPrestamo;
}

/** Calcula todos los préstamos del estado. Devuelve un objeto { [prestamoId]: resultado }. */
export function calcularTodos(estado, hoy) {
  const pagosPorPrestamo = agruparPagos(estado.pagos);
  const resultados = {};
  for (const prestamo of estado.prestamos || []) {
    resultados[prestamo.id] = calcularPrestamo(prestamo, pagosPorPrestamo.get(prestamo.id) || [], hoy);
  }
  return resultados;
}

/** Sección 4.5: el peor de dos estados. */
export function peorEstado(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (GRAVEDAD_ESTADO[b] || 0) > (GRAVEDAD_ESTADO[a] || 0) ? b : a;
}

/**
 * Sección 4.5: resumen de un cliente sumando sus préstamos.
 * `pagos` puede ser la lista completa; se filtran por prestamoId.
 */
export function resumenCliente(cliente, prestamosDelCliente, pagos, hoy) {
  const pagosPorPrestamo = agruparPagos(pagos);
  const resultados = (prestamosDelCliente || []).map((prestamo) =>
    calcularPrestamo(prestamo, pagosPorPrestamo.get(prestamo.id) || [], hoy),
  );

  const resumen = {
    clienteId: cliente ? cliente.id : null,
    capitalPrestado: 0,
    capitalPendiente: 0,
    interesPendiente: 0,
    deudaCliente: 0,
    totalRecibido: 0,
    ganancia: 0,
    netoRecuperar: 0,
    mesesAtrasados: 0,
    estado: cliente && cliente.tipo === 'familia' ? 'familia' : 'al_dia',
    proximoCobro: null,
    prestamosActivos: 0,
    prestamos: resultados.length,
    resultados,
  };

  let estado = null;
  for (const r of resultados) {
    resumen.capitalPrestado += r.capital;
    resumen.capitalPendiente += r.capitalPendiente;
    resumen.interesPendiente += r.interesPendiente;
    resumen.deudaCliente += r.deudaCliente;
    resumen.totalRecibido += r.totalRecibido;
    resumen.ganancia += r.ganancia;
    resumen.netoRecuperar += r.netoRecuperar;
    resumen.mesesAtrasados = Math.max(resumen.mesesAtrasados, r.mesesAtrasados);
    if (!ESTADOS_CERRADOS.includes(r.estado)) resumen.prestamosActivos++;
    estado = peorEstado(estado, r.estado);
    if (r.proximoCobro && (!resumen.proximoCobro || fechas.comparar(r.proximoCobro.fecha, resumen.proximoCobro.fecha) < 0)) {
      resumen.proximoCobro = { ...r.proximoCobro, prestamoId: r.prestamoId };
    }
  }
  if (estado) resumen.estado = estado;
  return resumen;
}

/** Sección 3.4: saldo de una caja = suma de monto × signo, opcionalmente hasta una fecha incluida. */
export function saldoCaja(movimientos, caja, hastaFecha) {
  let saldo = 0;
  for (const m of movimientos || []) {
    if (m.caja !== caja) continue;
    if (hastaFecha && fechas.comparar(m.fecha, hastaFecha) > 0) continue;
    saldo += entero(m.monto) * (Number(m.signo) === -1 ? -1 : 1);
  }
  return saldo;
}

/**
 * Caja mes a mes, como el cuadrito que ella lleva de la caja virtual: por cada mes desde el
 * primer movimiento hasta `hastaMes` (AAAA-MM), cuánto entró, cuánto salió, el saldo del mes,
 * el acumulado que venía del mes anterior y el acumulado al cierre. Un acumulado negativo
 * en la caja virtual es plata de su pareja que ella usó.
 * Devuelve [{ mes, entro, salio, saldoMes, anterior, acumulado }], del más viejo al más nuevo.
 */
export function cajaPorMes(movimientos, caja, hastaMes) {
  const porMes = new Map();
  let primerMes = null;
  for (const m of movimientos || []) {
    if (m.caja !== caja) continue;
    const mes = fechas.mesDe(m.fecha);
    if (!porMes.has(mes)) porMes.set(mes, { entro: 0, salio: 0 });
    const acumulador = porMes.get(mes);
    if (Number(m.signo) === -1) acumulador.salio += entero(m.monto);
    else acumulador.entro += entero(m.monto);
    if (!primerMes || fechas.comparar(mes, primerMes) < 0) primerMes = mes;
  }
  if (!primerMes) return [];

  const ultimoMes = hastaMes && fechas.comparar(hastaMes, primerMes) > 0 ? hastaMes : primerMes;
  const filas = [];
  let acumulado = 0;
  let mes = primerMes;
  while (fechas.comparar(mes, ultimoMes) <= 0) {
    const { entro, salio } = porMes.get(mes) || { entro: 0, salio: 0 };
    const anterior = acumulado;
    acumulado += entro - salio;
    filas.push({ mes, entro, salio, saldoMes: entro - salio, anterior, acumulado });
    mes = fechas.mesDe(fechas.sumarMeses(`${mes}-01`, 1));
  }
  return filas;
}

/**
 * Parte de ganancia de cada pago (lo que cuenta como "intereses cobrados").
 * interes_mensual: el interés del pago que de verdad se aplicó a un periodo
 * (lo que sobra sin periodo pendiente, reportado en advertencias, no es
 * ganancia; así la suma coincide con `interesPagado` del préstamo).
 * capital_primero: lo que pasa del capital, en orden de fecha. sin_interes: 0.
 * `hoy` es opcional: lo aplicado no depende de la fecha, pero si viene se usa.
 * Devuelve [{ pago, ganancia }].
 */
export function gananciaPorPago(prestamo, pagos, hoy = null) {
  const todos = pagosDe(prestamo, pagos);
  const ordenados = todos.filter((p) => p.tipo === 'pago');
  const modalidad = prestamo.modalidad || 'interes_mensual';
  if (modalidad === 'sin_interes') return ordenados.map((pago) => ({ pago, ganancia: 0 }));
  if (modalidad === 'capital_primero') {
    let acumulado = 0;
    const capital = entero(prestamo.capital);
    return ordenados.map((pago) => {
      const monto = montoDePago(pago);
      const antes = acumulado;
      acumulado += monto;
      const ganancia = Math.max(0, acumulado - Math.max(capital, antes));
      return { pago, ganancia };
    });
  }

  // interes_mensual: se recalcula el préstamo y se toma lo aplicado de cada pago.
  // La fecha de cálculo cubre el último pago para que todos tengan periodo.
  let fechaCalculo = fechas.esFechaValida(hoy) ? hoy : prestamo.fecha;
  const ultimoPago = todos.length ? todos[todos.length - 1].fecha : null;
  if (ultimoPago && (!fechas.esFechaValida(fechaCalculo) || fechas.comparar(ultimoPago, fechaCalculo) > 0)) {
    fechaCalculo = ultimoPago;
  }
  if (!fechas.esFechaValida(fechaCalculo)) return ordenados.map((pago) => ({ pago, ganancia: 0 }));

  const aplicadoPorPago = new Map();
  calcularInteresMensual(prestamo, todos, fechaCalculo, aplicadoPorPago);
  return ordenados.map((pago) => ({ pago, ganancia: aplicadoPorPago.get(pago) || 0 }));
}

/** Un préstamo es de familia si su modalidad es sin_interes o su cliente es tipo familia. */
function esDeFamilia(prestamo, cliente) {
  return (prestamo.modalidad || 'interes_mensual') === 'sin_interes' || (cliente && cliente.tipo === 'familia');
}

/**
 * Sección 4.5: resumen del negocio.
 * capitalEnCalle: capital pendiente de clientes (no familia) salvo lo perdido.
 * capitalEnRiesgo: préstamos atrasados o vencidos. capitalPerdido, capitalLegal y
 * capitalCongelado según estado. Intereses cobrados = parte de ganancia de los pagos.
 */
export function resumenNegocio(estado, hoy) {
  const clientesPorId = new Map((estado.clientes || []).map((c) => [c.id, c]));
  const pagosPorPrestamo = agruparPagos(estado.pagos);
  const mesHoy = fechas.mesDe(hoy);
  const anioHoy = String(hoy).slice(0, 4);
  const clientesAtrasados = new Set();

  const resumen = {
    capitalEnCalle: 0,
    capitalEnRiesgo: 0,
    capitalPerdido: 0,
    capitalLegal: 0,
    capitalCongelado: 0,
    interesesPendientes: 0,
    interesesCobradosMes: 0,
    interesesCobradosAnio: 0,
    interesesCobradosTotal: 0,
    gananciaRetiradaMes: 0,
    gananciaRetiradaTotal: 0,
    gananciaDisponible: 0,
    cajas: {
      efectivo: saldoCaja(estado.movimientos, 'efectivo'),
      virtual: saldoCaja(estado.movimientos, 'virtual'),
    },
    prestamosFamilia: { cantidad: 0, prestado: 0, recibido: 0, deuda: 0 },
    clientesAtrasados: 0,
    prestamosActivos: 0,
    prestamosAtrasados: 0,
  };

  for (const prestamo of estado.prestamos || []) {
    const cliente = clientesPorId.get(prestamo.clienteId);
    const pagos = pagosPorPrestamo.get(prestamo.id) || [];
    const r = calcularPrestamo(prestamo, pagos, hoy);

    if (esDeFamilia(prestamo, cliente)) {
      resumen.prestamosFamilia.cantidad++;
      resumen.prestamosFamilia.prestado += r.capital;
      resumen.prestamosFamilia.recibido += r.totalRecibido;
      resumen.prestamosFamilia.deuda += r.deudaCliente;
      continue;
    }

    for (const { pago, ganancia } of gananciaPorPago(prestamo, pagos, hoy)) {
      if (ganancia <= 0) continue;
      resumen.interesesCobradosTotal += ganancia;
      if (fechas.mesDe(pago.fecha) === mesHoy) resumen.interesesCobradosMes += ganancia;
      if (String(pago.fecha).slice(0, 4) === anioHoy) resumen.interesesCobradosAnio += ganancia;
    }

    if (r.estado === 'pagado') continue;
    if (r.estado === 'perdido') {
      resumen.capitalPerdido += r.capitalPendiente;
      continue;
    }

    resumen.prestamosActivos++;
    resumen.capitalEnCalle += r.capitalPendiente;
    resumen.interesesPendientes += r.interesPendiente;
    if (r.estado === 'legal') resumen.capitalLegal += r.capitalPendiente;
    if (r.estado === 'congelado') resumen.capitalCongelado += r.capitalPendiente;
    if (r.estado === 'atrasado' || r.estado === 'vencido') {
      resumen.capitalEnRiesgo += r.capitalPendiente;
      resumen.prestamosAtrasados++;
      clientesAtrasados.add(prestamo.clienteId);
    }
  }

  for (const m of estado.movimientos || []) {
    if (m.tipo !== 'ganancia_a_personal') continue;
    const monto = entero(m.monto);
    resumen.gananciaRetiradaTotal += monto;
    if (fechas.mesDe(m.fecha) === mesHoy) resumen.gananciaRetiradaMes += monto;
  }

  resumen.gananciaDisponible = resumen.interesesCobradosTotal - resumen.gananciaRetiradaTotal;
  resumen.clientesAtrasados = clientesAtrasados.size;
  return resumen;
}

/**
 * Sección 4.5: agenda de cobros. Atrasados primero (ordenados por meses de atraso),
 * luego lo que vence entre hoy y hoy + `dias`. Cada línea:
 * { fecha, clienteId, nombre, prestamoId, monto, motivo, mesesAtrasados }.
 * motivo: 'atrasado' | 'interes' | 'capital' | 'acuerdo' (acuerdo solo si el préstamo trae `acuerdo`).
 */
export function agendaCobros(estado, hoy, dias = 7) {
  const limite = fechas.sumarDias(hoy, Math.max(0, entero(dias)));
  const clientesPorId = new Map((estado.clientes || []).map((c) => [c.id, c]));
  const pagosPorPrestamo = agruparPagos(estado.pagos);
  const atrasados = [];
  const proximos = [];

  for (const prestamo of estado.prestamos || []) {
    const cliente = clientesPorId.get(prestamo.clienteId);
    if (esDeFamilia(prestamo, cliente)) continue;
    const r = calcularPrestamo(prestamo, pagosPorPrestamo.get(prestamo.id) || [], hoy);
    if (!['al_dia', 'atrasado', 'vencido'].includes(r.estado)) continue;

    const base = {
      clienteId: prestamo.clienteId,
      nombre: cliente ? cliente.nombre : '',
      prestamoId: prestamo.id,
      mesesAtrasados: r.mesesAtrasados,
    };

    // Interés atrasado: una sola línea por préstamo con la suma de lo atrasado.
    const periodosAtrasados = r.periodos.filter((p) => p.atrasado);
    if (periodosAtrasados.length) {
      atrasados.push({
        ...base,
        fecha: periodosAtrasados[0].hasta,
        monto: periodosAtrasados.reduce((suma, p) => suma + p.pendiente, 0),
        motivo: 'atrasado',
      });
    }

    // Capital vencido (plazo cumplido): siempre sale en su propia línea, haya o no
    // intereses atrasados, porque ya se debe y los periodos no lo cubren.
    // Va con mesesAtrasados 0 para que la pantalla lo muestre como "capital vencido".
    if (r.estado === 'vencido') {
      const monto = r.modalidad === 'interes_mensual' ? r.capitalPendiente : r.deudaCliente;
      atrasados.push({ ...base, mesesAtrasados: 0, fecha: r.vencimiento, monto, motivo: 'atrasado' });
    }

    // Intereses que se cobran entre hoy y el límite.
    for (const p of r.periodos) {
      if (p.atrasado || p.pendiente <= 0) continue;
      if (!fechas.entre(p.hasta, hoy, limite)) continue;
      proximos.push({ ...base, fecha: p.hasta, monto: p.pendiente, motivo: 'interes' });
    }

    // Periodos más allá de los generados, si el rango de días los alcanza.
    if (r.modalidad === 'interes_mensual' && r.capitalPendiente > 0 && r.tasa > 0 && fechas.esFechaValida(prestamo.fecha)) {
      const tope = topeDe(prestamo);
      let causadoTotal = r.periodos.reduce((suma, p) => suma + p.causado, 0);
      for (let numero = r.periodos.length + 1; numero <= MAXIMO_PERIODOS; numero++) {
        const fecha = fechas.sumarMeses(prestamo.fecha, numero);
        if (fechas.comparar(fecha, limite) > 0) break;
        if (tope != null && causadoTotal >= tope) break;
        let monto = redondear((r.capitalPendiente * r.tasa) / 100);
        if (tope != null) monto = Math.min(monto, tope - causadoTotal);
        causadoTotal += monto;
        if (monto > 0 && fechas.comparar(fecha, hoy) >= 0) {
          proximos.push({ ...base, fecha, monto, motivo: 'interes' });
        }
      }
    }

    // Capital que vence dentro del rango.
    if (r.vencimiento && r.capitalPendiente > 0 && fechas.entre(r.vencimiento, hoy, limite)) {
      const monto = r.modalidad === 'interes_mensual' ? r.capitalPendiente : r.deudaCliente;
      proximos.push({ ...base, fecha: r.vencimiento, monto, motivo: 'capital' });
    }

    // Acuerdo de pago anotado en el préstamo (sección 8, agenda).
    if (prestamo.acuerdo && fechas.esFechaValida(prestamo.acuerdo.fecha) && fechas.entre(prestamo.acuerdo.fecha, hoy, limite)) {
      proximos.push({
        ...base,
        fecha: prestamo.acuerdo.fecha,
        monto: entero(prestamo.acuerdo.monto) || r.deudaCliente,
        motivo: 'acuerdo',
        texto: prestamo.acuerdo.texto || '',
      });
    }
  }

  atrasados.sort(
    (a, b) => b.mesesAtrasados - a.mesesAtrasados || fechas.comparar(a.fecha, b.fecha) || compararTexto(a.nombre, b.nombre),
  );
  proximos.sort((a, b) => fechas.comparar(a.fecha, b.fecha) || compararTexto(a.nombre, b.nombre));
  return [...atrasados, ...proximos];
}

/**
 * Sección 4.5: sugerencia de reparto de un pago entre varios préstamos del
 * mismo cliente. Orden: interés atrasado más antiguo primero, luego interés
 * del mes, luego capital del préstamo más antiguo.
 * "Interés del mes" es, en cada préstamo, el periodo pendiente más antiguo que no
 * está atrasado: el que se cobra hoy o el que está en curso (como Ernesto, que
 * paga el 5 de mayo el interés que se cobra el 15). No hace falta recibir la
 * fecha. Si además viene `fechaPago`, también entra el periodo cuyo `mes` es el
 * de esa fecha (regla 4.1.7: ahí se aplica primero el interés de ese pago).
 * Los demás periodos proyectados no entran: todavía no se deben.
 * Devuelve { reparto: [{ prestamoId, interes, capital, monto }], sobrante, aplicado }.
 */
export function repartirPagoCliente(resultadosPrestamos, monto, fechaPago = null) {
  const mesDelPago = fechas.esFechaValida(fechaPago) ? fechas.mesDe(fechaPago) : null;
  let restante = Math.max(0, entero(monto));
  const activos = (resultadosPrestamos || []).filter((r) => r && !ESTADOS_CERRADOS.includes(r.estado));
  const partes = new Map();
  const parteDe = (prestamoId) => {
    if (!partes.has(prestamoId)) partes.set(prestamoId, { prestamoId, interes: 0, capital: 0, monto: 0 });
    return partes.get(prestamoId);
  };
  const asignar = (prestamoId, campo, maximo) => {
    const cantidad = Math.min(restante, Math.max(0, maximo));
    if (cantidad <= 0) return;
    const parte = parteDe(prestamoId);
    parte[campo] += cantidad;
    parte.monto += cantidad;
    restante -= cantidad;
  };

  // 1. Interés atrasado, del más antiguo al más reciente, entre todos los préstamos.
  const periodosAtrasados = [];
  const periodosDelMes = [];
  for (const r of activos) {
    let enCursoTomado = false;
    for (const p of r.periodos || []) {
      if (p.pendiente <= 0) continue;
      if (p.atrasado) {
        periodosAtrasados.push({ prestamoId: r.prestamoId, periodo: p });
      } else if (!enCursoTomado || (mesDelPago && p.mes === mesDelPago)) {
        // El primer pendiente no atrasado es el periodo en curso (o el cobro de hoy).
        enCursoTomado = true;
        periodosDelMes.push({ prestamoId: r.prestamoId, periodo: p });
      }
    }
  }
  periodosAtrasados.sort((a, b) => fechas.comparar(a.periodo.hasta, b.periodo.hasta));
  periodosDelMes.sort((a, b) => fechas.comparar(a.periodo.hasta, b.periodo.hasta));
  for (const { prestamoId, periodo } of periodosAtrasados) {
    if (restante <= 0) break;
    asignar(prestamoId, 'interes', periodo.pendiente);
  }

  // 2. Interés del mes (pendiente que todavía no está atrasado).
  for (const { prestamoId, periodo } of periodosDelMes) {
    if (restante <= 0) break;
    asignar(prestamoId, 'interes', periodo.pendiente);
  }

  // 3. Capital del préstamo más antiguo primero. En capital_primero y sin_interes
  //    todo lo que se debe cuenta como capital porque el motor lo reparte solo.
  const porFecha = [...activos].sort((a, b) => fechas.comparar(a.fecha, b.fecha) || compararTexto(a.prestamoId, b.prestamoId));
  for (const r of porFecha) {
    if (restante <= 0) break;
    const maximo = r.modalidad === 'interes_mensual' ? r.capitalPendiente : r.deudaCliente;
    asignar(r.prestamoId, 'capital', maximo);
  }

  return {
    reparto: [...partes.values()].filter((p) => p.monto > 0),
    sobrante: restante,
    aplicado: Math.max(0, entero(monto)) - restante,
  };
}
