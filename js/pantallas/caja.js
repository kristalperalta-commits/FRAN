/*
  caja.js: pantalla de caja de Mis Préstamos.
  - #/caja: saldo de efectivo y de virtual, botones de movimiento, lista de movimientos
    con filtro por caja y por mes, y total del mes (entró, salió).
  - #/caja/movimiento/:tipo: formulario de aporte, retiro, traslado, ganancia a personal
    o saldo inicial.
  Solo usa datos, motor, fechas, dinero y ui a través de ctx. No depende de otras
  pantallas: solo navega a sus rutas.
*/

import { miPlata } from './fran.js';

// ---------- Textos ----------

const TEXTO_CAJA = { efectivo: 'Efectivo', virtual: 'Virtual' };

const TEXTO_TIPO = {
  prestamo: 'Préstamo',
  pago: 'Pago',
  aporte: 'Aporte',
  retiro: 'Retiro',
  traslado: 'Traslado',
  ganancia_a_personal: 'Ganancia a personal',
  saldo_inicial: 'Saldo inicial'
};

const TEXTO_ORIGEN = {
  arriendo: 'Arriendo',
  esposo: 'Esposo',
  pension: 'Pensión',
  propio: 'Plata propia',
  otro: 'Otro'
};

// Definición de cada formulario de movimiento manual.
const FORMULARIOS = {
  aporte: {
    titulo: 'Nuevo aporte',
    explicacion: 'Plata que entra a la caja desde afuera del negocio: arriendo, esposo, pensión o tu propia plata.',
    guardar: 'Guardar aporte',
    guardado: 'Aporte guardado',
    signo: 1,
    conOrigen: true
  },
  retiro: {
    titulo: 'Nuevo retiro',
    explicacion: 'Plata que sacas de la caja para otra cosa, sin ser ganancia.',
    guardar: 'Guardar retiro',
    guardado: 'Retiro guardado',
    signo: -1
  },
  traslado: {
    titulo: 'Traslado entre cajas',
    explicacion: 'Pasar plata de efectivo a virtual o de virtual a efectivo. Se anotan dos movimientos: sale de una caja y entra a la otra.',
    guardar: 'Guardar traslado',
    guardado: 'Traslado guardado',
    signo: -1,
    esTraslado: true
  },
  ganancia_a_personal: {
    titulo: 'Ganancia a personal',
    explicacion: 'Intereses ya cobrados que pasas a tu vida personal. Así sabes cuánta ganancia ya retiraste.',
    guardar: 'Pasar a personal',
    guardado: 'Ganancia pasada a personal',
    signo: -1,
    esGanancia: true
  },
  saldo_inicial: {
    titulo: 'Saldo inicial',
    explicacion: 'Lo que tenías en esa caja cuando empezaste a usar la app. Si en la virtual estabas debiendo plata de tu pareja, márcalo como "Debo esa plata" y queda en negativo.',
    guardar: 'Guardar saldo inicial',
    guardado: 'Saldo inicial guardado',
    signo: 1,
    conSentido: true
  }
};

const OPCIONES_SENTIDO = [
  { valor: 'tengo', texto: 'Tengo esa plata' },
  { valor: 'debo', texto: 'Debo esa plata' }
];

// Filtros de la lista: viven mientras la app esté abierta, para que un guardado no los borre.
const filtros = { caja: 'todas', mes: null };

// ---------- Exportaciones ----------

export function titulo(params) {
  if (params && params.vista === 'movimiento') {
    const def = FORMULARIOS[params.tipo];
    return def ? def.titulo : 'Movimiento';
  }
  return 'Caja';
}

export function render(contenedor, params, ctx) {
  contenedor.innerHTML = '';
  if (params.vista === 'movimiento') {
    renderMovimiento(contenedor, params, ctx);
  } else {
    renderLista(contenedor, ctx);
  }
}

// ---------- Ayudas ----------

function capitalizar(texto) {
  const t = String(texto || '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function montoConSigno(dinero, monto, signo) {
  return `${signo === -1 ? '−' : '+'} ${dinero.formatear(monto)}`;
}

function esManual(movimiento) {
  return !movimiento.prestamoId && !movimiento.pagoId;
}

// Ordena por fecha descendente; a igual fecha, el creado más tarde primero.
function ordenarMovimientos(fechas, lista) {
  return [...lista].sort((a, b) => {
    const porFecha = fechas.comparar(b.fecha, a.fecha);
    if (porFecha !== 0) return porFecha;
    return String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''));
  });
}

// Texto corto de un movimiento y a qué ficha lleva, usando préstamos, pagos y clientes.
function describirMovimiento(movimiento, indices, ui) {
  const { prestamos, pagos, clientes } = indices;
  const prestamo = movimiento.prestamoId ? prestamos.get(movimiento.prestamoId) : null;
  const pago = movimiento.pagoId ? pagos.get(movimiento.pagoId) : null;
  const clienteId = (prestamo && prestamo.clienteId) || (pago && pago.clienteId) || null;
  const cliente = clienteId ? clientes.get(clienteId) : null;
  const nombre = cliente ? ui.esc(cliente.nombre) : 'cliente sin nombre';
  const ruta = prestamo ? `#/prestamo/${encodeURIComponent(prestamo.id)}` : (cliente ? `#/cliente/${encodeURIComponent(cliente.id)}` : null);

  let tipoTexto = TEXTO_TIPO[movimiento.tipo] || capitalizar(String(movimiento.tipo).replace(/_/g, ' '));
  let detalle = '';

  switch (movimiento.tipo) {
    case 'prestamo':
      detalle = `Préstamo a ${nombre}`;
      break;
    case 'pago':
      detalle = `Pago de ${nombre}`;
      break;
    case 'aporte': {
      const origen = TEXTO_ORIGEN[movimiento.origen] || capitalizar(movimiento.origen);
      tipoTexto = origen ? `Aporte: ${origen}` : 'Aporte';
      if (prestamo) detalle = `Para el préstamo a ${nombre}`;
      break;
    }
    case 'traslado': {
      const otraCaja = movimiento.caja === 'efectivo' ? 'virtual' : 'efectivo';
      tipoTexto = movimiento.signo === -1
        ? `Traslado a ${TEXTO_CAJA[otraCaja].toLowerCase()}`
        : `Traslado desde ${TEXTO_CAJA[otraCaja].toLowerCase()}`;
      break;
    }
    default:
      break;
  }

  return { tipoTexto, detalle, ruta };
}

// ---------- Caja virtual mes a mes ----------

// Cuadro por mes de la caja virtual: entró, salió, saldo del mes y acumulado. Las cuentas
// virtuales son compartidas con su pareja: si el acumulado queda negativo, es plata de su
// pareja que ella usó. Muestra los últimos 12 meses; con el botón se ven todos.
const vistaVirtual = { todos: false };

function tablaVirtualPorMes(ctx, movimientos, hoy) {
  const { motor, fechas, dinero, ui } = ctx;
  const filas = motor.cajaPorMes(movimientos, 'virtual', fechas.mesDe(hoy));
  if (filas.length === 0) {
    return ui.el(`
      <div class="tarjeta caja-mensual">
        <p class="tarjeta__titulo">Virtual mes a mes</p>
        <p class="tarjeta__detalle">Cuando anotes movimientos en la caja virtual, aquí queda el cuadro de cada mes: entró, salió y cuánto va acumulado.</p>
      </div>
    `);
  }

  const ultima = filas[filas.length - 1];
  const recientes = [...filas].reverse();
  const visibles = vistaVirtual.todos ? recientes : recientes.slice(0, 12);
  const hayMas = recientes.length > visibles.length;

  const filaHtml = (f) => {
    const negativo = f.acumulado < 0;
    return `
      <tr class="${negativo ? 'caja-mensual__fila--negativa' : ''}">
        <th scope="row">${ui.esc(capitalizar(fechas.nombreMes(Number(f.mes.slice(5, 7)), true)))} ${ui.esc(f.mes.slice(0, 4))}</th>
        <td class="numero monto--entra">${dinero.formatear(f.entro)}</td>
        <td class="numero monto--sale">${dinero.formatear(f.salio)}</td>
        <td class="numero caja-mensual__del-mes${f.saldoMes < 0 ? ' monto--sale' : ''}">${dinero.formatear(f.saldoMes)}</td>
        <td class="numero negrita${negativo ? ' monto--sale' : ''}">${dinero.formatear(f.acumulado)}</td>
      </tr>
    `;
  };

  const aviso = ultima.acumulado < 0
    ? `<p class="caja-mensual__aviso">Plata de tu pareja usada: <strong class="numero">${dinero.formatear(-ultima.acumulado)}</strong>. Es lo que le debes a hoy en lo virtual.</p>`
    : `<p class="tarjeta__detalle">Acumulado a hoy: <strong class="numero">${dinero.formatear(ultima.acumulado)}</strong>. Si queda en negativo, es plata de tu pareja que usaste.</p>`;

  const tarjeta = ui.el(`
    <div class="tarjeta caja-mensual">
      <p class="tarjeta__titulo">Virtual mes a mes</p>
      ${aviso}
      <div class="caja-mensual__tabla">
        <table>
          <thead>
            <tr><th scope="col">Mes</th><th scope="col">Entró</th><th scope="col">Salió</th><th scope="col" class="caja-mensual__del-mes">Del mes</th><th scope="col">Acumulado</th></tr>
          </thead>
          <tbody>${visibles.map(filaHtml).join('')}</tbody>
        </table>
      </div>
      ${hayMas || vistaVirtual.todos ? `<button type="button" class="boton boton--secundario boton--pequeno caja-mensual__mas">${vistaVirtual.todos ? 'Ver solo los últimos 12 meses' : `Ver todos los meses (${recientes.length})`}</button>` : ''}
    </div>
  `);

  const botonMas = tarjeta.querySelector('.caja-mensual__mas');
  if (botonMas) {
    botonMas.addEventListener('click', () => {
      vistaVirtual.todos = !vistaVirtual.todos;
      tarjeta.replaceWith(tablaVirtualPorMes(ctx, movimientos, hoy));
    });
  }
  return tarjeta;
}

// ---------- Vista: lista ----------

function renderLista(contenedor, ctx) {
  const { datos, motor, fechas, dinero, ui } = ctx;
  const estado = datos.estado;
  const hoy = ctx.hoy();
  const movimientos = estado.movimientos || [];

  if (!filtros.mes) filtros.mes = fechas.mesDe(hoy);

  // El mismo efectivo y virtual que muestra Mi plata: caja de préstamos más lo anotado en los libros (3.48.0).
  const plataHoy = miPlata(ctx);
  const saldoEfectivo = plataHoy.efectivo;
  const saldoVirtual = plataHoy.virtual;
  const resumen = motor.resumenNegocio(estado, hoy);

  // Meses disponibles para el filtro: los que tienen movimientos más el mes de hoy.
  const meses = new Set([fechas.mesDe(hoy)]);
  for (const m of movimientos) meses.add(fechas.mesDe(m.fecha));
  const listaMeses = [...meses].sort((a, b) => fechas.comparar(b, a));
  if (filtros.mes !== 'todos' && !meses.has(filtros.mes)) filtros.mes = fechas.mesDe(hoy);

  // ----- Encabezado y saldos -----
  contenedor.append(ui.el(ui.encabezado('Caja')));

  const claseSaldo = (saldo) => (saldo < 0 ? ' caja-saldo--negativo' : '');
  contenedor.append(ui.el(`
    <div class="tarjetas-dos caja-saldos">
      <div class="tarjeta tarjeta--primario">
        <p class="tarjeta__titulo">Efectivo</p>
        <p class="tarjeta__valor caja-saldo${claseSaldo(saldoEfectivo)}">${dinero.formatear(saldoEfectivo)}</p>
      </div>
      <div class="tarjeta tarjeta--primario">
        <p class="tarjeta__titulo">Virtual</p>
        <p class="tarjeta__valor caja-saldo${claseSaldo(saldoVirtual)}">${dinero.formatear(saldoVirtual)}</p>
      </div>
    </div>
  `));

  contenedor.append(ui.el(`
    <div class="tarjeta caja-resumen">
      <div class="caja-resumen__linea">
        <span>Total en cajas</span>
        <strong class="numero">${dinero.formatear(saldoEfectivo + saldoVirtual)}</strong>
      </div>
      <div class="caja-resumen__linea">
        <span>Ganancia disponible</span>
        <strong class="numero${resumen.gananciaDisponible < 0 ? ' caja-texto-negativo' : ''}">${dinero.formatear(resumen.gananciaDisponible)}</strong>
      </div>
      <p class="tarjeta__detalle">Intereses cobrados menos la ganancia que ya pasaste a personal.</p>
    </div>
  `));

  // ----- Caja virtual mes a mes: el cuadrito que ella llevaba en el Excel -----
  contenedor.append(tablaVirtualPorMes(ctx, movimientos, hoy));

  // ----- Botones de movimiento -----
  contenedor.append(ui.el(`
    <div class="caja-acciones">
      <a href="#/caja/movimiento/aporte" class="boton boton--primario boton--grande">Aporte</a>
      <a href="#/caja/movimiento/retiro" class="boton boton--secundario boton--grande">Retiro</a>
      <a href="#/caja/movimiento/traslado" class="boton boton--secundario boton--grande">Traslado</a>
      <a href="#/caja/movimiento/ganancia_a_personal" class="boton boton--secundario boton--grande">Ganancia a personal</a>
      <a href="#/caja/movimiento/saldo_inicial" class="boton boton--secundario boton--grande caja-acciones__ancho">Saldo inicial</a>
    </div>
  `));

  // ----- Filtros -----
  const opcionesMes = [
    `<option value="todos"${filtros.mes === 'todos' ? ' selected' : ''}>Todos los meses</option>`,
    ...listaMeses.map((mes) => `<option value="${ui.esc(mes)}"${filtros.mes === mes ? ' selected' : ''}>${ui.esc(capitalizar(fechas.formatearMes(mes)))}</option>`)
  ].join('');

  const filtrosEl = ui.el(`
    <div class="caja-filtros">
      <label class="campo caja-filtros__campo" for="caja-filtro-caja">
        <span class="campo__etiqueta">Caja</span>
        <select id="caja-filtro-caja" name="caja">
          <option value="todas"${filtros.caja === 'todas' ? ' selected' : ''}>Las dos</option>
          <option value="efectivo"${filtros.caja === 'efectivo' ? ' selected' : ''}>Efectivo</option>
          <option value="virtual"${filtros.caja === 'virtual' ? ' selected' : ''}>Virtual</option>
        </select>
      </label>
      <label class="campo caja-filtros__campo" for="caja-filtro-mes">
        <span class="campo__etiqueta">Mes</span>
        <select id="caja-filtro-mes" name="mes">${opcionesMes}</select>
      </label>
    </div>
  `);
  contenedor.append(filtrosEl);

  filtrosEl.querySelector('#caja-filtro-caja').addEventListener('change', (evento) => {
    filtros.caja = evento.target.value;
    render(contenedor, { vista: 'lista' }, ctx);
  });
  filtrosEl.querySelector('#caja-filtro-mes').addEventListener('change', (evento) => {
    filtros.mes = evento.target.value;
    render(contenedor, { vista: 'lista' }, ctx);
  });

  // ----- Movimientos filtrados -----
  const filtrados = ordenarMovimientos(fechas, movimientos.filter((m) => {
    if (filtros.caja !== 'todas' && m.caja !== filtros.caja) return false;
    if (filtros.mes !== 'todos' && fechas.mesDe(m.fecha) !== filtros.mes) return false;
    return true;
  }));

  // Total del mes: entró y salió. Con las dos cajas juntas, los traslados no se cuentan
  // porque salen de una caja y entran a la otra: no es plata que entre ni salga del negocio.
  let entro = 0;
  let salio = 0;
  for (const m of filtrados) {
    if (filtros.caja === 'todas' && m.tipo === 'traslado') continue;
    if (m.signo === -1) salio += m.monto;
    else entro += m.monto;
  }
  const tituloTotal = filtros.mes === 'todos' ? 'Total de todos los meses' : `Total de ${fechas.formatearMes(filtros.mes)}`;
  contenedor.append(ui.el(`
    <div class="tarjeta caja-total">
      <p class="tarjeta__titulo">${ui.esc(tituloTotal)}${filtros.caja !== 'todas' ? ` · ${TEXTO_CAJA[filtros.caja]}` : ''}</p>
      <div class="caja-total__cifras">
        <div>
          <span class="suave">Entró</span>
          <strong class="monto monto--entra">+ ${dinero.formatear(entro)}</strong>
        </div>
        <div>
          <span class="suave">Salió</span>
          <strong class="monto monto--sale">− ${dinero.formatear(salio)}</strong>
        </div>
        <div>
          <span class="suave">Neto</span>
          <strong class="monto${entro - salio < 0 ? ' monto--sale' : ''}">${dinero.formatear(entro - salio)}</strong>
        </div>
      </div>
      ${filtros.caja === 'todas' ? '<p class="tarjeta__detalle">Sin contar traslados entre cajas.</p>' : ''}
    </div>
  `));

  if (movimientos.length === 0) {
    contenedor.append(ui.el(ui.vacio('Todavía no hay movimientos. Empieza con "Saldo inicial" para anotar lo que tienes en cada caja.')));
    return;
  }
  if (filtrados.length === 0) {
    contenedor.append(ui.el(ui.vacio('No hay movimientos en ese mes o en esa caja.')));
    return;
  }

  const indices = {
    prestamos: new Map((estado.prestamos || []).map((p) => [p.id, p])),
    pagos: new Map((estado.pagos || []).map((g) => [g.id, g])),
    clientes: new Map((estado.clientes || []).map((c) => [c.id, c]))
  };

  const lista = ui.el('<ul class="lista caja-lista"></ul>');
  for (const m of filtrados) {
    const { tipoTexto, detalle, ruta } = describirMovimiento(m, indices, ui);
    const claseMonto = m.signo === -1 ? 'monto--sale' : 'monto--entra';
    const enlace = ruta && detalle ? `<a href="${ui.esc(ruta)}" class="caja-movimiento__enlace">${detalle} ›</a>` : (detalle ? `<span>${detalle}</span>` : '');
    const nota = m.nota ? `<span class="caja-movimiento__nota">${ui.esc(m.nota)}</span>` : '';
    const borrar = esManual(m)
      ? `<button type="button" class="boton boton--pequeno caja-movimiento__borrar" data-borrar="${ui.esc(m.id)}" aria-label="Borrar movimiento">Borrar</button>`
      : '';
    lista.append(ui.el(`
      <li class="fila caja-movimiento">
        <div class="fila__principal">
          <div class="fila__titulo">${ui.esc(tipoTexto)}</div>
          <div class="caja-movimiento__detalle">
            <span class="suave">${ui.esc(fechas.formatear(m.fecha))} · ${TEXTO_CAJA[m.caja] || ui.esc(m.caja)}</span>
            ${enlace}
            ${nota}
          </div>
        </div>
        <div class="fila__lateral">
          <div class="fila__monto monto ${claseMonto}">${montoConSigno(dinero, m.monto, m.signo)}</div>
          ${borrar}
        </div>
      </li>
    `));
  }
  contenedor.append(lista);

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-borrar]');
    if (!boton) return;
    const id = boton.dataset.borrar;
    const movimiento = datos.obtener('movimientos', id);
    if (!movimiento) return;
    const pregunta = movimiento.tipo === 'traslado'
      ? `¿Borrar este traslado de ${dinero.formatear(movimiento.monto)}? Se borran la salida y la entrada.`
      : `¿Borrar este movimiento de ${dinero.formatear(movimiento.monto)}?`;
    if (!(await ui.confirmar(pregunta, { aceptar: 'Sí, borrar', peligro: true }))) return;
    boton.disabled = true;
    try {
      await datos.eliminarMovimiento(id);
      ui.toast('Movimiento borrado');
    } catch (error) {
      boton.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo borrar el movimiento');
    }
  });
}

// ---------- Vista: formulario de movimiento ----------

function selectorOpciones(ui, nombre, etiqueta, opciones, valorInicial, ayuda) {
  const botones = opciones.map((o) => `
    <button type="button" class="opcion${o.valor === valorInicial ? ' opcion--activa' : ''}" data-valor="${ui.esc(o.valor)}" aria-pressed="${o.valor === valorInicial ? 'true' : 'false'}">${ui.esc(o.texto)}</button>
  `).join('');
  return `
    <div class="campo caja-selector" data-selector="${ui.esc(nombre)}">
      <span class="campo__etiqueta">${ui.esc(etiqueta)}</span>
      <div class="opciones">${botones}</div>
      <input type="hidden" name="${ui.esc(nombre)}" value="${ui.esc(valorInicial)}">
      ${ayuda ? `<span class="campo__ayuda">${ui.esc(ayuda)}</span>` : ''}
    </div>
  `;
}

function valorSelector(form, nombre) {
  const entrada = form.querySelector(`input[type="hidden"][name="${nombre}"]`);
  return entrada ? entrada.value : '';
}

function fijarSelector(form, nombre, valor) {
  const selector = form.querySelector(`[data-selector="${nombre}"]`);
  if (!selector) return;
  selector.querySelectorAll('.opcion').forEach((boton) => {
    const activa = boton.dataset.valor === valor;
    boton.classList.toggle('opcion--activa', activa);
    boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
  });
  const entrada = selector.querySelector('input[type="hidden"]');
  if (entrada) entrada.value = valor;
}

function renderMovimiento(contenedor, params, ctx) {
  const { datos, motor, fechas, dinero, ui } = ctx;
  const tipo = params.tipo;
  const def = FORMULARIOS[tipo];

  if (!def) {
    contenedor.append(ui.el(ui.encabezado('Movimiento', { atras: '#/caja' })));
    contenedor.append(ui.el(ui.vacio(`No existe el tipo de movimiento "${tipo}".`)));
    contenedor.append(ui.el('<a href="#/caja" class="boton boton--primario boton--grande">Volver a la caja</a>'));
    return;
  }

  const estado = datos.estado;
  const hoy = ctx.hoy();
  const movimientos = estado.movimientos || [];
  const saldos = {
    efectivo: miPlata(ctx).efectivo,
    virtual: miPlata(ctx).virtual
  };
  const gananciaDisponible = def.esGanancia ? motor.resumenNegocio(estado, hoy).gananciaDisponible : null;

  contenedor.append(ui.el(ui.encabezado(def.titulo, { atras: '#/caja' })));
  contenedor.append(ui.el(`<p class="caja-explicacion">${ui.esc(def.explicacion)}</p>`));

  if (def.esGanancia) {
    contenedor.append(ui.el(`
      <div class="tarjeta caja-resumen">
        <div class="caja-resumen__linea">
          <span>Ganancia disponible</span>
          <strong class="numero${gananciaDisponible < 0 ? ' caja-texto-negativo' : ''}">${dinero.formatear(gananciaDisponible)}</strong>
        </div>
        <p class="tarjeta__detalle">Intereses cobrados menos lo que ya pasaste a personal.</p>
      </div>
    `));
  }

  const opcionesCaja = [
    { valor: 'efectivo', texto: `Efectivo · ${dinero.formatear(saldos.efectivo)}` },
    { valor: 'virtual', texto: `Virtual · ${dinero.formatear(saldos.virtual)}` }
  ];

  let camposHtml = ui.campoFecha({ etiqueta: 'Fecha', nombre: 'fecha', valor: hoy, requerido: true });

  if (def.esTraslado) {
    camposHtml += selectorOpciones(ui, 'de', 'Sale de', opcionesCaja, 'efectivo');
    camposHtml += selectorOpciones(ui, 'a', 'Entra a', opcionesCaja, 'virtual');
  } else {
    camposHtml += selectorOpciones(ui, 'caja', 'Caja', opcionesCaja, 'efectivo');
  }

  camposHtml += ui.campoDinero({ etiqueta: 'Monto', nombre: 'monto', requerido: true, ayuda: 'En pesos. Puedes escribir 200k o 1.5M.' });

  if (def.conSentido) {
    camposHtml += selectorOpciones(ui, 'sentido', 'Esa plata', OPCIONES_SENTIDO, 'tengo', 'Elige "Debo esa plata" si la caja arranca en negativo.');
  }

  if (def.conOrigen) {
    camposHtml += selectorOpciones(
      ui,
      'origen',
      'De dónde sale la plata',
      Object.keys(TEXTO_ORIGEN).map((valor) => ({ valor, texto: TEXTO_ORIGEN[valor] })),
      'propio'
    );
  }

  camposHtml += ui.campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea', placeholder: 'Opcional. Por ejemplo: para el mercado.' });

  const form = ui.el(`
    <form class="formulario caja-formulario" novalidate>
      ${camposHtml}
      <p class="caja-previa" id="caja-previa" aria-live="polite"></p>
      <div class="botones caja-formulario__botones">
        <a href="#/caja" class="boton boton--secundario">Cancelar</a>
        <button type="submit" class="boton boton--primario">${ui.esc(def.guardar)}</button>
      </div>
    </form>
  `);
  contenedor.append(form);

  // ----- Selectores de opción (caja, de, a, origen) -----
  form.addEventListener('click', (evento) => {
    const boton = evento.target.closest('.opcion');
    if (!boton) return;
    const selector = boton.closest('[data-selector]');
    if (!selector || !form.contains(selector)) return;
    const nombre = selector.dataset.selector;
    const valor = boton.dataset.valor;
    fijarSelector(form, nombre, valor);
    // En un traslado, si eligen la misma caja de salida y de entrada, se cambia la otra sola.
    if (def.esTraslado) {
      const otra = valor === 'efectivo' ? 'virtual' : 'efectivo';
      if (nombre === 'de' && valorSelector(form, 'a') === valor) fijarSelector(form, 'a', otra);
      if (nombre === 'a' && valorSelector(form, 'de') === valor) fijarSelector(form, 'de', otra);
    }
    actualizarPrevia();
  });

  // ----- Vista previa: cómo quedan las cajas -----
  const previa = form.querySelector('#caja-previa');
  function actualizarPrevia() {
    const valores = ui.leerFormulario(form);
    const monto = valores.monto;
    if (!(monto > 0)) {
      previa.textContent = '';
      return;
    }
    if (def.esTraslado) {
      const de = valores.de;
      const a = valores.a;
      if (de === a) {
        previa.textContent = 'Elige dos cajas distintas.';
        return;
      }
      previa.textContent = `${TEXTO_CAJA[de]} quedará en ${dinero.formatear(saldos[de] - monto)} y ${TEXTO_CAJA[a].toLowerCase()} en ${dinero.formatear(saldos[a] + monto)}.`;
      return;
    }
    const caja = valores.caja;
    const signoReal = def.conSentido && valores.sentido === 'debo' ? -1 : def.signo;
    const nuevoSaldo = saldos[caja] + signoReal * monto;
    let texto = `${TEXTO_CAJA[caja]} quedará en ${dinero.formatear(nuevoSaldo)}.`;
    if (signoReal === -1 && def.conSentido && caja === 'virtual') {
      texto += ' Es plata de tu pareja que ya usaste.';
    }
    if (def.esGanancia) {
      texto += ` Ganancia disponible después: ${dinero.formatear(gananciaDisponible - monto)}.`;
    }
    previa.textContent = texto;
  }
  form.addEventListener('input', actualizarPrevia);
  form.addEventListener('change', actualizarPrevia);

  // ----- Guardar -----
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(form);
    const monto = valores.monto;
    const fecha = valores.fecha;

    if (!fechas.esFechaValida(fecha)) {
      ui.toast('Escribe una fecha válida.');
      form.querySelector('[name="fecha"]').focus();
      return;
    }
    if (fechas.comparar(fecha, hoy) > 0) {
      ui.toast('La fecha no puede ser después de hoy.');
      form.querySelector('[name="fecha"]').focus();
      return;
    }
    if (!Number.isInteger(monto) || monto <= 0) {
      ui.toast('Escribe un monto mayor que cero.');
      form.querySelector('[name="monto"]').focus();
      return;
    }

    let movimiento;
    if (def.esTraslado) {
      if (valores.de === valores.a) {
        ui.toast('Un traslado debe ir de una caja a la otra.');
        return;
      }
      movimiento = { tipo, fecha, de: valores.de, a: valores.a, monto, nota: valores.nota };
    } else {
      movimiento = { tipo, fecha, caja: valores.caja, monto, nota: valores.nota };
      if (def.conOrigen) movimiento.origen = valores.origen || 'propio';
      if (def.conSentido && valores.sentido === 'debo') movimiento.negativo = true;
    }

    // Avisos antes de guardar: saldo que queda negativo, ganancia que se pasa de lo disponible.
    // Un saldo inicial en negativo es a propósito, así que no se pregunta.
    const cajaQueSale = def.esTraslado ? valores.de : (def.signo === -1 ? valores.caja : null);
    if (cajaQueSale && saldos[cajaQueSale] - monto < 0) {
      const pregunta = `En ${TEXTO_CAJA[cajaQueSale].toLowerCase()} hay ${dinero.formatear(saldos[cajaQueSale])} y vas a sacar ${dinero.formatear(monto)}. El saldo quedará en ${dinero.formatear(saldos[cajaQueSale] - monto)}. ¿Guardar de todas formas?`;
      if (!(await ui.confirmar(pregunta, { aceptar: 'Sí, guardar' }))) return;
    }
    if (def.esGanancia && monto > gananciaDisponible) {
      const pregunta = `La ganancia disponible es ${dinero.formatear(gananciaDisponible)} y vas a pasar ${dinero.formatear(monto)}. ¿Guardar de todas formas?`;
      if (!(await ui.confirmar(pregunta, { aceptar: 'Sí, guardar' }))) return;
    }

    const botonGuardar = form.querySelector('button[type="submit"]');
    botonGuardar.disabled = true;
    try {
      await datos.movimientoCaja(movimiento);
      ui.toast(def.guardado);
      filtros.mes = fechas.mesDe(fecha); // que la lista muestre el mes donde quedó el movimiento
      ctx.navegar('/caja');
    } catch (error) {
      botonGuardar.disabled = false;
      ui.toast(error && error.message ? error.message : 'No se pudo guardar el movimiento');
    }
  });

  const campoMonto = form.querySelector('[name="monto"]');
  if (campoMonto) campoMonto.focus();
}
