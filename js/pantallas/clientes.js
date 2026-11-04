/*
  Pantalla "clientes" de Mis Préstamos.
  Rutas que atiende (app.js las resuelve y manda params.vista):
    #/clientes              vista 'lista'   → buscador, filtros y lista ordenada por estado
    #/clientes?grupo=X      vista 'lista'   → cuenta unificada del grupo X (suma de todos)
    #/clientes/nuevo        vista 'nuevo'   → formulario de cliente nuevo
    #/cliente/:id           vista 'ficha'   → datos de contacto, resumen, préstamos
    #/cliente/:id/editar    vista 'editar'  → formulario para corregir los datos
  Todo lo que se calcula sale de motor.resumenCliente. Esta pantalla no toca otros
  archivos: para ir a préstamos o pagos solo navega a sus rutas con ctx.navegar.
*/

// ---------- Estado propio de la pantalla (vive mientras la app esté abierta) ----------
let filtroActual = 'todos';
let textoBusqueda = '';

const FILTROS = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'al_dia', texto: 'Al día' },
  { clave: 'atrasados', texto: 'Atrasados' },
  { clave: 'perdidos', texto: 'Perdidos' },
  { clave: 'solo_intereses', texto: 'Solo intereses' },
  { clave: 'familia', texto: 'Familia' },
];

// Orden de la lista: los que necesitan atención van primero.
const ORDEN_ESTADO = {
  vencido: 0,
  atrasado: 1,
  legal: 2,
  perdido: 3,
  congelado: 4,
  al_dia: 5,
  familia: 6,
  pagado: 7,
};

const TEXTO_MODALIDAD = {
  interes_mensual: 'Interés mensual',
  capital_primero: 'Capital primero',
  sin_interes: 'Sin interés',
};

const ESTADOS_CERRADOS = ['pagado', 'perdido'];

// ---------- Título que app.js pone en la pestaña del navegador ----------
export function titulo(params) {
  const vista = params && params.vista;
  if (vista === 'nuevo') return 'Nuevo cliente';
  if (vista === 'editar') return 'Editar cliente';
  if (vista === 'ficha') return 'Cliente';
  return 'Clientes';
}

// ---------- Ayudas ----------

/** Quita tildes y pasa a minúsculas para buscar sin importar cómo lo escriba. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Lee lo que viene después de "?" en el hash, por ejemplo { grupo: 'Familia' }. */
function leerConsulta() {
  const hash = window.location.hash || '';
  const indice = hash.indexOf('?');
  if (indice < 0) return {};
  const resultado = {};
  for (const [clave, valor] of new URLSearchParams(hash.slice(indice + 1)).entries()) {
    resultado[clave] = valor;
  }
  return resultado;
}

/** Número para WhatsApp: solo dígitos, con el 57 de Colombia adelante. */
function numeroWhatsapp(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 10) return `57${digitos}`;
  if (digitos.startsWith('57') && digitos.length === 12) return digitos;
  return digitos;
}

// Con estado puesto a mano (perdido, legal, congelado, pagado) el atraso no se muestra:
// el chip ya dice lo que pasa con ese cliente.
const ESTADOS_SIN_ATRASO = ['perdido', 'legal', 'congelado', 'pagado', 'familia'];

/** "1 mes de atraso" o "4 meses de atraso". Vacío si no hay atraso o el estado es manual. */
function textoAtraso(meses, estado) {
  if (!meses || meses <= 0) return '';
  if (estado && ESTADOS_SIN_ATRASO.includes(estado)) return '';
  return meses === 1 ? '1 mes de atraso' : `${meses} meses de atraso`;
}

function textoCantidad(cantidad, singular, plural) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

/** Resumen del cliente con motor.resumenCliente. `pagos` es la lista completa: el motor filtra. */
function resumenDe(cliente, pagos, ctx) {
  const prestamos = ctx.datos.listar('prestamos', { clienteId: cliente.id });
  return ctx.motor.resumenCliente(cliente, prestamos, pagos, ctx.hoy());
}

function ordenarPorEstado(lista) {
  return lista.sort((a, b) => {
    const ordenA = ORDEN_ESTADO[a.resumen.estado] ?? 5;
    const ordenB = ORDEN_ESTADO[b.resumen.estado] ?? 5;
    if (ordenA !== ordenB) return ordenA - ordenB;
    if (a.resumen.mesesAtrasados !== b.resumen.mesesAtrasados) {
      return b.resumen.mesesAtrasados - a.resumen.mesesAtrasados;
    }
    if (a.resumen.deudaCliente !== b.resumen.deudaCliente) {
      return b.resumen.deudaCliente - a.resumen.deudaCliente;
    }
    return a.cliente.nombre.localeCompare(b.cliente.nombre, 'es');
  });
}

function pasaFiltro(entrada, filtro) {
  const { cliente, resumen } = entrada;
  switch (filtro) {
    case 'solo_intereses':
      return resumen.soloIntereses;
    case 'al_dia':
      return resumen.estado === 'al_dia' && cliente.tipo !== 'familia' && !resumen.soloIntereses;
    case 'atrasados':
      return (resumen.estado === 'atrasado' || resumen.estado === 'vencido') && !resumen.soloIntereses;
    case 'perdidos':
      return resumen.estado === 'perdido';
    case 'familia':
      return cliente.tipo === 'familia' || resumen.estado === 'familia';
    default:
      return true;
  }
}

function pasaBusqueda(cliente, texto) {
  if (!texto) return true;
  const objetivo = normalizar(`${cliente.nombre} ${cliente.alias} ${cliente.grupo} ${cliente.telefono}`);
  return texto.split(/\s+/).every((palabra) => objetivo.includes(palabra));
}

/** HTML de una fila de cliente para la lista y para el grupo. */
function filaCliente(entrada, ctx) {
  const { ui, dinero } = ctx;
  const { cliente, resumen } = entrada;
  const detalles = [];
  if (cliente.alias) detalles.push(ui.esc(cliente.alias));
  if (resumen.prestamos === 0) {
    detalles.push('Sin préstamos');
  } else {
    const atraso = textoAtraso(resumen.mesesAtrasados, resumen.estado);
    if (atraso) detalles.push(ui.esc(atraso));
    else detalles.push(ui.esc(textoCantidad(resumen.prestamosActivos, 'préstamo activo', 'préstamos activos')));
  }
  const chip = resumen.soloIntereses ? '<span class="fran-solo">Solo intereses</span>' : (resumen.prestamos > 0 || cliente.tipo === 'familia' ? ui.chipEstado(resumen.estado) : '');
  return `
    <a class="fila cliente-fila" href="#/cliente/${encodeURIComponent(cliente.id)}">
      <div class="fila__principal">
        <div class="fila__titulo">${ui.esc(cliente.nombre)}</div>
        <div class="fila__detalle">${detalles.join(' · ')}</div>
      </div>
      <div class="fila__lateral cliente-fila__lateral">
        <div class="fila__monto">${dinero.formatear(resumen.deudaCliente)}</div>
        ${chip}
      </div>
      <span class="fila__flecha" aria-hidden="true">›</span>
    </a>`;
}

/** Fila "etiqueta ... valor" del resumen de la ficha. */
function datoResumen(etiqueta, valor, clase = '') {
  return `
    <div class="dato ${clase}">
      <span class="dato__etiqueta">${etiqueta}</span>
      <span class="dato__valor">${valor}</span>
    </div>`;
}

// ---------- Entrada principal ----------
export async function render(contenedor, params, ctx) {
  contenedor.innerHTML = '';
  const vista = params.vista || 'lista';

  if (vista === 'nuevo') return renderFormulario(contenedor, null, ctx);
  if (vista === 'editar') {
    const cliente = ctx.datos.obtener('clientes', params.id);
    if (!cliente) return renderNoEncontrado(contenedor, ctx);
    return renderFormulario(contenedor, cliente, ctx);
  }
  if (vista === 'ficha') {
    const cliente = ctx.datos.obtener('clientes', params.id);
    if (!cliente) return renderNoEncontrado(contenedor, ctx);
    return renderFicha(contenedor, cliente, ctx);
  }

  const consulta = leerConsulta();
  if (consulta.grupo) return renderGrupo(contenedor, consulta.grupo, ctx);
  return renderLista(contenedor, ctx);
}

function renderNoEncontrado(contenedor, ctx) {
  const { ui } = ctx;
  contenedor.append(ui.el(`<div>
    ${ui.encabezado('Cliente', { atras: '#/clientes' })}
    ${ui.vacio('No se encontró este cliente. Puede que lo hayas eliminado.')}
    <a href="#/clientes" class="boton boton--primario boton--grande">Ver todos los clientes</a>
  </div>`));
}

// ---------- Lista con buscador y filtros ----------
function renderLista(contenedor, ctx) {
  const { ui, datos } = ctx;
  const pagos = datos.listar('pagos');
  const entradas = datos.listar('clientes').map((cliente) => ({
    cliente,
    resumen: resumenDe(cliente, pagos, ctx),
  }));
  ordenarPorEstado(entradas);

  const raiz = ui.el(`<div class="pantalla-clientes">
    ${ui.encabezado('Clientes', { accion: { texto: 'Nuevo', ruta: '#/clientes/nuevo' } })}
    <div class="clientes-buscador">
      <label class="campo sin-margen" for="clientes-busqueda">
        <span class="campo__etiqueta oculto-visual">Buscar</span>
        <input type="search" id="clientes-busqueda" name="busqueda" placeholder="Buscar por nombre o alias"
          autocomplete="off" value="${ui.esc(textoBusqueda)}">
      </label>
    </div>
    <div class="clientes-filtros" role="group" aria-label="Filtrar clientes"></div>
    <div id="clientes-lista"></div>
  </div>`);

  const filtros = raiz.querySelector('.clientes-filtros');
  for (const filtro of FILTROS) {
    const boton = ui.el(`<button type="button" class="opcion" data-filtro="${filtro.clave}">${ui.esc(filtro.texto)}</button>`);
    boton.setAttribute('aria-pressed', filtro.clave === filtroActual ? 'true' : 'false');
    boton.addEventListener('click', () => {
      filtroActual = filtro.clave;
      filtros.querySelectorAll('.opcion').forEach((b) => {
        b.setAttribute('aria-pressed', b.dataset.filtro === filtroActual ? 'true' : 'false');
      });
      pintarLista();
    });
    filtros.append(boton);
  }

  const campoBusqueda = raiz.querySelector('#clientes-busqueda');
  campoBusqueda.addEventListener('input', () => {
    textoBusqueda = campoBusqueda.value;
    pintarLista();
  });

  const zonaLista = raiz.querySelector('#clientes-lista');

  function pintarLista() {
    const texto = normalizar(textoBusqueda);
    const visibles = entradas.filter((e) => pasaFiltro(e, filtroActual) && pasaBusqueda(e.cliente, texto));

    if (entradas.length === 0) {
      zonaLista.innerHTML = `
        ${ui.vacio('Todavía no tienes clientes. Crea el primero para empezar a registrar préstamos.')}
        <a href="#/clientes/nuevo" class="boton boton--primario boton--grande">Crear el primer cliente</a>`;
      return;
    }
    if (visibles.length === 0) {
      zonaLista.innerHTML = ui.vacio(texto ? `Ningún cliente coincide con "${textoBusqueda.trim()}".` : 'No hay clientes en este filtro.');
      return;
    }

    // En "Todos" y en la búsqueda, quien solo debe intereses va aparte, abajo y cerrado.
    const aparte = filtroActual === 'solo_intereses' ? [] : visibles.filter((e) => e.resumen.soloIntereses);
    const principales = visibles.filter((e) => !aparte.includes(e));
    const suma = (lista) => lista.reduce((s, e) => s + e.resumen.deudaCliente, 0);
    zonaLista.innerHTML = `
      ${principales.length ? `<p class="clientes-conteo suave">
        ${ui.esc(textoCantidad(principales.length, 'cliente', 'clientes'))} · deben ${ctx.dinero.formatear(suma(principales))}
      </p>
      <ul class="lista">
        ${principales.map((e) => `<li>${filaCliente(e, ctx)}</li>`).join('')}
      </ul>` : ''}
      ${aparte.length ? `<details class="clientes-aparte"${principales.length ? '' : ' open'}>
        <summary>Solo deben intereses · ${aparte.length} · ${ctx.dinero.formatear(suma(aparte))}</summary>
        <p class="suave">Ya devolvieron todo el capital. Lo que paguen es ganancia.</p>
        <ul class="lista">${aparte.map((e) => `<li>${filaCliente(e, ctx)}</li>`).join('')}</ul>
      </details>` : ''}`;
  }

  pintarLista();
  contenedor.append(raiz);
}

// ---------- Ficha del cliente ----------
function renderFicha(contenedor, cliente, ctx) {
  const { ui, datos, dinero, fechas } = ctx;
  const id = cliente.id;
  const resumen = resumenDe(cliente, datos.listar('pagos'), ctx);
  const prestamos = datos.listar('prestamos', { clienteId: id });
  const resultadosPorId = new Map(resumen.resultados.map((r) => [r.prestamoId, r]));
  const activos = resumen.resultados.filter((r) => !ESTADOS_CERRADOS.includes(r.estado));

  const raiz = ui.el(`<div class="pantalla-clientes ficha-cliente"></div>`);
  raiz.append(ui.el(ui.encabezado(cliente.nombre, {
    atras: '#/clientes',
    accion: { texto: 'Editar', ruta: `#/cliente/${encodeURIComponent(id)}/editar` },
  })));

  // --- Contacto ---
  const lineasContacto = [];
  if (cliente.alias) lineasContacto.push(`<p class="ficha-contacto__alias">También: ${ui.esc(cliente.alias)}</p>`);
  if (cliente.tipo === 'familia') lineasContacto.push(`<p>${ui.chipEstado('familia')} <span class="suave">Préstamos sin interés</span></p>`);
  if (cliente.direccion) lineasContacto.push(`<p class="suave">${ui.esc(cliente.direccion)}</p>`);
  if (cliente.grupo) {
    lineasContacto.push(`<p>Grupo: <a href="#/clientes?grupo=${encodeURIComponent(cliente.grupo)}" class="enlace-grupo">${ui.esc(cliente.grupo)} › ver cuenta del grupo</a></p>`);
  }
  if (cliente.nota) lineasContacto.push(`<p class="ficha-contacto__nota">${ui.esc(cliente.nota)}</p>`);

  let botonesContacto = '';
  if (cliente.telefono) {
    const digitos = String(cliente.telefono).replace(/[^\d+]/g, '');
    const whatsapp = numeroWhatsapp(cliente.telefono);
    botonesContacto = `
      <p class="ficha-contacto__telefono numero">${ui.esc(cliente.telefono)}</p>
      <div class="botones ficha-contacto__botones">
        <a class="boton boton--secundario" href="tel:${ui.esc(digitos)}">Llamar</a>
        ${whatsapp ? `<a class="boton boton--secundario" href="https://wa.me/${ui.esc(whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      </div>`;
  } else {
    botonesContacto = `<p class="suave">Sin teléfono registrado.</p>`;
  }

  raiz.append(ui.el(`<section class="tarjeta ficha-contacto">
    ${lineasContacto.join('')}
    ${botonesContacto}
  </section>`));

  // --- Resumen de la cuenta ---
  const atraso = textoAtraso(resumen.mesesAtrasados, resumen.estado);
  const neto = resumen.netoRecuperar;
  const textoNeto = neto > 0
    ? dinero.formatear(neto)
    : `${dinero.formatear(0)} <span class="suave">(ya recuperó su plata${neto < 0 ? `; ${dinero.formatear(-neto)} de más` : ''})</span>`;
  let proximo = '';
  if (resumen.proximoCobro) {
    proximo = datoResumen('Próximo cobro', `${fechas.formatear(resumen.proximoCobro.fecha)} · ${dinero.formatear(resumen.proximoCobro.monto)}`);
  }

  raiz.append(ui.el(`<section class="tarjeta ficha-resumen">
    <div class="ficha-resumen__cabecera">
      ${prestamos.length > 0 || cliente.tipo === 'familia' ? ui.chipEstado(resumen.estado) : ''}
      ${atraso ? `<span class="texto-estado--atrasado negrita">${ui.esc(atraso)}</span>` : ''}
    </div>
    <p class="tarjeta__titulo">Deuda hoy</p>
    <p class="tarjeta__valor ficha-resumen__deuda">${dinero.formatear(resumen.deudaCliente)}</p>
    <div class="datos">
      ${datoResumen('Capital pendiente', dinero.formatear(resumen.capitalPendiente))}
      ${datoResumen('Intereses pendientes', dinero.formatear(resumen.interesPendiente), resumen.interesPendiente > 0 ? 'dato--alerta' : '')}
      ${datoResumen('Total recibido', dinero.formatear(resumen.totalRecibido))}
      ${datoResumen('Ganancia', dinero.formatear(resumen.ganancia), 'dato--ganancia')}
      ${datoResumen('Neto por recuperar', textoNeto)}
      ${proximo}
    </div>
  </section>`));

  // --- Botones de acción ---
  let rutaPago = null;
  if (activos.length === 1) rutaPago = `#/prestamo/${encodeURIComponent(activos[0].prestamoId)}/pago`;
  else if (prestamos.length > 0) rutaPago = `#/cliente/${encodeURIComponent(id)}/pago`;

  raiz.append(ui.el(`<div class="botones ficha-acciones">
    <a class="boton boton--primario boton--grande" href="#/prestamo/nuevo/${encodeURIComponent(id)}">Nuevo préstamo</a>
    ${rutaPago ? `<a class="boton boton--secundario boton--grande" href="${rutaPago}">Registrar pago</a>` : ''}
  </div>`));

  // --- Préstamos ---
  const seccionPrestamos = ui.el(`<section class="seccion">
    <h2 class="seccion__titulo">${ui.esc(textoCantidad(prestamos.length, 'préstamo', 'préstamos'))}</h2>
  </section>`);
  if (prestamos.length === 0) {
    seccionPrestamos.append(ui.el(ui.vacio('Todavía no le has prestado. Usa "Nuevo préstamo" para registrar el primero.')));
  } else {
    const ordenados = [...prestamos].sort((a, b) => fechas.comparar(b.fecha, a.fecha));
    const lista = ui.el('<ul class="lista"></ul>');
    for (const prestamo of ordenados) {
      const r = resultadosPorId.get(prestamo.id);
      const modalidad = prestamo.modalidad === 'interes_mensual'
        ? `${Math.round(prestamo.tasa * 100) / 100}% mensual`
        : (TEXTO_MODALIDAD[prestamo.modalidad] || prestamo.modalidad);
      const detalles = [modalidad];
      if (r && r.mesesAtrasados > 0) detalles.push(textoAtraso(r.mesesAtrasados));
      else if (r && r.proximoCobro) detalles.push(`cobro ${fechas.formatear(r.proximoCobro.fecha)}`);
      lista.append(ui.el(`<li>
        <a class="fila" href="#/prestamo/${encodeURIComponent(prestamo.id)}">
          <div class="fila__principal">
            <div class="fila__titulo">${fechas.formatear(prestamo.fecha)} · ${dinero.formatear(prestamo.capital)}</div>
            <div class="fila__detalle">${ui.esc(detalles.join(' · '))}</div>
          </div>
          <div class="fila__lateral cliente-fila__lateral">
            <div class="fila__monto">${r ? dinero.formatear(r.deudaCliente) : ''}</div>
            ${r ? ui.chipEstado(r.estado) : ''}
          </div>
          <span class="fila__flecha" aria-hidden="true">›</span>
        </a>
      </li>`));
    }
    seccionPrestamos.append(lista);
  }
  raiz.append(seccionPrestamos);

  // --- Datos de registro y eliminar (solo si no tiene préstamos) ---
  const pie = ui.el(`<section class="ficha-pie">
    <p class="suave">Cliente desde ${fechas.formatear(cliente.creadoEn)}.</p>
  </section>`);
  if (prestamos.length === 0) {
    const botonEliminar = ui.el(`<button type="button" class="boton boton--peligro boton--grande">Eliminar cliente</button>`);
    botonEliminar.addEventListener('click', async () => {
      const seguro = await ui.confirmar(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`, {
        aceptar: 'Sí, eliminar',
        peligro: true,
      });
      if (!seguro) return;
      botonEliminar.disabled = true;
      try {
        await datos.eliminarCliente(id);
        ui.toast('Cliente eliminado');
        ctx.navegar('/clientes');
      } catch (error) {
        botonEliminar.disabled = false;
        ui.toast(error && error.message ? error.message : 'No se pudo eliminar el cliente.');
      }
    });
    pie.append(botonEliminar);
  }
  raiz.append(pie);

  contenedor.append(raiz);
}

// ---------- Cuenta de un grupo (clientes con una sola cuenta) ----------
function renderGrupo(contenedor, grupo, ctx) {
  const { ui, datos, dinero, fechas, motor } = ctx;
  const nombreGrupo = normalizar(grupo);
  const pagos = datos.listar('pagos');
  const miembros = datos
    .listar('clientes', (c) => normalizar(c.grupo) === nombreGrupo && nombreGrupo !== '')
    .map((cliente) => ({ cliente, resumen: resumenDe(cliente, pagos, ctx) }));
  ordenarPorEstado(miembros);

  const raiz = ui.el(`<div class="pantalla-clientes cuenta-grupo"></div>`);
  raiz.append(ui.el(ui.encabezado(`Grupo ${grupo}`, { atras: '#/clientes' })));

  if (miembros.length === 0) {
    raiz.append(ui.el(ui.vacio(`No hay clientes en el grupo "${grupo}".`)));
    contenedor.append(raiz);
    return;
  }

  const total = {
    capitalPendiente: 0,
    interesPendiente: 0,
    deudaCliente: 0,
    totalRecibido: 0,
    ganancia: 0,
    netoRecuperar: 0,
    mesesAtrasados: 0,
    prestamosActivos: 0,
    prestamos: 0,
    proximoCobro: null,
  };
  let estado = null;
  for (const { resumen } of miembros) {
    total.capitalPendiente += resumen.capitalPendiente;
    total.interesPendiente += resumen.interesPendiente;
    total.deudaCliente += resumen.deudaCliente;
    total.totalRecibido += resumen.totalRecibido;
    total.ganancia += resumen.ganancia;
    total.netoRecuperar += resumen.netoRecuperar;
    total.prestamosActivos += resumen.prestamosActivos;
    total.prestamos += resumen.prestamos;
    total.mesesAtrasados = Math.max(total.mesesAtrasados, resumen.mesesAtrasados);
    if (resumen.prestamos > 0) {
      estado = typeof motor.peorEstado === 'function' ? motor.peorEstado(estado, resumen.estado) : (estado || resumen.estado);
    }
    if (resumen.proximoCobro && (!total.proximoCobro || fechas.comparar(resumen.proximoCobro.fecha, total.proximoCobro.fecha) < 0)) {
      total.proximoCobro = resumen.proximoCobro;
    }
  }

  const atraso = textoAtraso(total.mesesAtrasados, estado);
  raiz.append(ui.el(`<section class="tarjeta ficha-resumen">
    <div class="ficha-resumen__cabecera">
      ${estado ? ui.chipEstado(estado) : ''}
      ${atraso ? `<span class="texto-estado--atrasado negrita">${ui.esc(atraso)}</span>` : ''}
    </div>
    <p class="tarjeta__titulo">Deuda del grupo hoy</p>
    <p class="tarjeta__valor ficha-resumen__deuda">${dinero.formatear(total.deudaCliente)}</p>
    <p class="tarjeta__detalle">${ui.esc(textoCantidad(miembros.length, 'persona', 'personas'))} · ${ui.esc(textoCantidad(total.prestamosActivos, 'préstamo activo', 'préstamos activos'))}</p>
    <div class="datos">
      ${datoResumen('Capital pendiente', dinero.formatear(total.capitalPendiente))}
      ${datoResumen('Intereses pendientes', dinero.formatear(total.interesPendiente), total.interesPendiente > 0 ? 'dato--alerta' : '')}
      ${datoResumen('Total recibido', dinero.formatear(total.totalRecibido))}
      ${datoResumen('Ganancia', dinero.formatear(total.ganancia), 'dato--ganancia')}
      ${datoResumen('Neto por recuperar', dinero.formatear(Math.max(0, total.netoRecuperar)))}
      ${total.proximoCobro ? datoResumen('Próximo cobro', `${fechas.formatear(total.proximoCobro.fecha)} · ${dinero.formatear(total.proximoCobro.monto)}`) : ''}
    </div>
  </section>`));

  raiz.append(ui.el(`<section class="seccion">
    <h2 class="seccion__titulo">Integrantes</h2>
    <ul class="lista">
      ${miembros.map((m) => `<li>${filaCliente(m, ctx)}</li>`).join('')}
    </ul>
  </section>`));

  contenedor.append(raiz);
}

// ---------- Formulario de cliente (nuevo y editar) ----------
function renderFormulario(contenedor, cliente, ctx) {
  const { ui, datos } = ctx;
  const esNuevo = !cliente;
  const valores = cliente || { nombre: '', alias: '', telefono: '', direccion: '', nota: '', grupo: '', tipo: 'cliente' };
  const rutaAtras = esNuevo ? '#/clientes' : `#/cliente/${encodeURIComponent(cliente.id)}`;

  // Grupos ya usados, para sugerirlos mientras escribe.
  const grupos = [...new Set(datos.listar('clientes').map((c) => c.grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

  const raiz = ui.el(`<div class="pantalla-clientes formulario-cliente">
    ${ui.encabezado(esNuevo ? 'Nuevo cliente' : 'Editar cliente', { atras: rutaAtras })}
    <form class="formulario" novalidate>
      ${ui.campo({ etiqueta: 'Nombre', nombre: 'nombre', valor: valores.nombre, requerido: true, placeholder: 'Nombre completo', atributos: { autocomplete: 'off', autocapitalize: 'words' } })}
      ${ui.campo({ etiqueta: 'Otros nombres con que lo conoces', nombre: 'alias', valor: valores.alias, ayuda: 'Por ejemplo: "Ernesto Empresa", "el de la moto"', atributos: { autocomplete: 'off' } })}
      ${ui.campo({ etiqueta: 'Teléfono', nombre: 'telefono', tipo: 'tel', valor: valores.telefono, ayuda: 'Con él puedes llamar o escribir por WhatsApp desde la ficha', placeholder: '300 123 4567' })}
      ${ui.campo({ etiqueta: 'Dirección', nombre: 'direccion', valor: valores.direccion, atributos: { autocomplete: 'off' } })}
      ${ui.campo({
        etiqueta: 'Tipo',
        nombre: 'tipo',
        tipo: 'select',
        valor: valores.tipo,
        ayuda: 'Familia: préstamos sin interés; no entran en la cartera de clientes',
        opciones: [
          { valor: 'cliente', texto: 'Cliente' },
          { valor: 'familia', texto: 'Familia' },
        ],
      })}
      ${ui.campo({ etiqueta: 'Grupo', nombre: 'grupo', valor: valores.grupo, ayuda: 'Varias personas con una sola cuenta, por ejemplo "Rosa y familia"', atributos: { list: 'lista-grupos', autocomplete: 'off' } })}
      <datalist id="lista-grupos">${grupos.map((g) => `<option value="${ui.esc(g)}"></option>`).join('')}</datalist>
      ${ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea', valor: valores.nota, placeholder: 'Lo que quieras recordar de esta persona' })}
      <div class="botones">
        <button type="submit" class="boton boton--primario boton--grande">${esNuevo ? 'Guardar cliente' : 'Guardar cambios'}</button>
        <a href="${rutaAtras}" class="boton boton--secundario boton--grande">Cancelar</a>
      </div>
    </form>
  </div>`);

  const form = raiz.querySelector('form');
  const botonGuardar = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const lectura = ui.leerFormulario(form);
    const campoNombre = form.querySelector('[name="nombre"]');
    if (!lectura.nombre) {
      ui.toast('Escribe el nombre del cliente.');
      campoNombre.focus();
      return;
    }

    const datosCliente = {
      nombre: lectura.nombre,
      alias: lectura.alias,
      telefono: lectura.telefono,
      direccion: lectura.direccion,
      tipo: lectura.tipo === 'familia' ? 'familia' : 'cliente',
      grupo: lectura.grupo,
      nota: lectura.nota,
    };

    botonGuardar.disabled = true;
    try {
      let guardado;
      if (esNuevo) {
        guardado = await datos.agregarCliente(datosCliente);
        ui.toast('Cliente guardado');
      } else {
        guardado = await datos.actualizarCliente({ ...datosCliente, id: cliente.id });
        ui.toast('Cambios guardados');
      }
      ctx.navegar(`/cliente/${encodeURIComponent(guardado.id)}`);
    } catch (error) {
      botonGuardar.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el cliente.');
    }
  });

  contenedor.append(raiz);
  if (esNuevo) {
    const campoNombre = form.querySelector('[name="nombre"]');
    if (campoNombre) campoNombre.focus();
  }
}
