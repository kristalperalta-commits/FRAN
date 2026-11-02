/*
  agenda.js — pantalla Agenda (ruta #/agenda).
  Sección 8 de la especificación: cobros por fecha, atrasados y acuerdos de pago.

  Secciones: atrasados (ordenados por meses de atraso), hoy, esta semana,
  próximos 30 días y acuerdos de pago. Cada línea trae cliente, monto, motivo,
  botón "Registrar pago" y botones para llamar o escribir por WhatsApp.

  Los datos vienen de motor.agendaCobros(estado, hoy, 30): los atrasados llegan
  primero y el resto ordenado por fecha. Aquí solo se reparten por sección.
  El acuerdo de pago se guarda en el préstamo como { fecha, texto } con
  datos.actualizarPrestamo; esta pantalla permite anotarlo, cambiarlo y quitarlo.
*/

export const titulo = 'Agenda';

const DIAS_SEMANA = 7;
const DIAS_AGENDA = 30;
const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const ESTADOS_ACTIVOS = ['al_dia', 'atrasado', 'vencido', 'legal', 'congelado'];

/* ---------- Ayudas de texto ---------- */

/** Plural simple: plural(1, 'mes', 'meses') → '1 mes'. */
function plural(n, singular, varios) {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** Nombre corto del día de la semana. El 1 de enero de 1970 fue jueves. */
function diaSemana(fecha, fechas) {
  const n = fechas.diferenciaDias('1970-01-01', fecha);
  return NOMBRES_DIA[(((n % 7) + 7) % 7 + 4) % 7];
}

/** 'mié 4 nov' para mostrar una fecha corta con su día de la semana. */
function fechaCorta(fecha, fechas) {
  if (!fechas.esFechaValida(fecha)) return fechas.formatear(fecha);
  const { mes, dia } = fechas.partir(fecha);
  return `${diaSemana(fecha, fechas)} ${dia} ${fechas.nombreMes(mes, true)}`;
}

/** 'hoy', 'mañana', 'en 5 días', 'hace 3 días'. */
function textoRelativo(fecha, hoy, fechas) {
  if (!fechas.esFechaValida(fecha)) return '';
  const dias = fechas.diferenciaDias(hoy, fecha);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 0) return `en ${dias} días`;
  return `hace ${-dias} días`;
}

/** Número para WhatsApp: solo dígitos; si son 10 (celular colombiano) se antepone 57. */
function numeroWhatsApp(telefono) {
  let digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 10) digitos = `57${digitos}`;
  return digitos;
}

/** Texto del motivo de una línea de la agenda. */
function textoMotivo(linea, hoy, fechas) {
  switch (linea.motivo) {
    case 'atrasado':
      if (linea.mesesAtrasados > 0) {
        return `Intereses atrasados desde el ${fechas.formatear(linea.fecha)}`;
      }
      return `Capital vencido el ${fechas.formatear(linea.fecha)}`;
    case 'interes':
      return `Interés del mes · ${fechaCorta(linea.fecha, fechas)}`;
    case 'capital':
      return `Vence el capital · ${fechaCorta(linea.fecha, fechas)}`;
    case 'acuerdo':
      return linea.texto ? `Acuerdo: ${linea.texto}` : 'Acuerdo de pago';
    default:
      return fechas.formatear(linea.fecha);
  }
}

/* ---------- Trozos de HTML ---------- */

/** Botones de una línea: registrar pago, llamar, WhatsApp y anotar acuerdo. */
function botonesHtml(prestamoId, cliente, ui, opciones = {}) {
  const { conAcuerdo = true, acuerdoExistente = false } = opciones;
  const telefono = cliente ? cliente.telefono : '';
  const whatsapp = numeroWhatsApp(telefono);
  const botones = [
    `<button type="button" class="boton boton--primario" data-accion="pago" data-prestamo="${ui.esc(prestamoId)}">Registrar pago</button>`,
  ];
  if (telefono) {
    botones.push(`<a class="boton boton--secundario" href="tel:${ui.esc(telefono.replace(/\s+/g, ''))}">Llamar</a>`);
  }
  if (whatsapp) {
    botones.push(`<a class="boton boton--secundario boton--whatsapp" href="https://wa.me/${ui.esc(whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
  }
  if (!telefono) {
    botones.push(`<a class="boton boton--secundario" href="#/cliente/${ui.esc(cliente ? cliente.id : '')}/editar">Sin teléfono</a>`);
  }
  if (conAcuerdo) {
    botones.push(`<button type="button" class="boton" data-accion="acuerdo" data-prestamo="${ui.esc(prestamoId)}">${acuerdoExistente ? 'Cambiar acuerdo' : 'Anotar acuerdo'}</button>`);
  }
  if (acuerdoExistente) {
    botones.push(`<button type="button" class="boton boton--quitar" data-accion="quitar-acuerdo" data-prestamo="${ui.esc(prestamoId)}">Quitar acuerdo</button>`);
  }
  return `<div class="agenda-linea__botones">${botones.join('')}</div>`;
}

/** Una línea de cobro. */
function lineaHtml(linea, cliente, hoy, ctx) {
  const { ui, dinero, fechas } = ctx;
  const nombre = linea.nombre || (cliente ? cliente.nombre : 'Cliente sin nombre');
  const alias = cliente && cliente.alias ? ` <span class="agenda-linea__alias">(${ui.esc(cliente.alias)})</span>` : '';
  let chip = '';
  if (linea.motivo === 'atrasado' && linea.mesesAtrasados > 0) {
    chip = `<span class="chip-estado chip-estado--atrasado">${ui.esc(plural(linea.mesesAtrasados, 'mes', 'meses'))}</span>`;
  } else if (linea.motivo === 'atrasado') {
    chip = ui.chipEstado('vencido');
  } else if (linea.motivo === 'acuerdo') {
    chip = `<span class="chip-estado chip-estado--acuerdo">Acuerdo</span>`;
  }
  return `
    <li class="agenda-linea agenda-linea--${ui.esc(linea.motivo)}">
      <div class="agenda-linea__arriba">
        <a class="agenda-linea__principal" href="#/prestamo/${ui.esc(linea.prestamoId)}">
          <div class="agenda-linea__nombre">${ui.esc(nombre)}${alias} ${chip}</div>
          <div class="agenda-linea__motivo">${ui.esc(textoMotivo(linea, hoy, fechas))}</div>
        </a>
        <div class="agenda-linea__monto">${ui.esc(dinero.formatear(linea.monto))}</div>
      </div>
      ${botonesHtml(linea.prestamoId, cliente, ui, { conAcuerdo: linea.motivo !== 'acuerdo' })}
    </li>`;
}

/**
 * Una sección completa: título con cantidad y total, y la lista de líneas.
 * conFechas: mete un renglón con la fecha cada vez que cambia (semana y 30 días).
 */
function seccionHtml({ id, nombre, lineas, textoVacio, conFechas, clase }, clientesPorId, hoy, ctx) {
  const { ui, dinero, fechas } = ctx;
  const total = lineas.reduce((suma, l) => suma + (l.monto || 0), 0);
  let cuerpo;
  if (!lineas.length) {
    cuerpo = `<div class="agenda-vacio">${ui.esc(textoVacio)}</div>`;
  } else {
    let fechaAnterior = null;
    const partes = [];
    for (const linea of lineas) {
      if (conFechas && linea.fecha !== fechaAnterior) {
        fechaAnterior = linea.fecha;
        partes.push(`<li class="agenda-fecha">${ui.esc(fechaCorta(linea.fecha, fechas))} <span class="agenda-fecha__relativo">${ui.esc(textoRelativo(linea.fecha, hoy, fechas))}</span></li>`);
      }
      partes.push(lineaHtml(linea, clientesPorId.get(linea.clienteId), hoy, ctx));
    }
    cuerpo = `<ul class="agenda-lista">${partes.join('')}</ul>`;
  }
  return `
    <section class="agenda-seccion ${clase || ''}" id="seccion-${ui.esc(id)}">
      <h2 class="agenda-seccion__titulo">
        <span>${ui.esc(nombre)}${lineas.length ? ` <span class="agenda-seccion__cantidad">${lineas.length}</span>` : ''}</span>
        ${lineas.length ? `<span class="agenda-seccion__total">${ui.esc(dinero.formatear(total))}</span>` : ''}
      </h2>
      ${cuerpo}
    </section>`;
}

/** Línea de un acuerdo de pago en la sección "Acuerdos". */
function acuerdoHtml(prestamo, cliente, resultado, hoy, ctx) {
  const { ui, dinero, fechas } = ctx;
  const acuerdo = prestamo.acuerdo;
  const pasado = fechas.comparar(acuerdo.fecha, hoy) < 0;
  const esHoy = acuerdo.fecha === hoy;
  const nombre = cliente ? cliente.nombre : 'Cliente sin nombre';
  const relativo = textoRelativo(acuerdo.fecha, hoy, fechas);
  let aviso = '';
  if (pasado) aviso = `<span class="chip-estado chip-estado--vencido">Pasó la fecha</span>`;
  else if (esHoy) aviso = `<span class="chip-estado chip-estado--acuerdo">Hoy</span>`;
  const deuda = resultado ? `Debe ${dinero.formatear(resultado.deudaCliente)}` : '';
  return `
    <li class="agenda-linea agenda-linea--acuerdo ${pasado ? 'agenda-acuerdo--pasado' : ''}">
      <div class="agenda-linea__arriba">
        <a class="agenda-linea__principal" href="#/prestamo/${ui.esc(prestamo.id)}">
          <div class="agenda-linea__nombre">${ui.esc(nombre)} ${aviso}</div>
          <div class="agenda-linea__motivo">${ui.esc(fechaCorta(acuerdo.fecha, fechas))} ${ui.esc(fechas.partir(acuerdo.fecha).anio)} · ${ui.esc(relativo)}</div>
          ${acuerdo.texto ? `<div class="agenda-linea__texto">${ui.esc(acuerdo.texto)}</div>` : ''}
        </a>
        <div class="agenda-linea__monto">${ui.esc(deuda)}</div>
      </div>
      ${botonesHtml(prestamo.id, cliente, ui, { conAcuerdo: true, acuerdoExistente: true })}
    </li>`;
}

/** Formulario para anotar o cambiar un acuerdo de pago. Empieza oculto. */
function formularioAcuerdoHtml(opcionesPrestamo, hoy, ui) {
  return `
    <form class="tarjeta agenda-formulario oculto" id="formulario-acuerdo" novalidate>
      <h2>Acuerdo de pago</h2>
      <p class="suave">Anota el día en que el cliente prometió pagar. Ese día aparece en la agenda.</p>
      ${ui.campo({ etiqueta: 'Préstamo', nombre: 'prestamoId', tipo: 'select', opciones: opcionesPrestamo, requerido: true })}
      ${ui.campoFecha({ etiqueta: 'Fecha acordada', nombre: 'fecha', valor: hoy, requerido: true })}
      ${ui.campo({ etiqueta: 'Qué acordaron', nombre: 'texto', tipo: 'textarea', placeholder: 'Ej.: Dijo que el sábado paga 200.000', ayuda: 'Con sus palabras, para acordarte al cobrar.' })}
      <div class="botones">
        <button type="button" class="boton boton--secundario" data-accion="cancelar-acuerdo">Cancelar</button>
        <button type="submit" class="boton boton--primario">Guardar acuerdo</button>
      </div>
    </form>`;
}

/* ---------- Pantalla ---------- */

export async function render(contenedor, params, ctx) {
  const { datos, motor, fechas, dinero, ui } = ctx;
  const hoy = ctx.hoy();
  const estado = datos.estado;
  contenedor.innerHTML = '';

  const clientesPorId = new Map((estado.clientes || []).map((c) => [c.id, c]));

  // Sin préstamos no hay nada que cobrar: se explica y se ofrece el camino.
  if (!estado.prestamos || estado.prestamos.length === 0) {
    const vacio = ui.el(`
      <div class="agenda">
        ${ui.encabezado('Agenda')}
        ${ui.vacio('Todavía no hay préstamos. Cuando registres uno, aquí verás qué cobrar y cuándo.')}
        <a href="#/clientes" class="boton boton--primario boton--grande">Ir a clientes</a>
      </div>`);
    contenedor.append(vacio);
    return;
  }

  // Cálculos del motor. Si algo falla se avisa y la pantalla sigue con lo que tenga.
  let lineas = [];
  let resultados = {};
  try {
    lineas = motor.agendaCobros(estado, hoy, DIAS_AGENDA);
    resultados = motor.calcularTodos(estado, hoy);
  } catch (error) {
    ui.toast(`No se pudo calcular la agenda: ${error.message}`, 5000);
  }

  // Reparto por secciones. Los atrasados vienen primero y ya ordenados por meses de atraso.
  const finSemana = fechas.sumarDias(hoy, DIAS_SEMANA);
  const secciones = { atrasados: [], hoy: [], semana: [], mes: [] };
  for (const linea of lineas) {
    if (linea.motivo === 'atrasado') secciones.atrasados.push(linea);
    else if (linea.fecha === hoy) secciones.hoy.push(linea);
    else if (fechas.comparar(linea.fecha, finSemana) <= 0) secciones.semana.push(linea);
    else secciones.mes.push(linea);
  }

  // Acuerdos de pago anotados en los préstamos, ordenados por fecha.
  const prestamosConAcuerdo = (estado.prestamos || [])
    .filter((p) => p.acuerdo && fechas.esFechaValida(p.acuerdo.fecha))
    .sort((a, b) => fechas.comparar(a.acuerdo.fecha, b.acuerdo.fecha));

  // Préstamos activos de clientes (no familia) para el formulario de acuerdo.
  const prestamosActivos = (estado.prestamos || []).filter((p) => {
    const cliente = clientesPorId.get(p.clienteId);
    if (cliente && cliente.tipo === 'familia') return false;
    if (p.modalidad === 'sin_interes') return false;
    const r = resultados[p.id];
    return !r || ESTADOS_ACTIVOS.includes(r.estado);
  });
  const opcionesPrestamo = prestamosActivos.map((p) => {
    const cliente = clientesPorId.get(p.clienteId);
    const r = resultados[p.id];
    const deuda = r ? ` · debe ${dinero.formatear(r.deudaCliente)}` : '';
    return {
      valor: p.id,
      texto: `${cliente ? cliente.nombre : 'Sin cliente'} · ${dinero.formatear(p.capital)} del ${fechas.formatear(p.fecha)}${deuda}`,
    };
  });

  const totalAtrasado = secciones.atrasados.reduce((suma, l) => suma + l.monto, 0);
  const totalHoy = secciones.hoy.reduce((suma, l) => suma + l.monto, 0);

  const raiz = ui.el(`
    <div class="agenda">
      ${ui.encabezado('Agenda', { accion: { texto: 'Nuevo acuerdo', id: 'boton-nuevo-acuerdo' } })}

      <div class="tarjetas-dos margen-abajo">
        <div class="tarjeta">
          <p class="tarjeta__titulo">Atrasado</p>
          <p class="tarjeta__valor ${totalAtrasado > 0 ? 'texto-estado--atrasado' : ''}">${ui.esc(dinero.formatear(totalAtrasado))}</p>
          <p class="tarjeta__detalle">${ui.esc(plural(secciones.atrasados.length, 'préstamo', 'préstamos'))}</p>
        </div>
        <div class="tarjeta">
          <p class="tarjeta__titulo">Para cobrar hoy</p>
          <p class="tarjeta__valor">${ui.esc(dinero.formatear(totalHoy))}</p>
          <p class="tarjeta__detalle">${ui.esc(fechaCorta(hoy, fechas))} · ${ui.esc(plural(secciones.hoy.length, 'cobro', 'cobros'))}</p>
        </div>
      </div>

      ${formularioAcuerdoHtml(opcionesPrestamo, hoy, ui)}

      ${seccionHtml({
        id: 'atrasados',
        nombre: 'Atrasados',
        lineas: secciones.atrasados,
        textoVacio: 'Nadie está atrasado. Muy bien.',
        conFechas: false,
        clase: 'agenda-seccion--atrasados',
      }, clientesPorId, hoy, ctx)}

      ${seccionHtml({
        id: 'hoy',
        nombre: 'Hoy',
        lineas: secciones.hoy,
        textoVacio: 'Hoy no tienes cobros.',
        conFechas: false,
      }, clientesPorId, hoy, ctx)}

      ${seccionHtml({
        id: 'semana',
        nombre: 'Esta semana',
        lineas: secciones.semana,
        textoVacio: `Nada por cobrar hasta el ${fechas.formatear(finSemana)}.`,
        conFechas: true,
      }, clientesPorId, hoy, ctx)}

      ${seccionHtml({
        id: 'mes',
        nombre: 'Próximos 30 días',
        lineas: secciones.mes,
        textoVacio: `Nada más por cobrar hasta el ${fechas.formatear(fechas.sumarDias(hoy, DIAS_AGENDA))}.`,
        conFechas: true,
      }, clientesPorId, hoy, ctx)}

      <section class="agenda-seccion" id="seccion-acuerdos">
        <h2 class="agenda-seccion__titulo">
          <span>Acuerdos de pago${prestamosConAcuerdo.length ? ` <span class="agenda-seccion__cantidad">${prestamosConAcuerdo.length}</span>` : ''}</span>
        </h2>
        ${prestamosConAcuerdo.length
          ? `<ul class="agenda-lista">${prestamosConAcuerdo.map((p) => acuerdoHtml(p, clientesPorId.get(p.clienteId), resultados[p.id], hoy, ctx)).join('')}</ul>`
          : `<div class="agenda-vacio">No hay acuerdos de pago. Cuando un cliente te prometa pagar un día, anótalo con "Nuevo acuerdo" y te aparecerá aquí y en su fecha.</div>`}
      </section>
    </div>`);

  contenedor.append(raiz);

  /* ---------- Formulario de acuerdo ---------- */

  const formulario = raiz.querySelector('#formulario-acuerdo');
  const selectorPrestamo = formulario.elements.prestamoId;
  const campoFecha = formulario.elements.fecha;
  const campoTexto = formulario.elements.texto;

  function abrirFormulario(prestamoId) {
    if (!opcionesPrestamo.length) {
      ui.toast('No hay préstamos activos para anotar un acuerdo.');
      return;
    }
    const prestamo = prestamoId ? datos.obtener('prestamos', prestamoId) : null;
    if (prestamo) {
      selectorPrestamo.value = prestamo.id;
      campoFecha.value = prestamo.acuerdo && prestamo.acuerdo.fecha ? prestamo.acuerdo.fecha : hoy;
      campoTexto.value = prestamo.acuerdo ? prestamo.acuerdo.texto || '' : '';
    } else {
      campoFecha.value = hoy;
      campoTexto.value = '';
    }
    formulario.classList.remove('oculto');
    formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    campoFecha.focus();
  }

  function cerrarFormulario() {
    formulario.classList.add('oculto');
  }

  // Al cambiar de préstamo en el selector se trae el acuerdo que ya tenga, si hay.
  selectorPrestamo.addEventListener('change', () => {
    const prestamo = datos.obtener('prestamos', selectorPrestamo.value);
    if (prestamo && prestamo.acuerdo) {
      campoFecha.value = prestamo.acuerdo.fecha;
      campoTexto.value = prestamo.acuerdo.texto || '';
    }
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(formulario);
    if (!valores.prestamoId) {
      ui.toast('Elige el préstamo del acuerdo.');
      selectorPrestamo.focus();
      return;
    }
    if (!fechas.esFechaValida(valores.fecha)) {
      ui.toast('Escribe la fecha del acuerdo.');
      campoFecha.focus();
      return;
    }
    if (fechas.comparar(valores.fecha, hoy) < 0) {
      const sigue = await ui.confirmar(`La fecha ${fechas.formatear(valores.fecha)} ya pasó. ¿Guardar el acuerdo igual?`, { aceptar: 'Sí, guardar' });
      if (!sigue) return;
    }
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await datos.actualizarPrestamo({
        id: valores.prestamoId,
        acuerdo: { fecha: valores.fecha, texto: valores.texto || '' },
      });
      ui.toast('Acuerdo guardado');
      ctx.navegar(`/prestamo/${valores.prestamoId}`);
    } catch (error) {
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el acuerdo.', 5000);
    } finally {
      boton.disabled = false;
    }
  });

  const botonNuevo = raiz.querySelector('#boton-nuevo-acuerdo');
  if (botonNuevo) botonNuevo.addEventListener('click', () => abrirFormulario(null));

  /* ---------- Acciones de las líneas ---------- */

  raiz.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || !raiz.contains(boton)) return;
    const accion = boton.dataset.accion;
    const prestamoId = boton.dataset.prestamo || '';

    if (accion === 'pago') {
      ctx.navegar(`/prestamo/${prestamoId}/pago`);
      return;
    }
    if (accion === 'acuerdo') {
      abrirFormulario(prestamoId);
      return;
    }
    if (accion === 'cancelar-acuerdo') {
      cerrarFormulario();
      return;
    }
    if (accion === 'quitar-acuerdo') {
      const prestamo = datos.obtener('prestamos', prestamoId);
      const cliente = prestamo ? clientesPorId.get(prestamo.clienteId) : null;
      const nombre = cliente ? cliente.nombre : 'este cliente';
      const seguro = await ui.confirmar(`¿Quitar el acuerdo de pago de ${nombre}?`, { aceptar: 'Sí, quitar', peligro: true });
      if (!seguro) return;
      boton.disabled = true;
      try {
        await datos.actualizarPrestamo({ id: prestamoId, acuerdo: null });
        ui.toast('Acuerdo quitado');
        ctx.navegar(`/prestamo/${prestamoId}`);
      } catch (error) {
        ui.toast(error && error.message ? error.message : 'No se pudo quitar el acuerdo.', 5000);
        boton.disabled = false;
      }
    }
  });
}
