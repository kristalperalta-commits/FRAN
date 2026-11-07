/*
  fran.js: las pantallas de Fran, siguiendo los bocetos del plan maestro.
  Principal, Otros libros, y por libro: Inicio, Gráficos, Calendario, Informes y Agregar.
  También: registrar en Préstamos, ficha del cliente, agenda y movimientos de pensión.
*/

import { leerTexto } from '../texto.js';
import { guardarFoto, leerFoto, reducirFoto } from '../fotos.js';
import { abrirApariencia } from '../apariencia.js';

export const LIBROS = {
  personal: { nombre: 'Finanzas personales', corto: 'Finanzas personales', enInicio: 'Finanzas personales', icono: '👛', color: '#22C55E' },
  prestamos: { nombre: 'Negocio de préstamos', corto: 'Negocio de préstamos', enInicio: 'Préstamos', icono: '🏦', color: '#3B82F6' },
  pension: { nombre: 'Pensión', corto: 'Pensión', enInicio: 'Pensión', icono: '🐷', color: '#A855F7' },
  productos: { nombre: 'Negocio tecnológico', corto: 'Negocio tecnológico', enInicio: 'Negocio tecnológico', icono: '💻', color: '#F97316' },
  arriendos: { nombre: 'Negocio de arriendos', corto: 'Negocio de arriendos', enInicio: 'Arriendos', icono: '🏢', color: '#EAB308' },
  redes: { nombre: 'Redes y trabajos', corto: 'Redes y trabajos', enInicio: 'Redes', icono: '👥', color: '#EC4899' },
  terceros: { nombre: 'Plata de terceros', corto: 'Plata de terceros', enInicio: 'De terceros', icono: '🤝', color: '#64748B' },
};

// Qué ofrece el botón + de cada libro: [texto, clave, tipo guardado].
const TIPOS = {
  personal: [['Gasto', 'gasto', 'gasto'], ['Ingreso', 'ingreso', 'ingreso'], ['Transferencia', 'transferencia', 'transferencia']],
  arriendos: [['Ingreso', 'ingreso', 'ingreso'], ['Gasto de la propiedad', 'gasto', 'gasto']],
  redes: [['Ingreso', 'ingreso', 'ingreso'], ['Gasto', 'gasto', 'gasto']],
  productos: [['Inversión', 'inversion', 'gasto'], ['Venta', 'ingreso', 'ingreso'], ['Gasto', 'gasto', 'gasto']],
  terceros: [['Recibí', 'ingreso', 'ingreso'], ['Devolví', 'gasto', 'gasto'], ['Usé', 'uso', 'gasto']],
};

// Estos ingresos entran solos a Finanzas desde su libro. Se anotan allá, una sola vez.
export const INGRESOS_DE_OTRO_LIBRO = {
  'Ganancia de préstamos': '/libro/prestamos/registrar/interes',
  Arriendos: '/libro/arriendos/agregar/ingreso',
  'Redes sociales': '/libro/redes/agregar/ingreso',
  'Trabajo audiovisual': '/libro/redes/agregar/ingreso',
  Ventas: '/libro/productos/agregar/ingreso',
};

const NOTA_PROPIEDAD = { 'Arriendos del mes': 'Falta el detalle de esos meses' };

export const CATEGORIAS_BASE = {
  personal: {
    gasto: ['Alimentos', 'Vivienda', 'Carro', 'Gasolina', 'Servicios públicos', 'Compras', 'Medicina', 'Abogados', 'Social', 'Viajes', 'Electrónicos', 'Belleza', 'Deportes', 'Entretenimiento', 'Transporte', 'Otros'],
    ingreso: ['Otros', 'Salario', 'Negocio Ropa', 'Ingreso mensual'],
  },
  arriendos: { ingreso: [], gasto: ['Mano de obra', 'Servicios de las casas', 'Remodelación', 'Materiales', 'Trámites'] },
  redes: { ingreso: ['Redes sociales', 'Trabajo audiovisual'], gasto: ['Redes sociales', 'Videos'] },
  productos: { inversion: ['Inventario sin vender', 'Inversiones'], ingreso: ['Ventas'], gasto: ['Gasto de productos'] },
  terceros: { ingreso: ['Abuelos', 'Esposo'], gasto: ['Abuelos', 'Esposo'], uso: ['Préstamo interno'] },
};

const CUENTAS = ['Efectivo', 'Nequi propio', 'Nequi papá', 'Uno propio', 'Uno Garu', 'Bancolombia', 'Tarjeta comida', 'Tarjeta gasolina', 'Tarjeta Gold'];
// Colores de la dona y las barras, en orden (diseño Lila): rojo, cian, naranja, lila, rosado y más.
const COLORES = ['#F87171', '#22D3EE', '#FB923C', '#A5B4FC', '#F9A8D4', '#6EE7B7', '#FDBA74', '#C4B5FD'];
// Ingresos, intereses y ahorro van en verdes: el rojo se entiende como salida (pedido por ella el 6 nov 2026).
const VERDES = ['#34D399', '#2DD4BF', '#A3E635', '#22D3EE', '#86EFAC', '#5EEAD4', '#BEF264', '#67E8F9'];
export const coloresDe = (tipo) => (tipo === 'ingreso' || tipo === 'ahorro' ? VERDES : COLORES);

const ICONOS = [
  [/aliment|comida|mercado/, '🍎'], [/vivienda|hogar/, '🏠'], [/carro|auto/, '🚗'], [/gasolina|combustible/, '⛽'],
  [/servicio/, '💡'], [/compra/, '🛍️'], [/medicina|salud/, '💊'], [/abogado/, '⚖️'], [/social/, '👥'], [/viaje/, '✈️'],
  [/electronic/, '📱'], [/belleza/, '💄'], [/deporte/, '⚽'], [/entreten/, '🎬'], [/transporte/, '🚌'], [/educacion/, '📚'],
  [/regalo/, '🎁'], [/agua/, '💧'], [/ropa/, '👕'], [/tarjeta/, '💳'], [/descuadre/, '❓'], [/deuda/, '📄'],
  [/interes|prestamo/, '💵'], [/prado|laguna|bodega|piso|apartamento|franklin|arriendo/, '🏢'], [/mano de obra/, '👷'],
  [/remodel/, '🎨'], [/material/, '🧱'], [/tramite/, '📑'], [/casas/, '🏗️'], [/redes|youtube|video/, '📺'], [/audiovisual/, '🎬'],
  [/inventario|venta|producto/, '📦'], [/inversion/, '📈'], [/salario|ingreso|tiempo|premio/, '💰'], [/abuelo|esposo/, '🤝'],
  [/transferencia/, '🔁'], [/total|resto/, '🧾'], [/ferreter/, '🔨'], [/parqueadero/, '🅿️'],
];

const vista = { mes: null, tipo: null, orden: 'cantidad', anio: null };

/** Al volver al inicio se olvida el mes visto: cada libro abre en el mes actual. */
function reiniciarVista() {
  vista.mes = null;
  vista.tipo = null;
  vista.anio = null;
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function iconoDe(categoria) {
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

/**
 * Reparte cada pago en capital e interés. En capital primero todo va al capital hasta recuperarlo;
 * lo que pasa de ahí es ganancia. El resto de los préstamos ya trae su reparto guardado.
 */
export function repartirPagos(prestamos, pagos) {
  const porId = new Map(prestamos.map((p) => [p.id, p]));
  const recibido = new Map();
  const orden = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const reparto = new Map();
  for (const g of orden) {
    const p = porId.get(g.prestamoId);
    if (g.tipo === 'perdon' || !p || p.modalidad !== 'capital_primero') { reparto.set(g.id, { interes: g.interes, capital: g.capital }); continue; }
    const antes = recibido.get(p.id) || 0;
    const aCapital = Math.min(g.monto, Math.max(0, p.capital - antes));
    recibido.set(p.id, antes + g.monto);
    reparto.set(g.id, { capital: aCapital, interes: g.monto - aCapital });
  }
  return reparto;
}

const pagosRepartidos = (estado) => {
  const r = repartirPagos(estado.prestamos, estado.pagos);
  return estado.pagos.map((g) => ({ ...g, ...r.get(g.id) }));
};

/** Movimientos de los libros, más los intereses de los pagos registrados en la app. */
function asientos(ctx) {
  const estado = ctx.datos.estado;
  const propios = (estado.fran && estado.fran.asientos) || [];
  const deIntereses = pagosRepartidos(estado).filter((g) => g.tipo !== 'perdon' && g.interes > 0).map((g) => ({
    id: `pago-${g.id}`, libro: 'prestamos', fecha: g.fecha, tipo: 'ingreso', categoria: 'Intereses cobrados',
    descripcion: nombreCliente(ctx, g.clienteId), valor: g.interes, persona: nombreCliente(ctx, g.clienteId), importado: true,
  }));
  return [...propios, ...deIntereses];
}

const NEGOCIOS = ['prestamos', 'arriendos', 'productos', 'redes'];

/** Lo que entró como ganancia en los negocios y lo que ella sacó para sí. */
export function gananciasDe(lista) {
  return {
    entradas: lista.filter((a) => a.tipo === 'ingreso' && !a.soloLibro && NEGOCIOS.includes(a.libro)),
    retiros: lista.filter((a) => a.libro === 'ganancias' && a.tipo === 'retiro'),
  };
}

const NOMBRE_EN_FINANZAS = { prestamos: 'Ganancia de préstamos', arriendos: 'Arriendos' };

export function delLibro(lista, libro) {
  if (libro === 'personal') {
    return lista
      .filter((a) => a.libro === 'personal' || (a.tipo === 'ingreso' && !a.soloLibro && !['terceros', 'pension'].includes(a.libro)))
      .map((a) => (a.tipo === 'ingreso' && NOMBRE_EN_FINANZAS[a.libro] ? { ...a, categoria: NOMBRE_EN_FINANZAS[a.libro] } : a));
  }
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

// Inicio y cada libro muestran el mes actual, aunque todavía esté en 0 (pedido el 6 nov 2026).
// Si el mes está vacío, la pantalla ofrece ir al último mes con datos.
function mesVisible(ctx, lista) {
  return vista.mes || ctx.hoy().slice(0, 7);
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
  for (const m of estado.fran.virtualMov || []) virtual += m.tipo === 'entra' ? m.valor : -m.valor;
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
  const conteo = { al_dia: 0, por_confirmar: 0, atrasado: 0, congelado: 0, legal: 0, perdido: 0, solo_intereses: 0 };
  for (const c of estado.clientes) {
    if (c.tipo === 'familia') continue;
    const propios = estado.prestamos.filter((p) => p.clienteId === c.id);
    if (!propios.length) continue;
    const r = motor.resumenCliente(c, propios, estado.pagos.filter((g) => g.clienteId === c.id), ctx.hoy());
    const e = r.soloIntereses ? 'solo_intereses' : (r.estado === 'vencido' ? 'atrasado' : r.estado);
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

/** Cabecera de libro: volver, el emoji del libro en su cuadro con el nombre y, si hay, el mes en una píldora. */
function titular(id, ctx, atras, texto, mes) {
  const { ui } = ctx;
  const l = LIBROS[id];
  return `<header class="fran-titulo fran-titulo--libro">
    ${atras ? `<a href="${ui.esc(atras)}" class="fran-titulo__atras" aria-label="Volver">‹</a>` : ''}
    <h1><span class="fran-cuadro fran-cuadro--28" aria-hidden="true">${ui.esc(l.icono)}</span><span>${ui.esc(texto || l.corto)}</span></h1>
    ${mes ? `<button type="button" class="fran-pildora fran-titulo__mes" data-elegir-mes aria-label="Elegir mes">${ui.esc(MESES_CORTOS[Number(mes.slice(5, 7)) - 1])}${mes.slice(0, 4) !== ctx.hoy().slice(0, 4) ? ` ${mes.slice(2, 4)}` : ''} <i aria-hidden="true">▾</i></button>` : ''}
  </header>`;
}

// ---------- Piezas del diseño Lila ----------

/** Monto con ⊕ o ⊖ delante. El número va siempre del color del texto. signo: 'mas', 'menos' o nada (⊖ solo si es negativo). */
function conSigno(valor, dinero, signo) {
  const clase = signo || (valor < 0 ? 'menos' : '');
  return `<span class="numero${clase ? ` fran-${clase}` : ''}">${dinero.formatear(Math.abs(valor))}</span>`;
}

/** Tarjeta de saldo: la única en degradado de cada pantalla. cajas: [etiqueta, valor (número o texto), signo]. */
function heroe({ etiqueta, valor, cajas = [], ruta = '', ayudaTexto = '' }, ctx) {
  const { ui, dinero } = ctx;
  const grande = typeof valor === 'number' ? conSigno(valor, dinero) : `<span>${ui.esc(valor)}</span>`;
  const cajitas = cajas.length ? `<span class="fran-heroe__cajas${cajas.length === 4 ? ' fran-heroe__cajas--cuatro' : ''}">${cajas.map(([t, v, signo, enlace]) => {
    const dentro = `<small>${ui.esc(t)}</small>${typeof v === 'number' ? conSigno(v, dinero, signo) : `<span>${ui.esc(v)}</span>`}`;
    return enlace && !ruta ? `<a href="${ui.esc(enlace)}">${dentro}</a>` : `<span>${dentro}</span>`;
  }).join('')}</span>` : '';
  const etiquetaHtml = `<span class="fran-heroe__etiqueta"><small>${ui.esc(etiqueta)}</small>${ayudaTexto && !ruta ? ayuda(ayudaTexto, ui) : ''}</span>`;
  const interior = `${etiquetaHtml}<strong class="fran-heroe__valor">${grande}</strong>${cajitas}`;
  return ruta ? `<a href="${ui.esc(ruta)}" class="fran-heroe">${interior}</a>` : `<div class="fran-heroe">${interior}</div>`;
}

/** Botón ⓘ: el texto largo se lee en una hoja que sube desde abajo. */
function ayuda(texto, ui) {
  return `<button type="button" class="fran-info" data-ayuda="${ui.esc(texto)}" aria-label="Más información">ⓘ</button>`;
}

function abrirHoja(texto) {
  const fondo = document.createElement('div');
  fondo.className = 'fran-hoja-fondo';
  fondo.innerHTML = '<div class="fran-hoja" role="dialog" aria-modal="true"><p></p><button type="button" class="fran-boton-principal">Entendido</button></div>';
  fondo.querySelector('p').textContent = texto;
  fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('button')) fondo.remove(); });
  document.body.append(fondo);
  fondo.querySelector('button').focus();
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-ayuda]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    abrirHoja(b.dataset.ayuda);
  }, true);
}

/** Renglón tocable sobre la tarjeta: emoji en cuadro, texto, valor o número de aviso, y flecha. */
function renglon({ ruta, icono, texto, sub = '', derecha = '', contador = 0 }, ui) {
  return `<a href="${ui.esc(ruta)}" class="fran-renglon">
    <span class="fran-cuadro fran-cuadro--40" aria-hidden="true">${ui.esc(icono)}</span>
    <span class="fran-renglon__texto"><span>${ui.esc(texto)}</span>${sub ? `<small>${ui.esc(sub)}</small>` : ''}</span>
    ${derecha}${contador ? `<span class="fran-contador">${contador}</span>` : ''}
    <span class="fran-flecha" aria-hidden="true">›</span>
  </a>`;
}

/** Saldo del último mes con datos de un libro: el mismo número en Inicio y en la cabecera del libro. */
function saldoLibro(ctx, todos, id, mes = null) {
  const lista = delLibro(todos, id);
  const elMes = mes || ctx.hoy().slice(0, 7);
  const m = delMes(lista, elMes);
  const g = sumar(deTipo(m, 'gasto'));
  const i = sumar(deTipo(m, 'ingreso'));
  return { mes: elMes, lista, m, g, i, saldo: i - g };
}

/** Cartera de préstamos: capital en la calle más intereses pendientes. */
function carteraDe(ctx) {
  const estado = ctx.datos.estado;
  const r = ctx.motor.resumenNegocio(estado, ctx.hoy());
  const provisional = estado.prestamos.some((x) => x.porConfirmar);
  return { r, provisional, valor: provisional ? 'por confirmar' : r.capitalEnCalle + r.interesesPendientes };
}

/** Lo invertido en el negocio tecnológico que sigue sin venderse. */
function invertidoProductos(todos) {
  return sumar(deTipo(delLibro(todos, 'productos'), 'gasto').filter((a) => a.categoria === 'Inventario sin vender' && !a.enPago));
}

function caja3(a, b, c, ctx) {
  const { ui } = ctx;
  const clase = (t, v) => {
    if (['Gastos', 'Presté', 'Metí yo'].includes(t)) return 'fran-menos';
    if (['Ingresos', 'Cobré capital', 'Intereses', 'Vendí'].includes(t)) return 'fran-mas';
    return String(v).startsWith('-') ? 'fran-menos' : 'fran-mas';
  };
  return `<div class="fran-caja3">${[a, b, c].map(([t, v]) => `<div><small>${ui.esc(t)}</small><strong class="numero ${/\d/.test(v) ? clase(t, v) : ''}">${ui.esc(/\d/.test(v) ? String(v).replace(/^-/, '') : v)}</strong></div>`).join('')}</div>`;
}

function selectorMes(mes, ctx) {
  const { ui, fechas } = ctx;
  return `<div class="fran-mes"><button type="button" class="fran-mes__elegir" data-elegir-mes>${ui.esc(fechas.formatearMes(mes))} <i aria-hidden="true">▾</i></button></div>`;
}

/** Tira que se desliza con el dedo, de septiembre 2023 hasta hoy, como en Mis Gastos. */
function tiraDeMeses(mes, lista, ctx) {
  const { ui } = ctx;
  const conDatos = lista.map((a) => a.fecha).filter((f) => f > '2001');
  const primero = [...conDatos, `${mes}-01`].reduce((m, f) => (f < m ? f : m)).slice(0, 7);
  const hoyMes = ctx.hoy().slice(0, 7);
  const ultimo = mes > hoyMes ? mes : hoyMes;
  const meses = [];
  for (let m = primero; m <= ultimo; m = moverMes(m, 1, ctx)) meses.push(m);
  return `<div class="fran-tira" role="tablist" aria-label="Meses">${meses.map((m) => `<button type="button" role="tab" class="${m === mes ? 'activo' : ''}" aria-selected="${m === mes}" data-ir-mes="${m}">${ui.esc(MESES_CORTOS[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}</button>`).join('')}</div>`;
}

function centrarTira(raiz) {
  const tira = raiz.querySelector('.fran-tira');
  const activo = tira && tira.querySelector('.activo');
  if (activo) tira.scrollLeft = activo.offsetLeft - tira.offsetLeft - (tira.clientWidth - activo.offsetWidth) / 2;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Ventana para elegir cualquier mes de una vez, igual a la de Mis Gastos. */
function abrirMeses(mes, ctx, alElegir, permitidos = null) {
  const { ui, fechas } = ctx;
  const hoy = ctx.hoy();
  let anio = Number(mes.slice(0, 4));
  let elegido = mes;
  const ultimo = Math.max(Number(hoy.slice(0, 4)) + 1, anio);
  const anios = [];
  for (let a = ultimo; a >= Math.min(2023, anio); a--) anios.push(a);
  const fondo = ui.el(`<div class="fran-meses-fondo"><div class="fran-meses" role="dialog" aria-modal="true" aria-label="Elegir mes">
    <h2></h2>
    <div class="fran-meses__anio">
      <select aria-label="Año">${anios.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      <span><button type="button" data-anio="-1" aria-label="Año anterior">‹</button><button type="button" data-anio="1" aria-label="Año siguiente">›</button></span>
    </div>
    <div class="fran-meses__lista"></div>
    <div class="fran-meses__pie"><button type="button" data-cancelar>Cancelar</button><button type="button" data-confirmar>Confirmar</button></div>
  </div></div>`);
  const cerrar = () => fondo.remove();
  const pintar = () => {
    fondo.querySelector('h2').textContent = fechas.formatearMes(elegido).replace(/ (\d{4})$/, ' de $1');
    fondo.querySelector('select').value = String(anio);
    fondo.querySelector('[data-anio="-1"]').disabled = anio <= anios[anios.length - 1];
    fondo.querySelector('[data-anio="1"]').disabled = anio >= anios[0];
    fondo.querySelector('.fran-meses__lista').innerHTML = MESES_CORTOS.map((nombre, i) => {
      const clave = `${anio}-${String(i + 1).padStart(2, '0')}`;
      const clase = `${clave === elegido ? 'activo' : ''} ${clave === hoy.slice(0, 7) ? 'hoy' : ''}`;
      return `<button type="button" class="${clase}" data-m="${clave}" ${permitidos && !permitidos.includes(clave) ? 'disabled' : ''}>${nombre}</button>`;
    }).join('');
  };
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cancelar]')) { cerrar(); return; }
    if (e.target.closest('[data-confirmar]')) { cerrar(); if (elegido !== mes) alElegir(elegido); return; }
    const a = e.target.closest('[data-anio]');
    if (a && !a.disabled) { anio += Number(a.dataset.anio); pintar(); return; }
    const m = e.target.closest('[data-m]');
    if (m && !m.disabled) { elegido = m.dataset.m; pintar(); }
  });
  fondo.querySelector('select').addEventListener('change', (e) => { anio = Number(e.target.value); pintar(); });
  pintar();
  document.body.append(fondo);
}

function conectarMes(raiz, mes, ctx, redibujar) {
  raiz.querySelectorAll('[data-elegir-mes]').forEach((b) => b.addEventListener('click', () => {
    abrirMeses(mes, ctx, (m) => { vista.mes = m; redibujar(); });
  }));
  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => {
    vista.mes = moverMes(mes, Number(b.dataset.mes), ctx);
    redibujar();
  }));
  raiz.querySelectorAll('[data-ir-mes]').forEach((b) => b.addEventListener('click', () => {
    vista.mes = b.dataset.irMes;
    redibujar();
  }));
}

/** Mes vacío: dice cuál es el último mes con datos y lleva hasta allá. */
function vacioConSalto(lista, ctx, texto) {
  const { ui, fechas } = ctx;
  const ultimo = lista.length ? ultimoMes(ctx, lista) : null;
  return `<div class="fran-vacio"><p>${ui.esc(texto)}</p>${ultimo ? `<button type="button" class="boton boton--secundario" data-ir-mes="${ui.esc(ultimo)}">Ir a ${ui.esc(fechas.formatearMes(ultimo))}</button>` : ''}</div>`;
}

/** Explica de dónde sale un número cuando el mes todavía no tiene los movimientos uno por uno. */
function avisoSinDetalle(lista) {
  if (!lista.some((a) => a.sinDetalle)) return '';
  if (lista.every((a) => a.fecha.startsWith('2023'))) return '<p class="fran-explica">ⓘ De 2023 solo existe el total de cada mes.</p>';
  return '<p class="fran-explica">ⓘ Este mes solo tiene el total de cada categoría, tomado de Mis Gastos. Los movimientos uno por uno aparecen cuando se carguen los pantallazos de ese mes.</p>';
}

function fila({ icono, titulo: t, sub, derecha, clase = '', ruta, ui, ver }) {
  const interior = `<span class="fran-ico">${ui.esc(icono)}</span>
    <span class="fran-fila__texto"><strong>${ui.esc(t)}</strong>${sub ? `<small>${ui.esc(sub)}</small>` : ''}</span>
    <span class="fran-fila__valor numero ${clase}">${ui.esc(clase ? String(derecha).replace(/^[+−-]\s*/, '') : derecha)}</span>`;
  if (ver) return `<div class="fran-fila" role="button" tabindex="0" data-ver="${ui.esc(ver)}">${interior}</div>`;
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
    html += `<div class="fran-dia"><span>${ui.esc(fechaLinda(dia, ctx))}</span><span>${g ? `G: <b class="numero">${dinero.formatear(g)}</b> ` : ''}${i ? `I: <b class="numero">${dinero.formatear(i)}</b>` : ''}</span></div>`;
    for (const a of filas) {
      const signo = a.tipo === 'ingreso' ? '+' : (a.tipo === 'gasto' ? '−' : '');
      html += fila({ ui, ver: a.id, icono: iconoDe(a.categoria), titulo: a.categoria, sub: a.descripcion, derecha: `${signo}${dinero.formatear(a.valor)}`, clase: a.tipo === 'ingreso' ? 'fran-mas' : (a.tipo === 'gasto' ? 'fran-menos' : '') });
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

const ICONO_SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
const ICONO_LUNA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5 8.5 8.5 0 1 0 20.5 14.6z"/></svg>';

function renderPrincipal(contenedor, ctx) {
  reiniciarVista();
  const { ui, dinero, datos, fechas } = ctx;
  const estado = datos.estado;
  const fran = estado.fran;
  const lista = asientos(ctx);
  const plata = miPlata(ctx);
  const hoyAgenda = agendaDeHoy(ctx);
  const sinDatos = !estado.clientes.length && !fran.asientos.length;
  const ahora = new Date();
  const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  const { entradas, retiros } = gananciasDe(lista);
  const mesHoy = ctx.hoy().slice(0, 7);
  const gananciaMes = sumar(delMes(entradas, mesHoy));
  const sacadoMes = sumar(delMes(retiros, mesHoy));
  const avisoAnotar = !sinDatos && horaAhora >= fran.recordatorios.gastos && !fran.asientos.some((x) => x.fecha === ctx.hoy());
  // Cada tarjeta lleva el mismo número que la cabecera de su libro.
  const cartera = carteraDe(ctx);
  const valorDe = {
    personal: saldoLibro(ctx, lista, 'personal').saldo,
    prestamos: cartera.valor,
    pension: totalPension(fran),
    productos: invertidoProductos(lista),
    arriendos: saldoLibro(ctx, lista, 'arriendos').saldo,
    redes: saldoLibro(ctx, lista, 'redes').saldo,
    terceros: totalTerceros(ctx),
  };
  const tarjetaLibro = (id, chica) => `<a href="#/libro/${id}" class="fran-libro${chica ? ' fran-libro--chica' : ''}">
    <span class="fran-cuadro ${chica ? 'fran-cuadro--40' : 'fran-cuadro--52'}" aria-hidden="true">${LIBROS[id].icono}</span>
    <small>${ui.esc(LIBROS[id].enInicio)}</small>
    <span class="fran-libro__valor">${typeof valorDe[id] === 'number' ? conSigno(valorDe[id], dinero) : ui.esc(valorDe[id])}</span>
  </a>`;
  const ganadoHoy = sumar(entradas.filter((a) => a.fecha === ctx.hoy()));
  const hayAviso = hoyAgenda.length || avisoAnotar;

  const principal = ui.el(`<div class="fran-principal">
    <header class="fran-hola">
      <div><small>Hola,</small><h1>Fran</h1></div>
      <span class="fran-hola__botones"><button type="button" class="fran-campana" data-modo-cambiar aria-label="Cambiar entre claro y oscuro"></button><button type="button" class="fran-campana" data-apariencia aria-label="Apariencia: temas y letra"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.7a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg></button>
      <a href="#/agenda" class="fran-campana" aria-label="Avisos y cobros de hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>${hoyAgenda.length ? `<b class="fran-campana__numero">${hoyAgenda.length}</b>` : (hayAviso ? '<i></i>' : '')}</a></span>
    </header>
    ${heroe({ etiqueta: plata.total < 0 ? 'Mi plata hoy · me hace falta' : 'Mi plata hoy · debo tener', valor: plata.total, ayudaTexto: 'Es efectivo más virtual, menos lo que debo en tarjetas. Si sale con ⊖, es lo que me hace falta.', cajas: [
      ['Efectivo', plata.efectivo, '', '#/efectivo'],
      ['Virtual', fran.virtualPorDefinir ? 'por confirmar' : plata.virtual, '', '#/virtual'],
      ['Tarjetas', plata.tarjetas, plata.tarjetas ? 'menos' : '', '#/virtual'],
      [`Ganancia hoy · ${fechas.nombreMes(Number(mesHoy.slice(5, 7)), true)} ${dinero.formatear(gananciaMes)}`, ganadoHoy, ganadoHoy ? 'mas' : '', '#/ganancias'],
    ] }, ctx)}
    ${sinDatos ? `<a href="#/ajustes" class="fran-aviso">Todavía no están tus datos en este aparato. Toca aquí y entra a la nube con tu correo.</a>` : ''}
    ${avisoAnotar ? renglon({ ruta: '#/libro/personal/agregar/gasto', icono: '📝', texto: 'Hoy no has anotado nada' }, ui) : ''}
    <div class="fran-libros">${['personal', 'prestamos', 'pension', 'productos'].map((id) => tarjetaLibro(id, false)).join('')}</div>
    <div class="fran-libros-chicos">${['arriendos', 'redes', 'terceros'].map((id) => tarjetaLibro(id, true)).join('')}</div>
  </div>`);
  principal.querySelector('[data-apariencia]').addEventListener('click', () => abrirApariencia(''));
  // Sol y luna: en oscuro se ve el sol (para pasar a claro); en claro, la luna.
  const botonModo = principal.querySelector('[data-modo-cambiar]');
  const pintarModo = () => { botonModo.innerHTML = window.Tema && window.Tema.modo() === 'claro' ? ICONO_LUNA : ICONO_SOL; };
  botonModo.addEventListener('click', () => { if (window.Tema) window.Tema.cambiarModo(); pintarModo(); });
  pintarModo();
  contenedor.append(principal);
}

// ---------- Ganancia de los negocios, día a día ----------

function renderGanancias(contenedor, ctx) {
  const { ui, dinero, datos, fechas } = ctx;
  const { entradas, retiros } = gananciasDe(asientos(ctx));
  const hoy = ctx.hoy();
  const mes = vista.mes || hoy.slice(0, 7);
  const enMes = delMes(entradas, mes);
  const sacados = delMes(retiros, mes);
  const total = sumar(enMes);
  const sacado = sumar(sacados);
  const dibujar = () => { contenedor.innerHTML = ''; renderGanancias(contenedor, ctx); window.scrollTo(0, 0); };
  const dias = [...new Set([...enMes, ...sacados].map((a) => a.fecha))].sort().reverse();
  const filasDia = (dia) => [
    ...enMes.filter((a) => a.fecha === dia).map((a) => fila({ ui, icono: LIBROS[a.libro].icono, titulo: a.persona || a.descripcion || a.categoria, sub: LIBROS[a.libro].corto, derecha: `+${dinero.formatear(a.valor)}`, clase: 'fran-mas', ver: a.id })),
    ...sacados.filter((a) => a.fecha === dia).map((a) => fila({ ui, icono: '💰', titulo: a.categoria, sub: a.descripcion, derecha: `−${dinero.formatear(a.valor)}`, clase: 'fran-menos', ver: a.id })),
  ].join('');
  const raiz = ui.el(`<div>
    <header class="fran-titulo"><a href="#/inicio" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>Ganancias</h1></header>
    ${selectorMes(mes, ctx)}
    <div class="fran-reparto">
      <div class="fran-tarjeta"><small>Ganancia</small><strong class="numero">${dinero.formatear(total)}</strong></div>
      <div class="fran-tarjeta"><small>Saqué</small><strong class="numero">${dinero.formatear(sacado)}</strong></div>
      <div class="fran-tarjeta"><small>Para reinvertir</small><strong class="numero">${dinero.formatear(total - sacado)}</strong></div>
    </div>
    <p class="fran-seccion">Por negocio</p>
    <div class="fran-lista">${NEGOCIOS.map((id) => [id, sumar(enMes.filter((a) => a.libro === id))]).filter((x) => x[1]).map(([id, v]) => fila({ ui, icono: LIBROS[id].icono, titulo: LIBROS[id].corto, derecha: `+${dinero.formatear(v)}`, clase: 'fran-mas', ruta: `#/libro/${id}` })).join('') || '<p class="fran-vacio">Sin ganancias este mes.</p>'}</div>
    <form class="fran-campos" novalidate>
      <label><small>Saqué para mí</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
      <button class="boton boton--primario fran-guardar">Anotar</button>
    </form>
    <p class="fran-seccion">Día a día</p>
    ${dias.map((d) => `<div class="fran-dia"><span>${ui.esc(fechaLinda(d, ctx))}</span><span>Ganancia <b class="numero">${dinero.formatear(sumar(enMes.filter((a) => a.fecha === d)))}</b></span></div><div class="fran-lista">${filasDia(d)}</div>`).join('') || '<p class="fran-vacio">Nada todavía.</p>'}
  </div>`);
  conectarMes(raiz, mes, ctx, dibujar);
  conectarVer(raiz, [...enMes, ...sacados], contenedor, 'ganancias', dibujar, ctx);
  raiz.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      await datos.agregarAsiento({ libro: 'ganancias', fecha: f.fecha.value, tipo: 'retiro', categoria: 'Saqué para mí', descripcion: '', valor: Number(f.valor.value.replace(/\D/g, '')), cuenta: '', destino: '' });
      ui.toast('Anotado.');
    } catch (error) { ui.toast(error.message); }
  });
  contenedor.append(raiz);
}

// ---------- Otros libros (boceto 14) ----------

function renderOtros(contenedor, ctx) {
  reiniciarVista();
  const { ui, dinero, fechas } = ctx;
  const lista = asientos(ctx);
  // El mismo número que la cabecera de cada libro.
  const fila = (id, valor, detalle, info = '') => `<div class="fran-renglon-con-info">${renglon({ ruta: `#/libro/${id}`, icono: LIBROS[id].icono, texto: LIBROS[id].nombre, sub: detalle, derecha: `<span class="fran-renglon__valor">${conSigno(valor, dinero)}</span>` }, ui)}${info}</div>`;
  const deLibro = (id) => { const s = saldoLibro(ctx, lista, id); return [s.saldo, `Saldo de ${fechas.formatearMes(s.mes)}`]; };
  contenedor.append(ui.el(`<div>
    <header class="fran-titulo"><a href="#/inicio" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>Otros libros</h1></header>
    <div class="fran-tarjeta-lista">
      ${fila('arriendos', ...deLibro('arriendos'))}
      ${fila('redes', ...deLibro('redes'))}
      ${fila('terceros', totalTerceros(ctx), 'Lo que guardas para otros', ayuda('Plata de terceros nunca suma a tu plata propia.', ui))}
    </div>
  </div>`));
}

// ---------- Inicio de cada libro (bocetos 3, 7, 11, 13) ----------

function renderLibro(contenedor, id, ctx) {
  const redibujar = () => { contenedor.innerHTML = ''; renderLibro(contenedor, id, ctx); };
  if (id === 'prestamos') return renderPrestamos(contenedor, ctx, redibujar);
  if (id === 'pension') return renderPension(contenedor, ctx);
  if (id === 'terceros') return renderTerceros(contenedor, ctx);
  if (id === 'productos') return renderProductos(contenedor, ctx, redibujar);
  const { ui, fechas } = ctx;
  const todos = asientos(ctx);
  const lista = delLibro(todos, id);
  const mes = mesVisible(ctx, lista);
  const { m, g, i, saldo } = saldoLibro(ctx, todos, id, mes);
  const raiz = ui.el(`<div>
    ${titular(id, ctx, '#/inicio', '', mes)}
    ${heroe({ etiqueta: `Saldo de ${fechas.nombreMes(Number(mes.slice(5, 7))).toLowerCase()}`, valor: saldo, cajas: [['Gastos', g, 'menos'], ['Ingresos', i, 'mas']] }, ctx)}
    ${id === 'personal' ? tarjetaDona(deTipo(m, 'gasto'), ctx) : ''}
    ${id === 'arriendos' ? '<a class="fran-boton-secundario fran-boton--emoji" href="#/libro/arriendos/propiedades"><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">🏢</span>Cuánto dio cada propiedad</a>' : ''}
    ${avisoSinDetalle(m)}
    ${m.length ? `<div class="fran-lista">${listaPorDia(m, ctx)}</div>` : vacioConSalto(lista, ctx, 'No hay movimientos en este mes.')}
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  conectarVer(raiz, m, contenedor, id, redibujar, ctx);
  contenedor.append(raiz);
}

/** Une los intereses y el abono de una misma persona: "360.000 int · 1.340.000 capital". */
function filasDeAsientos(lista, dinero) {
  const grupos = new Map();
  for (const a of lista) {
    if (String(a.id).startsWith('pago-')) continue;
    const clave = a.persona || a.id;
    if (!grupos.has(clave)) grupos.set(clave, { a, interes: 0, capital: 0, otro: 0 });
    const g = grupos.get(clave);
    if (a.tipo === 'abono') g.capital += a.valor;
    else if (a.tipo === 'ingreso') g.interes += a.valor;
    else g.otro -= a.valor;
  }
  return [...grupos.values()].map(({ a, interes, capital, otro }) => {
    let sub = 'Intereses';
    if (a.sinDetalle) sub = 'Intereses del mes, sin detalle';
    else if (interes && capital) sub = `${dinero.formatear(interes)} int · ${dinero.formatear(capital)} capital`;
    else if (capital) sub = 'Abono a capital';
    else if (otro) sub = a.descripcion || a.categoria;
    return { fecha: a.fecha, icono: capital ? '↩️' : '💵', titulo: a.persona || a.categoria, sub, valor: interes + capital + otro, ruta: a.clienteId ? `#/cliente/${encodeURIComponent(a.clienteId)}` : null };
  });
}

function renderPrestamos(contenedor, ctx, redibujar) {
  const { ui, dinero, datos, motor } = ctx;
  const estado = datos.estado;
  const lista = delLibro(asientos(ctx), 'prestamos');
  const mes = mesVisible(ctx, lista);
  const enMes = (f) => f.slice(0, 7) === mes;
  const prestamos = estado.prestamos.filter((p) => enMes(p.fecha));
  const pagos = pagosRepartidos(estado).filter((g) => g.tipo !== 'perdon' && enMes(g.fecha));
  const abonos = deTipo(delMes(lista, mes), 'abono');
  const capital = pagos.reduce((s, g) => s + g.capital, 0) + sumar(abonos);
  const intereses = sumar(deTipo(delMes(lista, mes), 'ingreso'));
  const c = clientesPorEstado(ctx);
  const cartera = carteraDe(ctx);

  const movimientos = [
    ...prestamos.map((p) => ({ fecha: p.fecha, icono: '💵', titulo: nombreCliente(ctx, p.clienteId), sub: 'Nuevo préstamo', valor: -p.capital, ruta: `#/cliente/${encodeURIComponent(p.clienteId)}` })),
    ...pagos.map((g) => ({ fecha: g.fecha, icono: g.capital && !g.interes ? '↩️' : '💵', titulo: nombreCliente(ctx, g.clienteId), sub: [g.interes ? `${dinero.formatear(g.interes)} int` : '', g.capital ? `${dinero.formatear(g.capital)} capital` : ''].filter(Boolean).join(' · '), valor: g.monto, ruta: `#/cliente/${encodeURIComponent(g.clienteId)}` })),
    ...filasDeAsientos(delMes(lista, mes), dinero),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || Math.abs(b.valor) - Math.abs(a.valor));

  const pastilla = (t, n, clase) => `<a href="#/clientes" class="fran-pastilla ${clase}"><i></i>${ui.esc(t)} ${n}</a>`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/inicio', '', mes)}
    ${heroe({ etiqueta: 'Cartera', valor: cartera.valor, cajas: [
      ['Ganancia del mes', intereses, 'mas'],
      ['Presté', prestamos.reduce((s, p) => s + p.capital, 0), 'menos'],
      ['Cobré capital', estado.pagos.length || abonos.length ? capital : 'Sin datos', 'mas'],
    ] }, ctx)}
    ${cartera.provisional ? `<p class="fran-nota">Capital anotado: ${dinero.formatear(cartera.r.capitalEnCalle)}</p>` : ''}
    ${renglonSoloIntereses(ctx)}
    <div class="fran-pastillas">
      ${c.por_confirmar ? pastilla('Por confirmar', c.por_confirmar, 'gris') : ''}
      ${pastilla('Al día', c.al_dia, 'verde')}
      ${pastilla('Atrasados', c.atrasado, 'amarillo')}
      ${pastilla('Congelados', c.congelado, 'gris')}
      ${pastilla('Legal', c.legal, 'rojo')}
      ${c.solo_intereses ? pastilla('Solo intereses', c.solo_intereses, 'gris') : ''}
    </div>
    <div class="fran-accesos">
      <a href="#/clientes"><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">👥</span>Clientes</a>
      <a href="#/agenda"><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">⏰</span>Agenda de cobros</a>
      <a href="#/libro/prestamos/tabla" class="fran-accesos__ancho"><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">📋</span>Tabla de préstamos, como en el Excel</a>
    </div>
    <p class="fran-seccion">Movimientos del mes</p>
    ${avisoSinDetalle(delMes(lista, mes))}
    <div class="fran-lista">${movimientos.map((x) => fila({ ui, icono: x.icono, titulo: x.titulo, sub: x.sub, derecha: `${x.valor < 0 ? '−' : '+'}${dinero.formatear(Math.abs(x.valor))}`, clase: x.valor < 0 ? 'fran-menos' : 'fran-mas', ruta: x.ruta })).join('') || vacioConSalto(lista, ctx, 'No hay movimientos en este mes.')}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderProductos(contenedor, ctx, redibujar) {
  const { ui, dinero, fechas } = ctx;
  const lista = delLibro(asientos(ctx), 'productos');
  const mes = mesVisible(ctx, lista);
  const m = delMes(lista, mes);
  const meti = sumar(deTipo(m, 'gasto').filter((a) => !a.enPago));
  const vendi = sumar(deTipo(m, 'ingreso'));
  // Lo que está en inventario o en inversiones no es pérdida: solo restan los gastos del negocio.
  const gastosProductos = sumar(deTipo(m, 'gasto').filter((a) => a.categoria === 'Gasto de productos'));
  const inventario = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inventario sin vender');
  const inversiones = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inversiones');
  const vendido = deTipo(lista, 'ingreso').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filas = (l, signo) => l.map((a) => fila({ ui, ver: a.id, icono: iconoDe(a.categoria), titulo: a.descripcion || a.categoria, sub: a.textoFecha || fechas.formatear(a.fecha), derecha: `${signo}${dinero.formatear(a.valor)}`, clase: signo === '+' ? 'fran-mas' : '' })).join('');
  const raiz = ui.el(`<div>
    ${titular('productos', ctx, '#/inicio', '', mes)}
    ${heroe({ etiqueta: 'Invertido sin vender', valor: invertidoProductos(lista), cajas: [['Metí yo', meti, 'menos'], ['Vendí', vendi, 'mas'], ['Ganancia', vendi - gastosProductos]] }, ctx)}
    <p class="fran-seccion">Inventario</p><div class="fran-lista">${filas(inventario, '') || '<p class="fran-vacio">Sin inventario.</p>'}</div>
    ${inversiones.length ? `<p class="fran-seccion">Inversiones</p><div class="fran-lista">${filas(inversiones, '')}</div>` : ''}
    <p class="fran-seccion">Vendido</p><div class="fran-lista">${filas(vendido, '+') || '<p class="fran-vacio">Todavía sin ventas.</p>'}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  conectarVer(raiz, lista, contenedor, 'productos', redibujar, ctx);
  contenedor.append(raiz);
}

function renderPension(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const p = fran.pension;
  // Lo prestado de la pensión va junto en un renglón: a Daniel y lo que le debe el negocio.
  const esDelNegocio = (o) => /debe el negocio/i.test(o.nota || '');
  const prestados = p.otros.filter((o) => /prestado/i.test(o.nombre) || esDelNegocio(o));
  const otrosPropios = p.otros.filter((o) => !prestados.includes(o));
  const raiz = ui.el(`<div>
    ${titular('pension', ctx, '#/inicio')}
    ${heroe({ etiqueta: 'Total pensión', valor: totalPension(fran), ayudaTexto: p.origen ? `Origen: ${p.origen.charAt(0).toLowerCase() + p.origen.slice(1)}.` : '' }, ctx)}
    <button type="button" id="fran-tasa" class="fran-pildora">Tasa del día ${dinero.formatear(p.tasa)} ✏️</button>
    <form id="fran-tasa-form" class="fran-tasa oculto"><input name="tasa" inputmode="numeric" value="${ui.esc(p.tasa)}" aria-label="Tasa del día"><button class="boton boton--primario">Guardar</button></form>
    <div class="fran-lista">
      ${p.cuentas.map((c) => filaPension({ icono: '💵', titulo: c.nombre, pesos: Math.round(c.usd * p.tasa), usd: c.usd }, ctx)).join('')}
      ${otrosPropios.map((o) => filaPension({ icono: /carro/i.test(o.nombre) ? '🚗' : '👛', titulo: o.nombre, sub: o.nota, pesos: o.cop, usd: Number.isFinite(o.usd) ? o.usd : null }, ctx)).join('')}
    </div>
    ${prestados.length ? `<details class="fran-tachados fran-prestado-pension">
      <summary><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">🤝</span><span class="fran-renglon__texto"><span>Prestado de la pensión</span><small>Toca para ver a quién</small></span><b class="numero">${dinero.formatear(prestados.reduce((s, o) => s + o.cop, 0))}</b></summary>
      <div class="fran-lista">${prestados.map((o) => filaPension({ icono: esDelNegocio(o) ? '🏦' : '🤝', titulo: esDelNegocio(o) ? 'Lo debe el negocio de préstamos' : o.nombre.replace(/^Prestado a /i, ''), sub: esDelNegocio(o) ? 'Lorena lo devolvió y se volvió a prestar. El negocio se lo debe a la pensión.' : o.nota, pesos: o.cop }, ctx)).join('')}</div>
    </details>` : ''}
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

/** Fila de la pensión: pesos en grande y dólares pequeños debajo, igual en todas. */
function filaPension({ icono, titulo: t, sub = '', pesos, usd = null }, ctx) {
  const { ui, dinero } = ctx;
  return `<div class="fran-fila">
    <span class="fran-ico">${ui.esc(icono)}</span>
    <span class="fran-fila__texto"><strong>${ui.esc(t)}</strong>${sub ? `<small>${ui.esc(sub)}</small>` : ''}</span>
    <span class="fran-fila__valor fran-fila__valor--doble"><span class="numero">${dinero.formatear(pesos)}</span>${usd !== null ? `<small class="numero">${ui.esc(String(usd).replace('.', ','))} USD</small>` : ''}</span>
  </div>`;
}

function renderTerceros(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const lista = delLibro(asientos(ctx), 'terceros');
  contenedor.append(ui.el(`<div>
    ${titular('terceros', ctx, '#/inicio')}
    ${heroe({ etiqueta: 'Plata que guardas para otros', valor: totalTerceros(ctx), ayudaTexto: 'Nunca suma a tu plata propia.' }, ctx)}
    <div class="fran-lista">${fran.terceros.map((t) => fila({ ui, icono: '🤝', titulo: t.nombre, sub: t.nota, derecha: dinero.formatear(t.valor) })).join('')}</div>
    ${lista.length ? `<p class="fran-seccion">Movimientos</p><div class="fran-lista">${listaPorDia(lista, ctx)}</div>` : ''}
  </div>`));
}

// ---------- Gráficos (boceto 5) ----------

function dona(grupos, total, centro = null, colores = COLORES) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  let giro = 0;
  const arcos = grupos.map((g, i) => {
    const largo = total ? (g[1] / total) * circ : 0;
    const arco = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${colores[i % colores.length]}" stroke-width="18" stroke-dasharray="${Math.max(largo - 0.8, 0)} ${circ}" stroke-dashoffset="${-giro}" transform="rotate(-90 60 60)"/>`;
    giro += largo;
    return arco;
  }).join('');
  const m = (total / 1000000).toFixed(2).replace('.', ',');
  const [arriba, abajo] = centro || [m, 'millones'];
  return `<svg viewBox="0 0 120 120" class="fran-dona" role="img" aria-label="Reparto por categoría">${arcos}<text x="60" y="58" text-anchor="middle" class="fran-dona__n">${arriba}</text><text x="60" y="71" text-anchor="middle" class="fran-dona__t">${abajo}</text></svg>`;
}

/** Tarjeta de Finanzas con la dona de gastos del mes: 4 categorías como máximo y las demás en "Otros". */
function tarjetaDona(gastos, ctx) {
  const { ui, dinero } = ctx;
  const total = sumar(gastos);
  if (!total) return '';
  const porCat = new Map();
  for (const a of gastos) porCat.set(a.categoria, (porCat.get(a.categoria) || 0) + a.valor);
  const filas = [...porCat].sort((a, b) => b[1] - a[1]);
  const grupos = filas.slice(0, 4);
  if (filas.length > 4) grupos.push(['Otros', filas.slice(4).reduce((s, f) => s + f[1], 0)]);
  return `<a href="#/libro/personal/graficos" class="fran-tarjeta-dona">
    ${dona(grupos, total, [dinero.formatear(total), 'gastos'])}
    <span class="fran-tarjeta-dona__leyenda">${grupos.map(([n, v], i) => `<span><i style="background:${COLORES[i % COLORES.length]}"></i><span>${ui.esc(n)}</span><b class="numero">${Math.round((v / total) * 100)}%</b></span>`).join('')}</span>
  </a>`;
}

function renderGraficos(contenedor, id, ctx) {
  const { ui, dinero, fechas } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderGraficos(contenedor, id, ctx); };
  if (id === 'pension') {
    const p = ctx.datos.estado.fran.pension;
    const filas = [...p.cuentas.map((c) => [c.nombre, Math.round(c.usd * p.tasa)]), ...p.otros.map((o) => [o.nombre, o.cop])].sort((a, b) => b[1] - a[1]);
    const total = filas.reduce((s, f) => s + f[1], 0);
    contenedor.append(ui.el(`<div>${titular(id, ctx, `#/libro/${id}`, 'Gráficos')}
      ${total ? `<div class="fran-grafico">${dona(filas.slice(0, 7), total, null, VERDES)}</div>` : ''}
      <div class="fran-lista">${filas.map(([n, v], i) => `<div class="fran-barra-fila"><span class="fran-ico" style="background:${VERDES[i % VERDES.length]}"></span><span class="fran-barra-fila__c"><span class="fran-barra-fila__l"><strong>${ui.esc(n)}</strong><span class="numero">${dinero.formatear(v)}</span></span><span class="fran-barra-fila__l"><span class="fran-barra" style="width:${(v / filas[0][1]) * 80}%"></span><small>${((v / total) * 100).toFixed(1).replace('.', ',')}%</small></span></span></div>`).join('')}</div>
    </div>`));
    return;
  }
  if (!vista.tipo) vista.tipo = ['arriendos', 'redes', 'prestamos'].includes(id) ? 'ingreso' : 'gasto';
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
  const raiz = ui.el(`<div>
    <header class="fran-titulo"><a href="#/libro/${id}" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>${LIBROS[id].icono} Gráficos</h1>${id === 'personal' ? '<a href="#/libro/personal/calendario" class="fran-titulo__der" aria-label="Calendario">📅</a>' : ''}</header>
    <div class="fran-segmento">
      <button type="button" data-tipo="gasto" class="${vista.tipo === 'gasto' ? 'activo' : ''}">Gastos</button>
      <button type="button" data-tipo="ingreso" class="${vista.tipo === 'ingreso' ? 'activo' : ''}">Ingresos</button>
    </div>
    ${tiraDeMeses(mes, asientos(ctx), ctx)}
    ${avisoSinDetalle(m)}
    ${total ? `<div class="fran-grafico fran-grafico--leyenda">${dona(grupos, total, null, coloresDe(vista.tipo))}<div class="fran-grafico__leyenda">${grupos.map(([n, v], i) => `<p><i style="border-color:${coloresDe(vista.tipo)[i % 8]}"></i><span>${ui.esc(n)}</span><b class="numero">${pct(v)}%</b></p>`).join('')}</div></div>` : vacioConSalto(deTipo(lista, vista.tipo), ctx, `No hay ${vista.tipo === 'ingreso' ? 'ingresos' : 'gastos'} en este mes.`)}
    <div class="fran-lista">${filas.map(([cat, v], i) => `<a href="#/libro/${id}/categoria/${vista.tipo}/${encodeURIComponent(cat)}" class="fran-barra-fila">
      <span class="fran-ico">${ui.esc(iconoDe(cat))}</span>
      <span class="fran-barra-fila__c">
        <span class="fran-barra-fila__l"><strong>${ui.esc(cat)}</strong><span class="numero ${vista.tipo === 'ingreso' ? 'fran-mas' : 'fran-menos'}">${dinero.formatear(v)}</span></span>
        <span class="fran-barra-fila__l"><span class="fran-barra" style="width:${Math.max(1.5, (v / filas[0][1]) * 80)}%;background:${coloresDe(vista.tipo)[Math.min(i, 4)]}"></span><small>${pct(v)}%</small></span>
      </span>
    </a>`).join('')}</div>
  </div>`);
  raiz.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { vista.tipo = b.dataset.tipo; redibujar(); }));
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
  centrarTira(raiz);
}

/** Gráfica de línea del mes, día por día, como la de Mis Gastos. */
function graficaDelMes(lista, mes, ctx) {
  const colores = coloresDe(lista.length && lista.every((a) => a.tipo === 'ingreso') ? 'ingreso' : 'gasto');
  const dias = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
  const porDia = new Array(dias).fill(0);
  for (const a of lista) porDia[Number(a.fecha.slice(8)) - 1] += a.valor;
  const maximo = Math.max(...porDia, 1);
  const x = (i) => 44 + (i * 286) / Math.max(1, dias - 1);
  const y = (v) => 110 - (v / maximo) * 100;
  const corto = (v) => ctx.dinero.formatear(Math.round(v)).replace(/\s/g, '');
  return `<svg class="fran-linea" viewBox="0 0 340 128" role="img" aria-label="Movimientos por día">
    <line x1="44" y1="10" x2="44" y2="110" /><line x1="44" y1="110" x2="330" y2="110" />
    <text x="40" y="14" text-anchor="end">${corto(maximo)}</text><text x="40" y="64" text-anchor="end">${corto(maximo / 2)}</text><text x="40" y="114" text-anchor="end">0</text>
    ${[1, 8, 15, 22, 29].filter((d) => d <= dias).map((d) => `<text x="${x(d - 1).toFixed(1)}" y="124" text-anchor="middle">${d}</text>`).join('')}
    ${porDia.slice(1).map((v, i) => `<line class="fran-linea__tramo" style="stroke:${colores[i % colores.length]}" x1="${x(i).toFixed(1)}" y1="${y(porDia[i]).toFixed(1)}" x2="${x(i + 1).toFixed(1)}" y2="${y(v).toFixed(1)}" />`).join('')}
    ${porDia.map((v, i) => `<circle style="fill:${colores[i % colores.length]}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${v ? 3 : 1.8}" />`).join('')}
  </svg>`;
}

function conectarVer(raiz, lista, contenedor, id, volver, ctx) {
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const asiento = lista.find((x) => x.id === b.dataset.ver);
    if (asiento) { verAsiento(contenedor, asiento, id, volver, ctx); window.scrollTo(0, 0); }
  }));
}

function cuandoSeAnoto(iso, ctx) {
  // Algunos solo guardan el día: sin hora no se puede convertir, porque cambia de fecha.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `Anotado el ${ctx.fechas.formatear(iso)}`;
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const dia = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  return `Anotado el ${ctx.fechas.formatear(dia)}, ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
}

/** Pantalla Detalles de un movimiento: tipo, importe, fecha y nota, con Editar y Eliminar. */
function verAsiento(contenedor, visto, id, volver, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  // Se trabaja con el movimiento guardado: en Finanzas algunos se muestran con otro nombre.
  const real = datos.estado.fran.asientos.find((x) => x.id === visto.id);
  const a = real || visto;
  const editable = !!real && !a.sinDetalle;
  contenedor.innerHTML = '';
  const NOMBRE_TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', abono: 'Abono a capital', transferencia: 'Transferencia', uso: 'Uso', retiro: 'Saqué para mí' };
  const raiz = ui.el(`<div class="fran-detalles">
    <header class="fran-titulo"><button type="button" class="fran-titulo__atras" data-volver aria-label="Volver">‹</button><h1>Detalles</h1></header>
    <div class="fran-detalles__cabeza"><span class="fran-ico">${ui.esc(iconoDe(a.categoria))}</span><strong>${ui.esc(a.categoria)}</strong></div>
    <dl>
      <dt>Tipo</dt><dd>${ui.esc(NOMBRE_TIPO[a.tipo] || a.tipo)}</dd>
      <dt>Importe</dt><dd class="numero">${dinero.formatear(a.valor)}</dd>
      <dt>Fecha</dt><dd>${ui.esc(a.textoFecha || fechas.formatear(a.fecha))}${a.creadoEn ? `<small class="fran-detalles__cuando">${ui.esc(cuandoSeAnoto(a.creadoEn, ctx))}</small>` : ''}</dd>
      ${a.descripcion ? `<dt>Nota</dt><dd>${ui.esc(a.descripcion)}</dd>` : ''}
      ${a.cuenta ? `<dt>Cuenta</dt><dd>${ui.esc(a.cuenta)}</dd>` : ''}
    </dl>
    ${a.conFoto ? '<img class="fran-recibo oculto" alt="Foto del recibo"><p class="fran-nota oculto" data-sin-foto>La foto quedó en el aparato donde la tomaste.</p>' : ''}
    ${!editable ? `<p class="fran-nota">${a.sinDetalle ? 'Es un total del mes: no tiene movimientos para editar.' : 'Este pago se corrige desde el préstamo del cliente.'}</p>` : `<div class="fran-detalles__botones">
      <button type="button" class="boton boton--primario" data-editar>Editar</button>
      <button type="button" class="boton boton--secundario" data-eliminar>Eliminar</button>
    </div>`}
  </div>`);
  raiz.querySelector('[data-volver]').addEventListener('click', volver);
  if (a.conFoto) leerFoto(a.id).then((foto) => {
    if (foto) { const img = raiz.querySelector('.fran-recibo'); img.src = foto; img.classList.remove('oculto'); } else raiz.querySelector('[data-sin-foto]').classList.remove('oculto');
  }).catch(() => raiz.querySelector('[data-sin-foto]').classList.remove('oculto'));
  const borrar = raiz.querySelector('[data-eliminar]');
  if (borrar) borrar.addEventListener('click', async () => {
    if (await ui.confirmar('¿Borrar este movimiento?', { aceptar: 'Sí, borrar', peligro: true })) await datos.eliminarAsiento(a.id);
  });
  const editar = raiz.querySelector('[data-editar]');
  if (editar) editar.addEventListener('click', () => {
    const caja = raiz.querySelector('dl');
    caja.replaceWith(ui.el(`<form class="fran-campos" novalidate>
      <label><small>Nota</small><input name="descripcion" autocomplete="off" value="${ui.esc(a.descripcion || '')}"></label>
      <label><small>Importe</small><input name="valor" inputmode="numeric" autocomplete="off" value="${a.valor}"></label>
      <label><small>Categoría</small><input name="categoria" autocomplete="off" value="${ui.esc(a.categoria)}"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(a.fecha)}"></label>
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>`));
    raiz.querySelector('.fran-detalles__botones').remove();
    raiz.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      try {
        await datos.actualizarAsiento(a.id, { descripcion: f.descripcion.value, categoria: f.categoria.value, fecha: f.fecha.value, valor: Number(f.valor.value.replace(/\D/g, '')) });
        ui.toast('Guardado.');
      } catch (error) { ui.toast(error.message); }
    });
  });
  contenedor.append(raiz);
}

function renderDetalle(contenedor, id, tituloDetalle, lista, atras, ctx, conMes = null) {
  const { ui, dinero, fechas } = ctx;
  const total = sumar(lista);
  const meses = new Set(lista.map((a) => a.fecha.slice(0, 7)));
  const mesUnico = conMes ? conMes.mes : (meses.size === 1 ? [...meses][0] : '');
  const diasMes = mesUnico ? new Date(Number(mesUnico.slice(0, 4)), Number(mesUnico.slice(5, 7)), 0).getDate() : 0;
  const dibujar = () => {
    contenedor.innerHTML = '';
    const ordenada = [...lista].sort((a, b) => (vista.orden === 'cantidad' ? b.valor - a.valor : b.fecha.localeCompare(a.fecha)));
    const maximo = ordenada.reduce((m, a) => Math.max(m, a.valor), 1);
    const raiz = ui.el(`<div>
      ${titular(id, ctx, atras, tituloDetalle)}
      <p class="fran-total"><strong class="numero">Total: ${dinero.formatear(total)}</strong>${mesUnico ? `<small class="numero">Promedio: ${dinero.formatear(Math.floor(total / diasMes))}${total % diasMes ? `,${((total / diasMes) % 1).toFixed(2).slice(2)}` : ''}</small>` : ''}</p>
      ${conMes ? selectorMes(conMes.mes, ctx) : ''}
      ${mesUnico ? graficaDelMes(lista, mesUnico, ctx) : ''}
      ${avisoSinDetalle(lista)}
      <div class="fran-segmento">
        <button type="button" data-orden="cantidad" class="${vista.orden === 'cantidad' ? 'activo' : ''}">Ordenar por cantidad</button>
        <button type="button" data-orden="fecha" class="${vista.orden === 'fecha' ? 'activo' : ''}">Ordenar por fecha</button>
      </div>
      <div class="fran-lista">${ordenada.map((a) => `<div class="fran-barra-fila" role="button" tabindex="0" data-ver="${ui.esc(a.id)}">
        <span class="fran-ico">${ui.esc(iconoDe(a.categoria))}</span>
        <span class="fran-barra-fila__c">
          <span class="fran-barra-fila__l"><strong>${ui.esc(a.descripcion || a.categoria)}</strong><span class="numero ${a.tipo === 'gasto' ? 'fran-menos' : 'fran-mas'}">${dinero.formatear(a.valor)}</span></span>
          <span class="fran-barra-fila__l"><span class="fran-barra" style="width:${Math.max(1.5, (a.valor / maximo) * 80)}%"></span><small>${(total ? (a.valor / total) * 100 : 0).toFixed(2).replace('.', ',')}%</small></span>
          <span class="fran-barra-fila__l"><small>${ui.esc(a.textoFecha || fechas.formatear(a.fecha))}${a.conFoto ? ' · 📷' : ''}</small></span>
        </span>
      </div>`).join('') || '<p class="fran-vacio">Sin movimientos.</p>'}</div>
    </div>`);
    raiz.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', () => { vista.orden = b.dataset.orden; dibujar(); }));
    raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
      const asiento = lista.find((x) => x.id === b.dataset.ver);
      if (asiento) { verAsiento(contenedor, asiento, id, dibujar, ctx); window.scrollTo(0, 0); }
    }));
    if (conMes) conectarMes(raiz, conMes.mes, ctx, conMes.redibujar);
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
    return `<tr data-fila="${ui.esc(k)}"><th>${ui.esc(nombre)} ›</th><td class="numero">${dinero.formatear(g)}</td><td class="numero">${dinero.formatear(i)}</td><td class="numero">${dinero.formatear(i - g)}</td></tr>`;
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
    <p class="fran-nota">Toca ${anio === 'todo' ? 'un año' : 'un mes'} para ver su detalle.</p>
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
  raiz.querySelectorAll('[data-fila]').forEach((f) => f.addEventListener('click', () => {
    if (anio === 'todo') { vista.anio = f.dataset.fila; redibujar(); return; }
    vista.mes = f.dataset.fila;
    ctx.navegar(`/libro/${id}`);
  }));
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
  if (id === 'prestamos') {
    const enFicha = window.location.hash.match(/^#\/cliente\/([^/]+)$/);
    return ctx.navegar(enFicha ? `/libro/prestamos/registrar/elegir/${enFicha[1]}` : '/libro/prestamos/registrar/elegir');
  }
  if (id === 'pension') return ctx.navegar('/libro/pension/mover/ingreso');
  return ctx.navegar(`/libro/${id}/agregar/${(TIPOS[id] || TIPOS.personal)[0][1]}`);
}

// ---------- Agregar (boceto 4) ----------

/** Categorías de un libro: las del plan, las que ella creó y las que ya usó. */
export function categoriasDe(fran, id, clave, tipo) {
  const llave = `${id}:${clave}`;
  const base = (CATEGORIAS_BASE[id] && CATEGORIAS_BASE[id][clave]) || [];
  const extra = fran.categoriasExtra[llave] || [];
  const uso = new Map();
  for (const a of fran.asientos) {
    if (a.tipo !== tipo || a.libro !== id || a.sinDetalle) continue;
    if (!uso.has(a.categoria)) uso.set(a.categoria, { meses: new Set(), veces: 0 });
    const u = uso.get(a.categoria);
    u.meses.add(a.fecha.slice(0, 7));
    u.veces++;
  }
  const usadas = [...uso.keys()].sort((x, y) => uso.get(y).meses.size - uso.get(x).meses.size || uso.get(y).veces - uso.get(x).veces);
  let fijas = [];
  if (id === 'personal' && clave === 'ingreso') fijas = Object.keys(INGRESOS_DE_OTRO_LIBRO);
  if (id === 'arriendos' && clave === 'ingreso') fijas = (fran.propiedades || []).map((p) => p.nombre);
  const todas = [...new Set([...fijas, ...usadas, ...extra, ...base])].filter((c) => !/total del mes|resto sin|^casas del mes$|^arriendos del mes$|sin decir piso|^laguna y prado$/i.test(c));
  const ocultas = fran.categoriasOcultas[llave] || [];
  return { todas, visibles: todas.filter((c) => !ocultas.includes(c)), ocultas };
}

/** Suma lo marcado en el teclado: "12000+500-200" da 12300. */
export function evaluarMonto(expresion) {
  const partes = String(expresion || '').match(/[+−]?\d+/g);
  if (!partes) return 0;
  return partes.reduce((s, p) => (p[0] === '−' ? s - Number(p.slice(1)) : s + Number(p.replace('+', ''))), 0);
}

/** La categoría que ella ya usó para algo parecido. Solo la deja marcada: ella confirma con ✓. */
export function adivinarCategoria(asientos, libro, tipo, descripcion, permitidas) {
  const buscada = norm(descripcion);
  if (!buscada) return null;
  const palabras = buscada.split(/\s+/).filter((p) => p.length >= 4);
  const iguales = {};
  const parecidas = {};
  for (const a of asientos) {
    if (a.libro !== libro || a.tipo !== tipo || a.sinDetalle || !permitidas.includes(a.categoria)) continue;
    const d = norm(a.descripcion);
    if (d === buscada) iguales[a.categoria] = (iguales[a.categoria] || 0) + 1;
    else if (palabras.some((p) => d.split(/\s+/).includes(p))) parecidas[a.categoria] = (parecidas[a.categoria] || 0) + 1;
  }
  const mejor = (o) => Object.keys(o).sort((x, y) => o[y] - o[x])[0] || null;
  return mejor(iguales) || mejor(parecidas);
}

function renderAgregar(contenedor, id, clave, ctx) {
  const { ui, datos, dinero, fechas } = ctx;
  const tipos = TIPOS[id] || TIPOS.personal;
  const def = tipos.find((t) => t[1] === clave) || tipos[0];
  const tipo = def[2];
  const esTransfer = tipo === 'transferencia';
  const categorias = categoriasDe(datos.estado.fran, id, def[1], tipo).visibles;
  const vaAOtroLibro = (c) => (id === 'personal' && clave === 'ingreso' ? INGRESOS_DE_OTRO_LIBRO[c] : null);
  const hoy = ctx.hoy();
  let elegida = null;
  let expresion = '';
  const FOTO = '<button type="button" class="fran-mic" data-foto aria-label="Foto del recibo">📷</button>';
  const raiz = ui.el(`<div class="fran-agregar">
    <header class="fran-agregar__cabeza"><a href="#/libro/${id}">Cancelar</a><strong>Agregar</strong><a class="fran-agregar__repite" href="#/ajustes/recurrentes" aria-label="Transacciones recurrentes">↻</a></header>
    <div class="fran-segmento">${tipos.map((t) => `<a href="#/libro/${id}/agregar/${t[1]}" class="${t === def ? 'activo' : ''}">${ui.esc(t[0])}</a>`).join('')}</div>
    <form novalidate>
      ${esTransfer ? `
        <p class="fran-seccion">Sale de</p>${chips('cuenta', CUENTAS, 'Efectivo', ui)}
        <p class="fran-seccion">Entra a</p>${chips('destino', CUENTAS, 'Nequi propio', ui)}` : `
        <div class="fran-iconos">${categorias.map((c, i) => `<button type="button" class="${i >= 11 ? 'fran-mas-cat oculto' : ''}" data-cat="${ui.esc(c)}"><span>${ui.esc(iconoDe(c))}</span><small>${ui.esc(c.replace(' públicos', ''))}</small></button>`).join('')}
          <button type="button" data-ver-mas><span>＋</span><small>Más</small></button>
          <button type="button" class="fran-mas-cat oculto" data-nueva><span>✎</span><small>Nueva</small></button>
          <a class="fran-mas-cat oculto" href="#/ajustes/categorias"><span>⚙️</span><small>Categorías</small></a></div>`}
      <input type="file" class="oculto" name="foto" accept="image/*" capture="environment" aria-hidden="true" tabindex="-1">
      <div class="fran-agregar__pie">
        ${esTransfer ? '' : `<div class="fran-escribir" data-rapido>
          <input type="text" name="texto" autocomplete="off" placeholder="¿Para qué y cuánto cuesta?" aria-label="Para qué y cuánto cuesta">
          <button type="button" class="fran-mic" data-mic aria-label="Dictar">🎤</button>
          ${FOTO}
          <button type="submit" class="fran-enviar" aria-label="Seguir">✓</button>
        </div>`}
        <div class="fran-teclado${esTransfer ? '' : ' oculto'}" data-teclado>
          <input type="text" class="fran-entrada oculto" name="nueva" placeholder="Nombre de la categoría nueva" autocomplete="off">
          <div class="fran-teclado__valor">
            ${esTransfer || id === 'terceros' ? '<span></span>' : `<label class="fran-cuenta"><small>${tipo === 'ingreso' ? 'Entra por' : 'Pagado con'}</small><select name="cuenta">${CUENTAS.map((c) => `<option>${ui.esc(c)}</option>`).join('')}</select></label>`}
            <output class="numero" data-monto aria-live="polite">0</output>
          </div>
          <label class="fran-nota-campo"><span>Nota:</span><input type="text" name="nota" autocomplete="off" placeholder="Introduce una nota…" aria-label="Nota">${esTransfer ? '' : FOTO}</label>
          <div class="fran-teclas">
            ${['7', '8', '9'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}
            <label class="fran-tecla-fecha"><span data-fecha-texto>Hoy</span><input type="date" name="fecha" value="${ui.esc(hoy)}" aria-label="Fecha"></label>
            ${['4', '5', '6'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}
            <button type="button" data-k="+" aria-label="Sumar">+</button>
            ${['1', '2', '3'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}
            <button type="button" data-k="−" aria-label="Restar">−</button>
            <button type="button" data-k="0">0</button>
            <button type="button" data-k="00">00</button>
            <button type="button" data-k="borrar" aria-label="Borrar">⌫</button>
            <button type="button" class="fran-tecla-ok" data-ok aria-label="Guardar">✓</button>
          </div>
        </div>
      </div>
    </form>
  </div>`);
  conectarChips(raiz);
  const teclado = raiz.querySelector('[data-teclado]');
  const rapido = raiz.querySelector('[data-rapido]');
  const montoVista = raiz.querySelector('[data-monto]');
  const botonOk = raiz.querySelector('[data-ok]');
  const texto = raiz.querySelector('[name="texto"]');
  const nota = raiz.querySelector('[name="nota"]');
  const nueva = raiz.querySelector('[name="nueva"]');
  const campoFecha = raiz.querySelector('[name="fecha"]');
  const botonNueva = raiz.querySelector('[data-nueva]');

  const pintarMonto = () => {
    const vista = expresion.replace(/\d+/g, (n) => dinero.formatear(Number(n))).replace(/([+−])/g, ' $1 ');
    montoVista.textContent = vista || '0';
    botonOk.textContent = /\d[+−]\d/.test(expresion) ? '=' : '✓';
  };
  const abrirTeclado = () => {
    teclado.classList.remove('oculto');
    if (rapido) rapido.classList.add('oculto');
  };
  const marcar = (boton) => raiz.querySelectorAll('[data-cat],[data-nueva]').forEach((x) => x.classList.toggle('activo', x === boton));

  raiz.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    if (vaAOtroLibro(b.dataset.cat)) { ctx.navegar(vaAOtroLibro(b.dataset.cat)); return; }
    elegida = b.dataset.cat;
    marcar(b);
    nueva.classList.add('oculto');
    nueva.value = '';
    abrirTeclado();
  }));
  const verMas = raiz.querySelector('[data-ver-mas]');
  if (verMas) verMas.addEventListener('click', () => {
    raiz.querySelectorAll('.fran-mas-cat').forEach((x) => x.classList.remove('oculto'));
    verMas.remove();
  });
  if (botonNueva) botonNueva.addEventListener('click', () => {
    elegida = null;
    marcar(botonNueva);
    abrirTeclado();
    nueva.classList.remove('oculto');
    nueva.focus();
  });

  campoFecha.addEventListener('change', () => {
    const f = campoFecha.value || hoy;
    let t = fechas.formatear(f).replace(/ \d{4}$/, f.slice(0, 4) === hoy.slice(0, 4) ? '' : '$&');
    if (f === hoy) t = 'Hoy';
    else if (f === fechas.sumarDias(hoy, -1)) t = 'Ayer';
    raiz.querySelector('[data-fecha-texto]').textContent = t;
  });

  let foto = null;
  const entradaFoto = raiz.querySelector('[name="foto"]');
  raiz.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => entradaFoto.click()));
  entradaFoto.addEventListener('change', async () => {
    if (!entradaFoto.files[0]) return;
    try {
      foto = await reducirFoto(entradaFoto.files[0]);
      raiz.querySelectorAll('[data-foto]').forEach((b) => b.classList.add('activo'));
      ui.toast('Foto lista.');
    } catch (error) { ui.toast(error.message); }
  });

  // En el iPhone el dictado de la página no funciona con la app instalada: se usa el del teclado.
  const Voz = window.SpeechRecognition || window.webkitSpeechRecognition;
  const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const conTeclado = () => {
    texto.placeholder = 'Toca el 🎤 del teclado y habla';
    texto.focus();
  };
  const botonMic = raiz.querySelector('[data-mic]');
  if (botonMic) botonMic.addEventListener('click', () => {
    if (esIOS || !Voz) { conTeclado(); return; }
    try {
      const r = new Voz();
      r.lang = 'es-CO';
      r.onresult = (e) => { texto.value = e.results[0][0].transcript; };
      r.onerror = conTeclado;
      r.start();
    } catch { conTeclado(); }
  });

  const guardarMovimiento = async () => {
    const valor = evaluarMonto(expresion);
    if (!(valor > 0)) { ui.toast('Marca el valor en el teclado.'); return; }
    const form = raiz.querySelector('form');
    const cuenta = form.elements.cuenta ? form.elements.cuenta.value : '';
    const destino = form.elements.destino ? form.elements.destino.value : '';
    if (esTransfer && cuenta === destino) { ui.toast('Elige dos cuentas distintas.'); return; }
    const categoriaNueva = nueva.value.trim();
    if (botonNueva && botonNueva.classList.contains('activo') && !categoriaNueva) { ui.toast('Escribe el nombre de la categoría.'); nueva.focus(); return; }
    if (!esTransfer && !elegida && !categoriaNueva) { ui.toast('Elige la categoría.'); return; }
    const fecha = campoFecha.value || hoy;
    try {
      const asiento = await datos.agregarAsiento({ libro: id, fecha, tipo, categoria: esTransfer ? 'Transferencia' : (categoriaNueva || elegida), descripcion: nota.value, valor, cuenta, destino, conFoto: !!foto });
      if (foto) await guardarFoto(asiento.id, foto).catch(() => ui.toast('El movimiento quedó, pero la foto no se pudo guardar.'));
      ui.toast('Guardado.');
      vista.mes = fecha.slice(0, 7);
      ctx.navegar(`/libro/${id}`);
    } catch (error) { ui.toast(error.message); }
  };

  raiz.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'borrar') expresion = expresion.slice(0, -1);
    else if (k === '+' || k === '−') {
      if (expresion) expresion = expresion.replace(/[+−]$/, '') + k;
    } else if (!(k.startsWith('0') && !/[1-9]\d*$/.test(expresion)) && (expresion.match(/\d+$/) || [''])[0].length < 12) expresion += k;
    pintarMonto();
  }));
  botonOk.addEventListener('click', () => {
    if (/\d[+−]\d/.test(expresion)) {
      const total = evaluarMonto(expresion);
      expresion = total > 0 ? String(total) : '';
      if (!(total > 0)) ui.toast('La cuenta no da un valor mayor que cero.');
      pintarMonto();
      return;
    }
    guardarMovimiento();
  });

  // Escribir o dictar: "pollo 12000" llena el teclado; ella revisa y confirma con ✓.
  raiz.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (rapido && !rapido.classList.contains('oculto')) {
      const { descripcion, valor } = leerTexto(texto.value);
      if (!valor) { ui.toast('Escribe cuánto: por ejemplo, almuerzo 15000.'); texto.focus(); return; }
      expresion = String(valor);
      nota.value = descripcion;
      pintarMonto();
      abrirTeclado();
      const sugerida = adivinarCategoria(datos.estado.fran.asientos, id, tipo, descripcion, categorias.filter((c) => !vaAOtroLibro(c)));
      if (sugerida) {
        elegida = sugerida;
        const boton = [...raiz.querySelectorAll('[data-cat]')].find((x) => x.dataset.cat === sugerida);
        if (boton) { boton.classList.remove('oculto'); marcar(boton); }
      } else ui.toast('Elige la categoría.');
      return;
    }
    botonOk.click();
  });
  contenedor.append(raiz);
}

// ---------- Registrar en Préstamos (boceto 8) ----------

// [clave, emoji, nombre, para qué sirve]. Primero se ven los cuatro en cuadros grandes; al tocar uno sale su formulario.
const TIPOS_PRESTAMO = [
  ['nuevo', '💵', 'Nuevo préstamo', 'Le presto plata a alguien'],
  ['abono', '↩️', 'Abono a capital', 'Me devolvió parte del capital'],
  ['interes', '💰', 'Pago de intereses', 'Me pagó los intereses'],
  ['acuerdo', '🤝', 'Acuerdo de pago', 'Quedamos en una fecha'],
];

function renderRegistrar(contenedor, params, ctx) {
  const { ui, datos } = ctx;
  const tipo = params.tipo;
  const estado = datos.estado;
  const clientes = [...estado.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const elegido = params.clienteId || '';
  const conCliente = elegido ? `/${encodeURIComponent(elegido)}` : '';
  const actual = TIPOS_PRESTAMO.find(([k]) => k === tipo);
  // Paso 1: solo los cuatro cuadros grandes.
  if (!actual) {
    contenedor.append(ui.el(`<div class="fran-registrar">
      <header class="fran-titulo"><a href="${elegido ? `#/cliente${conCliente}` : '#/libro/prestamos'}" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>¿Qué vas a anotar?</h1></header>
      <div class="fran-cuatro">${TIPOS_PRESTAMO.map(([k, ic, t, d]) => `<a href="#/libro/prestamos/registrar/${k}${conCliente}" class="fran-cuatro__cuadro">
        <span class="fran-cuadro fran-cuadro--grande" aria-hidden="true">${ic}</span>
        <span class="fran-cuatro__nombre">${ui.esc(t)}</span>
        <small>${ui.esc(d)}</small>
      </a>`).join('')}</div>
    </div>`));
    return;
  }
  // Paso 2: el formulario de lo que eligió, y nada más.
  const raiz = ui.el(`<div class="fran-registrar">
    <header class="fran-titulo fran-titulo--libro"><a href="#/libro/prestamos/registrar/elegir${conCliente}" class="fran-titulo__atras" aria-label="Volver a elegir">‹</a><h1><span class="fran-cuadro fran-cuadro--28" aria-hidden="true">${actual[1]}</span><span>${ui.esc(actual[2])}</span></h1></header>
    <form novalidate class="fran-campos fran-campos--grande">
      <label><small>Cliente</small><select name="cliente"><option value="">Elige…</option>${tipo === 'nuevo' || tipo === 'acuerdo' ? '<option value="__nuevo">＋ Cliente nuevo</option>' : ''}${clientes.map((c) => `<option value="${ui.esc(c.id)}"${c.id === elegido ? ' selected' : ''}>${ui.esc(c.nombre)}</option>`).join('')}</select></label>
      <label class="oculto" id="campo-nombre"><small>Nombre del cliente nuevo</small><input name="nombre" autocomplete="off"></label>
      <label class="oculto" id="campo-prestamo"><small>¿De cuál préstamo?</small><select name="prestamo"></select></label>
      <label class="fran-campo-valor"><small>Valor${tipo === 'acuerdo' ? ' (si ya lo sabes)' : ''}</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      ${tipo === 'nuevo' ? `<div><small>Tasa mensual</small>${chips('tasa', [['5', '5%'], ['10', '10%'], ['12', '12%'], ['15', '15%'], ['20', '20%'], ['0', 'Sin interés']], '', ui)}</div>` : ''}
      ${tipo === 'acuerdo' ? `<div><small>Cada cuánto</small>${chips('repite', [['', 'Fecha fija'], ['diario', 'Diario'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']], '', ui)}</div>` : `<label><small>${tipo === 'nuevo' ? 'Sale por' : 'Entra por'}</small><select name="medio"><option value="efectivo">Efectivo</option><option value="virtual">Virtual</option></select></label>`}
      <label><small>${tipo === 'acuerdo' ? 'Fecha del cobro' : 'Fecha'}</small><input type="date" name="fecha" value="${ui.esc(ctx.hoy())}"></label>
      <label><small>Nota</small><input name="nota" autocomplete="off" placeholder="Escribe o dicta con el teclado"></label>
      <button class="fran-boton-principal fran-guardar">Guardar</button>
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

const NOMBRE_MEDIO = { efectivo: 'Efectivo', virtual: 'Virtual' };

/** Todo lo que el cliente pagó, con lo que se sabe de cada cobro. Lo que no se sabe queda vacío. */
export function cobrosDeCliente(asientosCliente, pagos, cliente) {
  const propia = (texto) => (texto && texto !== cliente.nombre ? texto : '');
  return [
    ...pagos.map((g) => ({ clave: `g-${g.id}`, id: g.id, esPago: true, perdon: g.tipo === 'perdon', fecha: g.fecha, titulo: g.tipo === 'perdon' ? 'Perdón de intereses' : (g.capital && !g.interes ? 'Abono a capital' : 'Pago'), valor: g.monto, capital: g.tipo === 'perdon' ? 0 : g.capital, interes: g.tipo === 'perdon' ? 0 : g.interes, medio: NOMBRE_MEDIO[g.medio] || '', nota: g.nota || '', prestamoId: g.prestamoId, creadoEn: g.creadoEn })),
    ...asientosCliente.map((a) => ({ clave: `a-${a.id}`, id: a.id, esPago: false, perdon: false, fecha: a.fecha, textoFecha: a.textoFecha, titulo: a.tipo === 'abono' ? 'Abono a capital' : 'Intereses', valor: a.valor, capital: a.tipo === 'abono' ? a.valor : 0, interes: a.tipo === 'abono' ? 0 : a.valor, medio: NOMBRE_MEDIO[a.medio] || a.cuenta || '', medioGuardado: a.medio || '', nota: a.nota || (a.descripcion === a.persona ? '' : propia(a.descripcion)), prestamoId: a.prestamoId || '', creadoEn: a.creadoEn })),
  ];
}

function textoPrestamo(p, ctx) {
  const { dinero, fechas } = ctx;
  const delExcel = p.porConfirmar && /(\d+(?:[.,]\d+)?)\s*%/.exec(p.porConfirmar.tasa || '');
  const tasa = p.tasa > 0 ? `al ${Math.round(p.tasa * 100) / 100} %` : (delExcel ? `al ${delExcel[1]} % según el Excel` : '');
  const fecha = p.porConfirmar && p.porConfirmar.fecha ? 'fecha por confirmar' : `del ${fechas.formatear(p.fecha)}`;
  return [dinero.formatear(p.capital), tasa, fecha].filter(Boolean).join(' · ');
}

/** Pantalla Detalles de un cobro del historial del cliente. */
function verCobro(contenedor, m, cobros, cliente, volver, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const propios = datos.estado.prestamos.filter((p) => p.clienteId === cliente.id);
  const prestamo = propios.find((p) => p.id === m.prestamoId);
  const deEseDia = cobros.filter((x) => x.fecha === m.fecha && !x.perdon);
  const nombreInteres = prestamo && prestamo.modalidad === 'capital_primero' ? 'Ganancia' : 'A intereses';
  const raiz = ui.el(`<div class="fran-detalles">
    <header class="fran-titulo"><button type="button" class="fran-titulo__atras" data-volver aria-label="Volver">‹</button><h1>Detalles</h1></header>
    <div class="fran-detalles__cabeza"><span class="fran-ico">${m.perdon ? '🎁' : '↩️'}</span><strong>${ui.esc(m.titulo)}</strong></div>
    <dl>
      <dt>Cliente</dt><dd>${ui.esc(cliente.nombre)}</dd>
      <dt>Importe</dt><dd class="numero">${dinero.formatear(m.valor)}</dd>
      <dt>Fecha</dt><dd>${ui.esc(m.textoFecha || fechas.formatear(m.fecha))}${m.creadoEn ? `<small class="fran-detalles__cuando">${ui.esc(cuandoSeAnoto(m.creadoEn, ctx))}</small>` : ''}</dd>
      ${m.perdon ? '' : `<dt>A capital</dt><dd class="numero">${dinero.formatear(m.capital)}</dd>
      <dt>${nombreInteres}</dt><dd class="numero">${dinero.formatear(m.interes)}</dd>
      <dt>Forma de pago</dt><dd>${ui.esc(m.medio || 'Por confirmar')}</dd>`}
      <dt>Préstamo</dt><dd>${prestamo ? `<a href="#/prestamo/${encodeURIComponent(prestamo.id)}">${ui.esc(textoPrestamo(prestamo, ctx))}</a>` : 'Por confirmar'}</dd>
      <dt>Nota</dt><dd>${ui.esc(m.nota || 'Sin nota')}</dd>
    </dl>
    ${deEseDia.length > 1 ? `<p class="fran-seccion">Ese día pagó en total ${dinero.formatear(deEseDia.reduce((s, x) => s + x.valor, 0))}</p>
    <div class="fran-lista">${deEseDia.map((x) => fila({ ui, icono: '↩️', titulo: x.titulo, derecha: `+${dinero.formatear(x.valor)}`, clase: 'fran-mas' })).join('')}</div>` : ''}
    <div class="fran-detalles__botones">
      <button type="button" class="boton boton--primario" data-editar>Editar</button>
      <button type="button" class="boton boton--secundario" data-eliminar>Eliminar</button>
    </div>
  </div>`);
  raiz.querySelector('[data-volver]').addEventListener('click', volver);
  raiz.querySelector('[data-eliminar]').addEventListener('click', async () => {
    if (!await ui.confirmar('¿Borrar este movimiento?', { aceptar: 'Sí, borrar', peligro: true })) return;
    if (m.esPago) await datos.eliminarPago(m.id); else await datos.eliminarAsiento(m.id);
  });
  raiz.querySelector('[data-editar]').addEventListener('click', () => {
    raiz.querySelector('dl').replaceWith(ui.el(`<form class="fran-campos" novalidate>
      <label><small>Nota: qué se pagó, qué préstamo se recogió</small><input name="nota" autocomplete="off" value="${ui.esc(m.nota)}"></label>
      ${m.esPago ? '' : `<label><small>Forma de pago</small><select name="medio"><option value="">Por confirmar</option>${Object.entries(NOMBRE_MEDIO).map(([k, v]) => `<option value="${k}"${m.medioGuardado === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label><small>Préstamo</small><select name="prestamoId"><option value="">Por confirmar</option>${propios.map((p) => `<option value="${ui.esc(p.id)}"${p.id === m.prestamoId ? ' selected' : ''}>${ui.esc(textoPrestamo(p, ctx))}</option>`).join('')}</select></label>`}
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>`));
    raiz.querySelector('.fran-detalles__botones').remove();
    raiz.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      try {
        await datos.detallarCobro(m.id, { nota: f.nota.value, medio: f.medio ? f.medio.value : '', prestamoId: f.prestamoId ? f.prestamoId.value : '' });
        ui.toast('Guardado.');
      } catch (error) { ui.toast(error.message); }
    });
  });
  contenedor.innerHTML = '';
  contenedor.append(raiz);
  window.scrollTo(0, 0);
}

// ---------- Solo deben intereses: caja aparte, no se suma a la cartera ----------

/** Quienes ya no deben capital y solo deben intereses, más lo anotado a mano sin préstamo. */
function soloInteresesDe(ctx) {
  const { datos, motor } = ctx;
  const estado = datos.estado;
  const pagos = pagosRepartidos(estado);
  const filas = [];
  for (const c of estado.clientes) {
    const propios = estado.prestamos.filter((p) => p.clienteId === c.id);
    if (!propios.length || c.tipo === 'familia') continue;
    const r = motor.resumenCliente(c, propios, pagos.filter((g) => g.clienteId === c.id), ctx.hoy());
    const sinCapital = r.resultados.filter((x) => x.capitalPendiente === 0 && x.interesPendiente > 0 && !['perdido', 'pagado'].includes(x.estado));
    const valor = sinCapital.reduce((s, x) => s + x.interesPendiente, 0);
    if (valor > 0) filas.push({ nombre: c.nombre, valor, ruta: `#/cliente/${encodeURIComponent(c.id)}` });
  }
  for (const x of estado.fran.interesesSueltos || []) {
    const queda = x.valor - (x.pagado || 0);
    if (queda > 0) filas.push({ nombre: x.nombre, valor: queda, suelto: x });
  }
  filas.sort((a, b) => b.valor - a.valor);
  return { filas, total: filas.reduce((s, f) => s + f.valor, 0) };
}

function renglonSoloIntereses(ctx) {
  const { ui, dinero } = ctx;
  const s = soloInteresesDe(ctx);
  if (!s.total) return '';
  return renglon({ ruta: '#/libro/prestamos/solo-intereses', icono: '💸', texto: 'Solo deben intereses', sub: `${s.filas.length} ${s.filas.length === 1 ? 'persona' : 'personas'} · no se suma a la cartera`, derecha: `<span class="fran-renglon__valor numero">${dinero.formatear(s.total)}</span>` }, ui);
}

function renderSoloIntereses(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const hoy = ctx.hoy();
  const { filas, total } = soloInteresesDe(ctx);
  const dibujar = () => { contenedor.innerHTML = ''; renderSoloIntereses(contenedor, ctx); };
  const filaSuelta = (f) => `<div class="fran-fila"><span class="fran-ico">💸</span><span class="fran-fila__texto"><strong>${ui.esc(f.nombre)}</strong><small>${ui.esc([f.suelto.nota, f.suelto.pagado ? `Ya pagó ${dinero.formatear(f.suelto.pagado)}` : ''].filter(Boolean).join(' · '))}</small></span><span class="fran-fila__valor numero">${dinero.formatear(f.valor)}</span><button type="button" class="fran-boton-secundario fran-boton--44" data-pago="${ui.esc(f.suelto.id)}">Pagó</button></div>`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/libro/prestamos', 'Solo deben intereses')}
    ${heroe({ etiqueta: 'Intereses por cobrar', valor: total, ayudaTexto: 'Son personas que ya no deben capital, solo intereses. Esta plata no se suma a tu cartera ni a tu plata propia: cuando la paguen, entra como ganancia.' }, ctx)}
    <div class="fran-lista">${filas.map((f) => (f.suelto ? filaSuelta(f) : fila({ ui, icono: '💸', titulo: f.nombre, sub: 'Ya devolvió el capital', derecha: dinero.formatear(f.valor), ruta: f.ruta }))).join('') || '<p class="fran-vacio">Nadie debe solo intereses.</p>'}</div>
    <form class="fran-campos fran-campos--grande oculto" data-form-pago novalidate>
      <label class="fran-campo-valor"><small data-quien>Pagó</small><input name="valor" inputmode="numeric" autocomplete="off"></label>
      <label><small>Entra por</small><select name="cuenta"><option>Efectivo</option><option>Nequi propio</option><option>Uno propio</option><option>Bancolombia</option></select></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar el pago</button>
    </form>
    <details class="fran-tachados"><summary>Anotar a alguien que debe solo intereses</summary>
      <form class="fran-campos fran-campos--grande" data-form-nuevo novalidate>
        <label><small>Nombre</small><input name="nombre" autocomplete="off"></label>
        <label class="fran-campo-valor"><small>Debe de intereses</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
        <label><small>Nota</small><input name="nota" autocomplete="off"></label>
        <button class="fran-boton-principal fran-guardar">Anotar</button>
      </form>
    </details>
  </div>`);
  const formPago = raiz.querySelector('[data-form-pago]');
  let elegido = null;
  raiz.querySelectorAll('[data-pago]').forEach((b) => b.addEventListener('click', () => {
    elegido = (datos.estado.fran.interesesSueltos || []).find((x) => x.id === b.dataset.pago);
    if (!elegido) return;
    formPago.querySelector('[data-quien]').textContent = `Pagó ${elegido.nombre}`;
    formPago.elements.valor.value = String(elegido.valor - (elegido.pagado || 0));
    formPago.classList.remove('oculto');
    formPago.scrollIntoView({ behavior: 'smooth' });
  }));
  formPago.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!elegido) return;
    const f = e.target.elements;
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!valor) { ui.toast('Escribe cuánto pagó.'); return; }
    try {
      const fecha = f.fecha.value || hoy;
      await datos.agregarAsiento({ libro: 'prestamos', fecha, tipo: 'ingreso', categoria: 'Intereses cobrados', descripcion: elegido.nombre, persona: elegido.nombre, valor, cuenta: f.cuenta.value });
      const lista = datos.estado.fran.interesesSueltos.map((x) => (x.id === elegido.id ? { ...x, pagado: (x.pagado || 0) + valor, pagos: [...(x.pagos || []), { fecha, valor }] } : x));
      await datos.actualizarFran({ interesesSueltos: lista });
      ui.toast('Pago guardado como ganancia.');
      dibujar();
    } catch (error) { ui.toast(error.message); }
  });
  raiz.querySelector('[data-form-nuevo]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const nombre = f.nombre.value.trim();
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!nombre || !valor) { ui.toast('Escribe el nombre y cuánto debe.'); return; }
    await datos.actualizarFran({ interesesSueltos: [...(datos.estado.fran.interesesSueltos || []), { id: `int-${Date.now()}`, nombre, valor, fecha: hoy, nota: f.nota.value.trim() }] });
    ui.toast('Anotado.');
    dibujar();
  });
  contenedor.append(raiz);
}

// ---------- Tabla de préstamos, como en su Excel ----------

const NOMBRE_ESTADO = { al_dia: 'Al día', atrasado: 'Atrasado', vencido: 'Atrasado', pagado: 'Pagado', perdido: 'Perdido', legal: 'Legal', congelado: 'Congelado', familia: 'Familia', por_confirmar: 'Por confirmar' };

/** Un renglón por cada préstamo del Excel o anotado después. Los núcleos de familia muestran cada préstamo por dentro. */
export function renglonesPrestamos(estado, estadoDe = () => '') {
  const clientes = new Map(estado.clientes.map((c) => [c.id, c]));
  const sinFecha = (f) => !f || f < '2001';
  const filas = [];
  for (const p of estado.prestamos) {
    const c = clientes.get(p.clienteId) || { nombre: 'Cliente', id: p.clienteId };
    const base = { clienteId: c.id, cliente: c.nombre, estado: estadoDe(p) };
    if (Array.isArray(p.detalle) && p.detalle.length) {
      for (const d of p.detalle) filas.push({ ...base, fecha: sinFecha(d.fecha) ? null : d.fecha, textoFecha: d.texto || '', nombre: d.nombre || c.nombre, capital: d.capital || 0 });
    } else {
      filas.push({ ...base, fecha: sinFecha(p.fecha) ? null : p.fecha, textoFecha: (p.porConfirmar && p.porConfirmar.fecha) || '', nombre: (p.nombreExcel || c.nombre).trim(), capital: p.capital });
    }
  }
  return filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.capital - a.capital);
}

function renderTablaPrestamos(contenedor, ctx) {
  const { ui, dinero, datos, motor, fechas } = ctx;
  const estado = datos.estado;
  const hoy = ctx.hoy();
  const pagos = pagosRepartidos(estado);
  // Estado de cada préstamo, calculado por cliente como en su ficha.
  const estadoPorPrestamo = new Map();
  for (const c of estado.clientes) {
    const propios = estado.prestamos.filter((p) => p.clienteId === c.id);
    if (!propios.length) continue;
    const r = motor.resumenCliente(c, propios, pagos.filter((g) => g.clienteId === c.id), hoy);
    for (const x of r.resultados) estadoPorPrestamo.set(x.prestamoId, c.tipo === 'familia' ? 'familia' : x.estado);
  }
  const filas = renglonesPrestamos(estado, (p) => estadoPorPrestamo.get(p.id) || '');
  if (!vista.tabla) vista.tabla = 'mes';
  const dibujar = () => { contenedor.innerHTML = ''; renderTablaPrestamos(contenedor, ctx); };
  const punto = (e) => (e ? `<i class="fran-punto fran-punto--${ui.esc(e)}" aria-hidden="true"></i>${ui.esc(NOMBRE_ESTADO[e] || e)}` : '');
  const mismo = (a, b) => norm(a) === norm(b);
  const renglon = (f, conDia) => `<a class="fran-tabla-fila" href="#/cliente/${encodeURIComponent(f.clienteId)}">
    <span class="fran-tabla-fila__dia">${f.fecha ? ui.esc(conDia ? String(Number(f.fecha.slice(8))) : fechas.formatear(f.fecha)) : `<small>${ui.esc(f.textoFecha || 'sin fecha')}</small>`}</span>
    <span class="fran-tabla-fila__nombre"><span>${ui.esc(f.nombre)}</span><small>${punto(f.estado)}${mismo(f.nombre, f.cliente) ? '' : `${f.estado ? ' · ' : ''}${ui.esc(f.cliente)}`}</small></span>
    <span class="numero">${dinero.formatear(f.capital)}</span>
  </a>`;
  const cabeza = (titulo, lista) => `<div class="fran-tabla-cabeza"><span>${ui.esc(titulo)}</span><span>${lista.length} · <b class="numero">${dinero.formatear(sumar(lista.map((f) => ({ valor: f.capital }))))}</b></span></div>`;

  let cuerpo = '';
  if (vista.tabla === 'mes') {
    const meses = new Map();
    for (const f of filas) { const k = f.fecha ? f.fecha.slice(0, 7) : 'sin'; if (!meses.has(k)) meses.set(k, []); meses.get(k).push(f); }
    cuerpo = [...meses].map(([k, lista]) => `<section class="fran-tabla-bloque">
      ${cabeza(k === 'sin' ? 'Sin fecha en el Excel' : fechas.formatearMes(k), lista)}
      <div class="fran-tabla-titulos"><span>${k === 'sin' ? 'Cuándo' : 'Día'}</span><span>Nombre</span><span>Capital</span></div>
      ${lista.map((f) => renglon(f, true)).join('')}
    </section>`).join('');
  } else {
    const porCliente = new Map();
    for (const f of filas) { if (!porCliente.has(f.clienteId)) porCliente.set(f.clienteId, []); porCliente.get(f.clienteId).push(f); }
    cuerpo = [...porCliente.values()].map((lista) => `<details class="fran-tabla-bloque fran-tabla-cliente">
      <summary>${cabeza(lista[0].cliente, lista)}<small>${punto(lista[0].estado)}${lista.length > 1 ? `${lista[0].estado ? ' · ' : ''}${lista.length} préstamos` : ''}</small></summary>
      <div class="fran-tabla-titulos"><span>Fecha</span><span>Nombre</span><span>Capital</span></div>
      ${lista.map((f) => renglon(f, false)).join('')}
    </details>`).join('');
  }

  const raiz = ui.el(`<div class="fran-tabla-prestamos">
    ${titular('prestamos', ctx, '#/libro/prestamos', 'Tabla de préstamos')}
    ${heroe({ etiqueta: 'Total de la tabla', valor: sumar(filas.map((f) => ({ valor: f.capital }))), ayudaTexto: 'Es el capital anotado en tu Excel y lo que has prestado después en Fran, sin intereses. Los núcleos de familia muestran cada préstamo por dentro.', cajas: [['Préstamos', String(filas.length)], ['Clientes', String(new Set(filas.map((f) => f.clienteId)).size)], ['Sin fecha', String(filas.filter((f) => !f.fecha).length)]] }, ctx)}
    <div class="fran-segmento"><button type="button" data-tabla="mes" class="${vista.tabla === 'mes' ? 'activo' : ''}">Por mes</button><button type="button" data-tabla="cliente" class="${vista.tabla === 'cliente' ? 'activo' : ''}">Por cliente</button></div>
    ${filas.length ? cuerpo : '<p class="fran-vacio">Todavía no hay préstamos en este aparato.</p>'}
  </div>`);
  raiz.querySelectorAll('[data-tabla]').forEach((b) => b.addEventListener('click', () => { vista.tabla = b.dataset.tabla; dibujar(); }));
  contenedor.append(raiz);
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
  const pagos = pagosRepartidos(estado).filter((g) => g.clienteId === id);
  const r = motor.resumenCliente(cliente, propios, pagos, ctx.hoy());
  const recuperado = Math.max(0, r.capitalPrestado - r.capitalPendiente);
  const abonosPlan = estado.fran.asientos.filter((x) => x.clienteId === id && x.tipo === 'abono').reduce((s, x) => s + x.valor, 0);
  const pct = r.capitalPrestado ? Math.min(100, (recuperado / r.capitalPrestado) * 100) : 0;
  // Lo que corre de intereses por los días que lleva cada préstamo en el mes.
  const corridos = r.resultados.filter((x) => x.interesCorrido > 0);
  const acuerdo = (estado.fran.agenda || []).find((x) => (x.fecha || x.repite) && (x.clienteId === id || norm(x.nombre) === norm(cliente.nombre)));
  const cuando = acuerdo && (acuerdo.repite ? `${acuerdo.repite}s` : (acuerdo.fecha ? fechas.formatear(acuerdo.fecha) : ''));
  const textoAcuerdo = acuerdo ? `Acuerdo: ${[acuerdo.monto ? `${dinero.formatear(acuerdo.monto)} ${acuerdo.repite ? cuando : ''}`.trim() : (acuerdo.repite ? cuando : ''), !acuerdo.repite && acuerdo.monto ? cuando : (!acuerdo.repite ? cuando : ''), acuerdo.nota].filter(Boolean).join(' · ')}` : '';
  const capitalPrimero = propios.some((p) => p.modalidad === 'capital_primero');
  const conTexto = propios.find((p) => p.acuerdoTexto);
  const asientosCliente = (estado.fran.asientos || []).filter((a) => a.clienteId === id || (a.persona && norm(a.persona) === norm(cliente.nombre)));
  const cobros = cobrosDeCliente(asientosCliente, pagos, cliente);
  const historial = [
    ...propios.flatMap((p) => (p.detalle
      ? p.detalle.map((d) => ({ f: d.fecha || '2000-01-01', sinFecha: d.fecha ? null : (d.texto || 'sin fecha'), icono: '💵', t: d.nombre || 'Préstamo', v: `−${dinero.formatear(d.capital)}`, c: 'fran-menos', ruta: `#/prestamo/${encodeURIComponent(p.id)}` }))
      : [{ f: p.fecha, sinFecha: p.porConfirmar && p.porConfirmar.fecha, icono: '💵', t: 'Préstamo', v: `−${dinero.formatear(p.capital)}`, c: 'fran-menos', ruta: `#/prestamo/${encodeURIComponent(p.id)}` }])),
    ...cobros.map((m) => ({ f: m.fecha, textoFecha: m.textoFecha, icono: m.perdon ? '🎁' : (m.titulo === 'Intereses' ? '%' : '↩️'), t: m.titulo, v: `+${dinero.formatear(m.valor)}`, c: 'fran-mas', ver: m.clave })),
  ].sort((a, b) => b.f.localeCompare(a.f));
  const tel = soloDigitos(cliente.telefono);
  const editar = `#/cliente/${encodeURIComponent(id)}/editar`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/clientes', 'Cliente')}
    <div class="fran-cliente">
      <span class="fran-avatar">${ui.esc(cliente.nombre.charAt(0).toUpperCase())}</span>
      <div><strong>${ui.esc(cliente.nombre)}</strong>${conTexto ? `<small>${ui.esc(`Acuerdo: ${conTexto.acuerdoTexto}`)}</small>` : (textoAcuerdo ? `<small>${ui.esc(textoAcuerdo)}</small>` : '')}</div>
      ${r.soloIntereses ? '<span class="fran-solo">Solo intereses</span>' : ui.chipEstado(r.estado)}
    </div>
    ${heroe({ etiqueta: 'Si paga hoy, debe', valor: r.debeHoy, cajas: [['Capital pendiente', r.capitalPendiente], ['Intereses', r.interesPendiente + r.interesCorrido]] }, ctx)}
    ${corridos.length ? `<div class="fran-corrido"><p class="fran-corrido__titulo">Intereses de estos días</p>${corridos.map((x) => `<div class="fran-corrido__fila"><span><span>${ui.esc(`Préstamo del ${fechas.formatear(x.fecha)} · ${dinero.formatear(x.capitalPendiente)}`)}</span><small>${ui.esc(`${dinero.formatear(x.interesDelMes)} al mes · ${dinero.formatear(x.interesDiario)} por día · ${x.diasCorridos} ${x.diasCorridos === 1 ? 'día' : 'días'} desde el ${fechas.formatear(x.corridoDesde)}`)}</small></span><b class="numero">${dinero.formatear(x.interesCorrido)}</b></div>`).join('')}</div>` : ''}
    <div class="fran-progreso"><span style="width:${pct}%"></span></div>
    <p class="fran-nota">${abonosPlan && !recuperado ? `Abono a capital anotado: ${dinero.formatear(abonosPlan)}.` : `Recuperado ${dinero.formatear(recuperado)} de ${dinero.formatear(r.capitalPrestado)} de capital.`}${capitalPrimero ? (r.capitalPendiente === 0 ? ' Ya recuperó todo el capital: lo que pague es ganancia.' : ' Cuando llegue a 100%, todo lo que pague es ganancia.') : ''}</p>
    <p class="fran-seccion">Historial</p>
    <div class="fran-lista">${historial.map((h) => fila({ ui, icono: h.icono, titulo: h.t, sub: h.sinFecha ? `Fecha por confirmar (${h.sinFecha})` : (h.textoFecha || fechas.formatear(h.f)), derecha: h.v, clase: h.c, ruta: h.ruta, ver: h.ver })).join('') || '<p class="fran-vacio">Sin movimientos.</p>'}</div>
    <div class="fran-tres">
      <a class="azul" href="${tel ? `tel:+${tel}` : editar}">📞 ${tel ? 'Llamar' : 'Poner teléfono'}</a>
      <a class="verde" href="${tel ? `https://wa.me/${tel}` : editar}"${tel ? ' target="_blank" rel="noopener"' : ''}>💬 WhatsApp</a>
      <a class="gris" href="#/libro/prestamos/registrar/acuerdo/${encodeURIComponent(id)}">⏰ Recordar</a>
    </div>
    <a class="fran-enlace-suave" href="${editar}">Editar datos del cliente</a>
  </div>`);
  const volver = () => { contenedor.innerHTML = ''; renderFicha(contenedor, id, ctx); window.scrollTo(0, 0); };
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const m = cobros.find((x) => x.clave === b.dataset.ver);
    if (m) verCobro(contenedor, m, cobros, cliente, volver, ctx);
  }));
  contenedor.append(raiz);
}

// ---------- Agenda de cobros (boceto 10) ----------

function hecho(item, hoy) {
  return item.repite ? item.hechoEn === hoy : !!item.hecho;
}

// ---------- Propiedades ----------

function arriendosDelAnio(ctx) {
  const lista = deTipo(delLibro(asientos(ctx), 'arriendos'), 'ingreso');
  if (!vista.anioPropiedad) vista.anioPropiedad = ctx.hoy().slice(0, 4);
  return { lista, delAnio: vista.anioPropiedad === 'todo' ? lista : lista.filter((a) => a.fecha.startsWith(vista.anioPropiedad)) };
}

function renderPropiedades(contenedor, ctx) {
  const { ui, dinero } = ctx;
  const { lista, delAnio } = arriendosDelAnio(ctx);
  const anios = [...new Set(lista.map((a) => a.fecha.slice(0, 4)))].sort().reverse();
  const DUENA = Object.fromEntries((ctx.datos.estado.fran.propiedades || []).map((p) => [p.nombre, p.duena]));
  const totales = new Map(Object.keys(DUENA).map((n) => [n, 0]));
  for (const a of delAnio) totales.set(a.categoria, (totales.get(a.categoria) || 0) + a.valor);
  const filas = [...totales].sort((x, y) => y[1] - x[1]);
  const raiz = ui.el(`<div>
    ${titular('arriendos', ctx, '#/libro/arriendos', 'Propiedades')}
    <div class="fran-anios">${[...anios, 'todo'].map((x) => `<button type="button" data-anio="${x}" class="${x === vista.anioPropiedad ? 'activo' : ''}">${x === 'todo' ? 'Todo' : x}</button>`).join('')}</div>
    <p class="fran-total"><strong class="numero">Total: <span class="fran-mas">${dinero.formatear(sumar(delAnio))}</span></strong></p>
    <div class="fran-lista">${filas.map(([n, v]) => fila({
      ui, icono: '🏢', titulo: n === 'Arriendos del mes' ? 'Sin repartir' : n,
      sub: v || !DUENA[n] ? (NOTA_PROPIEDAD[n] || (/sin decir piso/.test(n) ? 'La anotación no dice el piso' : '') || DUENA[n] || '') : `${DUENA[n]} · sin ingresos este año`,
      derecha: dinero.formatear(v), clase: v ? 'fran-mas' : '', ruta: `#/libro/arriendos/propiedad/${encodeURIComponent(n)}`,
    })).join('')}</div>
  </div>`);
  raiz.querySelectorAll('[data-anio]').forEach((b) => b.addEventListener('click', () => {
    vista.anioPropiedad = b.dataset.anio;
    contenedor.innerHTML = '';
    renderPropiedades(contenedor, ctx);
  }));
  contenedor.append(raiz);
}

// ---------- Plata virtual ----------

const CUENTA_NO_VIRTUAL = /^(efectivo|tarjeta)/i;

/** Todo lo que entró o salió de mi cuenta virtual después del saldo de partida. */
// ---------- Plata en efectivo: solo lo del efectivo, desde el cierre del mes pasado ----------

/** Todo lo que movió el efectivo: préstamos, pagos, gastos e ingresos en efectivo y lo anotado a mano. */
function filasEfectivo(ctx) {
  const estado = ctx.datos.estado;
  const filas = [];
  const clienteDe = (prestamoId) => {
    const p = estado.prestamos.find((x) => x.id === prestamoId);
    const c = p && estado.clientes.find((x) => x.id === p.clienteId);
    return c ? c.nombre : '';
  };
  const QUE = { prestamo: 'Préstamo', pago: 'Pago', aporte: 'Entró', retiro: 'Salió', traslado: 'Traslado', ganancia_a_personal: 'Ganancia a personal' };
  for (const m of estado.movimientos) {
    if (m.caja !== 'efectivo' || m.tipo === 'saldo_inicial') continue;
    const quien = m.prestamoId ? clienteDe(m.prestamoId) : '';
    const icono = m.tipo === 'prestamo' ? '💵' : (m.tipo === 'pago' ? '↩️' : (m.signo > 0 ? '⬇️' : '⬆️'));
    filas.push({ id: m.id, manual: ['aporte', 'retiro'].includes(m.tipo), fecha: m.fecha, icono, titulo: quien || m.nota || QUE[m.tipo] || m.tipo, sub: quien ? QUE[m.tipo] : (m.nota && QUE[m.tipo] ? QUE[m.tipo] : ''), valor: m.monto * m.signo });
  }
  for (const a of estado.fran.asientos) {
    if (a.libro === 'terceros') continue;
    const esEf = (c) => /^efectivo$/i.test(c || '');
    const base = { fecha: a.fecha, icono: iconoDe(a.categoria), titulo: a.categoria, sub: a.descripcion || '' };
    if (a.tipo === 'transferencia') {
      if (esEf(a.cuenta)) filas.push({ ...base, valor: -a.valor });
      if (esEf(a.destino)) filas.push({ ...base, valor: a.valor });
    } else if (esEf(a.cuenta)) {
      filas.push({ ...base, valor: a.tipo === 'ingreso' ? a.valor : -a.valor });
    }
  }
  return filas;
}

function renderEfectivo(contenedor, ctx) {
  const { ui, dinero, fechas, datos, motor } = ctx;
  const hoy = ctx.hoy();
  const iniciales = datos.estado.movimientos.filter((m) => m.caja === 'efectivo' && m.tipo === 'saldo_inicial');
  const partida = motor.saldoCaja(iniciales, 'efectivo');
  const desde = iniciales.length ? iniciales.map((m) => m.fecha.slice(0, 7)).sort()[0] : hoy.slice(0, 7);
  const filas = filasEfectivo(ctx);
  const total = partida + filas.reduce((s, f) => s + f.valor, 0);
  const meses = [];
  for (let m = desde; m <= hoy.slice(0, 7); m = fechas.sumarMeses(`${m}-01`, 1).slice(0, 7)) meses.push(m);
  if (!vista.mesEfectivo || !meses.includes(vista.mesEfectivo)) vista.mesEfectivo = meses[meses.length - 1];
  const mes = vista.mesEfectivo;
  const anterior = partida + filas.filter((f) => f.fecha.slice(0, 7) < mes).reduce((s, f) => s + f.valor, 0);
  const delMesE = filas.filter((f) => f.fecha.slice(0, 7) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const entro = delMesE.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
  const salio = delMesE.filter((f) => f.valor < 0).reduce((s, f) => s - f.valor, 0);
  const mesAntes = fechas.nombreMes(Number(fechas.sumarMeses(`${mes}-01`, -1).slice(5, 7))).toLowerCase();
  const dibujar = () => { contenedor.innerHTML = ''; renderEfectivo(contenedor, ctx); };
  const dias = [...new Set(delMesE.map((f) => f.fecha))];
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', 'Plata en efectivo', mes)}
    ${heroe({ etiqueta: 'Efectivo hoy', valor: total, ayudaTexto: `Arranca con el cierre del mes pasado y suma o resta solo lo que entró o salió en efectivo.`, cajas: [[`Cierre de ${mesAntes}`, anterior], ['Entró', entro, entro ? 'mas' : ''], ['Salió', salio, salio ? 'menos' : '']] }, ctx)}
    <div class="fran-dos fran-virtual__botones"><button type="button" class="fran-boton-principal" data-nuevo="aporte"><span class="fran-signo fran-signo--mas" aria-hidden="true"></span>Entró</button><button type="button" class="fran-boton-secundario" data-nuevo="retiro"><span class="fran-signo fran-signo--menos" aria-hidden="true"></span>Salió</button></div>
    <form class="fran-campos fran-campos--grande oculto" data-form-mov novalidate>
      <label><small data-titulo>Entró</small><input name="concepto" autocomplete="off" placeholder="¿Quién o qué?"></label>
      <label class="fran-campo-valor"><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(mes === hoy.slice(0, 7) ? hoy : `${mes}-01`)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar</button>
    </form>
    ${dias.map((dia) => `<div class="fran-dia"><span>${ui.esc(fechaLinda(dia, ctx))}</span></div><div class="fran-lista">${delMesE.filter((f) => f.fecha === dia).map((f) => `<div class="fran-fila"><span class="fran-ico">${ui.esc(f.icono)}</span><span class="fran-fila__texto"><strong>${ui.esc(f.titulo)}</strong>${f.sub ? `<small>${ui.esc(f.sub)}</small>` : ''}</span><span class="fran-fila__valor numero ${f.valor < 0 ? 'fran-menos' : 'fran-mas'}">${dinero.formatear(Math.abs(f.valor))}</span>${f.manual ? `<button type="button" class="fran-boton-secundario fran-boton--44" data-quitar="${ui.esc(f.id)}">Quitar</button>` : ''}</div>`).join('')}</div>`).join('') || '<p class="fran-vacio">Nada en efectivo este mes.</p>'}
  </div>`);
  raiz.querySelector('[data-elegir-mes]').addEventListener('click', () => abrirMeses(mes, ctx, (m) => { vista.mesEfectivo = m; dibujar(); }, meses));
  const form = raiz.querySelector('[data-form-mov]');
  let tipo = 'aporte';
  raiz.querySelectorAll('[data-nuevo]').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.nuevo;
    form.querySelector('[data-titulo]').textContent = tipo === 'aporte' ? 'Entró' : 'Salió';
    form.classList.remove('oculto');
    form.elements.concepto.focus();
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!valor) { ui.toast('Escribe el valor.'); return; }
    try {
      await datos.movimientoCaja({ fecha: f.fecha.value || hoy, tipo, caja: 'efectivo', monto: valor, nota: f.concepto.value.trim(), ...(tipo === 'aporte' ? { origen: 'otro' } : {}) });
      ui.toast('Guardado.');
      dibujar();
    } catch (error) { ui.toast(error.message); }
  });
  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (await ui.confirmar('¿Quitar este movimiento del efectivo?', { aceptar: 'Sí, quitar', peligro: true })) { await datos.eliminarMovimiento(b.dataset.quitar); dibujar(); }
  }));
  contenedor.append(raiz);
}

function filasVirtuales(ctx) {
  const estado = ctx.datos.estado;
  const filas = [];
  const nombreDe = (prestamoId) => {
    const p = estado.prestamos.find((x) => x.id === prestamoId);
    const c = p && estado.clientes.find((x) => x.id === p.clienteId);
    return c ? c.nombre : '';
  };
  for (const m of estado.movimientos) {
    if (m.caja !== 'virtual' || m.tipo === 'saldo_inicial') continue;
    const quien = m.prestamoId ? nombreDe(m.prestamoId) : '';
    filas.push({ fecha: m.fecha, concepto: quien ? `${quien} · ${m.tipo === 'prestamo' ? 'Préstamo' : 'Pago'}` : (m.nota || m.tipo.replace(/_/g, ' ')), valor: m.monto * m.signo });
  }
  for (const a of estado.fran.asientos) {
    if (a.libro === 'terceros') continue;
    const concepto = a.descripcion || a.categoria;
    if (a.tipo === 'transferencia') {
      if (a.cuenta && !CUENTA_NO_VIRTUAL.test(a.cuenta)) filas.push({ fecha: a.fecha, concepto, valor: -a.valor });
      if (a.destino && !CUENTA_NO_VIRTUAL.test(a.destino)) filas.push({ fecha: a.fecha, concepto, valor: a.valor });
    } else if (a.cuenta && !CUENTA_NO_VIRTUAL.test(a.cuenta)) {
      filas.push({ fecha: a.fecha, concepto, valor: a.tipo === 'ingreso' ? a.valor : -a.valor });
    }
  }
  for (const m of estado.fran.virtualMov) filas.push({ id: m.id, fecha: m.fecha, concepto: m.concepto || (m.tipo === 'entra' ? 'Entró' : 'Salió'), valor: m.tipo === 'entra' ? m.valor : -m.valor });
  return filas;
}

function renderVirtual(contenedor, ctx) {
  const { ui, dinero, fechas, datos, motor } = ctx;
  const fran = datos.estado.fran;
  const hoy = ctx.hoy();
  const historial = fran.virtualHistorial;
  const filas = filasVirtuales(ctx);
  const partida = motor.saldoCaja(datos.estado.movimientos.filter((m) => m.tipo === 'saldo_inicial'), 'virtual');
  const miSaldo = partida + filas.reduce((s, f) => s + f.valor, 0);
  const desde = historial.length ? historial[historial.length - 1].mes : hoy.slice(0, 7);
  const meses = [...historial.map((h) => h.mes)];
  for (let m = fechas.sumarMeses ? fechas.sumarMeses(`${desde}-01`, 1).slice(0, 7) : desde; m <= hoy.slice(0, 7); m = fechas.sumarMeses(`${m}-01`, 1).slice(0, 7)) meses.push(m);
  if (!meses.includes(hoy.slice(0, 7))) meses.push(hoy.slice(0, 7));
  if (!vista.mesVirtual || !meses.includes(vista.mesVirtual)) vista.mesVirtual = meses[meses.length - 1];
  const mes = vista.mesVirtual;
  const guardado = historial.find((h) => h.mes === mes);
  const anterior = guardado ? guardado.anterior : partida + filas.filter((f) => f.fecha.slice(0, 7) < mes).reduce((s, f) => s + f.valor, 0);
  const delMesV = guardado ? (guardado.filas || []) : filas.filter((f) => f.fecha.slice(0, 7) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const entro = delMesV.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
  const salio = delMesV.filter((f) => f.valor < 0).reduce((s, f) => s - f.valor, 0);
  const queda = guardado ? guardado.queda : anterior + entro - salio;
  const cuentas = fran.virtualCuentas;
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', 'Plata virtual')}
    ${heroe({ etiqueta: 'Mi cuenta virtual', valor: miSaldo, ayudaTexto: miSaldo < 0 ? 'Debo esto: ya usé plata de mi pareja.' : 'Esto me queda.' }, ctx)}
    <div class="fran-tarjeta fran-virtual__cuentas"><span class="fran-tarjeta__cabeza"><small>Hay en las cuentas, entre los dos</small>${ayuda(`${cuentas ? `Al ${fechas.formatear(cuentas.fecha)}. ` : ''}No es mía. Es lo que mi pareja me puede prestar.`, ui)}</span><strong>${cuentas ? conSigno(cuentas.valor, dinero) : 'Sin anotar'}</strong>
      <button type="button" class="fran-boton-secundario fran-boton--44" data-cuentas>Actualizar</button>
      ${cuentas && cuentas.detalle && cuentas.detalle.length ? `<details class="fran-virtual__detalle"><summary>De dónde sale</summary>${cuentas.detalle.map((d) => `<p><span>${ui.esc(d.concepto)}</span><span class="numero">${dinero.formatear(d.valor)}</span></p>`).join('')}</details>` : ''}
    </div>
    <form class="fran-en-linea oculto" data-form-cuentas novalidate><input class="fran-entrada" name="valor" inputmode="numeric" autocomplete="off" placeholder="¿Cuánto hay hoy?" aria-label="Cuánto hay en las cuentas"><button class="boton boton--primario">Guardar</button></form>
    ${selectorMes(mes, ctx)}
    ${guardado && !guardado.filas ? `<div class="fran-tarjeta"><small>Saldo al final del mes</small><strong>${conSigno(queda, dinero)}</strong></div>` : `<div class="fran-virtual__cuadro">
      <p><span>Cierre de ${ui.esc(fechas.nombreMes(Number(fechas.sumarMeses(`${mes}-01`, -1).slice(5, 7))).toLowerCase())}</span>${conSigno(anterior, dinero)}</p>
      <p><span>Entró</span><span class="numero fran-mas">${dinero.formatear(entro)}</span></p>
      <p><span>Salió</span><span class="numero fran-menos">${dinero.formatear(salio)}</span></p>
      <p class="fran-virtual__queda"><span>Queda</span><span class="numero ${queda < 0 ? 'fran-menos' : ''}">${dinero.formatear(Math.abs(queda))}</span></p>
    </div>`}
    ${guardado ? '' : `<div class="fran-dos fran-virtual__botones"><button type="button" class="fran-boton-principal" data-nuevo="entra"><span class="fran-signo fran-signo--mas" aria-hidden="true"></span>Entró</button><button type="button" class="fran-boton-secundario" data-nuevo="sale"><span class="fran-signo fran-signo--menos" aria-hidden="true"></span>Salió</button></div>
    <form class="fran-campos oculto" data-form-mov novalidate>
      <label><small data-titulo>Entró</small><input name="concepto" autocomplete="off" placeholder="¿Quién o qué?"></label>
      <label><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(mes === hoy.slice(0, 7) ? hoy : `${mes}-01`)}"></label>
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>`}
    <div class="fran-lista">${delMesV.map((f) => `<div class="fran-fila">
      <span class="fran-fila__texto"><strong>${ui.esc(f.concepto)}</strong>${f.fecha ? `<small>${ui.esc(fechas.formatear(f.fecha))}</small>` : ''}</span>
      <span class="fran-fila__valor numero ${f.valor < 0 ? 'fran-menos' : 'fran-mas'}">${dinero.formatear(Math.abs(f.valor))}</span>
      ${f.id ? `<button type="button" class="fran-boton-secundario fran-boton--44" data-quitar="${ui.esc(f.id)}">Quitar</button>` : ''}
    </div>`).join('') || (guardado && !guardado.filas ? '' : '<p class="fran-vacio">Nada anotado este mes.</p>')}</div>
  </div>`);
  raiz.querySelector('[data-elegir-mes]').addEventListener('click', () => abrirMeses(mes, ctx, (m) => {
    vista.mesVirtual = m;
    contenedor.innerHTML = '';
    renderVirtual(contenedor, ctx);
  }, meses));
  const formCuentas = raiz.querySelector('[data-form-cuentas]');
  raiz.querySelector('[data-cuentas]').addEventListener('click', () => { formCuentas.classList.toggle('oculto'); formCuentas.elements.valor.focus(); });
  formCuentas.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = e.target.elements.valor.value.trim();
    const valor = Number(texto.replace(/\D/g, ''));
    if (!texto || !Number.isInteger(valor)) { ui.toast('Escribe cuánto hay.'); return; }
    await datos.actualizarFran({ virtualCuentas: { valor, fecha: hoy, detalle: [] } });
    ui.toast('Guardado.');
  });
  const formMov = raiz.querySelector('[data-form-mov]');
  let tipoMov = 'entra';
  raiz.querySelectorAll('[data-nuevo]').forEach((b) => b.addEventListener('click', () => {
    tipoMov = b.dataset.nuevo;
    formMov.querySelector('[data-titulo]').textContent = tipoMov === 'entra' ? 'Entró' : 'Salió';
    formMov.classList.remove('oculto');
    formMov.elements.concepto.focus();
  }));
  if (formMov) formMov.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!valor) { ui.toast('Escribe el valor.'); return; }
    try {
      await datos.agregarVirtual({ fecha: f.fecha.value || hoy, tipo: tipoMov, concepto: f.concepto.value, valor });
      ui.toast('Guardado.');
    } catch (error) { ui.toast(error.message); }
  });
  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (await ui.confirmar('¿Quitar este movimiento?', { aceptar: 'Sí, quitar', peligro: true })) await datos.eliminarVirtual(b.dataset.quitar);
  }));
  contenedor.append(raiz);
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
  const sinFecha = propia.filter((x) => !x.repite && !x.fecha);
  const delMotor = motor.agendaCobros(datos.estado, hoy, 7);
  // Historial: cada vez que se tachó algo, con su fecha. Lo tachado antes de esta versión sale sin fecha.
  const tachados = (datos.estado.fran.agenda || []).flatMap((x) => {
    const fechasT = x.historial && x.historial.length ? x.historial : (x.hecho ? [x.hechoEl || null] : (x.hechoEn ? [x.hechoEn] : []));
    return fechasT.map((f) => ({ nombre: x.nombre, fecha: f, monto: x.monto, nota: x.nota }));
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const linea = (x) => {
    const legal = /denuncia|legal/i.test(x.nota || '');
    const icono = x.repite ? '🔁' : (legal ? '⚖️' : '⏰');
    const cuando = x.repite
      ? (x.repite === 'diario' ? (x.desde ? `Desde ${fechas.nombreMes(Number(x.desde.slice(5, 7)), true)} ${Number(x.desde.slice(8))}`.replace(/^Desde (\S+) (\d+)$/, 'Desde $2 $1') : 'Todos los días') : `${x.repite[0].toUpperCase()}${x.repite.slice(1)}`)
      : !x.fecha ? '' : fechaLinda(x.fecha, ctx).replace(/^(.+) · (\S+)$/, '$2 $1');
    return `<div class="fran-fila">
      <span class="fran-ico${x.repite ? ' fran-ico--verde' : (legal ? ' fran-ico--rojo' : '')}">${icono}</span>
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
    ${sinFecha.length ? `<p class="fran-seccion">Sin fecha</p><div class="fran-lista">${sinFecha.map(linea).join('')}</div>` : ''}
    ${tachados.length ? `<details class="fran-tachados"><summary>Ya tachados · ${tachados.length}</summary><div class="fran-lista">${tachados.slice(0, 60).map((t) => fila({ ui, icono: '✓', titulo: t.nombre, sub: [t.fecha ? `Tachado el ${fechas.formatear(t.fecha)}` : 'Tachado antes de que Fran guardara la fecha', t.nota].filter(Boolean).join(' · '), derecha: t.monto ? dinero.formatear(t.monto) : '' })).join('')}</div></details>` : ''}
  </div>`);
  raiz.querySelectorAll('[data-hecho]').forEach((b) => b.addEventListener('click', async () => {
    const item = (datos.estado.fran.agenda || []).find((x) => x.id === b.dataset.hecho);
    if (!item) return;
    // Cada tachada queda en su historial con la fecha, también en los que se repiten.
    const conHistorial = (x) => ({ ...x, historial: [...(x.historial || []), hoy] });
    const lista = datos.estado.fran.agenda.map((x) => (x.id !== item.id ? x : (x.repite ? { ...conHistorial(x), hechoEn: hoy } : { ...conHistorial(x), hecho: true, hechoEl: hoy })));
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
    case 'virtual': return renderVirtual(contenedor, ctx);
    case 'ganancias': return renderGanancias(contenedor, ctx);
    case 'propiedades': return renderPropiedades(contenedor, ctx);
    case 'tablaPrestamos': return renderTablaPrestamos(contenedor, ctx);
    case 'efectivo': return renderEfectivo(contenedor, ctx);
    case 'soloIntereses': return renderSoloIntereses(contenedor, ctx);
    case 'propiedad': {
      const { delAnio } = arriendosDelAnio(ctx);
      const anio = vista.anioPropiedad === 'todo' ? '' : ` · ${vista.anioPropiedad}`;
      return renderDetalle(contenedor, 'arriendos', `${params.nombre === 'Arriendos del mes' ? 'Sin repartir' : params.nombre}${anio}`, delAnio.filter((a) => a.categoria === params.nombre), '#/libro/arriendos/propiedades', ctx);
    }
    case 'moverPension': return renderMoverPension(contenedor, params.accion, ctx);
    case 'personas': return renderPersonas(contenedor, ctx);
    case 'persona': {
      const lista = deTipo(delLibro(asientos(ctx), 'prestamos'), 'ingreso').filter((a) => a.persona === params.nombre);
      return renderDetalle(contenedor, 'prestamos', params.nombre, lista, '#/libro/prestamos/personas', ctx);
    }
    case 'categoria': {
      const mes = mesVisible(ctx, delLibro(asientos(ctx), id));
      const lista = deTipo(delMes(delLibro(asientos(ctx), id), mes), params.tipo).filter((a) => a.categoria === params.categoria);
      return renderDetalle(contenedor, id, params.categoria, lista, `#/libro/${id}/graficos`, ctx, {
        mes,
        redibujar: () => { contenedor.innerHTML = ''; render(contenedor, params, ctx); },
      });
    }
    default: throw new Error('Vista desconocida.');
  }
}
