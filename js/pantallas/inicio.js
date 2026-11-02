/*
  inicio.js: tablero de la pantalla Inicio (sección 8 de la especificación).
  Muestra tarjetas con el resumen del negocio (motor.resumenNegocio), los cobros
  de hoy y de esta semana (motor.agendaCobros) y los atajos "Nuevo préstamo" y
  "Registrar pago". No guarda nada: solo lee el estado y navega.

  Exporta render(contenedor, params, ctx) y titulo.
  ctx = { datos, motor, fechas, dinero, ui, navegar(ruta), hoy() }.
*/

export const titulo = 'Inicio';

// Texto en español del motivo de cada línea de la agenda.
const TEXTO_MOTIVO = {
  atrasado: 'Atrasado',
  interes: 'Interés',
  capital: 'Capital',
  acuerdo: 'Acuerdo de pago'
};

// Cuántas líneas de cobros se muestran en el tablero antes de mandar a la agenda.
const MAXIMO_LINEAS_COBROS = 5;

/**
 * Dibuja el tablero completo dentro del contenedor.
 */
export async function render(contenedor, params, ctx) {
  const { datos, motor, fechas, ui } = ctx;
  contenedor.innerHTML = '';

  const hoy = ctx.hoy();
  const estado = datos.estado;
  const nombreNegocio = (estado.config && estado.config.nombreNegocio) || 'Mis Préstamos';

  const pantalla = ui.el(`<div class="inicio"></div>`);
  pantalla.innerHTML = ui.encabezado('Resumen del negocio', { atras: '#/libro/prestamos', accion: { texto: 'Agenda', ruta: '#/agenda' } });
  pantalla.append(ui.el(`<p class="inicio__fecha suave">Hoy, ${ui.esc(fechas.formatear(hoy))}</p>`));
  contenedor.append(pantalla);

  // Atajos: siempre arriba, aunque todavía no haya datos.
  pantalla.append(ui.el(`
    <div class="botones inicio__atajos">
      <button type="button" class="boton boton--primario boton--grande" data-atajo="prestamo">Nuevo préstamo</button>
      <button type="button" class="boton boton--secundario boton--grande" data-atajo="pago">Registrar pago</button>
    </div>
  `));
  const lugarSelector = ui.el(`<div class="inicio__selector-lugar"></div>`);
  pantalla.append(lugarSelector);

  const hayClientes = estado.clientes.length > 0;
  const hayPrestamos = estado.prestamos.length > 0;

  if (!hayClientes && !hayPrestamos) {
    pantalla.append(ui.el(`
      <div class="vacio inicio__vacio">
        <p class="negrita">Todavía no tienes clientes ni préstamos.</p>
        <p>Crea tu primer cliente o carga los casos de prueba desde Ajustes.</p>
        <div class="botones inicio__vacio-botones">
          <a href="#/clientes/nuevo" class="boton boton--primario">Crear cliente</a>
          <a href="#/ajustes" class="boton boton--secundario">Ir a Ajustes</a>
        </div>
      </div>
    `));
  } else {
    let resumen;
    let agenda;
    try {
      resumen = motor.resumenNegocio(estado, hoy);
      agenda = motor.agendaCobros(estado, hoy, 7);
    } catch (error) {
      ui.toast(`No se pudo calcular el resumen: ${error.message}`);
      pantalla.append(ui.el(`<div class="error-pantalla"><p>No se pudo calcular el resumen del negocio.</p><p class="negrita">${ui.esc(error.message)}</p></div>`));
      return;
    }
    pantalla.append(tarjetasResumen(resumen, ctx));
    pantalla.append(tarjetaCobros(agenda, hoy, ctx));
    if (resumen.prestamosFamilia && resumen.prestamosFamilia.cantidad > 0) {
      pantalla.append(tarjetaFamilia(resumen.prestamosFamilia, ctx));
    }
  }

  // Clicks de los atajos: abren el selector de cliente en el mismo tablero.
  pantalla.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-atajo]');
    if (!boton) return;
    mostrarSelectorCliente(lugarSelector, boton.dataset.atajo, ctx);
  });
}

/* ---------------------------------------------------------------------- */
/* Tarjetas del resumen                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Tarjetas: capital en la calle, en riesgo, perdido, intereses cobrados,
 * cajas y ganancia disponible.
 */
function tarjetasResumen(resumen, ctx) {
  const { ui, dinero } = ctx;
  const plata = (n) => dinero.formatear(n);
  const clientesAtrasados = resumen.clientesAtrasados || 0;
  const textoClientes = clientesAtrasados === 1 ? '1 cliente atrasado' : `${clientesAtrasados} clientes atrasados`;

  // Detalle del capital en la calle: lo que está en legal o congelado, si hay.
  const detallesCalle = [`Intereses pendientes: ${plata(resumen.interesesPendientes)}`];
  if (resumen.capitalLegal > 0) detallesCalle.push(`En cobro legal: ${plata(resumen.capitalLegal)}`);
  if (resumen.capitalCongelado > 0) detallesCalle.push(`Congelado: ${plata(resumen.capitalCongelado)}`);

  const gananciaDisponible = resumen.gananciaDisponible || 0;
  const claseGanancia = gananciaDisponible < 0 ? 'texto-estado--vencido' : '';
  const detalleGanancia = gananciaDisponible < 0
    ? 'Has retirado más ganancia de la que has cobrado.'
    : `Cobrado en total: ${plata(resumen.interesesCobradosTotal)} · Ya retirado: ${plata(resumen.gananciaRetiradaTotal)}`;

  const bloque = ui.el(`<div class="inicio__resumen"></div>`);
  bloque.innerHTML = `
    <a href="#/clientes" class="tarjeta tarjeta--primario inicio__tarjeta-enlace">
      <p class="tarjeta__titulo">Capital en la calle</p>
      <p class="tarjeta__valor numero">${plata(resumen.capitalEnCalle)}</p>
      ${detallesCalle.map((texto) => `<p class="tarjeta__detalle">${ui.esc(texto)}</p>`).join('')}
    </a>

    <div class="tarjetas-dos margen-abajo">
      <a href="#/clientes" class="tarjeta inicio__tarjeta-enlace">
        <p class="tarjeta__titulo">Capital en riesgo</p>
        <p class="tarjeta__valor numero ${resumen.capitalEnRiesgo > 0 ? 'texto-estado--atrasado' : ''}">${plata(resumen.capitalEnRiesgo)}</p>
        <p class="tarjeta__detalle">${ui.esc(textoClientes)}</p>
      </a>
      <div class="tarjeta">
        <p class="tarjeta__titulo">Capital perdido</p>
        <p class="tarjeta__valor numero ${resumen.capitalPerdido > 0 ? 'texto-estado--perdido' : ''}">${plata(resumen.capitalPerdido)}</p>
        <p class="tarjeta__detalle">Marcado como "se voló"</p>
      </div>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Intereses cobrados</p>
      <div class="inicio__par">
        <div>
          <p class="tarjeta__valor numero texto-estado--al_dia">${plata(resumen.interesesCobradosMes)}</p>
          <p class="tarjeta__detalle">Este mes</p>
        </div>
        <div>
          <p class="tarjeta__valor numero">${plata(resumen.interesesCobradosAnio)}</p>
          <p class="tarjeta__detalle">Este año</p>
        </div>
      </div>
    </div>

    <div class="tarjetas-dos margen-abajo">
      <a href="#/caja" class="tarjeta inicio__tarjeta-enlace">
        <p class="tarjeta__titulo">Caja efectivo</p>
        <p class="tarjeta__valor numero ${resumen.cajas.efectivo < 0 ? 'texto-estado--vencido' : ''}">${plata(resumen.cajas.efectivo)}</p>
      </a>
      <a href="#/caja" class="tarjeta inicio__tarjeta-enlace">
        <p class="tarjeta__titulo">Caja virtual</p>
        <p class="tarjeta__valor numero ${resumen.cajas.virtual < 0 ? 'texto-estado--vencido' : ''}">${plata(resumen.cajas.virtual)}</p>
      </a>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Ganancia disponible</p>
      <p class="tarjeta__valor numero ${claseGanancia}">${plata(gananciaDisponible)}</p>
      <p class="tarjeta__detalle">${ui.esc(detalleGanancia)}</p>
      ${resumen.gananciaRetiradaMes > 0 ? `<p class="tarjeta__detalle">Retirado este mes: ${plata(resumen.gananciaRetiradaMes)}</p>` : ''}
      <div class="botones inicio__tarjeta-botones">
        <a href="#/caja/movimiento/ganancia_a_personal" class="boton boton--secundario">Pasar ganancia a lo personal</a>
      </div>
    </div>
  `;
  return bloque;
}

/**
 * Tarjeta de cobros: atrasados, hoy y esta semana, con las primeras líneas y
 * acceso a la agenda.
 */
function tarjetaCobros(agenda, hoy, ctx) {
  const { ui, dinero, fechas } = ctx;
  const plata = (n) => dinero.formatear(n);

  const atrasados = agenda.filter((linea) => linea.motivo === 'atrasado');
  const deHoy = agenda.filter((linea) => linea.motivo !== 'atrasado' && linea.fecha === hoy);
  const deSemana = agenda.filter((linea) => linea.motivo !== 'atrasado' && fechas.comparar(linea.fecha, hoy) > 0);
  const sumar = (lista) => lista.reduce((suma, linea) => suma + (linea.monto || 0), 0);

  const grupos = [
    { clave: 'atrasados', texto: 'Atrasados', lista: atrasados, clase: 'texto-estado--atrasado' },
    { clave: 'hoy', texto: 'Hoy', lista: deHoy, clase: 'texto-estado--al_dia' },
    { clave: 'semana', texto: 'Esta semana', lista: deSemana, clase: '' }
  ];

  const filasGrupos = grupos.map((grupo) => `
    <div class="inicio__cobro-grupo">
      <span class="inicio__cobro-nombre ${grupo.clase}">${ui.esc(grupo.texto)}</span>
      <span class="inicio__cobro-cantidad suave">${grupo.lista.length === 1 ? '1 cobro' : `${grupo.lista.length} cobros`}</span>
      <span class="inicio__cobro-monto numero ${grupo.clase}">${plata(sumar(grupo.lista))}</span>
    </div>
  `).join('');

  // Primeras líneas: atrasados primero, luego hoy, luego la semana (ese es el orden de la agenda).
  const primeras = agenda.slice(0, MAXIMO_LINEAS_COBROS);
  const lineas = primeras.map((linea) => {
    let motivo = TEXTO_MOTIVO[linea.motivo] || linea.motivo;
    if (linea.motivo === 'atrasado' && linea.mesesAtrasados > 0) {
      motivo += linea.mesesAtrasados === 1 ? ' · 1 mes' : ` · ${linea.mesesAtrasados} meses`;
    } else if (linea.motivo === 'acuerdo' && linea.texto) {
      motivo += `: ${linea.texto}`;
    }
    const fecha = linea.fecha === hoy ? 'Hoy' : fechas.formatear(linea.fecha);
    const claseMotivo = linea.motivo === 'atrasado' ? 'texto-estado--atrasado' : 'suave';
    return `
      <a href="#/prestamo/${encodeURIComponent(linea.prestamoId)}" class="fila">
        <div class="fila__principal">
          <div class="fila__titulo">${ui.esc(linea.nombre || 'Sin nombre')}</div>
          <div class="fila__detalle ${claseMotivo}">${ui.esc(fecha)} · ${ui.esc(motivo)}</div>
        </div>
        <div class="fila__lateral">
          <div class="fila__monto">${plata(linea.monto)}</div>
        </div>
        <span class="fila__flecha" aria-hidden="true">›</span>
      </a>
    `;
  }).join('');

  const restantes = agenda.length - primeras.length;
  const textoVerAgenda = restantes > 0 ? `Ver agenda (${restantes} más)` : 'Ver agenda';

  const tarjeta = ui.el(`<div class="tarjeta inicio__cobros"></div>`);
  tarjeta.innerHTML = `
    <p class="tarjeta__titulo">Cobros</p>
    <div class="inicio__cobro-grupos">${filasGrupos}</div>
    ${agenda.length === 0
      ? `<p class="suave inicio__sin-cobros">No hay cobros pendientes ni atrasados en los próximos 7 días.</p>`
      : `<div class="lista inicio__cobro-lista">${lineas}</div>`}
    <div class="botones inicio__tarjeta-botones">
      <a href="#/agenda" class="boton boton--primario">${ui.esc(textoVerAgenda)}</a>
    </div>
  `;
  return tarjeta;
}

/**
 * Tarjeta de préstamos a familia: aparte de la cartera de clientes (sección 4.3).
 */
function tarjetaFamilia(familia, ctx) {
  const { ui, dinero } = ctx;
  const plata = (n) => dinero.formatear(n);
  const cantidad = familia.cantidad === 1 ? '1 préstamo' : `${familia.cantidad} préstamos`;
  return ui.el(`
    <a href="#/clientes" class="tarjeta inicio__tarjeta-enlace">
      <p class="tarjeta__titulo">Préstamos a familia</p>
      <p class="tarjeta__valor numero texto-estado--familia">${plata(familia.deuda)}</p>
      <p class="tarjeta__detalle">${ui.esc(cantidad)} · Prestado ${plata(familia.prestado)} · Recibido ${plata(familia.recibido)}</p>
    </a>
  `);
}

/* ---------------------------------------------------------------------- */
/* Selector de cliente para los atajos                                     */
/* ---------------------------------------------------------------------- */

/**
 * Muestra un cuadro para elegir el cliente y seguir al formulario:
 * - 'prestamo' → #/prestamo/nuevo/:clienteId (cualquier cliente).
 * - 'pago'     → #/cliente/:clienteId/pago (solo clientes con al menos un
 *                préstamo activo: se excluyen los pagados y los perdidos).
 */
export function mostrarSelectorCliente(lugar, accion, ctx) {
  const { datos, motor, ui } = ctx;
  const esPago = accion === 'pago';
  const estado = datos.estado;

  let clientes = estado.clientes.slice();
  if (esPago) {
    // Solo clientes con algún préstamo que todavía se pueda pagar. Un cliente
    // cuyos préstamos están todos pagados o perdidos no tiene dónde aplicar un pago.
    let resultados;
    try {
      resultados = motor.calcularTodos(estado, ctx.hoy());
    } catch (error) {
      ui.toast(`No se pudo calcular el estado de los préstamos: ${error.message}`);
      return;
    }
    const conPrestamoActivo = new Set();
    for (const prestamo of estado.prestamos) {
      const resultado = resultados[prestamo.id];
      const estadoPrestamo = resultado ? resultado.estado : null;
      if (estadoPrestamo === 'pagado' || estadoPrestamo === 'perdido') continue;
      conPrestamoActivo.add(prestamo.clienteId);
    }
    clientes = clientes.filter((cliente) => conPrestamoActivo.has(cliente.id));
  }

  if (clientes.length === 0) {
    if (esPago) {
      ui.toast('No hay préstamos activos para registrar un pago.');
    } else {
      ui.toast('Primero crea un cliente.');
      ctx.navegar('#/clientes/nuevo');
    }
    return;
  }

  clientes.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

  const tituloSelector = esPago ? '¿De quién es el pago?' : '¿Para quién es el préstamo?';
  const selector = ui.el(`
    <div class="tarjeta inicio__selector">
      <div class="inicio__selector-cabeza">
        <h2 class="sin-margen">${ui.esc(tituloSelector)}</h2>
        <button type="button" class="boton boton--pequeno" data-cerrar>Cancelar</button>
      </div>
      <label class="campo">
        <span class="campo__etiqueta">Buscar cliente</span>
        <input type="search" name="busqueda" autocomplete="off" placeholder="Nombre o alias">
      </label>
      <div class="lista inicio__selector-lista"></div>
      ${esPago ? '' : `<div class="botones"><a href="#/clientes/nuevo" class="boton boton--secundario">Cliente nuevo</a></div>`}
    </div>
  `);

  const lista = selector.querySelector('.inicio__selector-lista');
  const busqueda = selector.querySelector('input[name="busqueda"]');

  function rutaDe(cliente) {
    const id = encodeURIComponent(cliente.id);
    return esPago ? `#/cliente/${id}/pago` : `#/prestamo/nuevo/${id}`;
  }

  function pintarLista() {
    const texto = String(busqueda.value || '').trim().toLowerCase();
    const filtrados = clientes.filter((cliente) => {
      if (!texto) return true;
      return String(cliente.nombre).toLowerCase().includes(texto)
        || String(cliente.alias || '').toLowerCase().includes(texto);
    });
    if (filtrados.length === 0) {
      lista.innerHTML = ui.vacio('Ningún cliente coincide con la búsqueda.');
      return;
    }
    lista.innerHTML = filtrados.map((cliente) => `
      <a href="${rutaDe(cliente)}" class="fila">
        <div class="fila__principal">
          <div class="fila__titulo">${ui.esc(cliente.nombre)}</div>
          ${cliente.alias ? `<div class="fila__detalle">${ui.esc(cliente.alias)}</div>` : ''}
        </div>
        ${cliente.tipo === 'familia' ? ui.chipEstado('familia') : ''}
        <span class="fila__flecha" aria-hidden="true">›</span>
      </a>
    `).join('');
  }

  busqueda.addEventListener('input', pintarLista);
  selector.querySelector('[data-cerrar]').addEventListener('click', () => {
    lugar.innerHTML = '';
  });

  pintarLista();
  lugar.innerHTML = '';
  lugar.append(selector);
  busqueda.focus();
  selector.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
