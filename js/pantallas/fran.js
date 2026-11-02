/*
  fran.js: las pantallas de Fran, siguiendo los bocetos del plan maestro.
  Principal, Otros libros, y por libro: Inicio, Gráficos, Calendario, Informes y Agregar.
  También: registrar en Préstamos, ficha del cliente, agenda y movimientos de pensión.
*/

import { leerTexto } from '../texto.js';

export const LIBROS = {
  personal: { nombre: 'Finanzas personales', corto: 'Finanzas', icono: '💚', color: '#22C55E' },
  prestamos: { nombre: 'Préstamos', corto: 'Préstamos', icono: '💙', color: '#3B82F6' },
  pension: { nombre: 'Pensión', corto: 'Pensión', icono: '💜', color: '#A855F7' },
  productos: { nombre: 'Productos', corto: 'Productos', icono: '🧡', color: '#F97316' },
  arriendos: { nombre: 'Arriendos', corto: 'Arriendos', icono: '💛', color: '#EAB308' },
  redes: { nombre: 'Redes y trabajos', corto: 'Redes y trabajos', icono: '🩷', color: '#EC4899' },
  terceros: { nombre: 'Plata de terceros', corto: 'Plata de terceros', icono: '🤍', color: '#64748B' },
};

// Qué ofrece el botón + de cada libro: [texto, clave, tipo guardado].
const TIPOS = {
  personal: [['Gasto', 'gasto', 'gasto'], ['Ingreso', 'ingreso', 'ingreso'], ['Transferencia', 'transferencia', 'transferencia']],
  arriendos: [['Ingreso', 'ingreso', 'ingreso'], ['Gasto de la propiedad', 'gasto', 'gasto']],
  redes: [['Ingreso', 'ingreso', 'ingreso'], ['Gasto', 'gasto', 'gasto']],
  productos: [['Inversión', 'inversion', 'gasto'], ['Venta', 'ingreso', 'ingreso'], ['Gasto', 'gasto', 'gasto']],
  terceros: [['Recibí', 'ingreso', 'ingreso'], ['Devolví', 'gasto', 'gasto'], ['Usé', 'uso', 'gasto']],
};

const CATEGORIAS_BASE = {
  personal: {
    gasto: ['Alimentos', 'Vivienda', 'Carro', 'Gasolina', 'Servicios públicos', 'Compras', 'Medicina', 'Abogados', 'Social', 'Viajes', 'Electrónicos', 'Belleza', 'Deportes', 'Entretenimiento', 'Transporte', 'Otros'],
    ingreso: ['Salario', 'Inversiones', 'Tiempo parcial', 'Premios', 'Ingreso mensual', 'Negocio Ropa', 'Otros'],
  },
  arriendos: { ingreso: ['Prado', 'Laguna', 'Bodega mamá', 'Miguel', 'Apartamento la 17'], gasto: ['Mano de obra', 'Servicios de las casas', 'Remodelación', 'Materiales', 'Trámites'] },
  redes: { ingreso: ['Redes sociales', 'Trabajo audiovisual'], gasto: ['Redes sociales', 'Videos'] },
  productos: { inversion: ['Inventario sin vender', 'Inversiones'], ingreso: ['Ventas'], gasto: ['Gasto de productos'] },
  terceros: { ingreso: ['Abuelos', 'Esposo'], gasto: ['Abuelos', 'Esposo'], uso: ['Préstamo interno'] },
};

const CUENTAS = ['Efectivo', 'Nequi propio', 'Nequi papá', 'Uno propio', 'Uno Garu', 'Bancolombia', 'Tarjeta comida', 'Tarjeta gasolina', 'Tarjeta Gold'];
const COLORES = ['#22C55E', '#3B82F6', '#F97316', '#EC4899', '#A855F7', '#EAB308', '#14B8A6', '#94A3B8'];

const ICONOS = [
  [/aliment|comida|mercado/, '🍎'], [/vivienda|hogar/, '🏠'], [/carro|auto/, '🚗'], [/gasolina|combustible/, '⛽'],
  [/servicio/, '💡'], [/compra/, '🛍️'], [/medicina|salud/, '💊'], [/abogado/, '⚖️'], [/social/, '👥'], [/viaje/, '✈️'],
  [/electronic/, '📱'], [/belleza/, '💄'], [/deporte/, '⚽'], [/entreten/, '🎬'], [/transporte/, '🚌'], [/educacion/, '📚'],
  [/regalo/, '🎁'], [/agua/, '💧'], [/ropa/, '👕'], [/tarjeta/, '💳'], [/descuadre/, '❓'], [/deuda/, '📄'],
  [/interes|prestamo/, '💵'], [/prado|laguna|bodega|miguel|apartamento|franklin|arriendo/, '🏢'], [/mano de obra/, '👷'],
  [/remodel/, '🎨'], [/material/, '🧱'], [/tramite/, '📑'], [/casas/, '🏗️'], [/redes|youtube|video/, '📺'], [/audiovisual/, '🎬'],
  [/inventario|venta|producto/, '📦'], [/inversion/, '📈'], [/salario|ingreso|tiempo|premio/, '💰'], [/abuelo|esposo/, '🤝'],
  [/transferencia/, '🔁'], [/total|resto/, '🧾'],
];

const vista = { mes: null, tipo: 'gasto', orden: 'cantidad', anio: null };

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function iconoDe(categoria) {
  const n = norm(categoria);
  for (const [patron, emoji] of ICONOS) if (patron.test(n)) return emoji;
  return '🔖';
}

export const titulo = (params) => (params && LIBROS[params.libro] ? LIBROS[params.libro].nombre : '');

// ---------- Cálculos ----------

function nombreCliente(ctx, id) {
  const c = ctx.datos.estado.clientes.find((x) => x.id === id);
  return c ? c.nombre : 'Cliente';
}

/** Movimientos de los libros, más los intereses de los pagos registrados en la app. */
function asientos(ctx) {
  const estado = ctx.datos.estado;
  const propios = (estado.fran && estado.fran.asientos) || [];
  const deIntereses = estado.pagos.filter((g) => g.tipo !== 'perdon' && g.interes > 0).map((g) => ({
    id: `pago-${g.id}`, libro: 'prestamos', fecha: g.fecha, tipo: 'ingreso', categoria: 'Intereses cobrados',
    descripcion: nombreCliente(ctx, g.clienteId), valor: g.interes, persona: nombreCliente(ctx, g.clienteId), importado: true,
  }));
  return [...propios, ...deIntereses];
}

function delLibro(lista, libro) {
  if (libro === 'personal') return lista.filter((a) => a.libro === 'personal' || (a.tipo === 'ingreso' && !['terceros', 'pension'].includes(a.libro)));
  return lista.filter((a) => a.libro === libro);
}

const sumar = (lista) => lista.reduce((s, a) => s + a.valor, 0);
const mesDe = (a) => a.fecha.slice(0, 7);
const delMes = (lista, mes) => lista.filter((a) => mesDe(a) === mes);
const deTipo = (lista, tipo) => lista.filter((a) => a.tipo === tipo);

/** El mes más reciente con datos, sin pasar de hoy. */
function ultimoMes(ctx, lista) {
  const actual = ctx.hoy().slice(0, 7);
  let mejor = null;
  for (const a of lista) { const m = mesDe(a); if (m <= actual && (!mejor || m > mejor)) mejor = m; }
  return mejor || actual;
}

function mesVisible(ctx, lista) {
  return vista.mes || ultimoMes(ctx, lista);
}

function moverMes(mes, n, ctx) {
  return ctx.fechas.mesDe(ctx.fechas.sumarMeses(`${mes}-01`, n));
}

function totalPension(fran) {
  const p = fran.pension;
  return p.cuentas.reduce((s, c) => s + Math.round(c.usd * p.tasa), 0) + p.otros.reduce((s, o) => s + o.cop, 0);
}

function totalTerceros(ctx) {
  const fran = ctx.datos.estado.fran;
  const m = delLibro(asientos(ctx), 'terceros');
  return fran.terceros.reduce((s, t) => s + t.valor, 0) + sumar(deTipo(m, 'ingreso')) - sumar(deTipo(m, 'gasto'));
}

export function miPlata(ctx) {
  const { motor, datos } = ctx;
  const estado = datos.estado;
  let efectivo = motor.saldoCaja(estado.movimientos, 'efectivo');
  let virtual = motor.saldoCaja(estado.movimientos, 'virtual');
  let tarjetas = (estado.fran.tarjetas || []).reduce((s, t) => s + (t.deuda || 0), 0);
  const mover = (cuenta, valor) => {
    if (!cuenta) return;
    if (cuenta === 'Efectivo') efectivo += valor;
    else if (cuenta.startsWith('Tarjeta')) tarjetas -= valor;
    else virtual += valor;
  };
  for (const a of estado.fran.asientos || []) {
    if (a.libro === 'terceros') continue;
    if (a.tipo === 'transferencia') { mover(a.cuenta, -a.valor); mover(a.destino, a.valor); }
    else if (a.tipo === 'ingreso') mover(a.cuenta, a.valor);
    else mover(a.cuenta, -a.valor);
  }
  return { efectivo, virtual, tarjetas, total: efectivo + virtual - tarjetas };
}

function clientesPorEstado(ctx) {
  const { datos, motor } = ctx;
  const estado = datos.estado;
  const conteo = { al_dia: 0, por_confirmar: 0, atrasado: 0, congelado: 0, legal: 0, perdido: 0 };
  for (const c of estado.clientes) {
    if (c.tipo === 'familia') continue;
    const propios = estado.prestamos.filter((p) => p.clienteId === c.id);
    if (!propios.length) continue;
    const r = motor.resumenCliente(c, propios, estado.pagos.filter((g) => g.clienteId === c.id), ctx.hoy());
    const e = r.estado === 'vencido' ? 'atrasado' : r.estado;
    if (e in conteo) conteo[e] += 1;
  }
  return conteo;
}

function fechaLinda(fecha, ctx) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(a, m - 1, d).getDay()];
  return `${d} ${ctx.fechas.nombreMes(m, true)} · ${dia}`;
}

// ---------- Piezas comunes ----------

function titular(id, ctx, atras, texto) {
  const { ui } = ctx;
  const l = LIBROS[id];
  return `<header class="fran-titulo">
    ${atras ? `<a href="${ui.esc(atras)}" class="fran-titulo__atras" aria-label="Volver">‹</a>` : ''}
    <h1>${ui.esc(l.icono)} ${ui.esc(texto || l.corto)}</h1>
  </header>`;
}

function caja3(a, b, c, ctx) {
  const { ui } = ctx;
  return `<div class="fran-caja3">${[a, b, c].map(([t, v]) => `<div><small>${ui.esc(t)}</small><strong class="numero">${ui.esc(v)}</strong></div>`).join('')}</div>`;
}

function selectorMes(mes, ctx) {
  const { ui, fechas } = ctx;
  return `<div class="fran-mes">
    <button type="button" data-mes="-1" aria-label="Mes anterior">◀</button>
    <span>${ui.esc(fechas.formatearMes(mes))}</span>
    <button type="button" data-mes="1" aria-label="Mes siguiente">▶</button>
  </div>`;
}

function conectarMes(raiz, mes, ctx, redibujar) {
  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => {
    vista.mes = moverMes(mes, Number(b.dataset.mes), ctx);
    redibujar();
  }));
}

function fila({ icono, titulo: t, sub, derecha, clase = '', ruta, ui }) {
  const interior = `<span class="fran-ico">${ui.esc(icono)}</span>
    <span class="fran-fila__texto"><strong>${ui.esc(t)}</strong>${sub ? `<small>${ui.esc(sub)}</small>` : ''}</span>
    <span class="fran-fila__valor numero ${clase}">${ui.esc(derecha)}</span>`;
  return ruta ? `<a class="fran-fila" href="${ui.esc(ruta)}">${interior}</a>` : `<div class="fran-fila">${interior}</div>`;
}

function listaPorDia(lista, ctx) {
  const { ui, dinero } = ctx;
  const orden = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const dias = new Map();
  for (const a of orden) { if (!dias.has(a.fecha)) dias.set(a.fecha, []); dias.get(a.fecha).push(a); }
  let html = '';
  for (const [dia, filas] of dias) {
    const g = sumar(deTipo(filas, 'gasto'));
    const i = sumar(deTipo(filas, 'ingreso'));
    html += `<div class="fran-dia"><span>${ui.esc(fechaLinda(dia, ctx))}</span><span>${g ? `G: ${dinero.formatear(g)} ` : ''}${i ? `I: ${dinero.formatear(i)}` : ''}</span></div>`;
    for (const a of filas) {
      const signo = a.tipo === 'ingreso' ? '+' : (a.tipo === 'gasto' ? '−' : '');
      html += fila({ ui, icono: iconoDe(a.categoria), titulo: a.categoria, sub: a.descripcion, derecha: `${signo}${dinero.formatear(a.valor)}`, clase: a.tipo === 'ingreso' ? 'fran-mas' : (a.tipo === 'gasto' ? 'fran-menos' : '') });
    }
  }
  return html || `<p class="fran-vacio">No hay movimientos en este mes.</p>`;
}

function chips(nombre, valores, inicial, ui) {
  return `<div class="fran-chips" data-chips="${ui.esc(nombre)}">${valores.map((v) => {
    const [val, txt] = Array.isArray(v) ? v : [v, v];
    return `<button type="button" class="${val === inicial ? 'activo' : ''}" data-valor="${ui.esc(val)}">${ui.esc(txt)}</button>`;
  }).join('')}<input type="hidden" name="${ui.esc(nombre)}" value="${ui.esc(inicial)}"></div>`;
}

function conectarChips(raiz, alCambiar) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-valor]');
    if (!b) return;
    const caja = b.closest('[data-chips]');
    caja.querySelectorAll('[data-valor]').forEach((x) => x.classList.toggle('activo', x === b));
    caja.querySelector('input').value = b.dataset.valor;
    if (alCambiar) alCambiar(caja.dataset.chips, b.dataset.valor);
  });
}

// ---------- Pantalla principal (boceto 2) ----------

function detalleCategorias(lista) {
  const nombres = [...new Set(lista.map((a) => a.categoria))].slice(0, 3);
  return nombres.join(' · ');
}

function agendaDeHoy(ctx) {
  const hoy = ctx.hoy();
  return (ctx.datos.estado.fran.agenda || []).filter((x) => !hecho(x, hoy) && (x.repite === 'diario' ? (!x.desde || x.desde <= hoy) : x.fecha && x.fecha <= hoy));
}

function renderPrincipal(contenedor, ctx) {
  const { ui, dinero, datos, motor, fechas } = ctx;
  const estado = datos.estado;
  const fran = estado.fran;
  const lista = asientos(ctx);
  const plata = miPlata(ctx);
  const verde = delLibro(lista, 'personal');
  const mes = ultimoMes(ctx, verde);
  const m = delMes(verde, mes);
  const nombreMes = fechas.nombreMes(Number(mes.slice(5, 7)));
  const resumen = motor.resumenNegocio(estado, ctx.hoy());
  const c = clientesPorEstado(ctx);
  const estados = [['Por confirmar', c.por_confirmar], ['Al día', c.al_dia], ['Atrasados', c.atrasado], ['Congelados', c.congelado]].filter((x) => x[1]).map((x) => `${x[0]} ${x[1]}`).join(' · ');
  const usd = fran.pension.cuentas.reduce((s, x) => s + x.usd, 0);
  const invertido = sumar(deTipo(delLibro(lista, 'productos'), 'gasto'));
  const hoyAgenda = agendaDeHoy(ctx);
  const sinDatos = !estado.clientes.length && !fran.asientos.length;
  const grande = (id, valor, detalle) => `<a href="#/libro/${id}" class="fran-libro fran-libro--${id}">
    <span class="fran-libro__nombre"><i>${LIBROS[id].icono}</i>${ui.esc(id === 'personal' ? 'Finanzas personales' : LIBROS[id].corto)}</span>
    <span class="fran-libro__valor numero">${ui.esc(valor)}</span>
    <span class="fran-libro__detalle">${ui.esc(detalle)}</span>
  </a>`;
  const chica = (id) => `<a href="#/otros" class="fran-libro-chico fran-libro--${id}"><i>${LIBROS[id].icono}</i><span>${ui.esc(LIBROS[id].corto)}</span></a>`;

  contenedor.append(ui.el(`<div class="fran-principal">
    <header class="fran-titulo fran-titulo--principal"><h1>Fran</h1><a href="#/ajustes" class="fran-yo" aria-label="Yo y ajustes">Yo</a></header>
    <div class="fran-plata">
      <small>Mi plata propia hoy</small>
      <strong class="numero">${dinero.formatear(plata.total)}</strong>
      <small>Efectivo ${dinero.formatear(plata.efectivo)} · Virtual ${fran.virtualPorDefinir ? 'por confirmar' : dinero.formatear(plata.virtual)} · Tarjetas −${dinero.formatear(plata.tarjetas)}</small>
    </div>
    ${sinDatos ? `<a href="#/ajustes" class="fran-aviso">Todavía no están tus datos en este aparato. Toca aquí y entra a la nube con tu correo.</a>` : ''}
    ${hoyAgenda.length ? `<a href="#/agenda" class="fran-aviso">⏰ Cobros de hoy: ${hoyAgenda.length}. Toca para ver.</a>` : ''}
    <div class="fran-libros">
      ${grande('personal', dinero.formatear(sumar(deTipo(m, 'ingreso')) - sumar(deTipo(m, 'gasto'))), `Saldo de ${nombreMes}`)}
      ${grande('prestamos', dinero.formatear(resumen.capitalEnCalle), estados || 'Cartera')}
      ${grande('pension', dinero.formatear(totalPension(fran)), `${dinero.formatear(usd)} USD + efectivo + carro`)}
      ${grande('productos', dinero.formatear(invertido), 'Invertido')}
    </div>
    <div class="fran-libros-chicos">${chica('arriendos')}${chica('redes')}${chica('terceros')}</div>
  </div>`));
}

// ---------- Otros libros (boceto 14) ----------

function renderOtros(contenedor, ctx) {
  const { ui, dinero, datos, fechas } = ctx;
  const lista = asientos(ctx);
  const tarjeta = (id, valor, detalle) => `<a href="#/libro/${id}" class="fran-libro fran-libro--ancho fran-libro--${id}">
    <span class="fran-libro__nombre"><i>${LIBROS[id].icono}</i>${ui.esc(LIBROS[id].nombre)}</span>
    <span class="fran-libro__valor numero">${ui.esc(dinero.formatear(valor))}</span>
    <span class="fran-libro__detalle">${ui.esc(detalle)}</span>
  </a>`;
  const ingresosDe = (id) => {
    const l = deTipo(delLibro(lista, id), 'ingreso');
    const mes = ultimoMes(ctx, l);
    const m = delMes(l, mes);
    return [sumar(m), `${fechas.formatearMes(mes)}${detalleCategorias(m) ? ` · ${detalleCategorias(m)}` : ''}`];
  };
  const [a, ad] = ingresosDe('arriendos');
  const [r, rd] = ingresosDe('redes');
  const t = datos.estado.fran.terceros[0];
  contenedor.append(ui.el(`<div>
    <header class="fran-titulo"><a href="#/inicio" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>Otros libros</h1></header>
    <div class="fran-libros">
      ${tarjeta('arriendos', a, ad)}
      ${tarjeta('redes', r, rd)}
      ${tarjeta('terceros', totalTerceros(ctx), t ? `${t.nombre}${t.nota ? ` · ${t.nota}` : ''}` : 'Sin plata de terceros')}
    </div>
    <p class="fran-nota">Plata de terceros nunca suma a "mi plata propia".</p>
  </div>`));
}

// ---------- Inicio de cada libro (bocetos 3, 7, 11, 13) ----------

function renderLibro(contenedor, id, ctx) {
  const redibujar = () => { contenedor.innerHTML = ''; renderLibro(contenedor, id, ctx); };
  if (id === 'prestamos') return renderPrestamos(contenedor, ctx, redibujar);
  if (id === 'pension') return renderPension(contenedor, ctx);
  if (id === 'terceros') return renderTerceros(contenedor, ctx);
  if (id === 'productos') return renderProductos(contenedor, ctx, redibujar);
  const { ui, dinero } = ctx;
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const m = delMes(lista, mes);
  const g = sumar(deTipo(m, 'gasto'));
  const i = sumar(deTipo(m, 'ingreso'));
  const raiz = ui.el(`<div>
    ${titular(id, ctx, '#/inicio')}
    ${caja3(['Gastos', dinero.formatear(g)], ['Ingresos', dinero.formatear(i)], ['Saldo', dinero.formatear(i - g)], ctx)}
    ${selectorMes(mes, ctx)}
    <div class="fran-lista">${listaPorDia(m, ctx)}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderPrestamos(contenedor, ctx, redibujar) {
  const { ui, dinero, datos, motor } = ctx;
  const estado = datos.estado;
  const lista = delLibro(asientos(ctx), 'prestamos');
  const mes = mesVisible(ctx, lista);
  const enMes = (f) => f.slice(0, 7) === mes;
  const prestamos = estado.prestamos.filter((p) => enMes(p.fecha));
  const pagos = estado.pagos.filter((g) => g.tipo !== 'perdon' && enMes(g.fecha));
  const capital = pagos.reduce((s, g) => s + g.capital, 0);
  const intereses = sumar(deTipo(delMes(lista, mes), 'ingreso'));
  const r = motor.resumenNegocio(estado, ctx.hoy());
  const c = clientesPorEstado(ctx);
  const provisional = estado.prestamos.some((x) => x.porConfirmar);

  const movimientos = [
    ...prestamos.map((p) => ({ fecha: p.fecha, icono: '💵', titulo: nombreCliente(ctx, p.clienteId), sub: 'Nuevo préstamo', valor: -p.capital, ruta: `#/cliente/${encodeURIComponent(p.clienteId)}` })),
    ...pagos.map((g) => ({ fecha: g.fecha, icono: g.capital && !g.interes ? '↩️' : '💯', titulo: nombreCliente(ctx, g.clienteId), sub: [g.interes ? `${dinero.formatear(g.interes)} int` : '', g.capital ? `${dinero.formatear(g.capital)} capital` : ''].filter(Boolean).join(' · '), valor: g.monto, ruta: `#/cliente/${encodeURIComponent(g.clienteId)}` })),
    ...delMes(lista, mes).filter((a) => !String(a.id).startsWith('pago-')).map((a) => ({ fecha: a.fecha, icono: '💯', titulo: a.persona || a.categoria, sub: a.sinDetalle ? 'Intereses del mes, sin detalle' : 'Intereses', valor: a.tipo === 'gasto' ? -a.valor : a.valor })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || Math.abs(b.valor) - Math.abs(a.valor));

  const pastilla = (t, n, clase) => `<a href="#/clientes" class="fran-pastilla ${clase}"><i></i>${ui.esc(t)} ${n}</a>`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/inicio')}
    ${caja3(['Presté', dinero.formatear(prestamos.reduce((s, p) => s + p.capital, 0))], ['Cobré capital', estado.pagos.length ? dinero.formatear(capital) : 'Sin datos'], ['Intereses', dinero.formatear(intereses)], ctx)}
    ${selectorMes(mes, ctx)}
    <div class="fran-dos">
      <div class="fran-tarjeta"><small>${provisional ? 'Capital anotado' : 'Cartera'}</small><strong class="numero">${dinero.formatear(r.capitalEnCalle + r.interesesPendientes)}</strong></div>
      <div class="fran-tarjeta"><small>Ganancia mes</small><strong class="numero fran-mas">${dinero.formatear(intereses)}</strong></div>
    </div>
    <div class="fran-pastillas">
      ${c.por_confirmar ? pastilla('Por confirmar', c.por_confirmar, 'gris') : ''}
      ${pastilla('Al día', c.al_dia, 'verde')}
      ${pastilla('Atrasados', c.atrasado, 'amarillo')}
      ${pastilla('Congelados', c.congelado, 'gris')}
      ${pastilla('Legal', c.legal, 'rojo')}
    </div>
    <div class="fran-accesos">
      <a href="#/clientes">👥 Clientes</a>
      <a href="#/agenda">⏰ Agenda de cobros</a>
    </div>
    <p class="fran-seccion">Movimientos del mes</p>
    <div class="fran-lista">${movimientos.map((x) => fila({ ui, icono: x.icono, titulo: x.titulo, sub: x.sub, derecha: `${x.valor < 0 ? '−' : '+'}${dinero.formatear(Math.abs(x.valor))}`, clase: x.valor < 0 ? 'fran-menos' : 'fran-mas', ruta: x.ruta })).join('') || '<p class="fran-vacio">No hay movimientos en este mes.</p>'}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderProductos(contenedor, ctx, redibujar) {
  const { ui, dinero, fechas } = ctx;
  const lista = delLibro(asientos(ctx), 'productos');
  const mes = mesVisible(ctx, lista);
  const m = delMes(lista, mes);
  const meti = sumar(deTipo(m, 'gasto'));
  const vendi = sumar(deTipo(m, 'ingreso'));
  // Lo que está en inventario o en inversiones no es pérdida: solo restan los gastos del negocio.
  const gastosProductos = sumar(deTipo(m, 'gasto').filter((a) => a.categoria === 'Gasto de productos'));
  const inventario = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inventario sin vender');
  const inversiones = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inversiones');
  const vendido = deTipo(lista, 'ingreso').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filas = (l, signo) => l.map((a) => fila({ ui, icono: iconoDe(a.categoria), titulo: a.descripcion || a.categoria, sub: fechas.formatear(a.fecha), derecha: `${signo}${dinero.formatear(a.valor)}`, clase: signo === '+' ? 'fran-mas' : '' })).join('');
  const raiz = ui.el(`<div>
    ${titular('productos', ctx, '#/inicio')}
    ${caja3(['Metí yo', dinero.formatear(meti)], ['Vendí', dinero.formatear(vendi)], ['Ganancia', dinero.formatear(vendi - gastosProductos)], ctx)}
    ${selectorMes(mes, ctx)}
    <p class="fran-seccion">Inventario</p><div class="fran-lista">${filas(inventario, '') || '<p class="fran-vacio">Sin inventario.</p>'}</div>
    ${inversiones.length ? `<p class="fran-seccion">Inversiones</p><div class="fran-lista">${filas(inversiones, '')}</div>` : ''}
    <p class="fran-seccion">Vendido</p><div class="fran-lista">${filas(vendido, '+') || '<p class="fran-vacio">Todavía sin ventas.</p>'}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderPension(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const p = fran.pension;
  const deuda = fran.deudasInternas.reduce((s, d) => s + d.valor, 0);
  const raiz = ui.el(`<div>
    ${titular('pension', ctx, '#/inicio')}
    <div class="fran-hero">
      <small>Total pensión</small>
      <strong class="numero">${dinero.formatear(totalPension(fran))}</strong>
      <button type="button" id="fran-tasa">Tasa del día: ${dinero.formatear(p.tasa)} COP/USD ✏️</button>
      <form id="fran-tasa-form" class="fran-tasa oculto"><input name="tasa" inputmode="numeric" value="${ui.esc(p.tasa)}" aria-label="Tasa del día"><button class="boton boton--pequeno boton--primario">Guardar</button></form>
    </div>
    <div class="fran-lista">
      ${p.cuentas.map((c) => fila({ ui, icono: '◎', titulo: c.nombre, sub: dinero.formatear(Math.round(c.usd * p.tasa)), derecha: `${dinero.formatear(c.usd)} USD` })).join('')}
      ${p.otros.map((o) => fila({ ui, icono: /prestado/i.test(o.nombre) ? '🤝' : (/carro/i.test(o.nombre) ? '🚗' : '💵'), titulo: o.nombre, sub: o.nota, derecha: dinero.formatear(o.cop) })).join('')}
    </div>
    ${deuda ? `<div class="fran-tarjeta"><small>Me debe el negocio</small><strong class="numero">${dinero.formatear(deuda)}</strong></div>` : ''}
    ${!p.cuentas.length ? '<p class="fran-vacio">Todavía no están tus cuentas en este aparato.</p>' : ''}
  </div>`);
  const form = raiz.querySelector('#fran-tasa-form');
  raiz.querySelector('#fran-tasa').addEventListener('click', () => form.classList.toggle('oculto'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tasa = Number(String(form.tasa.value).replace(/\D/g, ''));
    if (!(tasa > 0)) { ui.toast('Escribe una tasa válida.'); return; }
    await datos.actualizarFran({ pension: { ...p, tasa } });
    ui.toast('Tasa guardada.');
  });
  contenedor.append(raiz);
}

function renderTerceros(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const lista = delLibro(asientos(ctx), 'terceros');
  contenedor.append(ui.el(`<div>
    ${titular('terceros', ctx, '#/inicio')}
    <div class="fran-hero"><small>Plata que guardas para otros</small><strong class="numero">${dinero.formatear(totalTerceros(ctx))}</strong><small>Nunca suma a tu plata propia.</small></div>
    <div class="fran-lista">${fran.terceros.map((t) => fila({ ui, icono: '🤝', titulo: t.nombre, sub: t.nota, derecha: dinero.formatear(t.valor) })).join('')}</div>
    ${lista.length ? `<p class="fran-seccion">Movimientos</p><div class="fran-lista">${listaPorDia(lista, ctx)}</div>` : ''}
  </div>`));
}

// ---------- Gráficos (boceto 5) ----------

function dona(grupos, total) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  let giro = 0;
  const arcos = grupos.map((g, i) => {
    const largo = total ? (g[1] / total) * circ : 0;
    const arco = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${COLORES[i % COLORES.length]}" stroke-width="18" stroke-dasharray="${Math.max(largo - 0.8, 0)} ${circ}" stroke-dashoffset="${-giro}" transform="rotate(-90 60 60)"/>`;
    giro += largo;
    return arco;
  }).join('');
  const m = (total / 1000000).toFixed(2).replace('.', ',');
  return `<svg viewBox="0 0 120 120" class="fran-dona" role="img" aria-label="Reparto por categoría">${arcos}<text x="60" y="58" text-anchor="middle" class="fran-dona__n">${m}</text><text x="60" y="71" text-anchor="middle" class="fran-dona__t">millones</text></svg>`;
}

function renderGraficos(contenedor, id, ctx) {
  const { ui, dinero, fechas } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderGraficos(contenedor, id, ctx); };
  if (id === 'pension') {
    const p = ctx.datos.estado.fran.pension;
    const filas = [...p.cuentas.map((c) => [c.nombre, Math.round(c.usd * p.tasa)]), ...p.otros.map((o) => [o.nombre, o.cop])].sort((a, b) => b[1] - a[1]);
    const total = filas.reduce((s, f) => s + f[1], 0);
    contenedor.append(ui.el(`<div>${titular(id, ctx, `#/libro/${id}`, 'Gráficos')}
      ${total ? `<div class="fran-grafico">${dona(filas.slice(0, 7), total)}</div>` : ''}
      <div class="fran-lista">${filas.map(([n, v], i) => `<div class="fran-barra-fila"><span class="fran-ico" style="background:${COLORES[i % COLORES.length]}"></span><span class="fran-barra-fila__c"><span class="fran-barra-fila__l"><strong>${ui.esc(n)}</strong><span class="numero">${dinero.formatear(v)}</span></span><span class="fran-barra-fila__l"><span class="fran-barra" style="width:${(v / filas[0][1]) * 80}%"></span><small>${((v / total) * 100).toFixed(1).replace('.', ',')}%</small></span></span></div>`).join('')}</div>
    </div>`));
    return;
  }
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const m = deTipo(delMes(lista, mes), vista.tipo);
  const total = sumar(m);
  const porCat = new Map();
  for (const a of m) porCat.set(a.categoria, (porCat.get(a.categoria) || 0) + a.valor);
  const filas = [...porCat].sort((a, b) => b[1] - a[1]);
  const grupos = filas.slice(0, 4);
  if (filas.length > 4) grupos.push(['Otro', filas.slice(4).reduce((s, f) => s + f[1], 0)]);
  const pct = (v) => (total ? (v / total) * 100 : 0).toFixed(2).replace('.', ',');
  const corto = (x) => fechas.nombreMes(Number(x.slice(5, 7)), true);
  const raiz = ui.el(`<div>
    <header class="fran-titulo"><a href="#/libro/${id}" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>${LIBROS[id].icono} Gráficos</h1>${id === 'personal' ? '<a href="#/libro/personal/calendario" class="fran-titulo__der" aria-label="Calendario">📅</a>' : ''}</header>
    <div class="fran-segmento">
      <button type="button" data-tipo="gasto" class="${vista.tipo === 'gasto' ? 'activo' : ''}">Gastos</button>
      <button type="button" data-tipo="ingreso" class="${vista.tipo === 'ingreso' ? 'activo' : ''}">Ingresos</button>
    </div>
    <div class="fran-mes fran-mes--tres">
      <button type="button" data-mes="-1">${ui.esc(corto(moverMes(mes, -1, ctx)))}</button>
      <strong>${ui.esc(fechas.formatearMes(mes))}</strong>
      <button type="button" data-mes="1">${ui.esc(corto(moverMes(mes, 1, ctx)))}</button>
    </div>
    ${total ? `<div class="fran-grafico">${dona(grupos, total)}</div>` : '<p class="fran-vacio">No hay movimientos en este mes.</p>'}
    <div class="fran-lista">${filas.map(([cat, v], i) => `<a href="#/libro/${id}/categoria/${vista.tipo}/${encodeURIComponent(cat)}" class="fran-barra-fila">
      <span class="fran-ico">${ui.esc(iconoDe(cat))}</span>
      <span class="fran-barra-fila__c">
        <span class="fran-barra-fila__l"><strong>${ui.esc(cat)}</strong><span class="numero">${dinero.formatear(v)}</span></span>
        <span class="fran-barra-fila__l"><span class="fran-barra" style="width:${Math.max(1.5, (v / filas[0][1]) * 80)}%;background:${COLORES[Math.min(i, 4) % COLORES.length]}"></span><small>${pct(v)}%</small></span>
      </span>
    </a>`).join('')}</div>
  </div>`);
  raiz.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { vista.tipo = b.dataset.tipo; redibujar(); }));
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderDetalle(contenedor, id, tituloDetalle, lista, atras, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const total = sumar(lista);
  const dibujar = () => {
    contenedor.innerHTML = '';
    const ordenada = [...lista].sort((a, b) => (vista.orden === 'cantidad' ? b.valor - a.valor : b.fecha.localeCompare(a.fecha)));
    const maximo = ordenada.reduce((m, a) => Math.max(m, a.valor), 1);
    const raiz = ui.el(`<div>
      ${titular(id, ctx, atras, tituloDetalle)}
      <p class="fran-total"><strong class="numero">Total: ${dinero.formatear(total)}</strong></p>
      <div class="fran-segmento">
        <button type="button" data-orden="cantidad" class="${vista.orden === 'cantidad' ? 'activo' : ''}">Por cantidad</button>
        <button type="button" data-orden="fecha" class="${vista.orden === 'fecha' ? 'activo' : ''}">Por fecha</button>
      </div>
      <div class="fran-lista">${ordenada.map((a) => `<div class="fran-barra-fila">
        <span class="fran-ico">${ui.esc(iconoDe(a.categoria))}</span>
        <span class="fran-barra-fila__c">
          <span class="fran-barra-fila__l"><strong>${ui.esc(a.descripcion || a.categoria)}</strong><span class="numero">${dinero.formatear(a.valor)}</span></span>
          <span class="fran-barra-fila__l"><span class="fran-barra" style="width:${Math.max(1.5, (a.valor / maximo) * 80)}%"></span><small>${(total ? (a.valor / total) * 100 : 0).toFixed(2).replace('.', ',')}%</small></span>
          <span class="fran-barra-fila__l"><small>${ui.esc(fechas.formatear(a.fecha))}</small>${a.importado ? '' : `<button type="button" class="fran-borrar" data-borrar="${ui.esc(a.id)}">Borrar</button>`}</span>
        </span>
      </div>`).join('') || '<p class="fran-vacio">Sin movimientos.</p>'}</div>
    </div>`);
    raiz.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', () => { vista.orden = b.dataset.orden; dibujar(); }));
    raiz.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
      if (await ui.confirmar('¿Borrar este movimiento?', { aceptar: 'Sí, borrar', peligro: true })) await datos.eliminarAsiento(b.dataset.borrar);
    }));
    contenedor.append(raiz);
  };
  dibujar();
}

function renderPersonas(contenedor, ctx) {
  const { ui, dinero } = ctx;
  const lista = deTipo(delLibro(asientos(ctx), 'prestamos'), 'ingreso').filter((a) => a.persona);
  const porPersona = new Map();
  for (const a of lista) porPersona.set(a.persona, (porPersona.get(a.persona) || 0) + a.valor);
  const filas = [...porPersona].sort((a, b) => b[1] - a[1]);
  contenedor.append(ui.el(`<div>
    ${titular('prestamos', ctx, '#/libro/prestamos/informes', 'Quién me pagó')}
    <p class="fran-nota">Intereses anotados en Mis Gastos, con el nombre como lo escribiste. Solo meses con detalle.</p>
    <div class="fran-lista">${filas.map(([n, v]) => fila({ ui, icono: n.charAt(0).toUpperCase(), titulo: n, derecha: dinero.formatear(v), ruta: `#/libro/prestamos/persona/${encodeURIComponent(n)}` })).join('') || '<p class="fran-vacio">Todavía no hay pagos por persona.</p>'}</div>
  </div>`));
}

// ---------- Calendario (boceto 6) ----------

function renderCalendario(contenedor, id, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderCalendario(contenedor, id, ctx); };
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const anio = Number(mes.slice(0, 4));
  const num = Number(mes.slice(5, 7));
  const dias = fechas.diasDelMes(anio, num);
  const presupuesto = Math.round(datos.estado.fran.presupuestoMensual / dias);
  const gastos = deTipo(delMes(lista, mes), 'gasto').filter((a) => !a.sinDetalle);
  const porDia = new Map();
  for (const a of gastos) { const d = Number(a.fecha.slice(8)); porDia.set(d, (porDia.get(d) || 0) + a.valor); }
  let celdas = '<span class="vacia"></span>'.repeat(new Date(anio, num - 1, 1).getDay());
  for (let d = 1; d <= dias; d++) {
    const v = porDia.get(d);
    celdas += `<span class="${v === undefined ? '' : (v > presupuesto ? 'rojo' : 'verde')}">${d}</span>`;
  }
  const sinDetalle = deTipo(delMes(lista, mes), 'gasto').some((a) => a.sinDetalle);
  const raiz = ui.el(`<div>
    <header class="fran-titulo"><a href="#/libro/${id}/graficos" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>📅 Calendario</h1></header>
    ${selectorMes(mes, ctx)}
    <div class="fran-cal">${['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((x) => `<b>${x}</b>`).join('')}${celdas}</div>
    <p class="fran-leyenda"><i class="rojo"></i>Por encima del presupuesto <i class="verde"></i>Dentro</p>
    <p class="fran-nota">Presupuesto diario: ${ui.esc(dinero.formatear(presupuesto))}${sinDetalle ? '. Este mes no tiene el detalle por día todavía.' : ''}</p>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

// ---------- Informes ----------

function renderInformes(contenedor, id, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderInformes(contenedor, id, ctx); };
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const anios = [...new Set(lista.map((a) => a.fecha.slice(0, 4)))].sort().reverse();
  const anio = vista.anio === 'todo' ? 'todo' : (vista.anio && anios.includes(vista.anio) ? vista.anio : (anios[0] || ctx.hoy().slice(0, 4)));
  const totalLista = anio === 'todo' ? lista : lista.filter((a) => a.fecha.startsWith(anio));
  const claves = anio === 'todo' ? anios : Array.from({ length: 12 }, (_, i) => `${anio}-${String(12 - i).padStart(2, '0')}`);
  const filas = claves.map((k) => {
    const m = totalLista.filter((a) => a.fecha.startsWith(k));
    const g = sumar(deTipo(m, 'gasto')); const i = sumar(deTipo(m, 'ingreso'));
    if (!g && !i) return '';
    const nombre = anio === 'todo' ? k : fechas.nombreMes(Number(k.slice(5)), true);
    return `<tr><th>${ui.esc(nombre)}</th><td class="numero">${dinero.formatear(g)}</td><td class="numero">${dinero.formatear(i)}</td><td class="numero">${dinero.formatear(i - g)}</td></tr>`;
  }).join('');
  const tg = sumar(deTipo(totalLista, 'gasto')); const ti = sumar(deTipo(totalLista, 'ingreso'));
  const m = delMes(lista, mes);
  const gastosMes = sumar(deTipo(m, 'gasto'));
  const presupuesto = datos.estado.fran.presupuestoMensual;
  const restante = presupuesto - gastosMes;
  const raiz = ui.el(`<div>
    ${titular(id, ctx, `#/libro/${id}`, 'Informes')}
    <div class="fran-hero fran-hero--centro"><small>Saldo ${anio === 'todo' ? 'total' : anio}</small><strong class="numero">${dinero.formatear(ti - tg)}</strong>
      <div class="fran-hero__par"><span><small>Gastos</small><b class="numero">${dinero.formatear(tg)}</b></span><span><small>Ingresos</small><b class="numero">${dinero.formatear(ti)}</b></span></div>
    </div>
    <div class="fran-anios">
      <button type="button" data-anio="todo" class="${anio === 'todo' ? 'activo' : ''}">Todo</button>
      ${anios.map((a) => `<button type="button" data-anio="${a}" class="${a === anio ? 'activo' : ''}">${a}</button>`).join('')}
    </div>
    <table class="fran-tabla"><thead><tr><th>${anio === 'todo' ? 'Año' : 'Mes'}</th><th>Gastos</th><th>Ingresos</th><th>Saldo</th></tr></thead><tbody>${filas}</tbody></table>
    ${id === 'personal' ? `
      <p class="fran-seccion">Presupuesto mensual</p>
      ${selectorMes(mes, ctx)}
      <div class="fran-tarjeta">
        <small>Presupuesto</small><strong class="numero">${dinero.formatear(presupuesto)}</strong>
        <small>Gastos ${dinero.formatear(gastosMes)} · Restante ${dinero.formatear(restante)}</small>
        <form id="fran-presu" class="fran-tasa"><input name="presu" inputmode="numeric" placeholder="Cambiar presupuesto" aria-label="Presupuesto mensual"><button class="boton boton--pequeno boton--secundario">Guardar</button></form>
      </div>
      <a class="fran-acceso" href="#/libro/personal/calendario">📅 Ver calendario</a>` : ''}
    ${id === 'prestamos' ? '<a class="fran-acceso" href="#/libro/prestamos/personas">💵 Quién me pagó</a><a class="fran-acceso" href="#/caja">🧾 Caja efectivo y virtual</a>' : ''}
  </div>`);
  raiz.querySelectorAll('[data-anio]').forEach((b) => b.addEventListener('click', () => { vista.anio = b.dataset.anio; redibujar(); }));
  conectarMes(raiz, mes, ctx, redibujar);
  const presu = raiz.querySelector('#fran-presu');
  if (presu) presu.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = ctx.dinero.leer(presu.presu.value);
    if (!(v > 0)) { ui.toast('Escribe un valor mayor que cero.'); return; }
    await datos.actualizarFran({ presupuestoMensual: v });
    ui.toast('Presupuesto guardado.');
  });
  contenedor.append(raiz);
}

// ---------- Botón + ----------

export function abrirMas(id, ctx) {
  if (id === 'prestamos') return ctx.navegar('/libro/prestamos/registrar/nuevo');
  if (id === 'pension') return ctx.navegar('/libro/pension/mover/ingreso');
  return ctx.navegar(`/libro/${id}/agregar/${(TIPOS[id] || TIPOS.personal)[0][1]}`);
}

// ---------- Agregar (boceto 4) ----------

function renderAgregar(contenedor, id, clave, ctx) {
  const { ui, datos } = ctx;
  const tipos = TIPOS[id] || TIPOS.personal;
  const def = tipos.find((t) => t[1] === clave) || tipos[0];
  const tipo = def[2];
  const esTransfer = tipo === 'transferencia';
  const base = (CATEGORIAS_BASE[id] && CATEGORIAS_BASE[id][def[1]]) || [];
  const usadas = {};
  for (const a of datos.estado.fran.asientos) if (a.tipo === tipo && a.libro === id && !a.sinDetalle) usadas[a.categoria] = (usadas[a.categoria] || 0) + 1;
  const categorias = [...new Set([...base, ...Object.keys(usadas).sort((a, b) => usadas[b] - usadas[a])])].filter((c) => !/total del mes|resto sin/i.test(c));
  let elegida = categorias[0] || 'Otros';
  const raiz = ui.el(`<div class="fran-agregar">
    <header class="fran-agregar__cabeza"><a href="#/libro/${id}">Cancelar</a><strong>Agregar</strong><label class="fran-fecha"><input type="date" name="fecha" value="${ui.esc(ctx.hoy())}" aria-label="Fecha"></label></header>
    <div class="fran-segmento">${tipos.map((t) => `<a href="#/libro/${id}/agregar/${t[1]}" class="${t === def ? 'activo' : ''}">${ui.esc(t[0])}</a>`).join('')}</div>
    <form novalidate>
      ${esTransfer ? `
        <p class="fran-seccion">Sale de</p>${chips('cuenta', CUENTAS, 'Efectivo', ui)}
        <p class="fran-seccion">Entra a</p>${chips('destino', CUENTAS, 'Nequi propio', ui)}` : `
        <div class="fran-iconos">${categorias.map((c) => `<button type="button" class="${c === elegida ? 'activo' : ''}" data-cat="${ui.esc(c)}"><span>${ui.esc(iconoDe(c))}</span><small>${ui.esc(c)}</small></button>`).join('')}
          <button type="button" data-nueva><span>＋</span><small>Nueva</small></button></div>
        <input type="text" class="fran-entrada oculto" name="nueva" placeholder="Nombre de la categoría nueva" autocomplete="off">`}
      <div class="fran-escribir">
        <input type="text" name="texto" autocomplete="off" placeholder="${esTransfer ? '¿Cuánto?' : '¿Para qué y cuánto cuesta?'}" aria-label="Para qué y cuánto cuesta">
        <button type="button" class="fran-mic oculto" aria-label="Dictar">🎤</button>
      </div>
      ${esTransfer || id === 'terceros' ? '' : `<p class="fran-pagado">${tipo === 'ingreso' ? 'Entra por' : 'Pagado con'}</p>${chips('cuenta', CUENTAS, 'Efectivo', ui)}`}
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>
  </div>`);
  conectarChips(raiz);
  raiz.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    elegida = b.dataset.cat;
    raiz.querySelectorAll('[data-cat],[data-nueva]').forEach((x) => x.classList.toggle('activo', x === b));
    const n = raiz.querySelector('[name="nueva"]');
    if (n) { n.classList.add('oculto'); n.value = ''; }
  }));
  const botonNueva = raiz.querySelector('[data-nueva]');
  if (botonNueva) botonNueva.addEventListener('click', () => {
    raiz.querySelectorAll('[data-cat],[data-nueva]').forEach((x) => x.classList.toggle('activo', x === botonNueva));
    const n = raiz.querySelector('[name="nueva"]');
    n.classList.remove('oculto');
    n.focus();
  });
  const texto = raiz.querySelector('[name="texto"]');
  const Voz = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Voz) {
    const mic = raiz.querySelector('.fran-mic');
    mic.classList.remove('oculto');
    mic.addEventListener('click', () => {
      try {
        const r = new Voz();
        r.lang = 'es-CO';
        r.onresult = (e) => { texto.value = e.results[0][0].transcript; };
        r.onerror = () => ui.toast('No se pudo dictar. Usa el micrófono del teclado.');
        r.start();
      } catch { ui.toast('No se pudo dictar. Usa el micrófono del teclado.'); }
    });
  }
  raiz.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const { descripcion, valor } = leerTexto(texto.value);
    if (!valor) { ui.toast('Escribe cuánto: por ejemplo, almuerzo 15000.'); texto.focus(); return; }
    const fecha = raiz.querySelector('[name="fecha"]').value || ctx.hoy();
    const cuenta = form.elements.cuenta ? form.elements.cuenta.value : '';
    const destino = form.elements.destino ? form.elements.destino.value : '';
    if (esTransfer && cuenta === destino) { ui.toast('Elige dos cuentas distintas.'); return; }
    const nueva = form.elements.nueva ? form.elements.nueva.value.trim() : '';
    if (botonNueva && botonNueva.classList.contains('activo') && !nueva) { ui.toast('Escribe el nombre de la categoría.'); return; }
    try {
      await datos.agregarAsiento({ libro: id, fecha, tipo, categoria: esTransfer ? 'Transferencia' : (nueva || elegida), descripcion, valor, cuenta, destino });
      ui.toast('Guardado.');
      vista.mes = fecha.slice(0, 7);
      ctx.navegar(`/libro/${id}`);
    } catch (error) { ui.toast(error.message); }
  });
  contenedor.append(raiz);
}

// ---------- Registrar en Préstamos (boceto 8) ----------

const TIPOS_PRESTAMO = [['nuevo', '＋', 'Nuevo préstamo'], ['abono', '↩️', 'Abono a capital'], ['interes', '💯', 'Pago de intereses'], ['acuerdo', '🤝', 'Acuerdo de pago']];

function renderRegistrar(contenedor, params, ctx) {
  const { ui, datos } = ctx;
  const tipo = params.tipo;
  const estado = datos.estado;
  const clientes = [...estado.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const elegido = params.clienteId || '';
  const raiz = ui.el(`<div class="fran-registrar">
    <header class="fran-agregar__cabeza"><a href="#/libro/prestamos">Cancelar</a><strong>Préstamos</strong><span></span></header>
    <div class="fran-opciones">${TIPOS_PRESTAMO.map(([k, ic, t]) => `<a href="#/libro/prestamos/registrar/${k}${elegido ? `/${encodeURIComponent(elegido)}` : ''}" class="${k === tipo ? 'activo' : ''}"><span>${ic}</span>${ui.esc(t)}</a>`).join('')}</div>
    <form novalidate class="fran-campos">
      <label><small>Cliente</small><select name="cliente"><option value="">Elige…</option>${tipo === 'nuevo' || tipo === 'acuerdo' ? '<option value="__nuevo">＋ Cliente nuevo</option>' : ''}${clientes.map((c) => `<option value="${ui.esc(c.id)}"${c.id === elegido ? ' selected' : ''}>${ui.esc(c.nombre)}</option>`).join('')}</select></label>
      <label class="oculto" id="campo-nombre"><small>Nombre del cliente nuevo</small><input name="nombre" autocomplete="off"></label>
      <label class="oculto" id="campo-prestamo"><small>¿De cuál préstamo?</small><select name="prestamo"></select></label>
      <label><small>Valor${tipo === 'acuerdo' ? ' (si ya lo sabes)' : ''}</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      ${tipo === 'nuevo' ? `<div><small>Tasa mensual</small>${chips('tasa', [['5', '5%'], ['10', '10%'], ['12', '12%'], ['15', '15%'], ['20', '20%'], ['0', 'Sin interés']], '', ui)}</div>` : ''}
      ${tipo === 'acuerdo' ? `<div><small>Cada cuánto</small>${chips('repite', [['', 'Fecha fija'], ['diario', 'Diario'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']], '', ui)}</div>` : `<label><small>${tipo === 'nuevo' ? 'Sale por' : 'Entra por'}</small><select name="medio"><option value="efectivo">Efectivo</option><option value="virtual">Virtual</option></select></label>`}
      <label><small>${tipo === 'acuerdo' ? 'Fecha del cobro' : 'Fecha'}</small><input type="date" name="fecha" value="${ui.esc(ctx.hoy())}"></label>
      <label><small>Nota</small><input name="nota" autocomplete="off" placeholder="🎤 dictar…"></label>
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>
  </div>`);
  conectarChips(raiz);
  const form = raiz.querySelector('form');
  const campoNombre = raiz.querySelector('#campo-nombre');
  const campoPrestamo = raiz.querySelector('#campo-prestamo');
  function alCambiarCliente() {
    const id = form.elements.cliente.value;
    campoNombre.classList.toggle('oculto', id !== '__nuevo');
    campoPrestamo.classList.add('oculto');
    if (tipo !== 'abono' && tipo !== 'interes') return;
    const activos = estado.prestamos.filter((p) => p.clienteId === id && !['pagado', 'perdido'].includes(p.estadoManual));
    const nombreP = (p) => `${p.porConfirmar && p.porConfirmar.fecha ? p.porConfirmar.fecha : ctx.fechas.formatear(p.fecha)} · ${ctx.dinero.formatear(p.capital)}`;
    form.elements.prestamo.innerHTML = (activos.length > 1 ? '<option value="">Elige…</option>' : '') + activos.map((p) => `<option value="${ui.esc(p.id)}">${ui.esc(nombreP(p))}</option>`).join('');
    campoPrestamo.classList.toggle('oculto', activos.length < 2);
  }
  form.elements.cliente.addEventListener('change', alCambiarCliente);
  alCambiarCliente();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const el = form.elements;
      let clienteId = el.cliente.value;
      if (!clienteId) { ui.toast('Elige el cliente.'); return; }
      const valor = el.valor.value.trim() ? ctx.dinero.leer(el.valor.value) : null;
      const fecha = el.fecha.value || ctx.hoy();
      const nota = el.nota.value.trim();
      if (tipo !== 'acuerdo' && !(valor > 0)) { ui.toast('Escribe el valor.'); return; }
      if (tipo === 'nuevo' && el.tasa.value === '') { ui.toast('Elige la tasa.'); return; }
      if ((tipo === 'abono' || tipo === 'interes') && !el.prestamo.value) { ui.toast(el.prestamo.options.length ? 'Elige de cuál préstamo.' : 'Este cliente no tiene préstamos activos.'); return; }
      if (clienteId === '__nuevo') {
        const nombre = el.nombre.value.trim();
        if (!nombre) { ui.toast('Escribe el nombre del cliente.'); return; }
        clienteId = (await datos.agregarCliente({ nombre })).id;
      }
      const cliente = datos.estado.clientes.find((c) => c.id === clienteId);
      if (tipo === 'nuevo') {
        const tasa = Number(el.tasa.value);
        const familia = cliente && cliente.tipo === 'familia';
        await datos.crearPrestamo({ clienteId, fecha, capital: valor, tasa: familia ? 0 : tasa, modalidad: familia || tasa === 0 ? 'sin_interes' : 'interes_mensual', medio: el.medio.value, nota });
      } else if (tipo === 'acuerdo') {
        const fran = datos.estado.fran;
        const repite = el.repite.value || null;
        await datos.actualizarFran({ agenda: [...(fran.agenda || []), { id: `ag-${Date.now()}`, nombre: cliente ? cliente.nombre : '', clienteId, fecha: repite ? null : fecha, desde: repite ? fecha : null, repite, monto: valor, nota }] });
      } else {
        const parte = tipo === 'interes' ? { interes: valor, capital: 0 } : { interes: 0, capital: valor };
        await datos.registrarPago({ prestamoId: el.prestamo.value, fecha, monto: valor, medio: el.medio.value, nota, ...parte });
      }
      ui.toast('Guardado.');
      ctx.navegar(`/cliente/${encodeURIComponent(clienteId)}`);
    } catch (error) { ui.toast(error.message, 5000); }
  });
  contenedor.append(raiz);
}

// ---------- Ficha del cliente (boceto 9) ----------

function soloDigitos(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 10) return `57${d}`;
  return d;
}

function renderFicha(contenedor, id, ctx) {
  const { ui, dinero, datos, motor, fechas } = ctx;
  const estado = datos.estado;
  const cliente = estado.clientes.find((c) => c.id === id);
  if (!cliente) {
    contenedor.append(ui.el(`<div>${titular('prestamos', ctx, '#/clientes', 'Cliente')}<p class="fran-vacio">No encontré este cliente.</p></div>`));
    return;
  }
  const propios = estado.prestamos.filter((p) => p.clienteId === id);
  const pagos = estado.pagos.filter((g) => g.clienteId === id);
  const r = motor.resumenCliente(cliente, propios, pagos, ctx.hoy());
  const recuperado = Math.max(0, r.capitalPrestado - r.capitalPendiente);
  const pct = r.capitalPrestado ? Math.min(100, (recuperado / r.capitalPrestado) * 100) : 0;
  const acuerdo = (estado.fran.agenda || []).find((x) => x.clienteId === id || norm(x.nombre) === norm(cliente.nombre));
  const textoAcuerdo = acuerdo ? `Acuerdo: ${[acuerdo.monto ? dinero.formatear(acuerdo.monto) : '', acuerdo.repite || (acuerdo.fecha ? fechas.formatear(acuerdo.fecha) : ''), acuerdo.nota].filter(Boolean).join(' · ')}` : '';
  const historial = [
    ...propios.map((p) => ({ f: p.fecha, sinFecha: p.porConfirmar && p.porConfirmar.fecha, icono: '💵', t: 'Préstamo', v: `−${dinero.formatear(p.capital)}`, c: 'fran-menos', ruta: `#/prestamo/${encodeURIComponent(p.id)}` })),
    ...pagos.map((g) => ({ f: g.fecha, icono: g.tipo === 'perdon' ? '🎁' : '↩️', t: g.tipo === 'perdon' ? 'Perdón de intereses' : (g.capital && !g.interes ? 'Abono a capital' : 'Pago'), v: `+${dinero.formatear(g.monto)}`, c: 'fran-mas' })),
    ...(estado.fran.asientos || []).filter((a) => a.persona && norm(a.persona) === norm(cliente.nombre)).map((a) => ({ f: a.fecha, icono: '💯', t: 'Intereses', v: `+${dinero.formatear(a.valor)}`, c: 'fran-mas' })),
  ].sort((a, b) => b.f.localeCompare(a.f));
  const tel = soloDigitos(cliente.telefono);
  const editar = `#/cliente/${encodeURIComponent(id)}/editar`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/clientes', 'Cliente')}
    <div class="fran-cliente">
      <span class="fran-avatar">${ui.esc(cliente.nombre.charAt(0).toUpperCase())}</span>
      <div><strong>${ui.esc(cliente.nombre)}</strong>${textoAcuerdo ? `<small>${ui.esc(textoAcuerdo)}</small>` : ''}</div>
      ${ui.chipEstado(r.estado)}
    </div>
    <div class="fran-dos">
      <div class="fran-tarjeta"><small>Debe total</small><strong class="numero">${dinero.formatear(r.deudaCliente)}</strong></div>
      <div class="fran-tarjeta"><small>Capital pendiente</small><strong class="numero">${dinero.formatear(r.capitalPendiente)}</strong></div>
    </div>
    <div class="fran-progreso"><span style="width:${pct}%"></span></div>
    <p class="fran-nota">Recuperado ${dinero.formatear(recuperado)} de ${dinero.formatear(r.capitalPrestado)} de capital.</p>
    <div class="fran-tres">
      <a class="azul" href="${tel ? `tel:+${tel}` : editar}">📞 ${tel ? 'Llamar' : 'Poner teléfono'}</a>
      <a class="verde" href="${tel ? `https://wa.me/${tel}` : editar}"${tel ? ' target="_blank" rel="noopener"' : ''}>💬 WhatsApp</a>
      <a class="gris" href="#/libro/prestamos/registrar/acuerdo/${encodeURIComponent(id)}">⏰ Recordar</a>
    </div>
    <div class="fran-accesos">
      <a href="#/libro/prestamos/registrar/interes/${encodeURIComponent(id)}">💯 Registrar pago</a>
      <a href="#/libro/prestamos/registrar/nuevo/${encodeURIComponent(id)}">＋ Nuevo préstamo</a>
    </div>
    <p class="fran-seccion">Historial</p>
    <div class="fran-lista">${historial.map((h) => fila({ ui, icono: h.icono, titulo: h.t, sub: h.sinFecha ? `Fecha por confirmar (${h.sinFecha})` : fechas.formatear(h.f), derecha: h.v, clase: h.c, ruta: h.ruta })).join('') || '<p class="fran-vacio">Sin movimientos.</p>'}</div>
    <a class="fran-acceso" href="${editar}">✏️ Editar datos del cliente</a>
  </div>`);
  contenedor.append(raiz);
}

// ---------- Agenda de cobros (boceto 10) ----------

function hecho(item, hoy) {
  return item.repite ? item.hechoEn === hoy : !!item.hecho;
}

function renderAgenda(contenedor, ctx) {
  const { ui, dinero, fechas, datos, motor } = ctx;
  const hoy = ctx.hoy();
  const fin = fechas.sumarDias(hoy, 7);
  const propia = (datos.estado.fran.agenda || []).filter((x) => !hecho(x, hoy));
  const repetidos = propia.filter((x) => x.repite);
  const conFecha = propia.filter((x) => !x.repite && x.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const semana = conFecha.filter((x) => x.fecha <= fin);
  const despues = conFecha.filter((x) => x.fecha > fin);
  const delMotor = motor.agendaCobros(datos.estado, hoy, 7);
  const linea = (x) => {
    const legal = /denuncia|legal/i.test(x.nota || '');
    const icono = x.repite ? '🔁' : (legal ? '⚖️' : '⏰');
    const cuando = x.repite
      ? (x.repite === 'diario' ? (x.desde ? `Desde ${fechas.nombreMes(Number(x.desde.slice(5, 7)), true)} ${Number(x.desde.slice(8))}`.replace(/^Desde (\S+) (\d+)$/, 'Desde $2 $1') : 'Todos los días') : `${x.repite[0].toUpperCase()}${x.repite.slice(1)}`)
      : fechaLinda(x.fecha, ctx).replace(/^(.+) · (\S+)$/, '$2 $1');
    return `<div class="fran-fila">
      <span class="fran-ico">${icono}</span>
      <span class="fran-fila__texto"><strong>${ui.esc(x.nombre)}</strong><small>${ui.esc([cuando, x.nota].filter(Boolean).join(' · '))}</small></span>
      <span class="fran-fila__valor numero">${x.monto ? dinero.formatear(x.monto) : ui.esc(x.repite || '—')}</span>
      <button type="button" class="fran-check" data-hecho="${ui.esc(x.id)}" aria-label="Marcar ${ui.esc(x.nombre)} como cobrado">✓</button>
    </div>`;
  };
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/libro/prestamos', 'Agenda de cobros')}
    <p class="fran-seccion fran-seccion--centro">Esta semana</p>
    <div class="fran-lista">${[...semana, ...repetidos].map(linea).join('')}
      ${delMotor.map((l) => fila({ ui, icono: l.motivo === 'atrasado' ? '🔴' : '⏰', titulo: l.nombre || 'Sin nombre', sub: l.fecha === hoy ? 'Hoy' : fechas.formatear(l.fecha), derecha: dinero.formatear(l.monto), ruta: `#/prestamo/${encodeURIComponent(l.prestamoId)}` })).join('')}
      ${!semana.length && !repetidos.length && !delMotor.length ? '<p class="fran-vacio">No hay cobros esta semana. Con el botón + agregas un acuerdo de pago.</p>' : ''}
    </div>
    ${despues.length ? `<p class="fran-seccion">Más adelante</p><div class="fran-lista">${despues.map(linea).join('')}</div>` : ''}
  </div>`);
  raiz.querySelectorAll('[data-hecho]').forEach((b) => b.addEventListener('click', async () => {
    const item = (datos.estado.fran.agenda || []).find((x) => x.id === b.dataset.hecho);
    if (!item) return;
    const lista = datos.estado.fran.agenda.map((x) => (x.id !== item.id ? x : (x.repite ? { ...x, hechoEn: hoy } : { ...x, hecho: true })));
    await datos.actualizarFran({ agenda: lista });
    const cliente = datos.estado.clientes.find((c) => c.id === item.clienteId || norm(c.nombre) === norm(item.nombre));
    if (cliente && await ui.confirmar(`¿Registrar el pago de ${item.nombre} ahora?`, { aceptar: 'Sí, registrar', cancelar: 'Después' })) {
      ctx.navegar(`/libro/prestamos/registrar/interes/${encodeURIComponent(cliente.id)}`);
    }
  }));
  contenedor.append(raiz);
}

// ---------- Pensión: movimientos (boceto 12) ----------

function renderMoverPension(contenedor, accion, ctx) {
  const { ui, datos } = ctx;
  const p = datos.estado.fran.pension;
  const nombres = p.cuentas.map((c) => c.nombre);
  const opciones = [['ingreso', '⬇️', 'Ingreso'], ['retiro', '⬆️', 'Retiro'], ['mover', '🔁', 'Mover entre cuentas']];
  const raiz = ui.el(`<div class="fran-registrar">
    <header class="fran-agregar__cabeza"><a href="#/libro/pension">Cancelar</a><strong>Pensión</strong><span></span></header>
    <div class="fran-opciones">${opciones.map(([k, ic, t]) => `<a href="#/libro/pension/mover/${k}" class="${k === accion ? 'activo' : ''}"><span>${ic}</span>${ui.esc(t)}</a>`).join('')}</div>
    ${nombres.length ? `<form novalidate class="fran-campos">
      <label><small>Valor en USD</small><input name="usd" inputmode="decimal" autocomplete="off" placeholder="100"></label>
      ${accion === 'ingreso' ? `<label><small>De dónde sale</small><select name="origen"><option value="">Por fuera de Fran</option><option value="Efectivo">Efectivo</option></select></label>` : ''}
      <label><small>${accion === 'ingreso' ? 'Dónde queda guardada' : 'De dónde sale'}</small><select name="cuenta">${nombres.map((n) => `<option>${ui.esc(n)}</option>`).join('')}</select></label>
      ${accion === 'mover' ? `<label><small>Dónde queda guardada</small><select name="destino">${nombres.map((n, i) => `<option${i === 1 ? ' selected' : ''}>${ui.esc(n)}</option>`).join('')}</select></label>` : ''}
      <label><small>Por qué</small><input name="nota" autocomplete="off" placeholder="Ahorro del mes"></label>
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>` : '<p class="fran-vacio">Todavía no están tus cuentas en este aparato.</p>'}
  </div>`);
  const form = raiz.querySelector('form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = form.elements;
    const usd = Number(String(el.usd.value).replace(',', '.'));
    if (!(usd > 0)) { ui.toast('Escribe un valor mayor que cero.'); return; }
    if (accion === 'mover' && el.cuenta.value === el.destino.value) { ui.toast('Elige dos cuentas distintas.'); return; }
    const cuentaSel = el.cuenta.value;
    const cuentas = p.cuentas.map((c) => {
      let n = c.usd;
      if (c.nombre === cuentaSel) n += accion === 'ingreso' ? usd : -usd;
      if (accion === 'mover' && c.nombre === el.destino.value) n += usd;
      return { ...c, usd: Math.round(n * 100) / 100 };
    });
    await datos.actualizarFran({ pension: { ...p, cuentas } });
    const opcion = opciones.find((o) => o[0] === accion);
    await datos.agregarAsiento({ libro: 'pension', fecha: ctx.hoy(), tipo: 'transferencia', categoria: opcion[2], descripcion: [`${usd} USD`, cuentaSel, el.nota.value.trim()].filter(Boolean).join(' · '), valor: Math.round(usd * p.tasa), cuenta: el.origen ? el.origen.value : '', destino: '' });
    ui.toast('Guardado.');
    ctx.navegar('/libro/pension');
  });
  contenedor.append(raiz);
}

// ---------- Entrada ----------

export async function render(contenedor, params, ctx) {
  contenedor.innerHTML = '';
  const id = params.libro;
  switch (params.vista) {
    case 'principal': return renderPrincipal(contenedor, ctx);
    case 'otros': return renderOtros(contenedor, ctx);
    case 'libro': return renderLibro(contenedor, id, ctx);
    case 'graficos': return renderGraficos(contenedor, id, ctx);
    case 'calendario': return renderCalendario(contenedor, id, ctx);
    case 'informes': return renderInformes(contenedor, id, ctx);
    case 'agregar': return renderAgregar(contenedor, id, params.tipo, ctx);
    case 'registrar': return renderRegistrar(contenedor, params, ctx);
    case 'ficha': return renderFicha(contenedor, params.id, ctx);
    case 'agenda': return renderAgenda(contenedor, ctx);
    case 'moverPension': return renderMoverPension(contenedor, params.accion, ctx);
    case 'personas': return renderPersonas(contenedor, ctx);
    case 'persona': {
      const lista = deTipo(delLibro(asientos(ctx), 'prestamos'), 'ingreso').filter((a) => a.persona === params.nombre);
      return renderDetalle(contenedor, 'prestamos', params.nombre, lista, '#/libro/prestamos/personas', ctx);
    }
    case 'categoria': {
      const mes = mesVisible(ctx, delLibro(asientos(ctx), id));
      const lista = deTipo(delMes(delLibro(asientos(ctx), id), mes), params.tipo).filter((a) => a.categoria === params.categoria);
      return renderDetalle(contenedor, id, params.categoria, lista, `#/libro/${id}/graficos`, ctx);
    }
    default: throw new Error('Vista desconocida.');
  }
}
