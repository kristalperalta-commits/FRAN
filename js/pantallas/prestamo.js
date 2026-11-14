/*
  prestamo.js — pantalla de préstamo (sección 8 de la especificación).

  Vistas (params.vista, las asigna app.js según la ruta):
  - ficha        #/prestamo/:id                 ficha con tabla mes a mes, pagos, acciones
  - nuevo        #/prestamo/nuevo/:clienteId    formulario de nuevo préstamo con fuentes
  - pago         #/prestamo/:id/pago            registrar pago con reparto y sugerencia
  - perdon       #/prestamo/:id/perdon          perdonar intereses
  - pagoCliente  #/cliente/:clienteId/pago      un pago repartido entre varios préstamos

  Todo se pinta con ui.el y el texto de la usuaria pasa siempre por ui.esc.
  Las operaciones que guardan van en try/catch y avisan con ui.toast.
  Dinero en enteros; fechas como texto AAAA-MM-DD (nunca new Date('AAAA-MM-DD')).
*/

import { guardarFoto, leerFoto, reducirFoto } from '../fotos.js';

const TEXTO_MODALIDAD = {
  interes_mensual: 'Interés mensual',
  capital_primero: 'Capital primero',
  sin_interes: 'Sin interés',
};

const TEXTO_ORIGEN = {
  caja_efectivo: 'Caja efectivo',
  caja_virtual: 'Caja virtual',
  arriendo: 'Arriendo',
  esposo: 'Esposo',
  pension: 'Pensión',
  otro: 'Otro',
};

const TEXTO_MEDIO = {
  efectivo: 'Efectivo',
  virtual: 'Virtual',
  especie: 'En especie',
};

const OPCIONES_ORIGEN = Object.keys(TEXTO_ORIGEN).map((valor) => ({ valor, texto: TEXTO_ORIGEN[valor] }));
const OPCIONES_MEDIO_PAGO = ['efectivo', 'virtual', 'especie'].map((valor) => ({ valor, texto: TEXTO_MEDIO[valor] }));
const OPCIONES_MEDIO_PRESTAMO = ['efectivo', 'virtual'].map((valor) => ({ valor, texto: TEXTO_MEDIO[valor] }));
const OPCIONES_MODALIDAD = Object.keys(TEXTO_MODALIDAD).map((valor) => ({ valor, texto: TEXTO_MODALIDAD[valor] }));

const TASAS_RAPIDAS = [5, 10, 12, 15, 20];

// Estados en los que el préstamo ya no recibe pagos por la vía normal.
const ESTADOS_CERRADOS = ['pagado', 'perdido'];

const TITULOS = {
  ficha: 'Préstamo',
  nuevo: 'Nuevo préstamo',
  pago: 'Registrar pago',
  perdon: 'Perdonar intereses',
  pagoCliente: 'Pago del cliente',
};

/** Título de la pestaña del navegador según la vista. */
export function titulo(params) {
  return TITULOS[params && params.vista] || 'Préstamo';
}

/** Punto de entrada que llama app.js. */
export async function render(contenedor, params, ctx) {
  contenedor.innerHTML = '';
  const vista = (params && params.vista) || 'ficha';
  if (vista === 'nuevo') return renderNuevo(contenedor, params, ctx);
  if (vista === 'pago') return renderPago(contenedor, params, ctx);
  if (vista === 'perdon') return renderPerdon(contenedor, params, ctx);
  if (vista === 'pagoCliente') return renderPagoCliente(contenedor, params, ctx);
  return renderFicha(contenedor, params, ctx);
}

/* ----------------------------------------------------------------------- */
/* Ayudas comunes                                                           */
/* ----------------------------------------------------------------------- */

/** '$ 1.234.567' */
function pesos(ctx, monto) {
  // Sin "$": en ninguna otra pantalla se usa (diseño Lila).
  return ctx.dinero.formatear(monto);
}

/** "Lleva 4 días (desde el 3 nov): 10.000 por día = 40.000". Vacío si no corre interés. */
function textoCorrido(ctx, r) {
  if (!r || !(r.interesCorrido > 0)) return '';
  const d = r.diasCorridos;
  return `Lleva ${d} ${d === 1 ? 'día' : 'días'} desde el ${ctx.fechas.formatear(r.corridoDesde)}: ${ctx.dinero.formatear(r.interesDiario)} por día = ${ctx.dinero.formatear(r.interesCorrido)}`;
}

/** Ruta del hash con el id codificado. */
function rutaPrestamo(id) {
  return `#/prestamo/${encodeURIComponent(id)}`;
}

function rutaCliente(id) {
  return `#/cliente/${encodeURIComponent(id)}`;
}

/** Préstamo, cliente, pagos y resultado del motor a la fecha de hoy. Null si no existe. */
function cargarPrestamo(ctx, id) {
  const prestamo = ctx.datos.obtener('prestamos', id);
  if (!prestamo) return null;
  const cliente = ctx.datos.obtener('clientes', prestamo.clienteId);
  const pagos = ctx.datos.listar('pagos', { prestamoId: prestamo.id });
  const resultado = ctx.motor.calcularPrestamo(prestamo, pagos, ctx.hoy());
  return { prestamo, cliente, pagos, resultado };
}

function nombreDe(cliente) {
  return cliente && cliente.nombre ? cliente.nombre : 'Cliente sin nombre';
}

/** Pantalla de "no existe" con botón para volver. */
function noEncontrado(contenedor, ctx, texto, atras) {
  const { ui } = ctx;
  contenedor.append(ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado('Préstamo', { atras })}
      ${ui.vacio(texto)}
      <a href="${ui.esc(atras)}" class="boton boton--primario boton--grande">Volver</a>
    </div>
  `));
}

/** Una línea etiqueta/valor dentro de un <dl class="prestamo-datos">. valorHtml ya viene escapado. */
function filaDato(etiqueta, valorHtml, clase = '') {
  return `<div class="dato${clase ? ` ${clase}` : ''}"><dt>${etiqueta}</dt><dd>${valorHtml}</dd></div>`;
}

/** Texto corto del préstamo para listas: "Préstamo del 11 abr 2026 · 1.000.000 al 20 %". */
function tituloCortoPrestamo(ctx, prestamo) {
  const { ui, fechas, dinero } = ctx;
  const pc = prestamo.porConfirmar;
  let texto = `Préstamo ${pc && pc.fecha ? `(${pc.fecha})` : `del ${fechas.formatear(prestamo.fecha)}`} · ${dinero.formatear(prestamo.capital)}`;
  if (prestamo.modalidad === 'interes_mensual' && !pc) texto += ` al ${String(Math.round(Number(prestamo.tasa) * 100) / 100).replace('.', ',')} %`;
  else texto += ` · ${TEXTO_MODALIDAD[prestamo.modalidad] || prestamo.modalidad}`;
  return ui.esc(texto);
}

/** Pone un entero formateado en un campo de dinero. */
function fijarDinero(entrada, valor) {
  if (!entrada) return;
  entrada.value = valor === null || valor === undefined ? '' : String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Convierte 0 o vacío en null para los campos opcionales que datos.js valida como entero > 0. */
function enteroONulo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * HTML del cuadro "Así quedaría" comparando el resultado antes y después de un
 * pago o perdón simulado. campoPeriodo: 'pagado' o 'perdonado'.
 */
function htmlPrevia(ctx, antes, despues, campoPeriodo) {
  const { ui, fechas, dinero } = ctx;
  const aplicaciones = [];
  if (despues.modalidad === 'interes_mensual') {
    const antesPorMes = new Map(antes.periodos.map((p) => [p.mes, p]));
    for (const periodo of despues.periodos) {
      const previo = antesPorMes.get(periodo.mes);
      const diferencia = periodo[campoPeriodo] - (previo ? previo[campoPeriodo] : 0);
      if (diferencia > 0) {
        aplicaciones.push(`${fechas.formatearMes(periodo.mes)}: ${dinero.formatear(diferencia)}`);
      }
    }
  }
  const abonoCapital = antes.capitalPendiente - despues.capitalPendiente;

  return `
    <h2 class="tarjeta__titulo">Así quedaría</h2>
    <dl class="prestamo-datos">
      ${filaDato('Capital pendiente', ui.esc(pesos(ctx, despues.capitalPendiente)))}
      ${filaDato('Intereses pendientes', ui.esc(pesos(ctx, despues.interesPendiente)))}
      ${filaDato('Deuda del cliente', ui.esc(pesos(ctx, despues.deudaCliente)))}
      ${filaDato('Estado', ui.chipEstado(despues.estado))}
    </dl>
    ${aplicaciones.length ? `<p class="suave">Se aplica a ${ui.esc(aplicaciones.join(' · '))}.</p>` : ''}
    ${abonoCapital > 0 ? `<p class="suave">Abona ${ui.esc(dinero.formatear(abonoCapital))} al capital.</p>` : ''}
    ${despues.advertencias.map((aviso) => `<p class="prestamo-previa__aviso">${ui.esc(aviso)}</p>`).join('')}
  `;
}

/* ----------------------------------------------------------------------- */
/* Ficha del préstamo                                                       */
/* ----------------------------------------------------------------------- */

function htmlTablaMesAMes(ctx, resultado) {
  const { ui, fechas, dinero } = ctx;
  // Se muestran los periodos causados y, aparte, los futuros que ya tengan algo
  // aplicado (pago adelantado). Un periodo futuro sin nada no se muestra.
  const periodos = resultado.periodos.filter((p) => p.esCausado || p.pagado > 0 || p.perdonado > 0);
  if (!periodos.length) {
    return ui.vacio('Todavía no se ha causado ningún interés. El primero se causa un mes después del préstamo.');
  }

  const totales = { causado: 0, pagado: 0, perdonado: 0, pendiente: 0 };
  const filas = periodos.map((p) => {
    if (p.esCausado) {
      totales.causado += p.causado;
      totales.pagado += p.pagado;
      totales.perdonado += p.perdonado;
      totales.pendiente += p.pendiente;
    }
    const clase = p.atrasado ? ' class="atrasado"' : (!p.esCausado ? ' class="proyectado"' : '');
    const etiqueta = !p.esCausado ? ' <span class="suave">(adelantado)</span>' : '';
    return `<tr${clase}>
      <td>${ui.esc(fechas.formatearMes(p.mes))}${etiqueta}<br><span class="suave">cobro ${ui.esc(fechas.formatear(p.hasta))}</span></td>
      <td>${ui.esc(dinero.formatear(p.causado))}</td>
      <td>${ui.esc(dinero.formatear(p.pagado))}</td>
      <td>${ui.esc(dinero.formatear(p.perdonado))}</td>
      <td>${ui.esc(dinero.formatear(p.esCausado ? p.pendiente : 0))}</td>
    </tr>`;
  }).join('');

  return `
    <div class="tabla-envoltura">
      <table class="tabla tabla-meses">
        <thead>
          <tr><th>Mes</th><th>Interés</th><th>Pagado</th><th>Perdonado</th><th>Pendiente</th></tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>${ui.esc(dinero.formatear(totales.causado))}</td>
            <td>${ui.esc(dinero.formatear(totales.pagado))}</td>
            <td>${ui.esc(dinero.formatear(totales.perdonado))}</td>
            <td>${ui.esc(dinero.formatear(totales.pendiente))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function htmlListaPagos(ctx, pagos) {
  const { ui, fechas, dinero } = ctx;
  if (!pagos.length) return ui.vacio('Todavía no hay pagos registrados.');

  const ordenados = [...pagos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''));
  });

  const filas = ordenados.map((pago) => {
    const esPerdon = pago.tipo === 'perdon';
    const detalle = [];
    if (esPerdon) {
      detalle.push('Perdón de intereses');
    } else {
      detalle.push(`Interés ${dinero.formatear(pago.interes)}`);
      detalle.push(`Capital ${dinero.formatear(pago.capital)}`);
      // Un perdón no tiene medio; en los pagos sí se muestra.
      detalle.push(TEXTO_MEDIO[pago.medio] || pago.medio || '');
    }
    if (pago.descripcion) detalle.push(pago.descripcion);
    if (pago.nota) detalle.push(pago.nota);
    return `<li class="fila${esPerdon ? ' fila--perdon' : ''}">
      <div class="fila__principal">
        <div class="fila__titulo">${ui.esc(fechas.formatear(pago.fecha))} · ${esPerdon ? 'Perdón' : 'Pago'}</div>
        <div class="fila__detalle fila__detalle--largo">${ui.esc(detalle.filter(Boolean).join(' · '))}</div>
      </div>
      <div class="fila__lateral">
        <div class="fila__monto">${ui.esc(dinero.formatear(pago.monto))}</div>
        <button type="button" class="boton boton--pequeno boton--secundario" data-borrar-pago="${ui.esc(pago.id)}">Borrar</button>
      </div>
    </li>`;
  }).join('');

  return `<ul class="lista">${filas}</ul>`;
}

function renderFicha(contenedor, params, ctx) {
  const { ui, fechas, dinero } = ctx;
  const carga = cargarPrestamo(ctx, params.id);
  if (!carga) return noEncontrado(contenedor, ctx, 'No se encontró este préstamo. Puede que se haya borrado.', '#/clientes');

  const { prestamo, cliente, pagos, resultado } = carga;
  const hoy = ctx.hoy();
  const nombre = nombreDe(cliente);
  const rutaFicha = rutaPrestamo(prestamo.id);
  const rutaDelCliente = rutaCliente(prestamo.clienteId);
  const esMensual = resultado.modalidad === 'interes_mensual';
  const cerrado = ESTADOS_CERRADOS.includes(resultado.estado);

  // ¿El cliente tiene más de un préstamo activo? Entonces se ofrece el pago repartido.
  const prestamosActivosDelCliente = ctx.datos.listar('prestamos', { clienteId: prestamo.clienteId }).filter((p) => {
    if (p.id === prestamo.id) return !cerrado;
    const r = ctx.motor.calcularPrestamo(p, ctx.datos.listar('pagos', { prestamoId: p.id }), hoy);
    return !ESTADOS_CERRADOS.includes(r.estado);
  });

  // --- Datos del préstamo ---
  const fuentesHtml = (prestamo.fuentes || []).map((f) => {
    const texto = `${TEXTO_ORIGEN[f.origen] || f.origen}: ${dinero.formatear(f.monto)}${f.nota ? ` (${f.nota})` : ''}`;
    return ui.esc(texto);
  }).join('<br>');

  const datosHtml = [
    filaDato('Cliente', `<a href="${rutaDelCliente}">${ui.esc(nombre)}</a>`),
    filaDato('Fecha', ui.esc(prestamo.porConfirmar && prestamo.porConfirmar.fecha ? `Por confirmar. En el Excel dice: ${prestamo.porConfirmar.fecha}` : fechas.formatear(prestamo.fecha))),
    filaDato('Capital prestado', ui.esc(pesos(ctx, prestamo.capital))),
    esMensual ? filaDato('Tasa', prestamo.porConfirmar && prestamo.porConfirmar.tasa ? ui.esc(prestamo.porConfirmar.tasa) : `${ui.esc(Math.round(prestamo.tasa * 100) / 100)} % mensual`) : '',
    filaDato('Modalidad', ui.esc(TEXTO_MODALIDAD[prestamo.modalidad] || prestamo.modalidad)),
    prestamo.totalPactado ? filaDato('Total pactado', ui.esc(pesos(ctx, prestamo.totalPactado))) : '',
    prestamo.plazoMeses
      ? filaDato('Plazo', ui.esc(`${prestamo.plazoMeses} ${prestamo.plazoMeses === 1 ? 'mes' : 'meses'} · vence ${fechas.formatear(resultado.vencimiento)}`))
      : '',
    prestamo.topeInteres ? filaDato('Tope de intereses', ui.esc(pesos(ctx, prestamo.topeInteres))) : '',
    filaDato('Entregado en', prestamo.porConfirmar ? 'Por confirmar' : ui.esc(TEXTO_MEDIO[prestamo.medio] || prestamo.medio)),
    filaDato('De dónde salió', prestamo.porConfirmar ? 'Por confirmar' : (fuentesHtml || ui.esc('Sin fuentes'))),
    prestamo.garantia ? filaDato('Garantía', ui.esc(prestamo.garantia)) : '',
    prestamo.nota ? filaDato('Nota', ui.esc(String(prestamo.nota).replace(/^CLAUDE D\d+,?\s*/i, ''))) : '',
    prestamo.estadoManual
      ? filaDato('Estado manual', ui.esc(`${ui.textoEstado(prestamo.estadoManual)} desde ${fechas.formatear(prestamo.fechaEstado)}`))
      : '',
    prestamo.acuerdo
      ? filaDato('Acuerdo de pago', ui.esc(`${fechas.formatear(prestamo.acuerdo.fecha)}${prestamo.acuerdo.texto ? `: ${prestamo.acuerdo.texto}` : ''}`))
      : '',
  ].join('');

  // --- Cuentas ---
  let netoHtml;
  if (resultado.netoRecuperar > 0) {
    netoHtml = ui.esc(pesos(ctx, resultado.netoRecuperar));
  } else {
    netoHtml = ui.esc(`Ya recuperó su plata${resultado.netoRecuperar < 0 ? ` y ${dinero.formatear(-resultado.netoRecuperar)} de más` : ''}`);
  }
  const cuentasHtml = [
    esMensual ? filaDato('Intereses causados', ui.esc(pesos(ctx, resultado.interesCausado))) : '',
    filaDato('Intereses pagados', ui.esc(pesos(ctx, resultado.interesPagado))),
    resultado.interesPerdonado > 0 ? filaDato('Intereses perdonados', ui.esc(pesos(ctx, resultado.interesPerdonado))) : '',
    filaDato('Capital pagado', ui.esc(pesos(ctx, resultado.capitalPagado))),
    filaDato('Total recibido', ui.esc(pesos(ctx, resultado.totalRecibido))),
    filaDato('Ganancia', ui.esc(pesos(ctx, resultado.ganancia))),
    filaDato('Neto por recuperar', netoHtml),
    resultado.proximoCobro
      ? filaDato('Próximo cobro', ui.esc(`${fechas.formatear(resultado.proximoCobro.fecha)} · ${pesos(ctx, resultado.proximoCobro.monto)}`))
      : '',
    resultado.vencimiento ? filaDato('Vencimiento', ui.esc(fechas.formatear(resultado.vencimiento))) : '',
  ].join('');

  const atrasoTexto = resultado.mesesAtrasados > 0
    ? `${resultado.mesesAtrasados} ${resultado.mesesAtrasados === 1 ? 'mes' : 'meses'} de atraso`
    : '';

  const advertenciasHtml = resultado.advertencias.length
    ? `<div class="tarjeta prestamo-avisos">${resultado.advertencias.map((a) => `<p>${ui.esc(a)}</p>`).join('')}</div>`
    : '';

  const raiz = ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado(nombre, { atras: rutaDelCliente, accion: { texto: 'Registrar pago', ruta: `${rutaFicha}/pago` } })}

      <div class="tarjeta tarjeta--primario prestamo-resumen">
        <p class="tarjeta__titulo">Debe hoy</p>
        <p class="tarjeta__valor">${ui.esc(pesos(ctx, resultado.debeHoy))}</p>
        <p class="tarjeta__detalle">${ui.chipEstado(resultado.estado)}${atrasoTexto ? ` <span>${ui.esc(atrasoTexto)}</span>` : ''}</p>
      </div>

      <div class="tarjetas-dos margen-abajo">
        <div class="tarjeta">
          <p class="tarjeta__titulo">Capital pendiente</p>
          <p class="tarjeta__valor">${ui.esc(dinero.formatear(resultado.capitalPendiente))}</p>
        </div>
        <div class="tarjeta">
          <p class="tarjeta__titulo">Intereses pendientes</p>
          <p class="tarjeta__valor">${ui.esc(dinero.formatear(resultado.interesPendiente + resultado.interesCorrido))}</p>
        </div>
      </div>
      ${resultado.interesCorrido > 0 ? `<p class="prestamo-corrido">${ui.esc(textoCorrido(ctx, resultado))}</p>` : ''}

      ${advertenciasHtml}

      <div class="botones prestamo-acciones">
        <a href="${rutaFicha}/pago" class="boton boton--primario boton--grande">Registrar pago</a>
        ${prestamosActivosDelCliente.length > 1 ? `<a href="${rutaDelCliente}/pago" class="boton boton--secundario">Pagar varios préstamos a la vez</a>` : ''}
        ${esMensual ? `<a href="${rutaFicha}/perdon" class="boton boton--secundario">Perdonar intereses</a>` : ''}
        <button type="button" class="boton" data-panel="estado">Cambiar estado</button>
        <button type="button" class="boton" data-panel="acuerdo">Acuerdo de pago</button>
        <button type="button" class="boton" data-panel="nota">Editar nota</button>
        <button type="button" class="boton" data-panel="corregir">Corregir o borrar</button>
      </div>

      <div class="tarjeta prestamo-panel oculto" id="panel-estado">
        <h2>Cambiar estado</h2>
        <p class="suave">Estado actual: ${ui.chipEstado(resultado.estado)}${prestamo.estadoManual ? ' (puesto a mano)' : ' (calculado)'}</p>
        <div class="botones prestamo-acciones">
          <button type="button" class="boton" data-estado="pagado">Marcar como pagado</button>
          <button type="button" class="boton" data-estado="perdido">Marcar como perdido (se voló)</button>
          <button type="button" class="boton" data-estado="congelado">Congelar</button>
          <button type="button" class="boton" data-estado="legal">En proceso legal</button>
          <button type="button" class="boton boton--secundario" data-estado="">Volver a activo</button>
        </div>
      </div>

      <div class="tarjeta prestamo-panel oculto" id="panel-acuerdo">
        <h2>Acuerdo de pago</h2>
        <p class="suave">Lo que el cliente prometió. Aparece en la agenda en su fecha.</p>
        <form id="form-acuerdo" novalidate>
          ${ui.campoFecha({ etiqueta: 'Fecha acordada', nombre: 'acuerdo_fecha', valor: prestamo.acuerdo ? prestamo.acuerdo.fecha : hoy, requerido: true })}
          ${ui.campo({ etiqueta: 'Qué acordaron', nombre: 'acuerdo_texto', valor: prestamo.acuerdo ? prestamo.acuerdo.texto : '', placeholder: 'Paga 300.000 el viernes' })}
          <div class="botones">
            <button type="submit" class="boton boton--primario">Guardar acuerdo</button>
            ${prestamo.acuerdo ? '<button type="button" class="boton boton--secundario" data-quitar-acuerdo>Quitar acuerdo</button>' : ''}
          </div>
        </form>
      </div>

      <div class="tarjeta prestamo-panel oculto" id="panel-nota">
        <h2>Editar nota</h2>
        <form id="form-nota" novalidate>
          ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea', valor: prestamo.nota })}
          ${ui.campo({ etiqueta: 'Garantía', nombre: 'garantia', valor: prestamo.garantia, placeholder: 'Moto a mi nombre, papel firmado...' })}
          ${ui.campo({ etiqueta: 'Plazo en meses (opcional)', nombre: 'plazoMeses', tipo: 'number', valor: prestamo.plazoMeses || '', atributos: { min: 1, step: 1 }, ayuda: 'Si pactaron devolver el capital en cierto tiempo' })}
          <button type="submit" class="boton boton--primario boton--grande">Guardar</button>
        </form>
      </div>

      <div class="tarjeta prestamo-panel oculto" id="panel-corregir">
        <h2>Corregir este préstamo</h2>
        <form id="form-corregir" novalidate>
          ${ui.campo({ etiqueta: 'Cliente', nombre: 'clienteId', tipo: 'select', valor: prestamo.clienteId, opciones: ctx.datos.listar('clientes').slice().sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')).map((c) => ({ valor: c.id, texto: nombreDe(c) })), ayuda: 'Si quedó a nombre de otra persona, elija aquí la correcta.' })}
          ${pagos.length ? '<p class="suave">Ya tiene pagos: la fecha y el capital no se pueden cambiar. Si hace falta, borre primero los pagos.</p>' : `
          ${ui.campo({ etiqueta: 'Fecha del préstamo', nombre: 'fecha', tipo: 'date', valor: prestamo.porConfirmar && prestamo.porConfirmar.fecha ? '' : prestamo.fecha, atributos: { max: hoy }, ayuda: prestamo.porConfirmar && prestamo.porConfirmar.fecha ? `Está por confirmar. En el Excel dice: ${prestamo.porConfirmar.fecha}` : '' })}
          ${ui.campo({ etiqueta: 'Capital prestado', nombre: 'capital', valor: ui.formatearDinero(prestamo.capital), atributos: { inputmode: 'numeric', autocomplete: 'off' } })}`}
          ${esMensual ? ui.campo({ etiqueta: 'Tasa (% mensual)', nombre: 'tasa', valor: prestamo.porConfirmar && prestamo.porConfirmar.tasa ? '' : String(prestamo.tasa).replace('.', ','), atributos: { inputmode: 'decimal', autocomplete: 'off', 'data-sin-puntos': '1' }, ayuda: prestamo.porConfirmar && prestamo.porConfirmar.tasa ? `Está por confirmar. En el Excel dice: ${prestamo.porConfirmar.tasa}` : 'Por ejemplo 10, 20 o 12,5' }) : ''}
          ${esMensual ? ui.campo({ etiqueta: '¿Hasta qué día tiene pagos los intereses?', nombre: 'interesesPagadosHasta', tipo: 'date', valor: prestamo.interesesPagadosHasta || '', atributos: { max: hoy }, ayuda: 'Desde ese día Fran empieza a contar los meses de interés. Si lo deja vacío, cuenta desde la fecha del préstamo.' }) : ''}
          <button type="submit" class="boton boton--primario boton--grande">Guardar corrección</button>
        </form>
        <button type="button" class="boton boton--peligro boton--grande prestamo-borrar" data-borrar-prestamo>Borrar este préstamo</button>
      </div>

      <section class="seccion">
        <h2 class="seccion__titulo">Datos del préstamo</h2>
        <div class="tarjeta"><dl class="prestamo-datos">${datosHtml}</dl></div>
      </section>

      <section class="seccion">
        <h2 class="seccion__titulo">Fotos y documentos</h2>
        <div class="tarjeta prestamo-fotos">
          <div class="prestamo-fotos__lista" data-fotos></div>
          <label class="boton boton--secundario prestamo-fotos__agregar">Agregar foto o documento<input type="file" accept="image/*" multiple data-agregar-foto></label>
          <p class="prestamo-fotos__aviso">Quedan guardadas en este aparato (no viajan a la nube).</p>
        </div>
      </section>

      <section class="seccion">
        <h2 class="seccion__titulo">Cuentas</h2>
        <div class="tarjeta"><dl class="prestamo-datos">${cuentasHtml}</dl></div>
      </section>

      ${esMensual ? `<section class="seccion">
        <h2 class="seccion__titulo">Mes a mes</h2>
        ${htmlTablaMesAMes(ctx, resultado)}
      </section>` : ''}

      <section class="seccion">
        <h2 class="seccion__titulo">Pagos</h2>
        ${htmlListaPagos(ctx, pagos)}
      </section>
    </div>
  `);
  contenedor.append(raiz);

  // Desde la lista "Por confirmar" se llega con el panel de corregir ya abierto.
  if (/[?&]corregir=1/.test(window.location.hash)) {
    const panel = raiz.querySelector('#panel-corregir');
    panel.classList.remove('oculto');
    setTimeout(() => panel.scrollIntoView({ block: 'start' }), 50);
  }

  // --- Fotos y documentos del préstamo (3.44.0): contrato firmado, prenda, comprobantes ---
  const claveFotos = `prestamo-fotos:${prestamo.id}`;
  const cajaFotos = raiz.querySelector('[data-fotos]');
  let fotos = [];
  const pintarFotos = () => {
    cajaFotos.innerHTML = fotos.length
      ? fotos.map((f, i) => `<figure><img src="${ui.esc(f.texto)}" alt="Foto ${i + 1}" data-ver-foto="${i}"><button type="button" class="prestamo-fotos__quitar" data-quitar-foto="${i}">Quitar</button></figure>`).join('')
      : '<p class="prestamo-fotos__vacio">Todavía no hay fotos de este préstamo.</p>';
  };
  leerFoto(claveFotos).then((lista) => { fotos = Array.isArray(lista) ? lista : []; pintarFotos(); }).catch(() => pintarFotos());
  raiz.querySelector('[data-agregar-foto]').addEventListener('change', async (evento) => {
    const archivos = [...evento.target.files];
    evento.target.value = '';
    try {
      for (const archivo of archivos) fotos.push({ texto: await reducirFoto(archivo, 1600), fecha: hoy });
      await guardarFoto(claveFotos, fotos);
      ui.toast(archivos.length === 1 ? 'Foto guardada' : 'Fotos guardadas');
    } catch (error) { ui.toast(`La foto no se pudo guardar: ${error.message}`); }
    pintarFotos();
  });
  cajaFotos.addEventListener('click', async (evento) => {
    const quitar = evento.target.closest('[data-quitar-foto]');
    if (quitar) {
      if (quitar.dataset.seguro !== 'si') { quitar.dataset.seguro = 'si'; quitar.textContent = '¿Quitar? Toque otra vez'; return; }
      fotos.splice(Number(quitar.dataset.quitarFoto), 1);
      try { await guardarFoto(claveFotos, fotos); } catch (error) { ui.toast(error.message); }
      pintarFotos();
      return;
    }
    const img = evento.target.closest('[data-ver-foto]');
    if (img) {
      const capa = ui.el(`<div class="prestamo-fotos__grande"><img src="${ui.esc(img.getAttribute('src'))}" alt="Foto en grande"></div>`);
      capa.addEventListener('click', () => capa.remove());
      document.body.append(capa);
    }
  });

  // --- Paneles que se abren y cierran ---
  raiz.addEventListener('click', async (evento) => {
    const botonPanel = evento.target.closest('[data-panel]');
    if (botonPanel) {
      const nombrePanel = botonPanel.dataset.panel;
      raiz.querySelectorAll('.prestamo-panel').forEach((panel) => {
        const esEste = panel.id === `panel-${nombrePanel}`;
        panel.classList.toggle('oculto', !esEste || !panel.classList.contains('oculto'));
      });
      const abierto = raiz.querySelector(`#panel-${nombrePanel}`);
      if (abierto && !abierto.classList.contains('oculto')) abierto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const botonEstado = evento.target.closest('[data-estado]');
    if (botonEstado) {
      await cambiarEstado(ctx, prestamo, botonEstado.dataset.estado);
      return;
    }

    const botonBorrar = evento.target.closest('[data-borrar-pago]');
    if (botonBorrar) {
      await borrarPago(ctx, prestamo, botonBorrar.dataset.borrarPago);
      return;
    }

    if (evento.target.closest('[data-quitar-acuerdo]')) {
      await guardarPrestamo(ctx, { id: prestamo.id, acuerdo: null }, 'Acuerdo quitado');
      return;
    }

    if (evento.target.closest('[data-borrar-prestamo]')) {
      const cuantos = pagos.length;
      const seguro = await ui.confirmar(
        `¿Borrar el préstamo de ${nombre} por ${pesos(ctx, prestamo.capital)}? ${cuantos ? `Se borran también sus ${cuantos === 1 ? 'pago' : `${cuantos} pagos`} y` : 'Se borran también'} sus movimientos de caja. No se puede deshacer.`,
        { aceptar: 'Sí, borrar', peligro: true },
      );
      if (!seguro) return;
      try {
        await ctx.datos.eliminarPrestamo(prestamo.id);
        await guardarFoto(`prestamo-fotos:${prestamo.id}`, []).catch(() => {});
        ui.toast('Préstamo borrado');
        ctx.navegar(`/cliente/${encodeURIComponent(prestamo.clienteId)}`);
      } catch (error) {
        ui.toast(error && error.message ? error.message : 'No se pudo borrar el préstamo.', 6000);
      }
    }
  });

  raiz.querySelector('#form-corregir').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(evento.target);
    const cambios = { id: prestamo.id };
    if (valores.clienteId && valores.clienteId !== prestamo.clienteId) cambios.clienteId = valores.clienteId;
    if (!pagos.length) {
      if (valores.fecha && valores.fecha !== prestamo.fecha) cambios.fecha = valores.fecha;
      const capital = ui.leerDinero(String(valores.capital || ''));
      if (!(capital > 0)) { ui.toast('Escriba el capital prestado.'); return; }
      if (capital !== prestamo.capital) cambios.capital = capital;
    }
    if (esMensual && String(valores.tasa || '').trim() !== '') {
      const tasa = Number(String(valores.tasa).replace(',', '.'));
      if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) { ui.toast('La tasa debe ser un número entre 0 y 100.'); return; }
      if (tasa !== prestamo.tasa) cambios.tasa = tasa;
      else if (prestamo.porConfirmar && prestamo.porConfirmar.tasa) {
        // Confirmó la misma tasa que ya estaba: deja de estar por confirmar.
        const { tasa: _confirmada, ...resto } = prestamo.porConfirmar;
        cambios.porConfirmar = Object.keys(resto).length ? resto : null;
      }
    }
    if (esMensual && (valores.interesesPagadosHasta || '') !== (prestamo.interesesPagadosHasta || '')) {
      const fechaBase = cambios.fecha || prestamo.fecha;
      if (valores.interesesPagadosHasta && valores.interesesPagadosHasta < fechaBase) { ui.toast('Esa fecha no puede ser anterior a la del préstamo.', 4000); return; }
      cambios.interesesPagadosHasta = valores.interesesPagadosHasta || null;
    }
    if (Object.keys(cambios).length === 1) { ui.toast('No cambió nada.'); return; }
    await guardarPrestamo(ctx, cambios, 'Préstamo corregido');
  });

  raiz.querySelector('#form-acuerdo').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(evento.target);
    if (!valores.acuerdo_fecha) {
      ui.toast('Escribe la fecha del acuerdo.');
      return;
    }
    await guardarPrestamo(ctx, {
      id: prestamo.id,
      acuerdo: { fecha: valores.acuerdo_fecha, texto: valores.acuerdo_texto || '' },
    }, 'Acuerdo guardado');
  });

  raiz.querySelector('#form-nota').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(evento.target);
    await guardarPrestamo(ctx, {
      id: prestamo.id,
      nota: valores.nota || '',
      garantia: valores.garantia || '',
      plazoMeses: enteroONulo(valores.plazoMeses),
    }, 'Nota guardada');
  });
}

/** Guarda cambios del préstamo con datos.actualizarPrestamo y vuelve a la ficha. */
async function guardarPrestamo(ctx, cambios, mensaje) {
  try {
    await ctx.datos.actualizarPrestamo(cambios);
    ctx.ui.toast(mensaje);
    ctx.navegar(`/prestamo/${encodeURIComponent(cambios.id)}`);
  } catch (error) {
    ctx.ui.toast(error && error.message ? error.message : 'No se pudo guardar el cambio.');
  }
}

const PREGUNTA_ESTADO = {
  pagado: '¿Marcar este préstamo como pagado? Dejará de causar intereses desde hoy.',
  perdido: '¿Marcar este préstamo como perdido (se voló)? Dejará de causar intereses desde hoy y su capital pasará a capital perdido.',
  congelado: '¿Congelar este préstamo? No causará intereses desde hoy.',
  legal: '¿Marcar este préstamo en proceso legal? Sigue causando intereses.',
  '': '¿Volver a dejar el préstamo activo? El estado se calculará solo con los pagos.',
};

async function cambiarEstado(ctx, prestamo, estado) {
  const { ui } = ctx;
  const pregunta = PREGUNTA_ESTADO[estado];
  if (pregunta === undefined) return;
  const peligro = estado === 'perdido';
  if (!(await ui.confirmar(pregunta, { aceptar: 'Sí', peligro }))) return;
  const hoy = ctx.hoy();
  // datos.js deja de causar periodos después de fechaEstado para perdido, congelado y pagado.
  await guardarPrestamo(ctx, {
    id: prestamo.id,
    estadoManual: estado || null,
    fechaEstado: estado ? hoy : null,
  }, estado ? `Estado cambiado a ${ui.textoEstado(estado).toLowerCase()}` : 'El préstamo vuelve a estar activo');
}

async function borrarPago(ctx, prestamo, pagoId) {
  const { ui, fechas, dinero } = ctx;
  const pago = ctx.datos.obtener('pagos', pagoId);
  if (!pago) {
    ui.toast('Ese pago ya no existe.');
    return;
  }
  const que = pago.tipo === 'perdon' ? 'el perdón' : 'el pago';
  const pregunta = `¿Borrar ${que} del ${fechas.formatear(pago.fecha)} por ${dinero.formatear(pago.monto)}? ${pago.tipo === 'perdon' ? '' : 'También se borra su movimiento de caja.'}`;
  if (!(await ui.confirmar(pregunta.trim(), { aceptar: 'Sí, borrar', peligro: true }))) return;
  try {
    await ctx.datos.eliminarPago(pagoId);
    ui.toast(pago.tipo === 'perdon' ? 'Perdón borrado' : 'Pago borrado');
    ctx.navegar(`/prestamo/${encodeURIComponent(prestamo.id)}`);
  } catch (error) {
    ui.toast(error && error.message ? error.message : 'No se pudo borrar el pago.');
  }
}

/* ----------------------------------------------------------------------- */
/* Nuevo préstamo                                                           */
/* ----------------------------------------------------------------------- */

/** HTML de una fila de fuente de la plata. */
function htmlFuente(ctx, indice, valores = {}) {
  const { ui } = ctx;
  const esPrimera = indice === 0;
  return `
    <div class="fuente" data-indice="${indice}">
      ${ui.campo({ etiqueta: esPrimera ? 'De dónde sale la plata' : 'Otra fuente', nombre: `fuente_origen_${indice}`, tipo: 'select', valor: valores.origen || 'caja_efectivo', opciones: OPCIONES_ORIGEN })}
      ${ui.campoDinero({ etiqueta: 'Monto de esta fuente', nombre: `fuente_monto_${indice}`, valor: valores.monto || '', placeholder: esPrimera ? 'Todo el capital' : '0', ayuda: esPrimera ? 'Si es la única fuente, déjalo vacío y se toma todo el capital' : '' })}
      ${ui.campo({ etiqueta: 'Nota de la fuente', nombre: `fuente_nota_${indice}`, valor: valores.nota || '', placeholder: 'Plata del arriendo de enero' })}
      ${esPrimera ? '' : '<button type="button" class="boton boton--pequeno boton--secundario" data-quitar-fuente>Quitar esta fuente</button>'}
    </div>
  `;
}

function renderNuevo(contenedor, params, ctx) {
  const { ui } = ctx;
  const clientes = ctx.datos.listar('clientes').sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const clienteInicial = ctx.datos.obtener('clientes', params.clienteId);
  if (!clienteInicial) {
    return noEncontrado(contenedor, ctx, 'No se encontró el cliente para este préstamo.', '#/clientes');
  }
  const hoy = ctx.hoy();
  const esFamilia = clienteInicial.tipo === 'familia';
  const modalidadInicial = esFamilia ? 'sin_interes' : 'interes_mensual';
  const atras = rutaCliente(clienteInicial.id);

  const opcionesClientes = clientes.map((c) => ({
    valor: c.id,
    texto: c.tipo === 'familia' ? `${c.nombre} (familia)` : c.nombre,
  }));

  const raiz = ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado('Nuevo préstamo', { atras })}
      <form class="formulario" id="form-prestamo" novalidate>
        ${ui.campo({ etiqueta: 'Cliente', nombre: 'clienteId', tipo: 'select', valor: clienteInicial.id, opciones: opcionesClientes, requerido: true })}
        ${ui.campoFecha({ etiqueta: 'Fecha en que entregó la plata', nombre: 'fecha', valor: hoy, requerido: true })}
        ${ui.campoDinero({ etiqueta: 'Capital', nombre: 'capital', requerido: true, ayuda: 'Puedes escribir 1.000.000, 1000000, 200k o 1.5M' })}

        ${ui.campo({ etiqueta: 'Modalidad', nombre: 'modalidad', tipo: 'select', valor: modalidadInicial, opciones: OPCIONES_MODALIDAD, ayuda: 'Interés mensual es la normal. Capital primero: lo pagado recupera primero el capital. Sin interés: familia.' })}

        <div id="caja-tasa" class="${modalidadInicial === 'sin_interes' ? 'oculto' : ''}">
          <div class="campo">
            <span class="campo__etiqueta">Tasa mensual</span>
            <div class="opciones" id="opciones-tasa">
              ${TASAS_RAPIDAS.map((t) => `<button type="button" class="opcion${t === 20 ? ' opcion--activa' : ''}" data-tasa="${t}" aria-pressed="${t === 20 ? 'true' : 'false'}">${t} %</button>`).join('')}
              <button type="button" class="opcion" data-tasa="otra" aria-pressed="false">Otra</button>
            </div>
          </div>
          ${ui.campo({ etiqueta: 'Tasa en % sobre el capital pendiente', nombre: 'tasa', tipo: 'number', valor: esFamilia ? 0 : 20, atributos: { min: 0, step: '0.5' } })}
        </div>

        <div id="caja-total-pactado" class="${modalidadInicial === 'capital_primero' ? '' : 'oculto'}">
          ${ui.campoDinero({ etiqueta: 'Total pactado con el cliente', nombre: 'totalPactado', ayuda: 'Todo lo que el cliente va a pagar en total, capital incluido' })}
        </div>

        ${ui.campo({ etiqueta: 'Plazo en meses (opcional)', nombre: 'plazoMeses', tipo: 'number', atributos: { min: 1, step: 1 }, ayuda: 'Si pactaron devolver el capital en cierto tiempo' })}

        <div id="caja-tope" class="${modalidadInicial === 'interes_mensual' ? '' : 'oculto'}">
          ${ui.campoDinero({ etiqueta: 'Tope de intereses (opcional)', nombre: 'topeInteres', ayuda: 'Si acordaron que los intereses no pasan de cierta suma' })}
        </div>

        ${ui.campo({ etiqueta: 'Por dónde entregó la plata', nombre: 'medio', tipo: 'select', valor: 'efectivo', opciones: OPCIONES_MEDIO_PRESTAMO })}

        <section class="seccion">
          <h2 class="seccion__titulo">Fuentes de la plata</h2>
          <div id="fuentes">${htmlFuente(ctx, 0, { origen: 'caja_efectivo' })}</div>
          <p class="suave" id="fuentes-suma"></p>
          <button type="button" class="boton boton--secundario" id="agregar-fuente">Agregar otra fuente</button>
        </section>

        ${ui.campo({ etiqueta: 'Garantía', nombre: 'garantia', placeholder: 'Moto a mi nombre, papel firmado...' })}
        ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea' })}

        <button type="submit" class="boton boton--primario boton--grande" id="boton-guardar">Guardar préstamo</button>
      </form>
    </div>
  `);
  contenedor.append(raiz);

  const form = raiz.querySelector('#form-prestamo');
  const contenedorFuentes = raiz.querySelector('#fuentes');
  const textoSuma = raiz.querySelector('#fuentes-suma');
  let contadorFuentes = 1;

  function filasFuentes() {
    return Array.from(contenedorFuentes.querySelectorAll('.fuente'));
  }

  /** Lee las fuentes del formulario. Si hay una sola sin monto, toma todo el capital. */
  function leerFuentes(valores) {
    const filas = filasFuentes();
    const fuentes = filas.map((fila) => {
      const i = fila.dataset.indice;
      return {
        origen: valores[`fuente_origen_${i}`],
        monto: Number(valores[`fuente_monto_${i}`]) || 0,
        nota: valores[`fuente_nota_${i}`] || '',
      };
    });
    if (fuentes.length === 1 && fuentes[0].monto === 0) fuentes[0].monto = Number(valores.capital) || 0;
    return fuentes;
  }

  function actualizarSuma() {
    const valores = ui.leerFormulario(form);
    const capital = Number(valores.capital) || 0;
    const fuentes = leerFuentes(valores);
    const suma = fuentes.reduce((total, f) => total + f.monto, 0);
    if (!capital) {
      textoSuma.textContent = '';
      textoSuma.classList.remove('prestamo-error');
      return;
    }
    const cuadra = suma === capital;
    textoSuma.textContent = cuadra
      ? `Las fuentes suman ${ctx.dinero.formatear(suma)}, igual al capital.`
      : `Las fuentes suman ${ctx.dinero.formatear(suma)} y el capital es ${ctx.dinero.formatear(capital)}. Deben ser iguales.`;
    textoSuma.classList.toggle('prestamo-error', !cuadra);
  }

  function marcarTasa(valor) {
    raiz.querySelectorAll('[data-tasa]').forEach((boton) => {
      const activa = boton.dataset.tasa !== 'otra' && Number(boton.dataset.tasa) === Number(valor);
      boton.classList.toggle('opcion--activa', activa);
      boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
    });
  }

  function aplicarModalidad(modalidad) {
    raiz.querySelector('#caja-tasa').classList.toggle('oculto', modalidad === 'sin_interes');
    raiz.querySelector('#caja-total-pactado').classList.toggle('oculto', modalidad !== 'capital_primero');
    raiz.querySelector('#caja-tope').classList.toggle('oculto', modalidad !== 'interes_mensual');
    if (modalidad === 'sin_interes') {
      form.elements.tasa.value = '0';
      marcarTasa(0);
    }
  }

  // Botones de tasa
  raiz.querySelector('#opciones-tasa').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-tasa]');
    if (!boton) return;
    const entradaTasa = form.elements.tasa;
    if (boton.dataset.tasa === 'otra') {
      marcarTasa(null);
      entradaTasa.focus();
      entradaTasa.select();
      return;
    }
    entradaTasa.value = boton.dataset.tasa;
    marcarTasa(boton.dataset.tasa);
  });

  // Fuentes
  raiz.querySelector('#agregar-fuente').addEventListener('click', () => {
    const indice = contadorFuentes++;
    contenedorFuentes.append(ui.el(htmlFuente(ctx, indice)));
    actualizarSuma();
  });

  contenedorFuentes.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-quitar-fuente]');
    if (!boton) return;
    const fila = boton.closest('.fuente');
    if (fila) fila.remove();
    actualizarSuma();
  });

  // Cambios en el formulario
  form.addEventListener('change', (evento) => {
    const nombre = evento.target.name;
    if (nombre === 'clienteId') {
      const cliente = ctx.datos.obtener('clientes', evento.target.value);
      if (cliente && cliente.tipo === 'familia') {
        form.elements.modalidad.value = 'sin_interes';
        aplicarModalidad('sin_interes');
      } else if (cliente && form.elements.modalidad.value === 'sin_interes') {
        // Al pasar de familia a un cliente normal vuelve a interés mensual al 20 %.
        form.elements.modalidad.value = 'interes_mensual';
        form.elements.tasa.value = '20';
        marcarTasa(20);
        aplicarModalidad('interes_mensual');
      }
    } else if (nombre === 'modalidad') {
      aplicarModalidad(evento.target.value);
    } else if (nombre === 'medio') {
      // La primera fuente sigue a la caja del medio si todavía es una caja.
      const primera = form.elements.fuente_origen_0;
      if (primera && (primera.value === 'caja_efectivo' || primera.value === 'caja_virtual')) {
        primera.value = `caja_${evento.target.value}`;
      }
    }
  });

  form.addEventListener('input', (evento) => {
    if (evento.target.name === 'tasa') marcarTasa(evento.target.value);
    if (evento.target.name === 'capital' || String(evento.target.name).startsWith('fuente_monto_')) actualizarSuma();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(form);
    const modalidad = valores.modalidad;
    const capital = Number(valores.capital) || 0;

    if (!valores.clienteId) return ui.toast('Elige el cliente.');
    if (!valores.fecha) return ui.toast('Escribe la fecha del préstamo.');
    if (capital <= 0) return ui.toast('Escribe el capital que prestó.');
    if (modalidad !== 'sin_interes' && (valores.tasa === null || valores.tasa === undefined || valores.tasa === '')) {
      return ui.toast('Escribe la tasa mensual.');
    }

    const fuentes = leerFuentes(valores);
    const sumaFuentes = fuentes.reduce((total, f) => total + f.monto, 0);
    if (sumaFuentes !== capital) {
      return ui.toast(`Las fuentes suman ${ctx.dinero.formatear(sumaFuentes)} y el capital es ${ctx.dinero.formatear(capital)}. Deben ser iguales.`);
    }

    const prestamo = {
      clienteId: valores.clienteId,
      fecha: valores.fecha,
      capital,
      tasa: modalidad === 'sin_interes' ? 0 : Number(valores.tasa),
      modalidad,
      totalPactado: modalidad === 'capital_primero' ? enteroONulo(valores.totalPactado) : null,
      plazoMeses: enteroONulo(valores.plazoMeses),
      topeInteres: modalidad === 'interes_mensual' ? enteroONulo(valores.topeInteres) : null,
      medio: valores.medio,
      fuentes,
      garantia: valores.garantia || '',
      nota: valores.nota || '',
    };

    const botonGuardar = raiz.querySelector('#boton-guardar');
    botonGuardar.disabled = true;
    try {
      const creado = await ctx.datos.crearPrestamo(prestamo);
      ui.toast('Préstamo guardado');
      ctx.navegar(`/prestamo/${encodeURIComponent(creado.id)}`);
    } catch (error) {
      botonGuardar.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el préstamo.');
    }
  });

  actualizarSuma();
}

/* ----------------------------------------------------------------------- */
/* Registrar pago de un préstamo                                            */
/* ----------------------------------------------------------------------- */

/** Tarjeta con el estado actual del préstamo, común a pago y perdón. */
function htmlCabeceraPrestamo(ctx, carga) {
  const { ui } = ctx;
  const { prestamo, cliente, resultado } = carga;
  const esMensual = resultado.modalidad === 'interes_mensual';
  const cerrado = ESTADOS_CERRADOS.includes(resultado.estado);
  return `
    <div class="tarjeta">
      <p class="negrita sin-margen">${ui.esc(nombreDe(cliente))}</p>
      <p class="suave">${tituloCortoPrestamo(ctx, prestamo)}</p>
      <dl class="prestamo-datos">
        ${filaDato('Capital pendiente', ui.esc(pesos(ctx, resultado.capitalPendiente)))}
        ${esMensual ? filaDato('Intereses pendientes', ui.esc(pesos(ctx, resultado.interesPendiente))) : ''}
        ${esMensual && resultado.mesesAtrasados > 0 ? filaDato('Meses de atraso', ui.esc(String(resultado.mesesAtrasados))) : ''}
        ${resultado.interesCorrido > 0 ? filaDato(`Intereses de ${resultado.diasCorridos} ${resultado.diasCorridos === 1 ? 'día' : 'días'}`, ui.esc(pesos(ctx, resultado.interesCorrido))) : ''}
        ${filaDato('Debe hoy', ui.esc(pesos(ctx, resultado.debeHoy)))}
        ${filaDato('Estado', ui.chipEstado(resultado.estado))}
      </dl>
      ${cerrado ? `<p class="prestamo-previa__aviso">Este préstamo está marcado como ${ui.esc(ui.textoEstado(resultado.estado).toLowerCase())}. Puedes registrar el pago igual, pero revisa el estado en la ficha.</p>` : ''}
    </div>
  `;
}

function renderPago(contenedor, params, ctx) {
  const { ui } = ctx;
  const carga = cargarPrestamo(ctx, params.id);
  if (!carga) return noEncontrado(contenedor, ctx, 'No se encontró este préstamo.', '#/clientes');

  const { prestamo, pagos, resultado } = carga;
  const hoy = ctx.hoy();
  const rutaFicha = rutaPrestamo(prestamo.id);
  const esMensual = prestamo.modalidad === 'interes_mensual';

  let explicacionReparto = '';
  if (prestamo.modalidad === 'capital_primero') {
    explicacionReparto = '<p class="suave">En capital primero todo lo pagado recupera primero el capital y después es ganancia. El reparto lo hace la app.</p>';
  } else if (prestamo.modalidad === 'sin_interes') {
    explicacionReparto = '<p class="suave">Préstamo sin interés: todo el pago abona a la deuda.</p>';
  }

  const raiz = ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado('Registrar pago', { atras: rutaFicha })}
      ${htmlCabeceraPrestamo(ctx, carga)}
      <form class="formulario" id="form-pago" novalidate>
        ${ui.campoFecha({ etiqueta: 'Fecha del pago', nombre: 'fecha', valor: hoy, requerido: true })}
        ${ui.campoDinero({ etiqueta: 'Monto recibido', nombre: 'monto', requerido: true, ayuda: 'Todo lo que el cliente entregó' })}

        ${esMensual ? `
        <div class="reparto">
          <span class="campo__etiqueta">Reparto del pago</span>
          <div class="opciones">
            <button type="button" class="opcion" data-reparto="interes">Todo interés</button>
            <button type="button" class="opcion" data-reparto="capital">Todo capital</button>
            <button type="button" class="opcion" data-reparto="sugerir">Sugerencia</button>
          </div>
          <div class="reparto__campos">
            ${ui.campoDinero({ etiqueta: 'Interés', nombre: 'interes', valor: 0 })}
            ${ui.campoDinero({ etiqueta: 'Abono a capital', nombre: 'capital', valor: 0 })}
          </div>
          <p class="suave" id="reparto-aviso"></p>
        </div>` : explicacionReparto}

        ${ui.campo({ etiqueta: 'Medio', nombre: 'medio', tipo: 'select', valor: 'efectivo', opciones: OPCIONES_MEDIO_PAGO })}
        <div id="caja-descripcion" class="oculto">
          ${ui.campo({ etiqueta: 'Qué recibió', nombre: 'descripcion', placeholder: 'Cicla, lechonas, pantallas, comida...' })}
        </div>
        ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea' })}

        <div class="tarjeta prestamo-previa" id="previa"></div>

        <button type="submit" class="boton boton--primario boton--grande" id="boton-guardar">Guardar pago</button>
      </form>
    </div>
  `);
  contenedor.append(raiz);

  const form = raiz.querySelector('#form-pago');
  const previa = raiz.querySelector('#previa');
  const avisoReparto = raiz.querySelector('#reparto-aviso');
  const entradaMonto = form.elements.monto;
  const entradaInteres = form.elements.interes;
  const entradaCapital = form.elements.capital;

  function leer() {
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    let interes;
    let capital;
    if (esMensual) {
      interes = Number(valores.interes) || 0;
      capital = Number(valores.capital) || 0;
    } else {
      interes = 0;
      capital = monto;
    }
    return { ...valores, monto, interes, capital };
  }

  /** Sugerencia del motor para este préstamo solo. Recibe la fecha del pago para contar el interés del mes. */
  function sugerir(monto) {
    const fechaPago = ui.leerFormulario(form).fecha || hoy;
    const { reparto } = ctx.motor.repartirPagoCliente([resultado], monto, fechaPago);
    const parte = reparto.find((p) => p.prestamoId === prestamo.id) || { interes: 0, capital: 0 };
    fijarDinero(entradaInteres, parte.interes);
    fijarDinero(entradaCapital, parte.capital);
  }

  function actualizarPrevia() {
    const valores = leer();
    if (valores.monto <= 0) {
      previa.innerHTML = '<p class="suave sin-margen">Escribe el monto para ver cómo quedaría el préstamo.</p>';
      if (avisoReparto) avisoReparto.textContent = '';
      return;
    }
    if (avisoReparto) {
      const diferencia = valores.monto - (valores.interes + valores.capital);
      if (diferencia === 0) {
        avisoReparto.textContent = '';
        avisoReparto.classList.remove('prestamo-error');
      } else {
        avisoReparto.textContent = diferencia > 0
          ? `Faltan ${ctx.dinero.formatear(diferencia)} por repartir entre interés y capital.`
          : `Interés más capital se pasan por ${ctx.dinero.formatear(-diferencia)} del monto.`;
        avisoReparto.classList.add('prestamo-error');
      }
    }
    const simulado = {
      id: 'simulado',
      prestamoId: prestamo.id,
      clienteId: prestamo.clienteId,
      fecha: valores.fecha || hoy,
      tipo: 'pago',
      monto: valores.monto,
      interes: valores.interes,
      capital: valores.capital,
      medio: valores.medio,
      creadoEn: hoy,
    };
    try {
      const despues = ctx.motor.calcularPrestamo(prestamo, [...pagos, simulado], hoy);
      previa.innerHTML = htmlPrevia(ctx, resultado, despues, 'pagado');
    } catch (error) {
      previa.innerHTML = `<p class="prestamo-previa__aviso">${ui.esc(error && error.message ? error.message : 'No se pudo calcular.')}</p>`;
    }
  }

  raiz.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-reparto]');
    if (!boton) return;
    const monto = Number(ui.leerFormulario(form).monto) || 0;
    if (boton.dataset.reparto === 'interes') {
      fijarDinero(entradaInteres, monto);
      fijarDinero(entradaCapital, 0);
    } else if (boton.dataset.reparto === 'capital') {
      fijarDinero(entradaInteres, 0);
      fijarDinero(entradaCapital, monto);
    } else {
      sugerir(monto);
    }
    actualizarPrevia();
  });

  form.addEventListener('input', (evento) => {
    const nombre = evento.target.name;
    if (esMensual) {
      const monto = Number(ui.leerFormulario(form).monto) || 0;
      if (nombre === 'monto') {
        sugerir(monto);
      } else if (nombre === 'interes') {
        const interes = ui.leerDinero(entradaInteres.value);
        fijarDinero(entradaCapital, Math.max(0, monto - interes));
      } else if (nombre === 'capital') {
        const capital = ui.leerDinero(entradaCapital.value);
        fijarDinero(entradaInteres, Math.max(0, monto - capital));
      }
    }
    actualizarPrevia();
  });

  form.addEventListener('change', (evento) => {
    if (evento.target.name === 'medio') {
      raiz.querySelector('#caja-descripcion').classList.toggle('oculto', evento.target.value !== 'especie');
    }
    actualizarPrevia();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = leer();
    if (!valores.fecha) return ui.toast('Escribe la fecha del pago.');
    if (valores.monto <= 0) return ui.toast('Escribe el monto del pago.');
    if (valores.interes + valores.capital !== valores.monto) {
      return ui.toast('Interés más abono a capital deben sumar el monto del pago.');
    }
    if (valores.medio === 'especie' && !valores.descripcion) return ui.toast('Escribe qué recibió en especie.');

    const pago = {
      prestamoId: prestamo.id,
      fecha: valores.fecha,
      monto: valores.monto,
      interes: valores.interes,
      capital: valores.capital,
      medio: valores.medio,
      descripcion: valores.descripcion || '',
      nota: valores.nota || '',
    };

    const botonGuardar = raiz.querySelector('#boton-guardar');
    botonGuardar.disabled = true;
    try {
      await ctx.datos.registrarPago(pago);
      ui.toast('Pago guardado');
      ctx.navegar(`/prestamo/${encodeURIComponent(prestamo.id)}`);
    } catch (error) {
      botonGuardar.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el pago.');
    }
  });

  actualizarPrevia();
  entradaMonto.focus();
}

/* ----------------------------------------------------------------------- */
/* Perdonar intereses                                                       */
/* ----------------------------------------------------------------------- */

function renderPerdon(contenedor, params, ctx) {
  const { ui } = ctx;
  const carga = cargarPrestamo(ctx, params.id);
  if (!carga) return noEncontrado(contenedor, ctx, 'No se encontró este préstamo.', '#/clientes');

  const { prestamo, pagos, resultado } = carga;
  const rutaFicha = rutaPrestamo(prestamo.id);
  if (prestamo.modalidad !== 'interes_mensual') {
    return noEncontrado(contenedor, ctx, 'Solo se pueden perdonar intereses en préstamos con interés mensual.', rutaFicha);
  }
  const hoy = ctx.hoy();

  const raiz = ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado('Perdonar intereses', { atras: rutaFicha })}
      ${htmlCabeceraPrestamo(ctx, carga)}
      <p class="suave">Un perdón rebaja intereses pendientes. No entra plata ni mueve la caja.</p>
      <form class="formulario" id="form-perdon" novalidate>
        ${ui.campoFecha({ etiqueta: 'Fecha del perdón', nombre: 'fecha', valor: hoy, requerido: true, ayuda: 'Se aplica primero al mes de esta fecha y luego al más antiguo' })}
        ${ui.campoDinero({ etiqueta: 'Intereses que perdona', nombre: 'monto', requerido: true })}
        <div class="opciones">
          <button type="button" class="opcion" data-perdon="todo">Todo lo pendiente (${ui.esc(ctx.dinero.formatear(resultado.interesPendiente))})</button>
        </div>
        ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea', placeholder: 'Por qué le rebajó' })}
        <div class="tarjeta prestamo-previa" id="previa"></div>
        <button type="submit" class="boton boton--primario boton--grande" id="boton-guardar">Guardar perdón</button>
      </form>
    </div>
  `);
  contenedor.append(raiz);

  const form = raiz.querySelector('#form-perdon');
  const previa = raiz.querySelector('#previa');

  function actualizarPrevia() {
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    if (monto <= 0) {
      previa.innerHTML = '<p class="suave sin-margen">Escribe el monto para ver cómo quedaría el préstamo.</p>';
      return;
    }
    const simulado = {
      id: 'simulado',
      prestamoId: prestamo.id,
      clienteId: prestamo.clienteId,
      fecha: valores.fecha || hoy,
      tipo: 'perdon',
      monto,
      interes: monto,
      capital: 0,
      medio: null,
      creadoEn: hoy,
    };
    try {
      const despues = ctx.motor.calcularPrestamo(prestamo, [...pagos, simulado], hoy);
      previa.innerHTML = htmlPrevia(ctx, resultado, despues, 'perdonado');
    } catch (error) {
      previa.innerHTML = `<p class="prestamo-previa__aviso">${ui.esc(error && error.message ? error.message : 'No se pudo calcular.')}</p>`;
    }
  }

  raiz.querySelector('[data-perdon="todo"]').addEventListener('click', () => {
    fijarDinero(form.elements.monto, resultado.interesPendiente);
    actualizarPrevia();
  });
  form.addEventListener('input', actualizarPrevia);
  form.addEventListener('change', actualizarPrevia);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    if (!valores.fecha) return ui.toast('Escribe la fecha del perdón.');
    if (monto <= 0) return ui.toast('Escribe cuántos intereses perdona.');
    if (monto > resultado.interesPendiente) {
      const sigue = await ui.confirmar(
        `Perdonas ${ctx.dinero.formatear(monto)} pero solo hay ${ctx.dinero.formatear(resultado.interesPendiente)} de intereses pendientes. ¿Guardar igual?`,
        { aceptar: 'Sí, guardar' },
      );
      if (!sigue) return;
    }

    const botonGuardar = raiz.querySelector('#boton-guardar');
    botonGuardar.disabled = true;
    try {
      await ctx.datos.registrarPerdon({ prestamoId: prestamo.id, fecha: valores.fecha, monto, nota: valores.nota || '' });
      ui.toast('Perdón guardado');
      ctx.navegar(`/prestamo/${encodeURIComponent(prestamo.id)}`);
    } catch (error) {
      botonGuardar.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el perdón.');
    }
  });

  actualizarPrevia();
  form.elements.monto.focus();
}

/* ----------------------------------------------------------------------- */
/* Pago de un cliente repartido entre sus préstamos                         */
/* ----------------------------------------------------------------------- */

function renderPagoCliente(contenedor, params, ctx) {
  const { ui, fechas } = ctx;
  const clienteId = params.clienteId;
  const cliente = ctx.datos.obtener('clientes', clienteId);
  if (!cliente) return noEncontrado(contenedor, ctx, 'No se encontró este cliente.', '#/clientes');

  const hoy = ctx.hoy();
  const atras = rutaCliente(cliente.id);

  // Solo préstamos activos, del más antiguo al más nuevo.
  const partes = ctx.datos.listar('prestamos', { clienteId: cliente.id })
    .map((prestamo) => {
      const pagos = ctx.datos.listar('pagos', { prestamoId: prestamo.id });
      return { prestamo, pagos, resultado: ctx.motor.calcularPrestamo(prestamo, pagos, hoy) };
    })
    .filter((parte) => !ESTADOS_CERRADOS.includes(parte.resultado.estado))
    .sort((a, b) => fechas.comparar(a.prestamo.fecha, b.prestamo.fecha));

  if (!partes.length) {
    contenedor.append(ui.el(`
      <div class="pantalla-prestamo">
        ${ui.encabezado(`Pago de ${cliente.nombre}`, { atras })}
        ${ui.vacio('Este cliente no tiene préstamos activos.')}
        <a href="#/prestamo/nuevo/${encodeURIComponent(cliente.id)}" class="boton boton--primario boton--grande">Nuevo préstamo</a>
      </div>
    `));
    return;
  }

  const deudaTotal = partes.reduce((total, p) => total + p.resultado.debeHoy, 0);
  const corridoTotal = partes.reduce((total, p) => total + p.resultado.interesCorrido, 0);
  const interesTotal = partes.reduce((total, p) => total + p.resultado.interesPendiente, 0);
  const capitalTotal = partes.reduce((total, p) => total + p.resultado.capitalPendiente, 0);

  const bloquesHtml = partes.map((parte, indice) => {
    const { prestamo, resultado } = parte;
    const esMensual = prestamo.modalidad === 'interes_mensual';
    return `
      <div class="tarjeta prestamo-parte" data-indice="${indice}">
        <p class="negrita sin-margen"><a href="${rutaPrestamo(prestamo.id)}">${tituloCortoPrestamo(ctx, prestamo)}</a></p>
        <p class="suave">${ui.chipEstado(resultado.estado)} Debe hoy ${ui.esc(ctx.dinero.formatear(resultado.debeHoy))}${esMensual ? ` · intereses ${ui.esc(ctx.dinero.formatear(resultado.interesPendiente + resultado.interesCorrido))} · capital ${ui.esc(ctx.dinero.formatear(resultado.capitalPendiente))}` : ''}</p>
        ${resultado.interesCorrido > 0 ? `<p class="prestamo-corrido">${ui.esc(textoCorrido(ctx, resultado))}</p>` : ''}
        <div class="reparto__campos">
          ${esMensual ? ui.campoDinero({ etiqueta: 'Interés', nombre: `interes_${indice}`, valor: 0 }) : ''}
          ${ui.campoDinero({ etiqueta: esMensual ? 'Abono a capital' : 'Abono', nombre: `capital_${indice}`, valor: 0 })}
        </div>
        <div class="prestamo-parte__previa suave" id="previa-${indice}"></div>
      </div>
    `;
  }).join('');

  const raiz = ui.el(`
    <div class="pantalla-prestamo">
      ${ui.encabezado(`Pago de ${cliente.nombre}`, { atras })}
      <div class="tarjeta">
        <dl class="prestamo-datos">
          ${filaDato('Préstamos activos', ui.esc(String(partes.length)))}
          ${filaDato('Capital pendiente', ui.esc(pesos(ctx, capitalTotal)))}
          ${filaDato('Intereses de meses cumplidos', ui.esc(pesos(ctx, interesTotal)))}
          ${filaDato('Intereses de estos días', ui.esc(pesos(ctx, corridoTotal)))}
          ${filaDato('Debe hoy', ui.esc(pesos(ctx, deudaTotal)))}
        </dl>
      </div>
      <form class="formulario" id="form-pago-cliente" novalidate>
        ${ui.campoFecha({ etiqueta: 'Fecha del pago', nombre: 'fecha', valor: hoy, requerido: true })}
        ${ui.campoDinero({ etiqueta: 'Monto recibido en total', nombre: 'monto', requerido: true, ayuda: 'La app sugiere cómo repartirlo; puedes cambiarlo' })}
        ${ui.campo({ etiqueta: 'Medio', nombre: 'medio', tipo: 'select', valor: 'efectivo', opciones: OPCIONES_MEDIO_PAGO })}
        <div id="caja-descripcion" class="oculto">
          ${ui.campo({ etiqueta: 'Qué recibió', nombre: 'descripcion', placeholder: 'Cicla, lechonas, comida...' })}
        </div>
        ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea' })}

        <section class="seccion">
          <h2 class="seccion__titulo">Reparto entre préstamos</h2>
          <div class="opciones margen-abajo">
            <button type="button" class="opcion" id="boton-sugerir">Sugerencia de la app</button>
          </div>
          ${bloquesHtml}
          <p id="reparto-total" class="negrita"></p>
        </section>

        <button type="submit" class="boton boton--primario boton--grande" id="boton-guardar">Guardar pagos</button>
      </form>
    </div>
  `);
  contenedor.append(raiz);

  const form = raiz.querySelector('#form-pago-cliente');
  const textoTotal = raiz.querySelector('#reparto-total');

  function entradaDe(nombre) {
    return form.elements[nombre] || null;
  }

  /** Lee el reparto escrito: una entrada por préstamo. */
  function leerReparto(valores) {
    return partes.map((parte, indice) => {
      const esMensual = parte.prestamo.modalidad === 'interes_mensual';
      const interes = esMensual ? (Number(valores[`interes_${indice}`]) || 0) : 0;
      const capital = Number(valores[`capital_${indice}`]) || 0;
      return { parte, indice, interes, capital, monto: interes + capital };
    });
  }

  function sugerir() {
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    // La fecha del pago define cuál es el interés "del mes" en la sugerencia.
    const { reparto, sobrante } = ctx.motor.repartirPagoCliente(partes.map((p) => p.resultado), monto, valores.fecha || hoy);
    partes.forEach((parte, indice) => {
      const sugerido = reparto.find((r) => r.prestamoId === parte.prestamo.id) || { interes: 0, capital: 0 };
      const esMensual = parte.prestamo.modalidad === 'interes_mensual';
      if (esMensual) {
        fijarDinero(entradaDe(`interes_${indice}`), sugerido.interes);
        fijarDinero(entradaDe(`capital_${indice}`), sugerido.capital);
      } else {
        // En capital primero y sin interés el motor lo cuenta todo como capital.
        fijarDinero(entradaDe(`capital_${indice}`), sugerido.interes + sugerido.capital);
      }
    });
    if (sobrante > 0) {
      ui.toast(`Sobran ${ctx.dinero.formatear(sobrante)}: el cliente pagó más de lo que debe. Repártelos a mano si quieres.`);
    }
  }

  function actualizarTotales() {
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    const reparto = leerReparto(valores);
    const repartido = reparto.reduce((total, r) => total + r.monto, 0);

    if (monto <= 0) {
      textoTotal.textContent = 'Escribe el monto total para repartirlo.';
      textoTotal.classList.remove('prestamo-error');
    } else if (repartido === monto) {
      textoTotal.textContent = `Repartido ${ctx.dinero.formatear(repartido)} de ${ctx.dinero.formatear(monto)}. Cuadra.`;
      textoTotal.classList.remove('prestamo-error');
    } else {
      const diferencia = monto - repartido;
      textoTotal.textContent = diferencia > 0
        ? `Repartido ${ctx.dinero.formatear(repartido)} de ${ctx.dinero.formatear(monto)}. Faltan ${ctx.dinero.formatear(diferencia)}.`
        : `Repartido ${ctx.dinero.formatear(repartido)} de ${ctx.dinero.formatear(monto)}. Sobran ${ctx.dinero.formatear(-diferencia)}.`;
      textoTotal.classList.add('prestamo-error');
    }

    // Vista previa por préstamo: qué quedaría pendiente.
    for (const r of reparto) {
      const previa = raiz.querySelector(`#previa-${r.indice}`);
      if (!previa) continue;
      if (r.monto <= 0) {
        previa.textContent = '';
        continue;
      }
      const simulado = {
        id: `simulado-${r.indice}`,
        prestamoId: r.parte.prestamo.id,
        clienteId: cliente.id,
        fecha: valores.fecha || hoy,
        tipo: 'pago',
        monto: r.monto,
        interes: r.interes,
        capital: r.capital,
        medio: valores.medio,
        creadoEn: hoy,
      };
      try {
        const despues = ctx.motor.calcularPrestamo(r.parte.prestamo, [...r.parte.pagos, simulado], hoy);
        const esMensual = r.parte.prestamo.modalidad === 'interes_mensual';
        let texto = `Quedaría debiendo ${ctx.dinero.formatear(despues.deudaCliente)}`;
        if (esMensual) texto += ` (intereses ${ctx.dinero.formatear(despues.interesPendiente)}, capital ${ctx.dinero.formatear(despues.capitalPendiente)})`;
        texto += ` · ${ui.textoEstado(despues.estado)}`;
        if (despues.advertencias.length) texto += `. ${despues.advertencias.join(' ')}`;
        previa.textContent = texto;
      } catch (error) {
        previa.textContent = error && error.message ? error.message : 'No se pudo calcular.';
      }
    }
  }

  raiz.querySelector('#boton-sugerir').addEventListener('click', () => {
    sugerir();
    actualizarTotales();
  });

  form.addEventListener('input', (evento) => {
    if (evento.target.name === 'monto') sugerir();
    actualizarTotales();
  });

  form.addEventListener('change', (evento) => {
    if (evento.target.name === 'medio') {
      raiz.querySelector('#caja-descripcion').classList.toggle('oculto', evento.target.value !== 'especie');
    }
    actualizarTotales();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(form);
    const monto = Number(valores.monto) || 0;
    const reparto = leerReparto(valores).filter((r) => r.monto > 0);
    const repartido = reparto.reduce((total, r) => total + r.monto, 0);

    if (!valores.fecha) return ui.toast('Escribe la fecha del pago.');
    if (monto <= 0) return ui.toast('Escribe el monto total del pago.');
    if (repartido !== monto) return ui.toast('El reparto entre préstamos debe sumar el monto total.');
    if (valores.medio === 'especie' && !valores.descripcion) return ui.toast('Escribe qué recibió en especie.');

    const botonGuardar = raiz.querySelector('#boton-guardar');
    botonGuardar.disabled = true;
    let guardados = 0;
    try {
      // Un pago por préstamo, todos con la misma fecha, medio y nota.
      for (const r of reparto) {
        await ctx.datos.registrarPago({
          prestamoId: r.parte.prestamo.id,
          fecha: valores.fecha,
          monto: r.monto,
          interes: r.interes,
          capital: r.capital,
          medio: valores.medio,
          descripcion: valores.descripcion || '',
          nota: valores.nota || '',
        });
        guardados++;
      }
      ui.toast(guardados === 1 ? 'Pago guardado' : `${guardados} pagos guardados`);
      ctx.navegar(`/cliente/${encodeURIComponent(cliente.id)}`);
    } catch (error) {
      botonGuardar.disabled = false;
      const mensaje = error && error.message ? error.message : 'No se pudo guardar el pago.';
      ui.toast(guardados > 0 ? `Se guardaron ${guardados} de ${reparto.length} pagos. ${mensaje}` : mensaje, 5000);
      if (guardados > 0) ctx.navegar(`/cliente/${encodeURIComponent(cliente.id)}`);
    }
  });

  actualizarTotales();
  form.elements.monto.focus();
}
