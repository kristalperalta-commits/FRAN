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
  redes: { ingreso: ['Facebook', 'YouTube', 'TikTok', 'Instagram', 'Creación de contenido para otros'], gasto: ['Facebook', 'YouTube', 'TikTok', 'Instagram', 'Creación de contenido para otros'] },
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
  [/aliment|comida|mercado/, '🍽️'], [/vivienda|hogar/, '🏠'], [/carro|auto/, '🚗'], [/gasolina|combustible/, '⛽'],
  [/servicio/, '💡'], [/compra/, '🛍️'], [/medicina|salud/, '💊'], [/abogado/, '⚖️'], [/social/, '👥'], [/viaje/, '✈️'],
  [/electronic/, '📱'], [/belleza/, '💄'], [/deporte/, '⚽'], [/entreten/, '🎬'], [/transporte/, '🚌'], [/educacion/, '📚'],
  [/regalo/, '🎁'], [/agua/, '💧'], [/ropa/, '👕'], [/tarjeta/, '💳'], [/descuadre/, '❓'], [/deuda/, '📄'],
  [/interes|prestamo/, '💵'], [/prado|laguna|bodega|piso|apartamento|franklin|arriendo/, '🏢'], [/mano de obra/, '👷'],
  [/remodel/, '🎨'], [/material/, '🧱'], [/tramite/, '📑'], [/casas/, '🏗️'], [/audiovisual|contenido/, '🎬'], [/redes|youtube|video/, '📺'],
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

// Emoji → ilustración 3D de la misma familia (app/iconos/3d). Todo lo que se ve en Fran es 3D.
const EMOJI_3D = {
  '🍎': 'manzana', '🍽️': 'plato', '🏠': 'casa', '🚗': 'carro', '⛽': 'gasolina', '💡': 'bombilla', '🛍️': 'bolsas', '💊': 'pastilla', '⚖️': 'balanza',
  '👥': 'personas', '✈️': 'avion', '📱': 'celular', '💄': 'labial', '⚽': 'balon', '🎬': 'claqueta', '🚌': 'bus', '📚': 'libros',
  '🎁': 'regalo', '💧': 'gota', '👕': 'camiseta', '💳': 'tarjeta', '❓': 'pregunta', '📄': 'documento', '💵': 'billete', '🏢': 'edificio',
  '👷': 'obrero', '🎨': 'paleta', '🧱': 'ladrillo', '📑': 'lista', '🏗️': 'edificio', '📺': 'tv', '📦': 'caja', '📈': 'grafica',
  '💰': 'bolsa', '🤝': 'manos', '🔁': 'repetir', '🧾': 'recibo', '🔨': 'ladrillo', '🅿️': 'carro', '🔖': 'marcador', '↩️': 'repetir',
  '💸': 'porcentaje', '⏰': 'reloj', '✎': 'lapiz', '⚙️': 'engranaje', '+': 'mas', '◎': 'monedas', '🐷': 'alcancia', '💯': 'recibo',
  '📲': 'celular', '💻': 'portatil', '🏛️': 'clasico', '🛒': 'bolsas', '🔔': 'reloj', '📝': 'lapiz', '🏦': 'banco', '👛': 'billetera', '📋': 'tabla', '📅': 'calendario', '📞': 'telefono', '💬': 'chat', '🔍': 'lista', '✓': 'recibo', '🔥': 'bombilla', '⬇️': 'repetir', '⬆️': 'repetir', '🔴': 'pregunta', '🤝': 'manos', '🏢': 'edificio',
};
/** Imagen 3D de una categoría (o de un emoji). Si no hay dibujo, devuelve el emoji en su cuadro. */
// Logos sencillos de las redes (pedido el 7 nov 2026): se ven en Redes, en sus categorías y en Inicio.
const LOGO_RED = {
  facebook: '<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1877F2"/><path d="M26.5 40V26.6h4.5l.7-5.2h-5.2v-3.3c0-1.5.4-2.5 2.6-2.5h2.8v-4.7c-.5-.1-2.1-.2-4-.2-4 0-6.7 2.4-6.7 6.9v3.8H16.7v5.2h4.5V40z" fill="#fff"/></svg>',
  youtube: '<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#FF0033"/><path d="M19 15.5v17l14-8.5z" fill="#fff"/></svg>',
  tiktok: '<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#111"/><path d="M28.6 10h-4.8v19.4a4.4 4.4 0 1 1-3.1-4.2v-4.9a9.2 9.2 0 1 0 7.9 9.1V19a11 11 0 0 0 6.4 2v-4.8a6.4 6.4 0 0 1-6.4-6.2z" fill="#25F4EE" transform="translate(-1.2 -1)"/><path d="M28.6 10h-4.8v19.4a4.4 4.4 0 1 1-3.1-4.2v-4.9a9.2 9.2 0 1 0 7.9 9.1V19a11 11 0 0 0 6.4 2v-4.8a6.4 6.4 0 0 1-6.4-6.2z" fill="#FE2C55" transform="translate(1.2 1)"/><path d="M28.6 10h-4.8v19.4a4.4 4.4 0 1 1-3.1-4.2v-4.9a9.2 9.2 0 1 0 7.9 9.1V19a11 11 0 0 0 6.4 2v-4.8a6.4 6.4 0 0 1-6.4-6.2z" fill="#fff"/></svg>',
  instagram: '<svg viewBox="0 0 48 48"><defs><linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".6" stop-color="#D62976"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#ig-g)"/><rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="24" cy="24" r="6.2" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="31.6" cy="16.4" r="2" fill="#fff"/></svg>',
};
function logoRed(nombre, clase = '') {
  const svg = LOGO_RED[norm(nombre)];
  return svg ? svg.replace('<svg ', `<svg class="fran-3d fran-logo-red ${clase}" aria-hidden="true" `) : '';
}

export function icono3dDe(categoriaOEmoji, clase = 'fran-3d--40') {
  const logo = logoRed(categoriaOEmoji, clase);
  if (logo) return logo;
  const emoji = EMOJI_3D[categoriaOEmoji] ? categoriaOEmoji : iconoDe(categoriaOEmoji);
  const archivo = EMOJI_3D[emoji];
  if (!archivo) return `<span class="fran-ico">${emoji}</span>`;
  return `<img class="fran-3d ${clase} fran-ico--3d" src="iconos/3d/${archivo}.png" alt="" aria-hidden="true" decoding="async">`;
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

/** De qué tarjeta es una cuenta de pago: "Tarjeta comida" es la Visa Classic comida, y así. */
export function tarjetaDeCuenta(tarjetas, cuenta) {
  const n = norm(cuenta);
  if (!n.startsWith('tarjeta')) return -1;
  const clave = ['comida', 'gasolina', 'gold', 'online'].find((k) => n.includes(k));
  const i = clave ? tarjetas.findIndex((t) => norm(t.nombre).includes(clave === 'online' ? 'gold' : clave) || norm(t.nombre).includes(clave)) : -1;
  return i;
}

/** Cada tarjeta: lo que se debía en su último extracto (o lo anotado al empezar) más lo de después. */
export function estadoTarjetas(fran, hasta = null) {
  const tarjetas = (fran.tarjetas || []).map((t) => ({ ...t, base: t.deuda || 0, deudaHoy: t.deuda || 0, movimientos: [] }));
  for (const a of fran.asientos || []) {
    if (a.libro === 'terceros') continue;
    if (hasta && a.fecha > hasta) continue;
    const cargar = (cuenta, valor) => {
      const i = tarjetaDeCuenta(tarjetas, cuenta);
      if (i < 0) return;
      if (tarjetas[i].fecha && a.fecha <= tarjetas[i].fecha) return;
      tarjetas[i].deudaHoy += valor;
      tarjetas[i].movimientos.push({ ...a, efecto: valor });
    };
    if (a.tipo === 'transferencia') { cargar(a.cuenta, a.valor); cargar(a.destino, -a.valor); }
    else if (a.tipo === 'ingreso') cargar(a.cuenta, -a.valor);
    else cargar(a.cuenta, a.valor);
  }
  return tarjetas;
}

export function miPlata(ctx, hasta = null) {
  const { motor, datos } = ctx;
  const estado = datos.estado;
  let efectivo = motor.saldoCaja(estado.movimientos, 'efectivo', hasta || undefined);
  let virtual = motor.saldoCaja(estado.movimientos, 'virtual', hasta || undefined);
  const tarjetas = estadoTarjetas(estado.fran, hasta).reduce((s, t) => s + t.deudaHoy, 0);
  const mover = (cuenta, valor) => {
    if (!cuenta) return;
    if (cuenta === 'Efectivo') efectivo += valor;
    else if (cuenta.startsWith('Tarjeta')) return; // va en la deuda de su tarjeta
    else virtual += valor;
  };
  for (const m of estado.fran.virtualMov || []) { if (hasta && m.fecha > hasta) continue; virtual += m.tipo === 'entra' ? m.valor : -m.valor; }
  for (const a of estado.fran.asientos || []) {
    if (a.libro === 'terceros') continue;
    if (hasta && a.fecha > hasta) continue;
    if (a.tipo === 'transferencia') { mover(a.cuenta, -a.valor); mover(a.destino, a.valor); }
    else if (a.tipo === 'ingreso') mover(a.cuenta, a.valor);
    else mover(a.cuenta, -a.valor);
  }
  return { efectivo, virtual, tarjetas, total: efectivo + virtual - tarjetas };
}

/**
 * De dónde sale "Mi plata hoy": con qué se arrancó (el cierre y lo que se debía en tarjetas) y cada
 * cosa que la movió después, con la misma cuenta que usa miPlata. Si algo no cuadra, sale aparte.
 */
export function cuentaMiPlata(ctx) {
  const { datos } = ctx;
  const estado = datos.estado;
  const fran = estado.fran;
  const tarjetas = fran.tarjetas || [];
  const QUE = { prestamo: 'Préstamo que hice', pago: 'Pago de un cliente', aporte: 'Entró', retiro: 'Salió', traslado: 'Pasé plata entre cajas', ganancia_a_personal: 'Ganancia a personal' };
  const partida = { efectivo: 0, virtual: 0, fecha: null, tarjetas: tarjetas.map((t) => ({ nombre: t.nombre, valor: t.deuda || 0, fecha: t.fecha || '', nota: t.nota || '' })) };
  const eventos = [];
  for (const m of estado.movimientos || []) {
    if (m.caja !== 'efectivo' && m.caja !== 'virtual') continue;
    const v = (Number(m.monto) || 0) * (Number(m.signo) === -1 ? -1 : 1);
    if (m.tipo === 'saldo_inicial') { partida[m.caja] += v; if (!partida.fecha || m.fecha > partida.fecha) partida.fecha = m.fecha; continue; }
    eventos.push({ fecha: m.fecha, titulo: m.nota || QUE[m.tipo] || 'Movimiento', donde: m.caja === 'efectivo' ? 'Efectivo' : 'Virtual', efecto: v, grupo: m.tipo === 'traslado' ? 'pases' : (v >= 0 ? 'entro' : 'salio'), icono: v >= 0 ? '💵' : '💸' });
  }
  for (const m of fran.virtualMov || []) {
    const v = m.tipo === 'entra' ? m.valor : -m.valor;
    eventos.push({ fecha: m.fecha, titulo: m.concepto || (v >= 0 ? 'Entró' : 'Salió'), donde: 'Virtual', efecto: v, grupo: v >= 0 ? 'entro' : 'salio', icono: v >= 0 ? '💵' : '💸' });
  }
  // Igual que miPlata: efectivo y virtual se mueven por la cuenta; las tarjetas por su deuda.
  const enCaja = (cuenta) => (!cuenta || cuenta.startsWith('Tarjeta') ? 0 : 1);
  const enTarjeta = (cuenta, fecha) => {
    const i = tarjetaDeCuenta(tarjetas, cuenta || '');
    if (i < 0) return 0;
    if (tarjetas[i].fecha && fecha <= tarjetas[i].fecha) return 0; // ya va dentro del extracto
    return 1;
  };
  const nombreCuenta = (c) => (!c ? '' : (c === 'Efectivo' ? 'Efectivo' : (c.startsWith('Tarjeta') ? c : 'Virtual')));
  for (const a of fran.asientos || []) {
    if (a.libro === 'terceros') continue;
    const v = a.valor;
    const titulo = a.descripcion ? `${a.categoria} · ${a.descripcion}` : a.categoria;
    if (a.tipo === 'transferencia') {
      const efecto = -v * enCaja(a.cuenta) + v * enCaja(a.destino) - v * enTarjeta(a.cuenta, a.fecha) + v * enTarjeta(a.destino, a.fecha);
      if (!enCaja(a.cuenta) && !enCaja(a.destino) && !enTarjeta(a.cuenta, a.fecha) && !enTarjeta(a.destino, a.fecha)) continue;
      eventos.push({ fecha: a.fecha, titulo, donde: `${nombreCuenta(a.cuenta) || '¿?'} → ${nombreCuenta(a.destino) || '¿?'} · ${dineroTexto(v)}`, efecto, grupo: 'pases', icono: a.categoria });
      continue;
    }
    const signo = a.tipo === 'ingreso' ? 1 : -1;
    if (enCaja(a.cuenta)) eventos.push({ fecha: a.fecha, titulo, donde: nombreCuenta(a.cuenta), efecto: signo * v, grupo: signo > 0 ? 'entro' : 'salio', icono: a.categoria });
    else if (enTarjeta(a.cuenta, a.fecha)) eventos.push({ fecha: a.fecha, titulo, donde: a.cuenta, efecto: signo * v, grupo: signo > 0 ? 'abonoTarjeta' : 'tarjeta', icono: a.categoria });
  }
  const debiaTarjetas = partida.tarjetas.reduce((s, t) => s + t.valor, 0);
  const arranque = partida.efectivo + partida.virtual - debiaTarjetas;
  const sumaEventos = eventos.reduce((s, e) => s + e.efecto, 0);
  const hoy = miPlata(ctx);
  const sinCuadrar = hoy.total - (arranque + sumaEventos);
  const grupos = {};
  for (const e of eventos) (grupos[e.grupo] = grupos[e.grupo] || []).push(e);
  return { partida, debiaTarjetas, arranque, eventos, grupos, hoy, sinCuadrar };
}

function dineroTexto(v) {
  return String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
    <h1>${ICONO_3D[id] ? icono3d(id, 'fran-3d--28') : `<span class="fran-cuadro fran-cuadro--28" aria-hidden="true">${ui.esc(l.icono)}</span>`}<span>${ui.esc(texto || l.corto)}</span></h1>
    ${mes ? `<button type="button" class="fran-pildora fran-titulo__mes" data-elegir-mes aria-label="Elegir mes">${ui.esc(MESES_CORTOS[Number(mes.slice(5, 7)) - 1])}${mes.slice(0, 4) !== ctx.hoy().slice(0, 4) ? ` ${mes.slice(2, 4)}` : ''} <i aria-hidden="true">▾</i></button>` : ''}
  </header>`;
}

// ---------- Piezas del diseño Lila ----------

/** Monto con ⊕ o ⊖ delante. El número va siempre del color del texto. signo: 'mas', 'menos' o nada (⊖ solo si es negativo). */
/** Igual que conSigno, pero con el signo de pesos delante (para los números grandes de las tarjetas de color). */
function conPeso(valor, dinero, signo) {
  const clase = signo || (valor < 0 ? 'menos' : '');
  return `<span class="numero${clase ? ` fran-${clase}` : ''}"><i class="fran-peso">$</i>${dinero.formatear(Math.abs(valor))}</span>`;
}

function conSigno(valor, dinero, signo) {
  const clase = signo || (valor < 0 ? 'menos' : '');
  return `<span class="numero${clase ? ` fran-${clase}` : ''}">${dinero.formatear(Math.abs(valor))}</span>`;
}

/** Tarjeta de saldo: la única en degradado de cada pantalla. cajas: [etiqueta, valor (número o texto), signo]. */
function heroe({ etiqueta, valor, cajas = [], ruta = '', ayudaTexto = '', ilustracion = '' }, ctx) {
  const { ui, dinero } = ctx;
  const grande = typeof valor === 'number' ? conPeso(valor, dinero) : `<span>${ui.esc(valor)}</span>`;
  const cajitas = cajas.length ? `<span class="fran-heroe__cajas${cajas.length === 4 ? ' fran-heroe__cajas--cuatro' : ''}">${cajas.map(([t, v, signo, enlace]) => {
    const dentro = `<small>${ui.esc(t)}</small>${typeof v === 'number' ? conPeso(v, dinero, signo) : `<span>${ui.esc(v)}</span>`}`;
    return enlace && !ruta ? `<a href="${ui.esc(enlace)}">${dentro}</a>` : `<span>${dentro}</span>`;
  }).join('')}</span>` : '';
  const etiquetaHtml = `<span class="fran-heroe__etiqueta"><small>${ui.esc(etiqueta)}</small>${ayudaTexto && !ruta ? ayuda(ayudaTexto, ui) : ''}</span>`;
  const interior = `${ilustracion ? icono3d(ilustracion, 'fran-heroe__3d') : ''}${etiquetaHtml}<strong class="fran-heroe__valor">${grande}</strong>${cajitas}`;
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
function renglon({ ruta, icono, texto, sub = '', derecha = '', contador = 0, icono3 = '' }, ui) {
  return `<a href="${ui.esc(ruta)}" class="fran-renglon">
    ${icono3 ? icono3d(icono3, 'fran-3d--40') : icono3dDe(icono)}
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

function fila({ icono, titulo: t, sub, derecha, clase = '', ruta, ui, ver, icono3 = '' }) {
  const interior = `${icono3 ? icono3d(icono3, 'fran-3d--40 fran-ico--3d') : icono3dDe(icono)}
    <span class="fran-fila__texto"><strong>${ui.esc(t)}</strong>${sub ? `<small>${ui.esc(sub)}</small>` : ''}</span>
    <span class="fran-fila__valor numero ${clase}">${ui.esc(clase ? String(derecha).replace(/^[+−-]\s*/, '') : derecha)}</span>`;
  if (ver) return `<div class="fran-fila" role="button" tabindex="0" data-ver="${ui.esc(ver)}">${interior}</div>`;
  return ruta ? `<a class="fran-fila" href="${ui.esc(ruta)}">${interior}</a>` : `<div class="fran-fila">${interior}</div>`;
}

/** Título de sección como en la referencia: icono 3D pequeño, texto y una línea que se desvanece. */
function seccion(texto, icono3 = 'lista') {
  return `<p class="fran-seccion fran-seccion--yo">${icono3d(icono3, 'fran-3d--28')}${texto}<i></i></p>`;
}

/** Lo más nuevo primero: por fecha y, el mismo día, lo último que ella anotó arriba (pedido el 9 nov 2026). */
function nuevosPrimero(lista) {
  return lista.map((x, i) => [x, i]).sort(([a, i], [b, j]) => (b.fecha || '').localeCompare(a.fecha || '') || String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')) || j - i).map(([x]) => x);
}

function listaPorDia(lista, ctx) {
  const { ui, dinero } = ctx;
  const orden = nuevosPrimero(lista);
  const dias = new Map();
  for (const a of orden) { if (!dias.has(a.fecha)) dias.set(a.fecha, []); dias.get(a.fecha).push(a); }
  let html = '';
  for (const [dia, filas] of dias) {
    const g = sumar(deTipo(filas, 'gasto'));
    const i = sumar(deTipo(filas, 'ingreso'));
    html += `<div class="fran-dia"><span>${ui.esc(fechaLinda(dia, ctx))}</span><span>${g ? `G: <b class="numero">${dinero.formatear(g)}</b> ` : ''}${i ? `I: <b class="numero">${dinero.formatear(i)}</b>` : ''}</span></div>`;
    for (const a of filas) {
      const signo = a.tipo === 'ingreso' ? '+' : (a.tipo === 'gasto' ? '−' : '');
      html += fila({ ui, ver: a.id, icono: LOGO_RED[norm(a.categoria)] ? a.categoria : iconoDe(a.categoria), titulo: a.categoria, sub: [a.propiedad, a.descripcion].filter(Boolean).join(' · '), derecha: `${signo}${dinero.formatear(a.valor)}`, clase: a.tipo === 'ingreso' ? 'fran-mas' : (a.tipo === 'gasto' ? 'fran-menos' : '') });
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

/**
 * "Mi plata" día por día, desde el saldo inicial (o el primero del mes) hasta hoy: los datos reales
 * de la gráfica de Inicio. Máximo 31 días.
 */
export function historiaPlata(ctx) {
  const hoy = ctx.hoy();
  const iniciales = ctx.datos.estado.movimientos.filter((m) => m.tipo === 'saldo_inicial').map((m) => m.fecha).sort();
  // Siempre los últimos 14 días, para que la gráfica tenga forma aunque el mes vaya empezando.
  const limite = ctx.fechas.sumarDias(hoy, -13);
  let desde = iniciales[0] && iniciales[0] < limite ? limite : limite;
  const serie = [];
  for (let f = desde; f <= hoy; f = ctx.fechas.sumarDias(f, 1)) serie.push({ fecha: f, valor: miPlata(ctx, f).total });
  return serie;
}

/** Gráfica con los días reales: barras en oscuro (como el brief) y línea con puntos en claro. */
function graficaPlata(serie) {
  if (serie.length < 2) return '';
  const oscuro = typeof document !== 'undefined' && document.documentElement.dataset.modo !== 'claro';
  if (oscuro) {
    const vals = serie.map((p) => p.valor);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const n = Math.min(serie.length, 14);
    const ultimos = serie.slice(-n);
    const ancho = 300; const alto = 72; const hueco = 6;
    const w = (ancho - hueco * (n - 1)) / n;
    const h = (v) => (max === min ? alto * 0.55 : 14 + ((v - min) / (max - min)) * (alto - 14));
    return `<svg class="fran-panel__grafica" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img" aria-label="Mi plata día por día">
      <defs><linearGradient id="fran-barra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#3B82F6" stop-opacity=".75"/></linearGradient></defs>
      ${ultimos.map((p, i) => { const hh = h(p.valor); return `<rect x="${(i * (w + hueco)).toFixed(1)}" y="${(alto - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="4" fill="url(#fran-barra)" class="fran-barra-dia" style="--i:${i}"${i === n - 1 ? ' filter="url(#fran-glow)"' : ''}/>`; }).join('')}
      <filter id="fran-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </svg>`;
  }
  const vals = serie.map((p) => p.valor);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const alto = 64;
  const ancho = 300;
  const x = (i) => 6 + (i * (ancho - 12)) / (serie.length - 1);
  const y = (v) => (max === min ? alto / 2 : 8 + (1 - (v - min) / (max - min)) * (alto - 16));
  const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`);
  const area = `M${puntos[0]} L${puntos.join(' L')} L${x(serie.length - 1).toFixed(1)},${alto} L${x(0).toFixed(1)},${alto} Z`;
  const ultimo = serie.length - 1;
  return `<svg class="fran-panel__grafica" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img" aria-label="Mi plata día por día">
    <defs><linearGradient id="fran-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#fran-area)"/>
    <polyline points="${puntos.join(' ')}" fill="none" stroke="#9BE7FF" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${serie.map((p, i) => (serie.length <= 12 || i % Math.ceil(serie.length / 8) === 0 || i === ultimo ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="3.2" fill="#fff" class="fran-panel__punto"/>` : '')).join('')}
  </svg>`;
}

/** Iconos 3D de una misma familia (Fluent Emoji, MIT), guardados en la app para que sirvan sin internet. */
const ICONO_3D = {
  personal: 'billetera', prestamos: 'banco', pension: 'alcancia', productos: 'portatil', arriendos: 'edificio',
  redes: 'personas', terceros: 'manos', efectivo: 'billete', virtual: 'celular', tarjetas: 'tarjeta',
  ganancia: 'grafica', credito: 'clasico', liquidez: 'bolsa',
};
// En la referencia, los iconos de renglones y tarjetas son azules; los de los libros conservan su color.
const AZULES_3D = new Set(['carpeta', 'reloj', 'repetir', 'nube', 'candado', 'mundo', 'info', 'celular', 'calendario', 'tabla', 'recibo', 'lista', 'documento', 'porcentaje', 'personas', 'grafica', 'billete', 'tarjeta', 'clasico', 'engranaje']);
const LIBROS_3D = new Set(['personal', 'prestamos', 'pension', 'productos', 'arriendos', 'redes', 'terceros', 'efectivo', 'virtual', 'tarjetas', 'ganancia', 'liquidez', 'credito']);
function icono3d(clave, clase = '') {
  const archivo = ICONO_3D[clave] || clave;
  const azul = AZULES_3D.has(archivo) && !LIBROS_3D.has(clave);
  return `<img class="fran-3d ${clase}" src="iconos/3d/${archivo}${azul ? '-azul' : ''}.png" alt="" aria-hidden="true" decoding="async">`;
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
  const tarjetaLibro = (id, chica, n) => `<a href="#/libro/${id}" class="fran-modulo${chica ? ' fran-modulo--chico' : ''} fran-entra" style="--i:${n}">
    ${id === 'redes' ? `<span class="fran-redes-mini" aria-hidden="true">${['Facebook', 'YouTube', 'TikTok', 'Instagram'].map((r) => logoRed(r)).join('')}</span>` : icono3d(id, chica ? 'fran-3d--48' : 'fran-3d--64')}
    <span class="fran-modulo__nombre">${ui.esc(LIBROS[id].enInicio)}</span>
    <span class="fran-modulo__valor">${typeof valorDe[id] === 'number' ? conSigno(valorDe[id], dinero) : ui.esc(valorDe[id])}</span>
    ${chica ? '' : '<span class="fran-modulo__ir" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'}
  </a>`;
  const ganadoHoy = sumar(entradas.filter((a) => a.fecha === ctx.hoy()));
  const hayAviso = hoyAgenda.length || avisoAnotar;
  const serie = sinDatos ? [] : historiaPlata(ctx);
  const metrica = (clave, nombre, valor, signo, ruta, n, extra = '') => `<a href="${ruta}" class="fran-metrica fran-metrica--${clave} fran-entra" style="--i:${n}">
    ${icono3d(clave, 'fran-3d--40')}
    <span class="fran-metrica__texto"><small>${ui.esc(nombre)}</small><b>${typeof valor === 'number' ? conSigno(valor, dinero, signo) : ui.esc(valor)}</b>${extra ? `<small>${ui.esc(extra)}</small>` : ''}</span>
  </a>`;

  const principal = ui.el(`<div class="fran-principal fran-tablero">
    <header class="fran-hola">
      <div><small>Hola,</small><h1>Fran</h1></div>
      ${libretaBoton(ctx)}
      <span class="fran-hola__botones"><button type="button" class="fran-campana" data-modo-cambiar aria-label="Cambiar entre claro y oscuro"></button><button type="button" class="fran-campana" data-apariencia aria-label="Apariencia: temas y letra"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.7a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg></button>
      <a href="#/agenda" class="fran-campana" aria-label="Avisos y cobros de hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>${hoyAgenda.length ? `<b class="fran-campana__numero">${hoyAgenda.length}</b>` : (hayAviso ? '<i></i>' : '')}</a></span>
    </header>
    <section class="fran-panel fran-entra" style="--i:0">
      <span class="fran-panel__etiqueta"><small>${plata.total < 0 ? 'Mi plata hoy · me hace falta' : 'Mi plata hoy · debo tener'}</small>${ayuda('Es efectivo más virtual, menos lo que debo en tarjetas. Si sale con ⊖, es lo que me hace falta. La línea muestra cómo ha ido día por día.', ui)}</span>
      <strong class="fran-panel__valor">${conPeso(plata.total, dinero)}${serie.length >= 2 ? `<span class="fran-panel__tendencia ${serie[serie.length - 1].valor >= serie[serie.length - 2].valor ? 'sube' : 'baja'}" aria-label="${serie[serie.length - 1].valor >= serie[serie.length - 2].valor ? 'Subió desde ayer' : 'Bajó desde ayer'}"><svg viewBox="0 0 24 24"><path d="M4 16l6-6 4 4 6-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''}</strong>
      ${graficaPlata(serie)}
      ${serie.length >= 2 ? `<span class="fran-panel__pie"><small>${ui.esc(fechas.formatear(serie[0].fecha).replace(/ \d{4}$/, ''))}</small><small>Hoy</small></span>` : ''}
      <a href="#/mi-plata" class="fran-panel__boton">Ver detalles <span aria-hidden="true">→</span></a>
    </section>
    <div class="fran-metricas">
      ${metrica('efectivo', 'Efectivo', plata.efectivo, '', '#/efectivo', 1)}
      ${metrica('virtual', 'Virtual', fran.virtualPorDefinir ? 'por confirmar' : plata.virtual, '', '#/virtual', 2)}
      ${metrica('tarjetas', 'Tarjetas', -plata.tarjetas, '', '#/tarjetas', 3)}
      ${metrica('ganancia', 'Ganancia hoy', ganadoHoy, ganadoHoy ? 'mas' : '', '#/ganancias', 4, `En ${fechas.nombreMes(Number(mesHoy.slice(5, 7))).toLowerCase()}: ${dinero.formatear(gananciaMes)}`)}
    </div>
    ${sinDatos ? `<a href="#/ajustes" class="fran-aviso">Todavía no están tus datos en este aparato. Toca aquí y entra a la nube con tu correo.</a>` : ''}
    ${avisoAnotar ? renglon({ ruta: '#/libro/personal/agregar/gasto', icono: '📝', texto: 'Hoy no has anotado nada' }, ui) : ''}
    <p class="fran-tablero__titulo">Mis libros</p>
    <div class="fran-libros">${['personal', 'prestamos', 'pension', 'productos'].map((id, n) => tarjetaLibro(id, false, n + 5)).join('')}</div>
    <div class="fran-libros-chicos">${['arriendos', 'redes', 'terceros'].map((id, n) => tarjetaLibro(id, true, n + 9)).join('')}</div>
    ${(fran.creditos || []).map((c) => { const ec = estadoCredito(c); return `<a href="#/credito/${encodeURIComponent(c.id)}" class="fran-fila-tablero fran-entra" style="--i:12">${icono3d('credito', 'fran-3d--48')}<span class="fran-renglon__texto"><span>${ui.esc(c.nombre)}</span><small>Negocio aparte · en el banco ${dinero.formatear(ec.enBanco)}</small></span><b>${conSigno(-ec.deboBanco, dinero)}</b><span class="fran-flecha" aria-hidden="true">›</span></a>`; }).join('')}
    ${sinDatos ? '' : `<a href="#/liquidez" class="fran-fila-tablero fran-fila-tablero--liquidez fran-entra" style="--i:13">${icono3d('liquidez', 'fran-3d--48')}<span class="fran-renglon__texto"><span>Liquidez real</span><small>Toda la plata que puedo mover hoy</small></span><b>${conSigno(fondosLiquidez(ctx, tasaDolar(fran)).total, dinero)}</b><span class="fran-flecha" aria-hidden="true">›</span></a>`}
  </div>`);
  if (!sinDatos) traerDolar(ctx.hoy()).catch(() => {});
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
    ${seccion('Por negocio', 'grafica')}
    <div class="fran-lista">${NEGOCIOS.map((id) => [id, sumar(enMes.filter((a) => a.libro === id))]).filter((x) => x[1]).map(([id, v]) => fila({ ui, icono: LIBROS[id].icono, titulo: LIBROS[id].corto, derecha: `+${dinero.formatear(v)}`, clase: 'fran-mas', ruta: `#/libro/${id}` })).join('') || '<p class="fran-vacio">Sin ganancias este mes.</p>'}</div>
    <form class="fran-campos fran-campos--grande" novalidate>
      <label><small>Saqué para mí</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
      <button class="boton boton--primario fran-guardar">Anotar</button>
    </form>
    ${seccion('Día a día', 'calendario')}
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
    ${heroe({ etiqueta: `Saldo de ${fechas.nombreMes(Number(mes.slice(5, 7))).toLowerCase()}`, valor: saldo, cajas: [['Gastos', g, 'menos', `#/libro/${id}/graficos`], ['Ingresos', i, 'mas', `#/libro/${id}/graficos`]] }, ctx)}
    ${id === 'personal' ? tarjetaDona(deTipo(m, 'gasto'), ctx) : ''}
    ${id === 'arriendos' ? '<a class="fran-boton-secundario fran-boton--emoji" href="#/libro/arriendos/propiedades"><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">🏢</span>Cuánto dio cada propiedad</a>' : ''}
    ${avisoSinDetalle(m)}
    ${m.length ? `<div class="fran-lista">${listaPorDia(m, ctx)}</div>` : vacioConSalto(lista, ctx, 'No hay movimientos en este mes.')}
  </div>`);
  // Tocar Gastos o Ingresos lleva a Gráficos con ese tipo ya elegido.
  raiz.querySelectorAll('.fran-heroe__cajas a').forEach((a, n) => a.addEventListener('click', () => { vista.tipo = n === 0 ? 'gasto' : 'ingreso'; }));
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
    ...prestamos.map((p) => ({ fecha: p.fecha, creadoEn: p.creadoEn, icono: '💵', titulo: nombreCliente(ctx, p.clienteId), sub: 'Nuevo préstamo', valor: -p.capital, ruta: `#/cliente/${encodeURIComponent(p.clienteId)}` })),
    ...pagos.map((g) => ({ fecha: g.fecha, creadoEn: g.creadoEn, icono: g.capital && !g.interes ? '↩️' : '💵', titulo: nombreCliente(ctx, g.clienteId), sub: [g.interes ? `${dinero.formatear(g.interes)} int` : '', g.capital ? `${dinero.formatear(g.capital)} capital` : ''].filter(Boolean).join(' · '), valor: g.monto, ruta: `#/cliente/${encodeURIComponent(g.clienteId)}` })),
    ...filasDeAsientos(delMes(lista, mes), dinero),
  ];
  const movimientosOrden = nuevosPrimero(movimientos);

  const pastilla = (t, n, clase) => `<a href="#/clientes" class="fran-pastilla ${clase}"><i></i>${ui.esc(t)} ${n}</a>`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/inicio', '', mes)}
    ${heroe({ etiqueta: 'Cartera', valor: cartera.valor, ilustracion: 'documento', ayudaTexto: cartera.provisional ? 'La cartera sale "por confirmar" porque hay préstamos del Excel sin tasa o sin fecha. Cuando se confirmen, aquí sale el número.' : '', cajas: [
      ['Ganancia del mes', intereses, 'mas'],
      ['Presté', prestamos.reduce((s, p) => s + p.capital, 0), 'menos'],
      ['Cobré capital', estado.pagos.length || abonos.length ? capital : 'Sin datos', 'mas'],
    ] }, ctx)}
    ${cartera.provisional ? `<div class="fran-renglon fran-renglon--dato">${icono3d('recibo', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Capital anotado: <b>${dinero.formatear(cartera.r.capitalEnCalle)}</b></span></span></div>` : ''}
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
      <a href="#/clientes">${icono3d('personas', 'fran-3d--40')}Clientes<i class="fran-ajuste__flecha" aria-hidden="true"></i></a>
      <a href="#/agenda">${icono3d('calendario', 'fran-3d--40')}Agenda de cobros<i class="fran-ajuste__flecha" aria-hidden="true"></i></a>
      <a href="#/libro/prestamos/tabla" class="fran-accesos__ancho">${icono3d('tabla', 'fran-3d--40')}Tabla de préstamos, como en el Excel<i class="fran-ajuste__flecha" aria-hidden="true"></i></a>
    </div>
    ${seccion('Movimientos del mes', 'grafica')}
    ${avisoSinDetalle(delMes(lista, mes))}
    <div class="fran-lista fran-lista--tarjetas">${movimientosOrden.map((x) => fila({ ui, icono: x.icono, icono3: x.valor < 0 ? 'billete' : 'recibo', titulo: x.titulo, sub: x.sub, derecha: `${x.valor < 0 ? '−' : '+'}${dinero.formatear(Math.abs(x.valor))}`, clase: x.valor < 0 ? 'fran-menos' : 'fran-mas', ruta: x.ruta })).join('') || vacioConSalto(lista, ctx, 'No hay movimientos en este mes.')}</div>
  </div>`);
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

function renderProductos(contenedor, ctx, redibujar) {
  const { ui, dinero, fechas } = ctx;
  const lista = delLibro(asientos(ctx), 'productos');
  const mes = mesVisible(ctx, lista);
  const m = delMes(lista, mes);
  const meti = sumar(deTipo(m, 'gasto').filter((a) => !a.enPago && a.categoria !== 'Inversiones'));
  const vendi = sumar(deTipo(m, 'ingreso'));
  // Lo que está en inventario o en inversiones no es pérdida: solo restan los gastos del negocio.
  const gastosProductos = sumar(deTipo(m, 'gasto').filter((a) => a.categoria === 'Gasto de productos'));
  // Ganancia real de una venta: lo que se vendió menos lo que costó el producto (campo costo de la venta).
  const costoVendido = deTipo(m, 'ingreso').reduce((t, a) => t + (Number(a.costo) || 0), 0);
  const inventario = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inventario sin vender');
  const inversiones = lista.filter((a) => a.tipo === 'gasto' && a.categoria === 'Inversiones');
  const vendido = nuevosPrimero(deTipo(lista, 'ingreso'));
  const plegado = (icono, titulo, sub, total, cuerpo) => `<details class="fran-tachados fran-prestado-pension"><summary>${icono3dDe(icono, 'fran-3d--40')}<span class="fran-renglon__texto"><span>${ui.esc(titulo)}</span><small>${ui.esc(sub)}</small></span><b class="numero">${dinero.formatear(total)}</b></summary><div class="fran-lista">${cuerpo}</div></details>`;
  const filas = (l, signo) => l.map((a) => fila({ ui, ver: a.id, icono: iconoDe(a.categoria), titulo: (a.descripcion || a.categoria).split(' · ')[0], sub: [a.textoFecha || fechas.formatear(a.fecha), a.costo ? `costó ${dinero.formatear(a.costo)} · ganancia ${dinero.formatear(a.valor - a.costo)}` : ''].filter(Boolean).join(' · '), derecha: `${signo}${dinero.formatear(a.valor)}`, clase: signo === '+' ? 'fran-mas' : '' })).join('');
  const raiz = ui.el(`<div>
    ${titular('productos', ctx, '#/inicio', '', mes)}
    ${heroe({ etiqueta: 'Productos sin vender', valor: invertidoProductos(lista), ayudaTexto: 'Lo que costaron los productos que todavía no se han vendido. Las inversiones (PC, busos, Uber, carro) van aparte: no son productos para vender.', cajas: [['Metí yo', meti, 'menos'], ['Vendí', vendi, 'mas'], ['Ganancia', vendi - costoVendido - gastosProductos]] }, ctx)}
    ${costoVendido ? `<p class="fran-nota">La ganancia del mes es lo vendido menos lo que costó: ${dinero.formatear(vendi)} − ${dinero.formatear(costoVendido)}.</p>` : ''}
    ${plegado('📦', 'Inventario', `${inventario.length} ${inventario.length === 1 ? 'producto' : 'productos'} sin vender`, sumar(inventario.filter((a) => !a.enPago)), filas(inventario, '') || '<p class="fran-vacio">Sin inventario.</p>')}
    ${inversiones.length ? plegado('📈', 'Inversiones', `${inversiones.length} · no son para vender`, sumar(inversiones), filas(inversiones, '')) : ''}
    ${plegado('💰', 'Vendido', vendido.length ? `${vendido.length} ${vendido.length === 1 ? 'venta' : 'ventas'}` : 'Todavía sin ventas', sumar(vendido), filas(vendido, '+') || '<p class="fran-vacio">Todavía sin ventas.</p>')}
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
  // Las cuentas en dólares van juntas en un renglón; al tocarlo se ven una por una.
  const usdTotal = p.cuentas.reduce((t, c) => t + c.usd, 0);
  const pesosDolares = p.cuentas.reduce((t, c) => t + Math.round(c.usd * p.tasa), 0);
  // El dólar de hoy contra la tasa a la que ella compró (pedido el 6 nov 2026).
  const hoyDolar = tasaDolar(fran);
  const diferenciaDolar = Math.round(usdTotal * hoyDolar.valor) - pesosDolares;
  const raiz = ui.el(`<div>
    ${titular('pension', ctx, '#/inicio')}
    ${heroe({ etiqueta: 'Total pensión', valor: totalPension(fran), ayudaTexto: `Los dólares están contados a ${dinero.formatear(p.tasa)}, la tasa a la que los compraste.${p.origen ? ` Origen: ${p.origen.charAt(0).toLowerCase() + p.origen.slice(1)}.` : ''}`, cajas: hoyDolar.fuente === 'internet' ? [['Dólares a la tasa de hoy', pesosDolares + diferenciaDolar], [diferenciaDolar < 0 ? 'Perdería hoy' : 'Ganaría hoy', diferenciaDolar, diferenciaDolar < 0 ? 'menos' : 'mas']] : [] }, ctx)}
    ${hoyDolar.fuente === 'internet' ? `<p class="fran-nota">Dólar: compraste a ${dinero.formatear(p.tasa)} · hoy está a ${dinero.formatear(hoyDolar.valor)} (${diferenciaDolar < 0 ? 'pierdes' : 'ganas'} ${dinero.formatear(Math.abs(hoyDolar.valor - p.tasa))} por dólar).</p>` : '<p class="fran-nota">Sin la tasa de hoy: falta internet.</p>'}
    <button type="button" id="fran-tasa" class="fran-pildora">Compré a ${dinero.formatear(p.tasa)} ✏️</button>
    <form id="fran-tasa-form" class="fran-tasa oculto"><input name="tasa" inputmode="numeric" value="${ui.esc(p.tasa)}" aria-label="Tasa del día"><button class="boton boton--primario">Guardar</button></form>
    ${p.cuentas.length ? `<details class="fran-tachados fran-prestado-pension">
      <summary>${icono3d('billete', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Dinero en dólares</span><small>${ui.esc(String(Math.round(usdTotal * 100) / 100).replace('.', ','))} USD · comprados a ${dinero.formatear(p.tasa)}${hoyDolar.fuente === 'internet' ? ` · hoy valen ${dinero.formatear(pesosDolares + diferenciaDolar)}` : ''}</small></span><b class="numero">${dinero.formatear(pesosDolares)}</b></summary>
      <div class="fran-lista">${p.cuentas.map((c) => filaPension({ icono: '💵', titulo: c.nombre, pesos: Math.round(c.usd * p.tasa), usd: c.usd }, ctx)).join('')}</div>
    </details>` : ''}
    ${otrosPropios.map((o) => {
      // Con descripción (como el carro), el renglón se abre al tocarlo.
      const cabeza = `${icono3d(/carro/i.test(o.nombre) ? 'carro' : 'billetera', 'fran-3d--40')}<span class="fran-renglon__texto"><span>${ui.esc(o.nombre)}</span>${o.nota || o.detalle ? `<small>${ui.esc(o.nota || 'Toca para ver la descripción')}</small>` : ''}</span><b class="numero">${dinero.formatear(o.cop)}</b>`;
      return o.detalle
        ? `<details class="fran-tachados fran-prestado-pension"><summary>${cabeza}</summary><p class="fran-pension-detalle">${ui.esc(o.detalle)}</p></details>`
        : `<div class="fran-tachados fran-prestado-pension fran-pension-fija">${cabeza}</div>`;
    }).join('')}
    ${prestados.length ? `<details class="fran-tachados fran-prestado-pension">
      <summary>${icono3d('manos', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Prestado de la pensión</span><small>Toca para ver a quién</small></span><b class="numero">${dinero.formatear(prestados.reduce((s, o) => s + o.cop, 0))}</b></summary>
      <div class="fran-lista">${prestados.map((o) => filaPension({ icono: esDelNegocio(o) ? '🏦' : '🤝', titulo: esDelNegocio(o) ? 'Lo debe el negocio de préstamos' : o.nombre.replace(/^Prestado a /i, ''), sub: esDelNegocio(o) ? 'Lorena lo devolvió y se volvió a prestar. El negocio se lo debe a la pensión.' : o.nota, pesos: o.cop }, ctx)).join('')}</div>
    </details>` : ''}
    ${!p.cuentas.length ? '<p class="fran-vacio">Todavía no están tus cuentas en este aparato.</p>' : ''}
  </div>`);
  const form = raiz.querySelector('#fran-tasa-form');
  raiz.querySelector('#fran-tasa').addEventListener('click', () => form.classList.toggle('oculto'));
  traerDolar(ctx.hoy()).then((t) => { if (t.valor !== hoyDolar.valor && document.body.contains(raiz)) { contenedor.innerHTML = ''; renderPension(contenedor, ctx); } }).catch(() => {});
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tasa = Number(String(form.tasa.value).replace(/\D/g, ''));
    if (!(tasa > 0)) { ui.toast('Escribe una tasa válida.'); return; }
    await datos.actualizarFran({ pension: { ...p, tasa } });
    ui.toast('Tasa de compra guardada.');
  });
  contenedor.append(raiz);
}

/** Fila de la pensión: pesos en grande y dólares pequeños debajo, igual en todas. */
function filaPension({ icono, titulo: t, sub = '', pesos, usd = null }, ctx) {
  const { ui, dinero } = ctx;
  return `<div class="fran-fila">
    ${icono3dDe(icono)}
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
      ${icono3dDe(cat)}
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
    <div class="fran-detalles__cabeza">${icono3dDe(a.categoria, 'fran-3d--64')}<strong>${ui.esc(a.categoria)}</strong></div>
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
    const ordenada = vista.orden === 'cantidad' ? [...lista].sort((a, b) => b.valor - a.valor) : nuevosPrimero(lista);
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
        ${icono3dDe(a.categoria)}
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
    <div class="fran-heroe fran-heroe--informes">
      ${icono3d('grafica', 'fran-heroe__3d fran-heroe__3d--izq')}
      <span class="fran-heroe__etiqueta"><small>Saldo ${anio === 'todo' ? 'total' : anio}</small></span>
      <strong class="fran-heroe__valor"><span class="numero${ti - tg < 0 ? ' fran-menos' : ''}"><i class="fran-peso">$</i>${dinero.formatear(Math.abs(ti - tg))}</span></strong>
      <span class="fran-heroe__cajas"><span>${icono3d('billetera', 'fran-3d--28')}<span class="fran-heroe__caja-texto"><small>Gastos</small><span class="numero"><i class="fran-peso">$</i>${dinero.formatear(tg)}</span></span></span><span>${icono3d('grafica', 'fran-3d--28')}<span class="fran-heroe__caja-texto"><small>Ingresos</small><span class="numero"><i class="fran-peso">$</i>${dinero.formatear(ti)}</span></span></span></span>
    </div>
    <div class="fran-anios">
      <button type="button" data-anio="todo" class="${anio === 'todo' ? 'activo' : ''}">Todo</button>
      ${anios.map((a) => `<button type="button" data-anio="${a}" class="${a === anio ? 'activo' : ''}">${a}</button>`).join('')}
    </div>
    <div class="fran-tabla-premium">
      <div class="fran-tabla-premium__cabeza"><span>${icono3d('calendario', 'fran-3d--28')}${anio === 'todo' ? 'Año' : 'Mes'}</span><span>${icono3d('billetera', 'fran-3d--28')}Gastos</span><span>${icono3d('grafica', 'fran-3d--28')}Ingresos</span><span>${icono3d('tabla', 'fran-3d--28')}Saldo</span></div>
      ${claves.map((k) => { const m2 = totalLista.filter((a) => a.fecha.startsWith(k)); const g = sumar(deTipo(m2, 'gasto')); const i2 = sumar(deTipo(m2, 'ingreso')); if (!g && !i2) return ''; const nombre = anio === 'todo' ? k : fechas.nombreMes(Number(k.slice(5)), true); return `<button type="button" class="fran-tabla-premium__fila" data-fila="${ui.esc(k)}"><span class="fran-tabla-premium__mes">${ui.esc(nombre)} <i>›</i></span><span class="numero">${dinero.formatear(g)}</span><span class="numero">${dinero.formatear(i2)}</span><span class="numero ${i2 - g < 0 ? 'fran-menos' : ''}">${dinero.formatear(Math.abs(i2 - g))}</span><i class="fran-ajuste__flecha" aria-hidden="true"></i></button>`; }).join('')}
    </div>
    <div class="fran-renglon fran-renglon--dato">${icono3d('info', 'fran-3d--28')}<span class="fran-renglon__texto"><span>Toca ${anio === 'todo' ? 'un año' : 'un mes'} para ver su detalle.</span></span></div>
    ${id === 'personal' ? `
      ${seccion('Presupuesto mensual', 'grafica')}
      ${selectorMes(mes, ctx)}
      <div class="fran-tarjeta">
        <small>Presupuesto</small><strong class="numero">${dinero.formatear(presupuesto)}</strong>
        <small>Gastos ${dinero.formatear(gastosMes)} · Restante ${dinero.formatear(restante)}</small>
        <form id="fran-presu" class="fran-tasa"><input name="presu" inputmode="numeric" placeholder="Cambiar presupuesto" aria-label="Presupuesto mensual"><button class="boton boton--pequeno boton--secundario">Guardar</button></form>
      </div>
      ${renglon({ ruta: '#/libro/personal/calendario', icono: '📅', icono3: 'calendario', texto: 'Ver calendario' }, ui)}` : ''}
    ${id === 'prestamos' ? `${renglon({ ruta: '#/libro/prestamos/personas', icono: '💵', icono3: 'personas', texto: 'Quién me pagó' }, ui)}${renglon({ ruta: '#/caja', icono: '🧾', icono3: 'recibo', texto: 'Caja efectivo y virtual' }, ui)}` : ''}
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
  // Arriendos (ingreso) y Redes muestran solo lo de hoy: las propiedades y las redes. Lo viejo sigue en el historial.
  const soloFijas = (id === 'arriendos' && clave === 'ingreso' && fijas.length) || id === 'redes';
  const todas = [...new Set(soloFijas ? [...fijas, ...base, ...extra] : [...fijas, ...usadas, ...extra, ...base])].filter((c) => !/total del mes|resto sin|^casas del mes$|^arriendos del mes$|sin decir piso|^laguna y prado$/i.test(c));
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
  const propiedades = datos.estado.fran.propiedades || [];
  const pidePropiedad = id === 'arriendos' && tipo === 'gasto' && propiedades.length > 0;
  let propiedadElegida = null;
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
        ${pidePropiedad ? `<p class="fran-seccion fran-agregar__paso">¿Para qué propiedad?</p>
        <div class="fran-iconos fran-iconos--prop">${propiedades.map((p) => `<button type="button" data-prop="${ui.esc(p.nombre)}"><span>${iconoPropiedad(p, 'fran-3d--48')}</span><small>${ui.esc(p.nombre)}</small></button>`).join('')}</div>
        <p class="fran-seccion fran-agregar__paso oculto" data-paso-cat>¿De qué fue el gasto?</p>` : ''}
        <div class="fran-iconos${pidePropiedad ? ' oculto' : ''}" data-grilla-cat>${categorias.map((c, i) => `<button type="button" class="${i >= 11 ? 'fran-mas-cat oculto' : ''}" data-cat="${ui.esc(c)}"><span>${iconoCategoria(c, id, datos.estado.fran, 'fran-3d--48')}</span><small>${ui.esc(c.replace(' públicos', ''))}</small></button>`).join('')}
          <button type="button" data-ver-mas><span>＋</span><small>Más</small></button>
          <button type="button" class="fran-mas-cat oculto" data-nueva><span>${icono3dDe('✎', 'fran-3d--48')}</span><small>Nueva</small></button>
          <a class="fran-mas-cat oculto" href="#/ajustes/categorias"><span>${icono3dDe('⚙️', 'fran-3d--48')}</span><small>Categorías</small></a></div>`}
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

  raiz.querySelectorAll('[data-prop]').forEach((b) => b.addEventListener('click', () => {
    propiedadElegida = b.dataset.prop;
    raiz.querySelectorAll('[data-prop]').forEach((x) => x.classList.toggle('activo', x === b));
    raiz.querySelector('[data-grilla-cat]').classList.remove('oculto');
    raiz.querySelector('[data-paso-cat]').classList.remove('oculto');
    setTimeout(() => raiz.querySelector('[data-paso-cat]').scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  }));
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
    if (pidePropiedad && !propiedadElegida) { ui.toast('Elige la propiedad.'); return; }
    const fecha = campoFecha.value || hoy;
    try {
      const asiento = await datos.agregarAsiento({ libro: id, fecha, tipo, categoria: esTransfer ? 'Transferencia' : (categoriaNueva || elegida), descripcion: nota.value, valor, cuenta, destino, conFoto: !!foto, propiedad: propiedadElegida || '' });
      if (notaDeLibreta) { await marcarNotaPasada(ctx, notaDeLibreta); notaDeLibreta = null; }
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

  if (textoDeLibreta && texto) { texto.value = textoDeLibreta; textoDeLibreta = ''; }
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

/** Nombres del historial de préstamos (Excel) que no son de ningún cliente con ficha. */
function nombresSinFicha(estado) {
  const vistos = new Map();
  for (const a of estado.fran.asientos || []) {
    if (a.libro !== 'prestamos' || a.clienteId || !a.persona) continue;
    const n = norm(a.persona);
    if (!n || vistos.has(n)) continue;
    vistos.set(n, a.persona.trim());
  }
  return [...vistos.values()].filter((p) => !estado.clientes.some((c) => personaEsDe(p, c, estado.clientes)));
}

/** El campo Cliente: se escribe la inicial y salen los que coinciden. El + abre la ficha de uno nuevo. */
function conectarBuscaCliente(raiz, form, clientes, delHistorial, alCambiar, ui) {
  const buscar = form.elements.buscar;
  const oculto = form.elements.cliente;
  const lista = raiz.querySelector('.fran-buscacliente__lista');
  const mas = raiz.querySelector('[data-nuevo]');
  const nuevo = raiz.querySelector('#campo-nombre');
  const empieza = (texto, q) => palabrasDe(norm(texto)).some((w) => w.startsWith(q)) || norm(texto).startsWith(q);
  const elegir = (valor, nombre) => {
    oculto.value = valor;
    buscar.value = valor === '__nuevo' ? '' : nombre;
    lista.classList.add('oculto');
    if (valor === '__nuevo') { form.elements.nombre.value = nombre || ''; (nombre ? form.elements.cedula : form.elements.nombre).focus(); }
    alCambiar();
  };
  const pintar = () => {
    const q = norm(buscar.value);
    if (!q) { lista.classList.add('oculto'); lista.innerHTML = ''; return; }
    const propios = clientes.filter((c) => empieza(c.nombre, q) || empieza(c.alias || '', q)).slice(0, 12);
    const viejos = delHistorial.filter((n) => empieza(n, q)).slice(0, 8);
    lista.innerHTML = [
      ...propios.map((c) => `<button type="button" role="option" data-id="${ui.esc(c.id)}" data-nombre="${ui.esc(c.nombre)}"><span>${ui.esc(c.nombre)}</span>${c.alias ? `<small>${ui.esc(c.alias)}</small>` : ''}</button>`),
      ...viejos.map((n) => `<button type="button" role="option" data-id="__nuevo" data-nombre="${ui.esc(n)}"><span>${ui.esc(n)}</span><small>Del historial · toca para hacerle ficha</small></button>`),
      !propios.length && !viejos.length ? `<p class="fran-buscacliente__nada">No hay nadie con "${ui.esc(buscar.value.trim())}".${mas ? ' Toca + para crearlo.' : ''}</p>` : '',
    ].join('');
    lista.classList.remove('oculto');
  };
  buscar.addEventListener('input', () => {
    if (oculto.value) { oculto.value = ''; nuevo.classList.add('oculto'); alCambiar(); }
    pintar();
  });
  buscar.addEventListener('focus', () => { if (!oculto.value) pintar(); });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) elegir(b.dataset.id, b.dataset.nombre);
  });
  if (mas) mas.addEventListener('click', () => elegir('__nuevo', oculto.value ? '' : buscar.value.trim()));
}

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
        ${icono3dDe(ic, 'fran-3d--64')}
        <span class="fran-cuatro__nombre">${ui.esc(t)}</span>
        <small>${ui.esc(d)}</small>
      </a>`).join('')}</div>
    </div>`));
    return;
  }
  // Paso 2: el formulario de lo que eligió, y nada más.
  const puedeNuevo = tipo === 'nuevo' || tipo === 'acuerdo';
  const elegidoNombre = (clientes.find((c) => c.id === elegido) || {}).nombre || '';
  // Los que pasaron por el Excel y todavía no tienen ficha: también se pueden elegir.
  const delHistorial = puedeNuevo ? nombresSinFicha(estado) : [];
  const raiz = ui.el(`<div class="fran-registrar">
    <header class="fran-titulo fran-titulo--libro"><a href="#/libro/prestamos/registrar/elegir${conCliente}" class="fran-titulo__atras" aria-label="Volver a elegir">‹</a><h1><span class="fran-cuadro fran-cuadro--28" aria-hidden="true">${actual[1]}</span><span>${ui.esc(actual[2])}</span></h1></header>
    <form novalidate class="fran-campos fran-campos--grande">
      <div class="fran-buscacliente"><small>Cliente</small>
        <div class="fran-buscacliente__fila">
          <input name="buscar" autocomplete="off" autocapitalize="words" placeholder="Escribe la inicial o el nombre" value="${ui.esc(elegidoNombre)}" aria-label="Buscar cliente">
          ${puedeNuevo ? '<button type="button" class="fran-buscacliente__mas" data-nuevo aria-label="Cliente nuevo" title="Cliente nuevo">+</button>' : ''}
        </div>
        <input type="hidden" name="cliente" value="${ui.esc(elegido)}">
        <div class="fran-buscacliente__lista oculto" role="listbox"></div>
      </div>
      <div class="oculto fran-campos fran-clientenuevo" id="campo-nombre">
        <p class="fran-clientenuevo__titulo">Cliente nuevo</p>
        <label><small>Nombre</small><input name="nombre" autocomplete="off" autocapitalize="words"></label>
        <label><small>Cédula</small><input name="cedula" inputmode="numeric" autocomplete="off"></label>
        <label><small>Teléfono</small><input name="telefono" type="tel" inputmode="tel" autocomplete="off"></label>
        <label><small>Dirección</small><input name="direccion" autocomplete="off"></label>
      </div>
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
  conectarBuscaCliente(raiz, form, clientes, delHistorial, alCambiarCliente, ui);
  alCambiarCliente();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const el = form.elements;
      let clienteId = el.cliente.value;
      if (!clienteId) { ui.toast('Busca el cliente y tócalo en la lista, o toca + si es nuevo.', 4000); return; }
      const valor = el.valor.value.trim() ? ctx.dinero.leer(el.valor.value) : null;
      const fecha = el.fecha.value || ctx.hoy();
      const nota = el.nota.value.trim();
      if (tipo !== 'acuerdo' && !(valor > 0)) { ui.toast('Escribe el valor.'); return; }
      if (tipo === 'nuevo' && el.tasa.value === '') { ui.toast('Elige la tasa.'); return; }
      if ((tipo === 'abono' || tipo === 'interes') && !el.prestamo.value) { ui.toast(el.prestamo.options.length ? 'Elige de cuál préstamo.' : 'Este cliente no tiene préstamos activos.'); return; }
      if (clienteId === '__nuevo') {
        const nombre = el.nombre.value.trim();
        if (!nombre) { ui.toast('Escribe el nombre del cliente.'); return; }
        const repetido = datos.estado.clientes.find((c) => norm(c.nombre) === norm(nombre));
        if (repetido) { ui.toast(`${repetido.nombre} ya tiene ficha. Búscalo arriba.`, 4000); return; }
        clienteId = (await datos.agregarCliente({ nombre, cedula: el.cedula.value.trim(), telefono: el.telefono.value.trim(), direccion: el.direccion.value.trim() })).id;
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

/** Nombre y alias del cliente, sin tildes. */
function nombresDe(c) {
  return [c.nombre, ...String(c.alias || '').split(/[,;/]/)].map(norm).filter(Boolean);
}
const palabrasDe = (n) => n.replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter(Boolean);
const RELLENO = ['de', 'del', 'y', 'don', 'dona'];
const TITULOS = ['don', 'dona', 'tio', 'tia', 'sr', 'sra', 'senor', 'senora', 'celador', 'profe'];

/**
 * Los cobros viejos del Excel guardan solo el nombre corto ("Ana", "Don Pedro", "Gómez").
 * Se le dan al cliente solo si ese nombre es de uno solo. Si lo comparten dos, no se adivina.
 * "Laura" no es "Mamá de Laura": lo que va después de "de" no cuenta.
 */
export function personaEsDe(persona, cliente, clientes) {
  const p = norm(persona);
  if (!p) return false;
  if (nombresDe(cliente).includes(p)) return true;
  if (clientes.some((c) => c.id !== cliente.id && nombresDe(c).includes(p))) return false;
  // "Pedro (sobrino de Doña Ana)" es "Pedro sobrino Ana": las palabras de relleno no cuentan.
  const buscadas = palabrasDe(p).filter((w) => !RELLENO.includes(w));
  if (!buscadas.length) return false;
  const conPalabras = (c, prueba) => nombresDe(c).some((n) => prueba(palabrasDe(n)));
  const unico = (prueba) => {
    const quienes = clientes.filter((c) => conPalabras(c, prueba));
    return quienes.length ? (quienes.length === 1 && quienes[0].id === cliente.id) : null;
  };
  if (buscadas.length > 1) return unico((w) => buscadas.every((x) => w.includes(x))) === true;
  const [x] = buscadas;
  const primero = unico((w) => w.find((y) => !TITULOS.includes(y)) === x);
  if (primero !== null) return primero;
  return unico((w) => w.some((y, i) => y === x && w[i - 1] !== 'de')) === true;
}

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
    <div class="fran-detalles__cabeza">${icono3dDe(m.perdon ? '🎁' : '↩️', 'fran-3d--64')}<strong>${ui.esc(m.titulo)}</strong></div>
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
    if (valor > 0) filas.push({ nombre: c.nombre, valor, clienteId: c.id, ruta: `#/cliente/${encodeURIComponent(c.id)}` });
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
  return renglon({ ruta: '#/libro/prestamos/solo-intereses', icono: '💸', icono3: 'porcentaje', texto: 'Solo deben intereses', sub: `${s.filas.length} ${s.filas.length === 1 ? 'persona' : 'personas'} · no se suma a la cartera`, derecha: `<span class="fran-renglon__valor numero">${dinero.formatear(s.total)}</span>` }, ui);
}

function renderSoloIntereses(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const hoy = ctx.hoy();
  const { filas, total } = soloInteresesDe(ctx);
  const dibujar = () => { contenedor.innerHTML = ''; renderSoloIntereses(contenedor, ctx); };
  // Quien tiene préstamo en Fran: al tocar el nombre va a su ficha; "Abonó" registra el pago de intereses.
  const filaCliente = (f) => `<div class="fran-fila"><a class="fran-fila__enlace" href="${ui.esc(f.ruta)}">${icono3dDe('💸')}<span class="fran-fila__texto"><strong>${ui.esc(f.nombre)}</strong><small>Ya devolvió el capital</small></span></a><span class="fran-fila__valor numero">${dinero.formatear(f.valor)}</span><a class="fran-boton-secundario fran-boton--44" href="#/libro/prestamos/registrar/interes/${encodeURIComponent(f.clienteId)}">Abonó</a></div>`;
  const filaSuelta = (f) => `<div class="fran-fila">${icono3dDe('💸')}<span class="fran-fila__texto"><strong>${ui.esc(f.nombre)}</strong><small>${ui.esc([f.suelto.nota, f.suelto.pagado ? `Ya pagó ${dinero.formatear(f.suelto.pagado)}` : ''].filter(Boolean).join(' · '))}</small></span><span class="fran-fila__valor numero">${dinero.formatear(f.valor)}</span><button type="button" class="fran-boton-secundario fran-boton--44" data-pago="${ui.esc(f.suelto.id)}">Abonó</button></div>`;
  const raiz = ui.el(`<div>
    ${titular('prestamos', ctx, '#/libro/prestamos', 'Solo deben intereses')}
    ${heroe({ etiqueta: 'Intereses por cobrar', valor: total, ayudaTexto: 'Son personas que ya no deben capital, solo intereses. Esta plata no se suma a tu cartera ni a tu plata propia: cuando la paguen, entra como ganancia.' }, ctx)}
    <div class="fran-lista">${filas.map((f) => (f.suelto ? filaSuelta(f) : filaCliente(f))).join('') || '<p class="fran-vacio">Nadie debe solo intereses.</p>'}</div>
    <form class="fran-campos fran-campos--grande oculto" data-form-pago novalidate>
      <label class="fran-campo-valor"><small data-quien>Pagó</small><input name="valor" inputmode="numeric" autocomplete="off"></label>
      <label><small>Entra por</small><select name="cuenta"><option>Efectivo</option><option>Nequi propio</option><option>Uno propio</option><option>Bancolombia</option></select></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar el abono</button>
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
    formPago.querySelector('[data-quien]').textContent = `Abonó ${elegido.nombre}`;
    formPago.elements.valor.value = dinero.formatear(elegido.valor - (elegido.pagado || 0));
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
  const asientosCliente = (estado.fran.asientos || []).filter((a) => a.clienteId === id || (!a.clienteId && a.persona && (norm(a.persona) === norm(cliente.nombre) || (a.libro === 'prestamos' && personaEsDe(a.persona, cliente, estado.clientes)))));
  const cobros = cobrosDeCliente(asientosCliente, pagos, cliente);
  const conInteres = cobros.filter((m) => !m.perdon && m.interes > 0);
  const interesesPagados = { n: conInteres.length, total: conInteres.reduce((s, m) => s + m.interes, 0), desde: conInteres.map((m) => m.fecha).sort()[0] };
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
    <div class="fran-cliente fran-tarjeta">
      <span class="fran-avatar">${ui.esc(cliente.nombre.charAt(0).toUpperCase())}</span>
      <div><strong>${ui.esc(cliente.nombre)}</strong>${[cliente.cedula ? `C.C. ${cliente.cedula}` : '', cliente.direccion].filter(Boolean).map((x) => `<small>${ui.esc(x)}</small>`).join('')}${conTexto ? `<small>${ui.esc(`Acuerdo: ${conTexto.acuerdoTexto}`)}</small>` : (textoAcuerdo ? `<small>${ui.esc(textoAcuerdo)}</small>` : '')}</div>
      ${r.soloIntereses ? '<span class="fran-solo">Solo intereses</span>' : ui.chipEstado(r.estado)}
    </div>
    ${heroe({ etiqueta: 'Si paga hoy, debe', valor: r.debeHoy, cajas: [['Capital pendiente', r.capitalPendiente], ['Intereses', r.interesPendiente + r.interesCorrido]] }, ctx)}
    ${corridos.length ? `<div class="fran-corrido"><p class="fran-corrido__titulo">Intereses de estos días</p>${corridos.map((x) => `<div class="fran-corrido__fila"><span><span>${ui.esc(`Préstamo del ${fechas.formatear(x.fecha)} · ${dinero.formatear(x.capitalPendiente)}`)}</span><small>${ui.esc(`${dinero.formatear(x.interesDelMes)} al mes · ${dinero.formatear(x.interesDiario)} por día · ${x.diasCorridos} ${x.diasCorridos === 1 ? 'día' : 'días'} desde el ${fechas.formatear(x.corridoDesde)}`)}</small></span><b class="numero">${dinero.formatear(x.interesCorrido)}</b></div>`).join('')}</div>` : ''}
    <div class="fran-progreso"><span style="width:${pct}%"></span></div>
    <p class="fran-nota">${abonosPlan && !recuperado ? `Abono a capital anotado: ${dinero.formatear(abonosPlan)}.` : `Recuperado ${dinero.formatear(recuperado)} de ${dinero.formatear(r.capitalPrestado)} de capital.`}${capitalPrimero ? (r.capitalPendiente === 0 ? ' Ya recuperó todo el capital: lo que pague es ganancia.' : ' Cuando llegue a 100%, todo lo que pague es ganancia.') : ''}</p>
    ${interesesPagados.n ? `<p class="fran-nota fran-nota--pagado">Ha pagado <strong class="numero">${dinero.formatear(interesesPagados.total)}</strong> de intereses en ${interesesPagados.n} ${interesesPagados.n === 1 ? 'pago' : 'pagos'}, desde ${ui.esc(fechas.formatear(interesesPagados.desde))}.</p>` : ''}
    ${seccion('Historial', 'lista')}
    <div class="fran-lista">${historial.map((h) => fila({ ui, icono: h.icono, titulo: h.t, sub: h.sinFecha ? `Fecha por confirmar (${h.sinFecha})` : (h.textoFecha || fechas.formatear(h.f)), derecha: h.v, clase: h.c, ruta: h.ruta, ver: h.ver })).join('') || '<p class="fran-vacio">Sin movimientos.</p>'}</div>
    <div class="fran-tres">
      <a href="${tel ? `tel:+${tel}` : editar}">${icono3d('telefono', 'fran-3d--40')}${tel ? 'Llamar' : 'Poner teléfono'}</a>
      <a href="${tel ? `https://wa.me/${tel}` : editar}"${tel ? ' target="_blank" rel="noopener"' : ''}>${icono3d('chat', 'fran-3d--40')}WhatsApp</a>
      <a href="#/libro/prestamos/registrar/acuerdo/${encodeURIComponent(id)}">${icono3d('reloj', 'fran-3d--40')}Recordar</a>
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
  const PROPS = Object.fromEntries((ctx.datos.estado.fran.propiedades || []).map((p) => [p.nombre, p]));
  const totales = new Map(Object.keys(DUENA).map((n) => [n, 0]));
  for (const a of delAnio) totales.set(a.categoria, (totales.get(a.categoria) || 0) + a.valor);
  const filas = [...totales].sort((x, y) => y[1] - x[1]);
  const raiz = ui.el(`<div>
    ${titular('arriendos', ctx, '#/libro/arriendos', 'Propiedades')}
    <div class="fran-anios">${[...anios, 'todo'].map((x) => `<button type="button" data-anio="${x}" class="${x === vista.anioPropiedad ? 'activo' : ''}">${x === 'todo' ? 'Todo' : x}</button>`).join('')}</div>
    <p class="fran-total"><strong class="numero">Total: <span class="fran-mas">${dinero.formatear(sumar(delAnio))}</span></strong></p>
    <div class="fran-lista">${filas.map(([n, v]) => fila({
      ui, icono: EMOJI_PROPIEDAD[(PROPS[n] || {}).tipo] || '🏢', titulo: n === 'Arriendos del mes' ? 'Sin repartir' : n,
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
/** Entró o Salió: el botón elegido se pinta (verde lo que entra, naranja lo que sale) y el otro se apaga. */
function marcarEntraSale(raiz, boton, form, entra) {
  raiz.querySelectorAll('.fran-virtual__botones [data-nuevo]').forEach((x) => {
    x.classList.toggle('elegido', x === boton);
    x.classList.toggle('apagado', x !== boton);
  });
  form.classList.toggle('fran-form-entra', entra);
  form.classList.toggle('fran-form-sale', !entra);
  form.querySelector('[data-titulo]').textContent = entra ? '⊕ Entró: ¿de quién o de qué?' : '⊖ Salió: ¿para quién o para qué?';
}

// ---------- Crédito de banco: plata prestada por el banco, aparte del negocio ----------

const TIPOS_CREDITO = {
  presto: ['🤝', 'Presté de esta plata', -1],
  cobro: ['💰', 'Cobré intereses', 1],
  devolvio: ['↩️', 'Me devolvieron capital', 1],
  pago: ['🏛️', 'Pagué al banco', -1],
  otro: ['✏️', 'Otro gasto del crédito', -1],
};

/** Cuánto hay del crédito en el banco, cuánto está prestado, cuánto se debe al banco y lo ganado. */
export function estadoCredito(c) {
  const suma = (t) => c.movimientos.filter((m) => m.tipo === t).reduce((s, m) => s + m.valor, 0);
  const presto = suma('presto');
  const devolvio = suma('devolvio');
  const cobro = suma('cobro');
  const pagado = suma('pago');
  const capitalPagado = c.movimientos.filter((m) => m.tipo === 'pago').reduce((s, m) => s + (m.capital ?? m.valor), 0);
  return {
    enBanco: c.monto - presto + devolvio + cobro - pagado - suma('otro'),
    prestado: presto - devolvio,
    deboBanco: Math.max(0, c.monto - capitalPagado),
    ganado: cobro,
    pagadoBanco: pagado,
  };
}

function renderCredito(contenedor, id, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const fran = datos.estado.fran;
  const c = (fran.creditos || []).find((x) => x.id === id);
  if (!c) { contenedor.append(ui.el(`<div>${titular('personal', ctx, '#/inicio', 'Crédito')}<p class="fran-vacio">No encontré ese crédito.</p></div>`)); return; }
  const e = estadoCredito(c);
  const hoy = ctx.hoy();
  const dibujar = () => { contenedor.innerHTML = ''; renderCredito(contenedor, id, ctx); };
  const movs = nuevosPrimero(c.movimientos);
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', c.nombre)}
    ${heroe({ etiqueta: 'Le debo al banco', valor: -e.deboBanco, ayudaTexto: 'Es un negocio aparte: no entra a tus finanzas personales ni a la cartera del negocio de préstamos. Lo que cobres de intereses de esta plata sirve para pagarle al banco.', cajas: [['En el banco', e.enBanco], ['Prestado de aquí', e.prestado], ['Intereses cobrados', e.ganado, e.ganado ? 'mas' : '']] }, ctx)}
    <p class="fran-nota">Me desembolsaron ${dinero.formatear(c.monto)} el ${ui.esc(fechas.formatear(c.fecha))}${c.cuenta ? ` en ${ui.esc(c.cuenta)}` : ''}.${c.nota ? ` ${ui.esc(c.nota)}` : ''}</p>
    ${c.plan && c.plan.length ? `<details class="fran-tachados fran-prestado-pension" open><summary><span class="fran-cuadro fran-cuadro--40" aria-hidden="true">📝</span><span class="fran-renglon__texto"><span>Lo que pienso hacer</span><small>Todavía no está hecho</small></span></summary><div class="fran-lista">${c.plan.map((x) => `<div class="fran-liquidez__fila"><span>${ui.esc(x.texto)}</span>${x.valor ? conSigno(x.valor, dinero) : ''}</div>`).join('')}</div></details>` : ''}
    <div class="fran-cuatro fran-cuatro--chico">${Object.entries(TIPOS_CREDITO).map(([k, [ic, t]]) => `<button type="button" class="fran-cuatro__cuadro" data-credito-nuevo="${k}">${icono3dDe(ic, 'fran-3d--48')}<span class="fran-cuatro__nombre">${ui.esc(t)}</span></button>`).join('')}</div>
    <form class="fran-campos fran-campos--grande oculto" data-form-credito novalidate>
      <label><small data-titulo>¿Quién o qué?</small><input name="concepto" autocomplete="off" placeholder="Nombre o detalle"></label>
      <label class="fran-campo-valor"><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label data-campo-tasa><small>Tasa de interés al mes (%)</small><input name="tasa" inputmode="decimal" autocomplete="off" placeholder="Ej. 20"></label>
      <label class="fran-foto-campo"><small>Comprobante (foto o captura)</small><input type="file" name="foto" accept="image/*"></label>
      <label class="oculto" data-campo-capital><small>De eso, ¿cuánto fue a capital? (si lo sabes)</small><input name="capital" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar</button>
    </form>
    ${seccion('Movimientos del crédito', 'grafica')}
    <div class="fran-lista">${movs.map((m) => { const [ic, t, sg] = TIPOS_CREDITO[m.tipo] || ['•', m.tipo, -1]; return `<div class="fran-credito-mov"><div class="fran-fila">${icono3dDe(ic)}<span class="fran-fila__texto"><strong>${ui.esc(m.concepto || t)}</strong><small>${ui.esc(`${t}${m.tasa ? ` · al ${String(m.tasa).replace('.', ',')} %` : ''} · ${fechas.formatear(m.fecha)}`)}${m.conFoto ? '' : (m.tipo === 'presto' ? ' · falta el comprobante' : '')}</small></span><span class="fran-fila__valor numero ${sg > 0 ? 'fran-mas' : 'fran-menos'}">${dinero.formatear(m.valor)}</span></div><span class="fran-credito-mov__botones">${m.conFoto ? `<button type="button" class="fran-boton-secundario fran-boton--44" data-ver-comprobante="${ui.esc(m.id)}">📷 Ver comprobante</button>` : ''}<button type="button" class="fran-boton-secundario fran-boton--44" data-editar-credito="${ui.esc(m.id)}">Editar</button><button type="button" class="fran-boton-secundario fran-boton--44" data-quitar-credito="${ui.esc(m.id)}">Quitar</button></span></div>`; }).join('') || '<p class="fran-vacio">Todavía no hay movimientos.</p>'}</div>
  </div>`);
  const form = raiz.querySelector('[data-form-credito]');
  let tipo = 'presto';
  raiz.querySelectorAll('[data-credito-nuevo]').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.creditoNuevo;
    raiz.querySelectorAll('[data-credito-nuevo]').forEach((x) => x.classList.toggle('activo', x === b));
    form.querySelector('[data-titulo]').textContent = `${TIPOS_CREDITO[tipo][1]}: ¿quién o qué?`;
    form.querySelector('[data-campo-capital]').classList.toggle('oculto', tipo !== 'pago');
    form.querySelector('[data-campo-tasa]').classList.toggle('oculto', tipo !== 'presto');
    form.classList.remove('oculto');
    form.elements.concepto.focus();
  }));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target.elements;
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!valor) { ui.toast('Escribe el valor.'); return; }
    const capital = tipo === 'pago' && f.capital.value.trim() ? Number(f.capital.value.replace(/\D/g, '')) : null;
    const tasa = tipo === 'presto' && f.tasa.value.trim() ? Number(f.tasa.value.replace(',', '.').replace(/[^\d.]/g, '')) : null;
    const mov = { id: `cr-${Date.now()}`, tipo, fecha: f.fecha.value || hoy, valor, concepto: f.concepto.value.trim(), ...(capital !== null ? { capital } : {}), ...(tasa ? { tasa } : {}) };
    if (f.foto.files[0]) {
      try { await guardarFoto(mov.id, await reducirFoto(f.foto.files[0])); mov.conFoto = true; } catch (error) { ui.toast(`La foto no se pudo guardar: ${error.message}`); }
    }
    await datos.actualizarFran({ creditos: fran.creditos.map((x) => (x.id === c.id ? { ...x, movimientos: [...x.movimientos, mov] } : x)) });
    ui.toast('Guardado.');
    dibujar();
  });
  // Completar un movimiento ya anotado: cliente, tasa, fecha, valor y comprobante.
  raiz.querySelectorAll('[data-editar-credito]').forEach((b) => b.addEventListener('click', () => {
    const m = c.movimientos.find((x) => x.id === b.dataset.editarCredito);
    if (!m) return;
    const caja = b.closest('.fran-credito-mov');
    if (caja.querySelector('form')) { caja.querySelector('form').remove(); return; }
    const fe = ui.el(`<form class="fran-campos fran-campos--grande fran-credito-editar" novalidate>
      <label><small>¿Quién o qué?</small><input name="concepto" autocomplete="off" value="${ui.esc(m.concepto || '')}"></label>
      <label class="fran-campo-valor"><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" value="${ui.esc(dinero.formatear(m.valor))}"></label>
      ${m.tipo === 'presto' ? `<label><small>Tasa de interés al mes (%)</small><input name="tasa" inputmode="decimal" autocomplete="off" value="${ui.esc(m.tasa ? String(m.tasa) : '')}" placeholder="Ej. 20"></label>` : ''}
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(m.fecha)}"></label>
      <label class="fran-foto-campo"><small>${m.conFoto ? 'Cambiar el comprobante' : 'Subir el comprobante (foto o captura)'}</small><input type="file" name="foto" accept="image/*"></label>
      <button class="fran-boton-principal fran-guardar">Guardar cambios</button>
    </form>`);
    caja.append(fe);
    fe.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target.elements;
      const valor = Number(f.valor.value.replace(/\D/g, ''));
      if (!valor) { ui.toast('Escribe el valor.'); return; }
      const cambios = { concepto: f.concepto.value.trim(), valor, fecha: f.fecha.value || m.fecha };
      if (f.tasa) { const t = Number(f.tasa.value.replace(',', '.').replace(/[^\d.]/g, '')); if (t) cambios.tasa = t; }
      if (f.foto.files[0]) {
        try { await guardarFoto(m.id, await reducirFoto(f.foto.files[0])); cambios.conFoto = true; } catch (error) { ui.toast(`La foto no se pudo guardar: ${error.message}`); }
      }
      await datos.actualizarFran({ creditos: fran.creditos.map((x) => (x.id === c.id ? { ...x, movimientos: x.movimientos.map((y) => (y.id === m.id ? { ...y, ...cambios } : y)) } : x)) });
      ui.toast('Guardado.');
      dibujar();
    });
  }));
  raiz.querySelectorAll('[data-ver-comprobante]').forEach((b) => b.addEventListener('click', async () => {
    const foto = await leerFoto(b.dataset.verComprobante).catch(() => null);
    if (!foto) { ui.toast('La foto está guardada en el aparato donde la subiste.'); return; }
    const fondo = document.createElement('div');
    fondo.className = 'fran-hoja-fondo';
    fondo.innerHTML = `<div class="fran-hoja" role="dialog" aria-modal="true"><img class="fran-comprobante" alt="Comprobante" src="${foto}"><button type="button" class="fran-boton-principal">Cerrar</button></div>`;
    fondo.addEventListener('click', (ev) => { if (ev.target === fondo || ev.target.closest('button')) fondo.remove(); });
    document.body.append(fondo);
  }));
  raiz.querySelectorAll('[data-quitar-credito]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await ui.confirmar('¿Quitar este movimiento del crédito?', { aceptar: 'Sí, quitar', peligro: true }))) return;
    await datos.actualizarFran({ creditos: fran.creditos.map((x) => (x.id === c.id ? { ...x, movimientos: x.movimientos.filter((m) => m.id !== b.dataset.quitarCredito) } : x)) });
    dibujar();
  }));
  contenedor.append(raiz);
}

// ---------- Liquidez real: toda la plata que se puede mover hoy ----------

const CLAVE_DOLAR = 'fran-dolar-hoy';

/** Tasa del dólar de hoy guardada en este aparato; si no hay, la tasa anotada en la pensión. */
function tasaDolar(fran) {
  try {
    const t = JSON.parse(window.localStorage.getItem(CLAVE_DOLAR));
    if (t && t.valor > 0) return { valor: t.valor, fecha: t.fecha, fuente: 'internet' };
  } catch (_error) { /* sin almacenamiento */ }
  return { valor: fran.pension.tasa, fecha: null, fuente: 'anotada' };
}

/** Pide la tasa del dólar de hoy (gratis, sin clave). Una vez por día. */
async function traerDolar(hoy) {
  try {
    const t = JSON.parse(window.localStorage.getItem(CLAVE_DOLAR) || 'null');
    if (t && t.fecha === hoy) return t;
  } catch (_error) { /* nada */ }
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  const j = await r.json();
  const valor = Math.round(j && j.rates && j.rates.COP);
  if (!(valor > 0)) throw new Error('Sin tasa');
  const t = { valor, fecha: hoy };
  try { window.localStorage.setItem(CLAVE_DOLAR, JSON.stringify(t)); } catch (_error) { /* nada */ }
  return t;
}

/** Cada fondo de plata disponible, agrupado por de dónde sale. */
export function fondosLiquidez(ctx, tasa) {
  const fran = ctx.datos.estado.fran;
  const plata = miPlata(ctx);
  const grupos = [];
  grupos.push({ icono: '💵', titulo: 'Efectivo de préstamos y personal', filas: [{ texto: 'Efectivo hoy (incluye lo apartado)', valor: plata.efectivo, ruta: '#/efectivo' }] });
  const cuentas = fran.virtualCuentas;
  if (cuentas) {
    const detalle = (cuentas.detalle || []).filter((x) => !/tarjeta/i.test(x.concepto));
    const usable = detalle.length ? detalle.reduce((s, x) => s + x.valor, 0) : cuentas.valor;
    grupos.push({ icono: '📲', titulo: 'Cuentas virtuales (lo que queda para usar)', filas: detalle.length ? detalle.map((x) => ({ texto: x.concepto, valor: x.valor })) : [{ texto: 'En las cuentas', valor: usable }], total: usable, nota: 'No resta lo que debes en tarjetas.' });
  }
  const ventas = (fran.asientos || []).filter((a) => a.libro === 'productos' && a.disponible);
  if (ventas.length) {
    grupos.push({ icono: '💻', titulo: 'Plata de ventas del negocio tecnológico (con tu pareja)', filas: ventas.flatMap((a) => [
      ...(a.disponible.efectivo ? [{ texto: `${a.descripcion.split(' · ')[0]} · en efectivo`, valor: a.disponible.efectivo }] : []),
      ...(a.disponible.virtual ? [{ texto: `${a.descripcion.split(' · ')[0]} · en virtual`, valor: a.disponible.virtual }] : []),
    ]) });
  }
  // La plata de un crédito de banco nunca se cuenta como liquidez propia (pedido por ella el 7 nov 2026).
  const p = fran.pension;
  const usd = p.cuentas.reduce((s, c) => s + c.usd, 0);
  const filasPension = [{ texto: `Dólares: ${String(Math.round(usd * 100) / 100).replace('.', ',')} USD a ${ctx.dinero.formatear(tasa.valor)}`, valor: Math.round(usd * tasa.valor), ruta: '#/libro/pension' }];
  const perdida = Math.round(usd * tasa.valor) - Math.round(usd * p.tasa);
  if (tasa.fuente === 'internet' && perdida) filasPension.push({ texto: `Comprados a ${ctx.dinero.formatear(p.tasa)}: ${perdida < 0 ? 'perderías hoy' : 'ganarías hoy'}`, valor: perdida, aparte: true });
  for (const o of p.otros.filter((x) => x.liquido)) filasPension.push({ texto: o.nombre, valor: o.cop });
  grupos.push({ icono: '🐷', titulo: 'Pensión (solo lo que está disponible)', filas: filasPension, nota: 'Lo prestado y el carro no cuentan: no están en tu bolsillo.' });
  for (const g of grupos) if (g.total === undefined) g.total = g.filas.filter((f) => !f.aparte).reduce((s, f) => s + f.valor, 0);
  return { grupos, total: grupos.reduce((s, g) => s + g.total, 0) };
}

function renderLiquidez(contenedor, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const fran = datos.estado.fran;
  const tasa = tasaDolar(fran);
  const { grupos, total } = fondosLiquidez(ctx, tasa);
  const raiz = ui.el(`<div>
    ${titular('personal', ctx, '#/inicio', 'Liquidez real')}
    ${heroe({ etiqueta: 'Plata que puedo mover hoy', valor: total, ayudaTexto: 'Suma la plata que de verdad está disponible: efectivo, lo que queda en las cuentas, la plata del negocio tecnológico y los dólares de la pensión a la tasa de hoy. No cuenta lo prestado, el carro ni la plata del crédito del banco, y no resta lo que debes en tarjetas.' }, ctx)}
    <p class="fran-nota">Dólar: ${dinero.formatear(tasa.valor)} ${tasa.fuente === 'internet' ? `· tasa de hoy (${ui.esc(fechas.formatear(tasa.fecha))})` : '· tasa anotada en la pensión'}</p>
    ${grupos.map((g) => `<details class="fran-tachados fran-liquidez">
      <summary class="fran-liquidez__cabeza">${icono3dDe(g.icono, 'fran-3d--40')}<span>${ui.esc(g.titulo)}<small>Toca para ver el detalle</small></span><b>${conSigno(g.total, dinero)}</b></summary>
      <div class="fran-lista">${g.filas.map((f) => `<${f.ruta ? `a href="${ui.esc(f.ruta)}"` : 'div'} class="fran-liquidez__fila"><span>${ui.esc(f.texto)}</span>${conSigno(f.valor, dinero)}</${f.ruta ? 'a' : 'div'}>`).join('')}</div>
      ${g.nota ? `<p class="fran-nota">${ui.esc(g.nota)}</p>` : ''}
    </details>`).join('')}
  </div>`);
  contenedor.append(raiz);
  // Trae el dólar de hoy y vuelve a dibujar si cambió.
  traerDolar(ctx.hoy()).then((t) => { if (t.valor !== tasa.valor && document.body.contains(raiz)) { contenedor.innerHTML = ''; renderLiquidez(contenedor, ctx); } }).catch(() => {});
}

// ---------- Propiedades: icono según el tipo (casa, apartamento, bodega) ----------

const EMOJI_PROPIEDAD = { casa: '🏠', apartamento: '🏢', bodega: '📦' };
const ARCHIVO_PROPIEDAD = { casa: 'casa', apartamento: 'edificio', bodega: 'caja' };
function iconoPropiedad(p, clase = '') {
  return `<img class="fran-3d ${clase}" src="iconos/3d/${ARCHIVO_PROPIEDAD[p.tipo] || 'edificio'}.png" alt="" aria-hidden="true" decoding="async">`;
}
function iconoCategoria(c, libro, fran, clase) {
  if (libro === 'arriendos') { const p = (fran.propiedades || []).find((x) => x.nombre === c); if (p) return iconoPropiedad(p, clase); }
  return icono3dDe(c, clase);
}

// ---------- Libreta: anotar rápido en texto y pasarlo después a su categoría ----------

let textoDeLibreta = '';
let notaDeLibreta = null;

async function marcarNotaPasada(ctx, id) {
  const notas = (ctx.datos.estado.fran.notas || []).map((n) => (n.id === id ? { ...n, pasada: true, pasadaEl: ctx.hoy() } : n));
  await ctx.datos.actualizarFran({ notas });
}

// Libreta en Inicio: una hoja con lápiz grande al lado de "Hola, Fran" (pedido el 7 nov 2026).
const SVG_LIBRETA = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lib-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--accent) 14%, #fff)"/></linearGradient><linearGradient id="lib-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#F59E0B"/></linearGradient></defs><rect x="9" y="7" width="38" height="48" rx="8" fill="url(#lib-h)" style="stroke:var(--accent)" stroke-width="2.5"/><path d="M17 21h22M17 29h22M17 37h14" style="stroke:var(--accent)" stroke-width="3" stroke-linecap="round" opacity=".7"/><g transform="rotate(40 46 40)"><rect x="41" y="14" width="10" height="34" rx="2.5" fill="url(#lib-l)"/><rect x="41" y="14" width="10" height="6" rx="2" fill="#F472B6"/><path d="M41 48h10l-5 9z" fill="#FCD9B6"/><path d="M44.6 54.2h2.8L46 57z" fill="#374151"/></g></svg>';

function libretaBoton(ctx) {
  const pendientes = (ctx.datos.estado.fran.notas || []).filter((n) => !n.pasada).length;
  return `<a href="#/libreta" class="fran-hola__libreta" aria-label="Libreta: anotar rápido${pendientes ? `, ${pendientes} por pasar` : ''}">${SVG_LIBRETA}${pendientes ? `<b>${pendientes}</b>` : ''}</a>`;
}

function libretaInicio(ctx) {
  const { ui } = ctx;
  const pendientes = (ctx.datos.estado.fran.notas || []).filter((n) => !n.pasada);
  return `<section class="fran-libreta fran-entra" style="--i:5">
    <a class="fran-libreta__cabeza" href="#/libreta">${icono3d('lapiz', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Libreta</span><small>${pendientes.length ? `${pendientes.length} ${pendientes.length === 1 ? 'nota' : 'notas'} por pasar` : 'Anota rápido y lo pasas después'}</small></span><i class="fran-ajuste__flecha" aria-hidden="true"></i></a>
    <form class="fran-libreta__escribir" data-libreta novalidate><input name="texto" autocomplete="off" placeholder="Ej.: pagué 20.000 de gas en efectivo" aria-label="Nota rápida"><button class="fran-boton-principal" aria-label="Guardar nota">＋</button></form>
    ${pendientes.slice(0, 2).map((n) => `<p class="fran-libreta__nota">${ui.esc(n.texto)}</p>`).join('')}
  </section>`;
}

function conectarLibreta(raiz, ctx, redibujar) {
  const form = raiz.querySelector('[data-libreta]');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = form.elements.texto.value.trim();
    if (!texto) { ctx.ui.toast('Escribe la nota.'); return; }
    const nota = { id: `nota-${Date.now()}`, texto, fecha: ctx.hoy(), creadoEn: new Date().toISOString() };
    await ctx.datos.actualizarFran({ notas: [...(ctx.datos.estado.fran.notas || []), nota] });
    ctx.ui.toast('Anotado en la libreta.');
    redibujar();
  });
}

function renderLibreta(contenedor, ctx) {
  const { ui, fechas } = ctx;
  const notas = ctx.datos.estado.fran.notas || [];
  const pendientes = notas.filter((n) => !n.pasada).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const pasadas = notas.filter((n) => n.pasada).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const dibujar = () => { contenedor.innerHTML = ''; renderLibreta(contenedor, ctx); };
  const tarjeta = (n) => `<div class="fran-libreta__item" data-nota="${ui.esc(n.id)}">
    <p>${ui.esc(n.texto)}</p>
    <small>${ui.esc(fechas.formatear(n.fecha))}${n.pasada ? ' · ya la pasé' : ''}</small>
    <span class="fran-libreta__botones">${n.pasada ? `<button type="button" class="fran-boton-secundario fran-boton--44" data-volver="${ui.esc(n.id)}">Volver a pendientes</button>` : `<button type="button" class="fran-boton-principal fran-boton--44" data-pasar="${ui.esc(n.id)}" data-tipo="gasto">Pasar a gasto</button><button type="button" class="fran-boton-secundario fran-boton--44" data-pasar="${ui.esc(n.id)}" data-tipo="ingreso">Pasar a ingreso</button><button type="button" class="fran-boton-secundario fran-boton--44" data-hecha="${ui.esc(n.id)}">Ya la pasé</button>`}<button type="button" class="fran-boton-secundario fran-boton--44" data-editar-nota="${ui.esc(n.id)}">Editar</button><button type="button" class="fran-boton-secundario fran-boton--44" data-borrar-nota="${ui.esc(n.id)}" aria-label="Borrar nota">Borrar</button></span>
  </div>`;
  const raiz = ui.el(`<div>
    ${titular('personal', ctx, '#/inicio', 'Libreta')}
    <p class="fran-nota">Anota aquí lo que pagaste o recibiste, como te salga. Cuando tengas calma, toca "Pasar" y Fran te abre Agregar con el texto ya escrito.</p>
    <form class="fran-libreta__escribir fran-libreta__escribir--grande" data-libreta novalidate><textarea name="texto" rows="3" placeholder="Ej.: recibí 150.000 de un arriendo por Nequi" aria-label="Nota"></textarea><button class="fran-boton-principal">Guardar nota</button></form>
    ${seccion(`Por pasar (${pendientes.length})`, 'lapiz')}
    ${pendientes.map(tarjeta).join('') || '<p class="fran-vacio">No hay notas por pasar.</p>'}
    ${pasadas.length ? `<details class="fran-tachados"><summary>Ya pasadas (${pasadas.length})</summary>${pasadas.map(tarjeta).join('')}</details>` : ''}
  </div>`);
  conectarLibreta(raiz, ctx, dibujar);
  setTimeout(() => { const t = raiz.querySelector('textarea'); if (t && !pendientes.length) t.focus(); }, 150);
  raiz.querySelectorAll('[data-pasar]').forEach((b) => b.addEventListener('click', () => {
    const n = notas.find((x) => x.id === b.dataset.pasar);
    textoDeLibreta = n ? n.texto : '';
    notaDeLibreta = n ? n.id : null;
    ctx.navegar(`/libro/personal/agregar/${b.dataset.tipo}`);
  }));
  raiz.querySelectorAll('[data-hecha]').forEach((b) => b.addEventListener('click', async () => { await marcarNotaPasada(ctx, b.dataset.hecha); dibujar(); }));
  raiz.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', async () => {
    await ctx.datos.actualizarFran({ notas: notas.map((n) => (n.id === b.dataset.volver ? { ...n, pasada: false } : n)) });
    dibujar();
  }));
  raiz.querySelectorAll('[data-editar-nota]').forEach((b) => b.addEventListener('click', () => {
    const n = notas.find((x) => x.id === b.dataset.editarNota);
    const caja = b.closest('.fran-libreta__item');
    if (!n || caja.querySelector('form')) return;
    const fe = ui.el(`<form class="fran-libreta__escribir fran-libreta__escribir--grande" novalidate><textarea name="texto" rows="6" aria-label="Editar nota">${ui.esc(n.texto)}</textarea><span class="fran-libreta__botones"><button class="fran-boton-principal fran-boton--44">Guardar cambios</button><button type="button" class="fran-boton-secundario fran-boton--44" data-cancelar>Cancelar</button></span></form>`);
    caja.querySelector('p').replaceWith(fe);
    caja.querySelector('.fran-libreta__botones:not(form .fran-libreta__botones)').classList.add('oculto');
    const t = fe.querySelector('textarea');
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
    fe.querySelector('[data-cancelar]').addEventListener('click', dibujar);
    fe.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const texto = t.value.trim();
      if (!texto) { ui.toast('La nota quedó vacía. Si no la quieres, bórrala.'); return; }
      await ctx.datos.actualizarFran({ notas: notas.map((x) => (x.id === n.id ? { ...x, texto, editadaEl: ctx.hoy() } : x)) });
      ui.toast('Nota guardada.');
      dibujar();
    });
  }));
  raiz.querySelectorAll('[data-borrar-nota]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await ui.confirmar('¿Borrar esta nota?', { aceptar: 'Sí, borrar', peligro: true }))) return;
    await ctx.datos.actualizarFran({ notas: notas.filter((n) => n.id !== b.dataset.borrarNota) });
    dibujar();
  }));
  contenedor.append(raiz);
}

// ---------- Mi plata hoy: por qué da lo que da ----------

function renderMiPlata(contenedor, ctx) {
  const { ui, dinero, fechas } = ctx;
  const c = cuentaMiPlata(ctx);
  const { hoy, partida } = c;
  const suma = (g) => (c.grupos[g] || []).reduce((s, e) => s + e.efecto, 0);
  const cuantos = (g) => (c.grupos[g] || []).length;
  const mesAntes = partida.fecha ? fechas.nombreMes(Number(fechas.sumarMeses(`${partida.fecha.slice(0, 7)}-01`, -1).slice(5, 7))).toLowerCase() : '';
  const arranqueTexto = partida.fecha ? `Cierre de ${mesAntes}` : 'Con lo que arrancó Fran';
  const fmt = (v) => `${v < 0 ? '−' : ''}${dinero.formatear(Math.abs(v))}`;
  const lista = (g) => nuevosPrimero(c.grupos[g] || []).map((e) => fila({ ui, icono: e.icono, titulo: e.titulo, sub: `${fechas.formatear(e.fecha)} · ${e.donde}`, derecha: dinero.formatear(Math.abs(e.efecto)), clase: e.efecto > 0 ? 'fran-mas' : (e.efecto < 0 ? 'fran-menos' : '') })).join('');
  const plegado = (g, icono, titulo, sub) => (cuantos(g) ? `<details class="fran-tachados fran-prestado-pension"><summary>${icono3dDe(icono, 'fran-3d--40')}<span class="fran-renglon__texto"><span>${ui.esc(titulo)}</span><small>${cuantos(g)} ${cuantos(g) === 1 ? 'movimiento' : 'movimientos'}${sub ? ` · ${ui.esc(sub)}` : ''}</small></span><b>${conSigno(suma(g), dinero, suma(g) > 0 ? 'mas' : (suma(g) < 0 ? 'menos' : ''))}</b></summary><div class="fran-lista">${lista(g)}</div></details>` : '');
  const filaCuenta = (texto, v, signo) => `<p><span>${ui.esc(texto)}</span><span class="numero${signo ? ` fran-${signo}` : (v < 0 ? ' fran-menos' : '')}">${dinero.formatear(Math.abs(v))}</span></p>`;
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', 'Mi plata hoy')}
    ${heroe({ etiqueta: hoy.total < 0 ? 'Me hace falta' : 'Debo tener', valor: hoy.total, cajas: [['Efectivo', hoy.efectivo, '', '#/efectivo'], ['Virtual', hoy.virtual, '', '#/virtual'], ['Tarjetas', -hoy.tarjetas, '', '#/tarjetas']] }, ctx)}
    <p class="fran-nota fran-miplata__cuenta">Efectivo ${fmt(hoy.efectivo)} + virtual ${fmt(hoy.virtual)} − tarjetas ${dinero.formatear(hoy.tarjetas)} = <b>${fmt(hoy.total)}</b></p>
    ${seccion('Cómo se llegó a este número', 'grafica')}
    <div class="fran-virtual__cuadro">
      ${filaCuenta(arranqueTexto, c.arranque)}
      ${cuantos('entro') ? filaCuenta('Entró', suma('entro'), 'mas') : ''}
      ${cuantos('salio') ? filaCuenta('Salió de efectivo y virtual', suma('salio'), 'menos') : ''}
      ${cuantos('tarjeta') ? filaCuenta('Compras con tarjeta', suma('tarjeta'), 'menos') : ''}
      ${cuantos('abonoTarjeta') ? filaCuenta('Devoluciones a tarjetas', suma('abonoTarjeta'), 'mas') : ''}
      ${cuantos('pases') ? filaCuenta('Pases entre cuentas', suma('pases'), suma('pases') > 0 ? 'mas' : (suma('pases') < 0 ? 'menos' : '')) : ''}
      ${c.sinCuadrar ? filaCuenta('Sin explicar', c.sinCuadrar) : ''}
      <p class="fran-virtual__queda"><span>Hoy</span><span class="numero ${hoy.total < 0 ? 'fran-menos' : ''}">${dinero.formatear(Math.abs(hoy.total))}</span></p>
    </div>
    <details class="fran-tachados fran-prestado-pension"><summary>${icono3d('calendario', 'fran-3d--40')}<span class="fran-renglon__texto"><span>${ui.esc(arranqueTexto)}</span><small>${partida.fecha ? `Así arrancó el ${ui.esc(fechas.formatear(partida.fecha))}` : 'Lo anotado al empezar'}</small></span><b>${conSigno(c.arranque, dinero)}</b></summary>
      <div class="fran-lista">
        ${fila({ ui, icono: '💵', titulo: 'Efectivo', sub: 'Lo que había al cerrar', derecha: dinero.formatear(Math.abs(partida.efectivo)), clase: partida.efectivo < 0 ? 'fran-menos' : '' })}
        ${fila({ ui, icono: '📲', titulo: 'Virtual', sub: partida.virtual < 0 ? 'Ya había usado plata de las cuentas' : 'Lo que había al cerrar', derecha: dinero.formatear(Math.abs(partida.virtual)), clase: partida.virtual < 0 ? 'fran-menos' : '' })}
        ${partida.tarjetas.filter((t) => t.valor).map((t) => fila({ ui, icono: '💳', titulo: t.nombre, sub: t.nota ? t.nota : (t.fecha ? `Extracto al ${fechas.formatear(t.fecha)}` : 'Lo que se debía al empezar'), derecha: dinero.formatear(t.valor), clase: 'fran-menos' })).join('')}
      </div>
      ${partida.fecha ? `<p class="fran-nota">Lo de ${ui.esc(mesAntes)} (ingresos y gastos de Finanzas) ya está dentro de este cierre. Aquí abajo sale solo lo que movió la plata después.</p>` : ''}
    </details>
    ${plegado('entro', '💵', 'Entró', 'a efectivo o virtual')}
    ${plegado('salio', '💸', 'Salió de efectivo y virtual', '')}
    ${plegado('tarjeta', '💳', 'Compras con tarjeta', 'suben lo que debo')}
    ${plegado('abonoTarjeta', '💳', 'Devoluciones a tarjetas', 'bajan lo que debo')}
    ${plegado('pases', '🔁', 'Pases entre cuentas', 'pagar la tarjeta con efectivo no cambia el total')}
    ${c.sinCuadrar ? `<p class="fran-nota">Hay ${ui.esc(dinero.formatear(Math.abs(c.sinCuadrar)))} que no sale de ningún movimiento anotado. Puede ser un saldo o un extracto que se cambió a mano.</p>` : ''}
  </div>`);
  contenedor.append(raiz);
}

// ---------- Tarjetas: cuánto se debe en cada una y a qué fecha ----------

function renderTarjetas(contenedor, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const hoy = ctx.hoy();
  const fran = datos.estado.fran;
  const tarjetas = estadoTarjetas(fran);
  const total = tarjetas.reduce((s, t) => s + t.deudaHoy, 0);
  const dibujar = () => { contenedor.innerHTML = ''; renderTarjetas(contenedor, ctx); };
  const ICONO = (n) => (/gasolina/i.test(n) ? '⛽' : (/comida/i.test(n) ? '🛒' : '💳'));
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', 'Tarjetas')}
    ${heroe({ etiqueta: 'Debo en tarjetas', valor: -total, ayudaTexto: 'Cada tarjeta parte de lo que se debía en su último extracto (o lo anotado al empezar Fran) y suma lo que pagaste con ella después. Lo que le abonas a la tarjeta lo resta.' }, ctx)}
    ${tarjetas.map((t, i) => `<section class="fran-tarjeta fran-tarjeta-credito">
      <span class="fran-tarjeta-credito__cabeza">${icono3dDe(ICONO(t.nombre), 'fran-3d--48')}<span class="fran-renglon__texto"><span>${ui.esc(t.nombre)}</span><small>${t.nota ? `${ui.esc(t.nota)}: ${dinero.formatear(t.base)}` : (t.fecha ? `Extracto al ${ui.esc(fechas.formatear(t.fecha))}: ${dinero.formatear(t.base)}` : `Al empezar Fran: ${dinero.formatear(t.base)}`)}${t.pagoHasta ? ` · Pagar antes del ${ui.esc(fechas.formatear(t.pagoHasta))}` : ''}</small></span><b>${conSigno(-t.deudaHoy, dinero)}</b></span>
      ${t.movimientos.length ? `<div class="fran-lista">${nuevosPrimero(t.movimientos).map((a) => fila({ ui, icono: iconoDe(a.categoria), titulo: a.categoria, sub: `${fechas.formatear(a.fecha)}${a.descripcion ? ` · ${a.descripcion}` : ''}`, derecha: `${a.efecto > 0 ? '−' : '+'}${dinero.formatear(Math.abs(a.efecto))}`, clase: a.efecto > 0 ? 'fran-menos' : 'fran-mas' })).join('')}</div>` : '<p class="fran-nota">Sin compras anotadas después de esa fecha.</p>'}
      <button type="button" class="fran-boton-secundario fran-boton--44" data-extracto="${i}">Actualizar con el extracto</button>
      <form class="fran-campos fran-campos--grande oculto" data-form-extracto="${i}" novalidate>
        <label class="fran-campo-valor"><small>¿Cuánto se debe según el extracto?</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
        <label><small>¿A qué fecha?</small><input type="date" name="fecha" value="${ui.esc(hoy)}"></label>
        <label><small>Pagar antes del (si lo sabes)</small><input type="date" name="pagoHasta" value="${ui.esc(t.pagoHasta || '')}"></label>
        <button class="fran-boton-principal fran-guardar">Guardar</button>
      </form>
    </section>`).join('') || '<p class="fran-vacio">No hay tarjetas anotadas.</p>'}
  </div>`);
  raiz.querySelectorAll('[data-extracto]').forEach((b) => b.addEventListener('click', () => raiz.querySelector(`[data-form-extracto="${b.dataset.extracto}"]`).classList.toggle('oculto')));
  raiz.querySelectorAll('[data-form-extracto]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const i = Number(form.dataset.formExtracto);
    const f = form.elements;
    const texto = f.valor.value.trim();
    const valor = Number(texto.replace(/\D/g, ''));
    if (!texto || !Number.isInteger(valor)) { ui.toast('Escribe cuánto se debe.'); return; }
    const lista = (fran.tarjetas || []).map((t, j) => { if (j !== i) return t; const { nota, ...resto } = t; return { ...resto, deuda: valor, fecha: f.fecha.value || hoy, ...(f.pagoHasta.value ? { pagoHasta: f.pagoHasta.value } : {}) }; });
    await datos.actualizarFran({ tarjetas: lista });
    ui.toast('Tarjeta actualizada.');
    dibujar();
  }));
  contenedor.append(raiz);
}

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
    const grupo = m.tipo === 'prestamo' ? 'Préstamos' : (m.tipo === 'pago' ? 'Pagos recibidos' : (m.signo > 0 ? 'Entró (anotado a mano)' : 'Salió (anotado a mano)'));
    filas.push({ id: m.id, creadoEn: m.creadoEn, grupo, manual: ['aporte', 'retiro'].includes(m.tipo), fecha: m.fecha, icono, titulo: quien || m.nota || QUE[m.tipo] || m.tipo, sub: quien ? QUE[m.tipo] : (m.nota && QUE[m.tipo] ? QUE[m.tipo] : ''), valor: m.monto * m.signo });
  }
  for (const a of estado.fran.asientos) {
    if (a.libro === 'terceros') continue;
    const esEf = (c) => /^efectivo$/i.test(c || '');
    const base = { fecha: a.fecha, creadoEn: a.creadoEn, grupo: a.categoria, icono: iconoDe(a.categoria), titulo: a.descripcion || a.categoria, sub: '' };
    if (a.tipo === 'transferencia') {
      if (esEf(a.cuenta)) filas.push({ ...base, valor: -a.valor });
      if (esEf(a.destino)) filas.push({ ...base, valor: a.valor });
    } else if (esEf(a.cuenta)) {
      filas.push({ ...base, valor: a.tipo === 'ingreso' ? a.valor : -a.valor });
    }
  }
  return filas;
}

// ---------- Conté mi efectivo (3.40.0, pedido el 12 nov 2026) ----------
// Fran calcula lo que debería haber; aquí queda cuándo ella lo contó de verdad y si cuadró.

/** Lo que Fran dice que había en efectivo al terminar ese día. */
function efectivoAl(filas, partida, fecha) {
  return partida + filas.filter((f) => f.fecha <= fecha).reduce((s, f) => s + f.valor, 0);
}

/** Lo que movió el efectivo después de un conteo: días siguientes, o el mismo día pero anotado después de contar. */
function movidoDesde(filas, conteo) {
  return filas.filter((f) => f.fecha > conteo.fecha
    || (f.fecha === conteo.fecha && typeof f.creadoEn === 'string' && f.creadoEn.length > 10 && f.creadoEn > conteo.creadoEn));
}

function ultimoConteo(estado) {
  return (estado.fran.conteos || []).filter((x) => x.caja === 'efectivo')
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creadoEn).localeCompare(String(b.creadoEn))).pop() || null;
}

function textoCuadre(dif, dinero, ajuste = 0) {
  if (!dif && ajuste) return ajuste < 0 ? `Faltaban ${dinero.formatear(-ajuste)} (anotado como descuadre)` : `Sobraban ${dinero.formatear(ajuste)} (anotado)`;
  if (!dif) return 'Cuadró';
  return dif < 0 ? `Faltaban ${dinero.formatear(-dif)}` : `Sobraban ${dinero.formatear(dif)}`;
}

function avisoConteo(u, dinero) {
  const dif = u.contado - u.debia;
  return `<div class="fran-conteo__aviso"><p>Fran decía ${dinero.formatear(u.debia)} y usted contó ${dinero.formatear(u.contado)}. ${dif < 0 ? `Faltan <b>${dinero.formatear(-dif)}</b>.` : `Sobran <b>${dinero.formatear(dif)}</b>.`}</p>
    <p><small>El conteo ya quedó guardado. Si no sabe en qué se fue (o de dónde salió), anótelo para que Fran cuadre con lo que tiene en la mano.</small></p>
    <div class="fran-dos"><button type="button" class="fran-boton-principal" data-cuadrar>${dif < 0 ? 'Anotar como descuadre' : 'Anotar lo que sobró'}</button><button type="button" class="fran-boton-secundario" data-no-cuadrar>Lo reviso yo</button></div></div>`;
}

function bloqueConteo(ctx, filas, partida, total) {
  const { ui, dinero, fechas } = ctx;
  const hoy = ctx.hoy();
  const u = ultimoConteo(ctx.datos.estado);
  const anteriores = (ctx.datos.estado.fran.conteos || []).filter((x) => x.caja === 'efectivo' && (!u || x.id !== u.id)).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12);
  let resumen = '<p class="fran-conteo__nada">Todavía no ha contado el efectivo en Fran. Cuente la plata y anótela aquí.</p>';
  if (u) {
    const desde = movidoDesde(filas, u);
    const entro = desde.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
    const salio = desde.filter((f) => f.valor < 0).reduce((s, f) => s - f.valor, 0);
    // Exacto: lo contado más todo lo que Fran cambió desde ese momento (aunque se haya anotado con fecha vieja).
    const esperado = u.contado + (total - u.debia);
    const otros = (total - u.debia) - (entro - salio);
    const dias = Math.round((Date.parse(hoy) - Date.parse(u.fecha)) / 86400000);
    resumen = `<p class="fran-conteo__ultima"><b>Última vez que contó:</b> ${ui.esc(fechas.formatear(u.fecha))}${dias > 0 ? ` (hace ${dias} ${dias === 1 ? 'día' : 'días'})` : ' (hoy)'}</p>
      <div class="fran-conteo__cuentas">
        <span><small>Contó</small><b class="numero">${dinero.formatear(u.contado)}</b><small class="${u.contado === u.debia && !u.ajuste ? 'fran-mas' : 'fran-menos'}">${ui.esc(textoCuadre(u.contado - u.debia, dinero, u.ajuste))}</small></span>
        <span><small>Entró después</small><b class="numero fran-mas">${dinero.formatear(entro)}</b></span>
        <span><small>Salió después</small><b class="numero fran-menos">${dinero.formatear(salio)}</b></span>
      </div>
      <p class="fran-conteo__debe">Debe tener hoy: <b class="numero">${dinero.formatear(esperado)}</b>${otros ? ` <small>(incluye ${dinero.formatear(Math.abs(otros))} anotado ese mismo día o con fecha de antes)</small>` : ''}${esperado !== total ? ` <small>(Fran dice ${dinero.formatear(total)} porque falta anotar la diferencia del conteo)</small>` : ''}</p>
      ${desde.length ? `<details class="fran-conteo__lista"><summary>Ver lo que se movió desde ese día (${desde.length})</summary><div class="fran-lista">${nuevosPrimero(desde).map((f) => `<div class="fran-fila"><span class="fran-fila__texto"><strong>${ui.esc(f.titulo)}</strong><small>${ui.esc(fechas.formatear(f.fecha))}</small></span><span class="fran-fila__valor numero ${f.valor < 0 ? 'fran-menos' : 'fran-mas'}">${dinero.formatear(Math.abs(f.valor))}</span></div>`).join('')}</div></details>` : ''}`;
  }
  return `<section class="fran-conteo">
    <div class="fran-conteo__cabeza">${icono3d('billete', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Conteo del efectivo</span><small>Para saber desde cuándo está confirmada la plata</small></span></div>
    ${resumen}
    <button type="button" class="fran-boton-principal fran-conteo__boton" data-contar>Conté mi efectivo</button>
    <form class="fran-campos fran-campos--grande oculto" data-form-conteo novalidate>
      <label class="fran-campo-valor"><small>¿Cuánto contó?</small><input name="contado" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(hoy)}" max="${ui.esc(hoy)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar conteo</button>
    </form>
    ${u && vista.conteoPendiente === u.id && u.contado !== u.debia ? avisoConteo(u, dinero) : ''}
    ${anteriores.length ? `<details class="fran-conteo__lista"><summary>Conteos anteriores</summary><div class="fran-lista">${anteriores.map((x) => `<div class="fran-fila"><span class="fran-fila__texto"><strong>${ui.esc(fechas.formatear(x.fecha))}</strong><small>${ui.esc(textoCuadre(x.contado - x.debia, dinero, x.ajuste))}</small></span><span class="fran-fila__valor numero">${dinero.formatear(x.contado)}</span></div>`).join('')}</div></details>` : ''}
  </section>`;
}

function conectarConteo(raiz, ctx, filas, partida, dibujar) {
  const { ui, datos } = ctx;
  const form = raiz.querySelector('[data-form-conteo]');
  if (!form) return;
  raiz.querySelector('[data-contar]').addEventListener('click', () => { form.classList.toggle('oculto'); if (!form.classList.contains('oculto')) form.elements.contado.focus(); });
  form.elements.contado.addEventListener('input', (e) => { const n = e.target.value.replace(/\D/g, ''); e.target.value = n ? Number(n).toLocaleString('es-CO') : ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const texto = f.contado.value.replace(/\D/g, '');
    if (!texto) { ui.toast('Escriba cuánto contó.'); return; }
    const contado = Number(texto);
    const fecha = f.fecha.value || ctx.hoy();
    const debia = efectivoAl(filas, partida, fecha);
    const conteo = { id: `conteo-${Date.now()}`, caja: 'efectivo', fecha, contado, debia, creadoEn: new Date().toISOString() };
    await datos.actualizarFran({ conteos: [...(datos.estado.fran.conteos || []), conteo] });
    if (contado === debia) { vista.conteoPendiente = null; ui.toast('Listo: cuadró. Quedó anotado el conteo.'); } else vista.conteoPendiente = conteo.id;
    dibujar();
  });
  const cuadrar = raiz.querySelector('[data-cuadrar]');
  if (!cuadrar) return;
  const u = ultimoConteo(datos.estado);
  raiz.querySelector('[data-no-cuadrar]').addEventListener('click', () => { vista.conteoPendiente = null; dibujar(); });
  cuadrar.addEventListener('click', async () => {
    const dif = u.contado - u.debia;
    try {
      if (dif < 0) await datos.agregarAsiento({ libro: 'personal', fecha: u.fecha, tipo: 'gasto', categoria: 'Descuadre o Perdida', valor: -dif, cuenta: 'Efectivo', descripcion: 'Descuadre al contar el efectivo · no se sabe en qué se gastó' });
      else await datos.movimientoCaja({ fecha: u.fecha, tipo: 'aporte', caja: 'efectivo', monto: dif, nota: 'Sobró al contar el efectivo', origen: 'otro' });
      // Con la diferencia anotada, ese conteo ya cuadra.
      const conteos = (datos.estado.fran.conteos || []).map((x) => (x.id === u.id ? { ...x, debia: u.contado, ajuste: dif, creadoEn: new Date().toISOString() } : x));
      vista.conteoPendiente = null;
      await datos.actualizarFran({ conteos });
      ui.toast('Anotado. Ya cuadra con lo que contó.');
      dibujar();
    } catch (error) { ui.toast(error.message); }
  });
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
  const delMesE = nuevosPrimero(filas.filter((f) => f.fecha.slice(0, 7) === mes));
  const entro = delMesE.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
  const salio = delMesE.filter((f) => f.valor < 0).reduce((s, f) => s - f.valor, 0);
  const mesAntes = fechas.nombreMes(Number(fechas.sumarMeses(`${mes}-01`, -1).slice(5, 7))).toLowerCase();
  const dibujar = () => { contenedor.innerHTML = ''; renderEfectivo(contenedor, ctx); };
  const apartados = datos.estado.fran.apartados || [];
  const apartado = apartados.reduce((s, x) => s + x.valor, 0);
  // Por grupo (Alimentos, Préstamos, Mano de obra...), primero lo que más movió.
  const porGrupo = new Map();
  for (const f of delMesE) { if (!porGrupo.has(f.grupo)) porGrupo.set(f.grupo, []); porGrupo.get(f.grupo).push(f); }
  const grupos = [...porGrupo].sort((a, b) => Math.abs(b[1].reduce((t, f) => t + f.valor, 0)) - Math.abs(a[1].reduce((t, f) => t + f.valor, 0)));
  const rangoFechas = (lista) => { const fs = lista.map((f) => f.fecha).sort(); const a = fechas.formatear(fs[0]).replace(/ \d{4}$/, ''); const b = fechas.formatear(fs[fs.length - 1]).replace(/ \d{4}$/, ''); return a === b ? a : `${a} al ${b}`; };
  const raiz = ui.el(`<div class="fran-virtual">
    ${titular('personal', ctx, '#/inicio', 'Plata en efectivo', mes)}
    ${heroe({ etiqueta: 'Efectivo hoy', valor: total, ilustracion: 'billete', ayudaTexto: `Arranca con el cierre del mes pasado y suma o resta solo lo que entró o salió en efectivo.${apartado ? ` De eso, ${dinero.formatear(apartado)} está apartado y ${dinero.formatear(total - apartado)} es para gastar.` : ''}`, cajas: [[`Cierre de ${mesAntes}`, anterior], ['Entró', entro, entro ? 'mas' : ''], ['Salió', salio, salio ? 'menos' : '']] }, ctx)}
    ${bloqueConteo(ctx, filas, partida, total)}
    ${apartados.length ? `<details class="fran-tachados fran-prestado-pension"><summary>${icono3d('bolsa', 'fran-3d--40')}<span class="fran-renglon__texto"><span>Apartado</span><small>Para gastar quedan ${dinero.formatear(total - apartado)}</small></span><b class="numero">${dinero.formatear(apartado)}</b></summary>
      <div class="fran-lista">${apartados.map((x) => `<div class="fran-fila"><span class="fran-fila__texto"><strong>${ui.esc(x.nombre)}</strong>${x.nota ? `<small>${ui.esc(x.nota)}</small>` : ''}</span><span class="fran-fila__valor numero">${dinero.formatear(x.valor)}</span><button type="button" class="fran-boton-secundario fran-boton--44" data-quitar-apartado="${ui.esc(x.id)}">Ya no</button></div>`).join('')}</div>
    </details>` : ''}
    <div class="fran-dos fran-virtual__botones"><button type="button" class="fran-boton-secundario fran-boton-entra" data-nuevo="aporte"><span class="fran-signo fran-signo--mas" aria-hidden="true"></span>Entró</button><button type="button" class="fran-boton-secundario fran-boton-sale" data-nuevo="retiro"><span class="fran-signo fran-signo--menos" aria-hidden="true"></span>Salió</button></div>
    <form class="fran-campos fran-campos--grande oculto" data-form-mov novalidate>
      <label><small data-titulo>Entró</small><input name="concepto" autocomplete="off" placeholder="¿Quién o qué?"></label>
      <label class="fran-campo-valor"><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Fecha</small><input type="date" name="fecha" value="${ui.esc(mes === hoy.slice(0, 7) ? hoy : `${mes}-01`)}"></label>
      <button class="fran-boton-principal fran-guardar">Guardar</button>
    </form>
    <details class="fran-tachados"><summary>Apartar plata del efectivo</summary>
      <form class="fran-campos fran-campos--grande" data-form-apartar novalidate>
        <label><small>¿Para qué o de quién?</small><input name="nombre" autocomplete="off" placeholder="Ej. Pago de un cliente"></label>
        <label class="fran-campo-valor"><small>Cuánto</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
        <button class="fran-boton-principal fran-guardar">Apartar</button>
      </form>
    </details>
    ${grupos.map(([nombre, lista]) => { const suma = lista.reduce((t, f) => t + f.valor, 0); return `<details class="fran-tachados fran-prestado-pension">
      <summary>${icono3dDe(lista[0].icono, 'fran-3d--40')}<span class="fran-renglon__texto"><span>${ui.esc(nombre)}</span><small>${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'} · ${ui.esc(rangoFechas(lista))}</small></span><b>${conSigno(suma, dinero, suma < 0 ? 'menos' : 'mas')}</b></summary>
      <div class="fran-lista">${lista.map((f) => `<div class="fran-fila"><span class="fran-fila__texto"><strong>${ui.esc(f.titulo)}</strong><small>${ui.esc([fechas.formatear(f.fecha), f.sub].filter(Boolean).join(' · '))}</small></span><span class="fran-fila__valor numero ${f.valor < 0 ? 'fran-menos' : 'fran-mas'}">${dinero.formatear(Math.abs(f.valor))}</span>${f.manual ? `<button type="button" class="fran-boton-secundario fran-boton--44" data-quitar="${ui.esc(f.id)}">Quitar</button>` : ''}</div>`).join('')}</div>
    </details>`; }).join('') || '<p class="fran-vacio">Nada en efectivo este mes.</p>'}
  </div>`);
  raiz.querySelector('[data-elegir-mes]').addEventListener('click', () => abrirMeses(mes, ctx, (m) => { vista.mesEfectivo = m; dibujar(); }, meses));
  conectarConteo(raiz, ctx, filas, partida, dibujar);
  const form = raiz.querySelector('[data-form-mov]');
  let tipo = 'aporte';
  raiz.querySelectorAll('[data-nuevo]').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.nuevo;
    marcarEntraSale(raiz, b, form, tipo === 'aporte');
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
  raiz.querySelector('[data-form-apartar]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const nombre = f.nombre.value.trim();
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!nombre || !valor) { ui.toast('Escribe para qué y cuánto.'); return; }
    await datos.actualizarFran({ apartados: [...apartados, { id: `ap-${Date.now()}`, nombre, valor, fecha: hoy }] });
    ui.toast('Apartado.');
    dibujar();
  });
  raiz.querySelectorAll('[data-quitar-apartado]').forEach((b) => b.addEventListener('click', async () => {
    await datos.actualizarFran({ apartados: apartados.filter((x) => x.id !== b.dataset.quitarApartado) });
    dibujar();
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
    filas.push({ fecha: m.fecha, creadoEn: m.creadoEn, concepto: quien ? `${quien} · ${m.tipo === 'prestamo' ? 'Préstamo' : 'Pago'}` : (m.nota || m.tipo.replace(/_/g, ' ')), valor: m.monto * m.signo });
  }
  for (const a of estado.fran.asientos) {
    if (a.libro === 'terceros') continue;
    const concepto = a.descripcion || a.categoria;
    if (a.tipo === 'transferencia') {
      if (a.cuenta && !CUENTA_NO_VIRTUAL.test(a.cuenta)) filas.push({ fecha: a.fecha, creadoEn: a.creadoEn, concepto, valor: -a.valor });
      if (a.destino && !CUENTA_NO_VIRTUAL.test(a.destino)) filas.push({ fecha: a.fecha, creadoEn: a.creadoEn, concepto, valor: a.valor });
    } else if (a.cuenta && !CUENTA_NO_VIRTUAL.test(a.cuenta)) {
      filas.push({ fecha: a.fecha, creadoEn: a.creadoEn, concepto, valor: a.tipo === 'ingreso' ? a.valor : -a.valor });
    }
  }
  for (const m of estado.fran.virtualMov) filas.push({ id: m.id, creadoEn: m.creadoEn || ((String(m.id || '').match(/\d{12,}/) || [])[0] ? new Date(Number(String(m.id).match(/\d{12,}/)[0])).toISOString() : ''), fecha: m.fecha, concepto: m.concepto || (m.tipo === 'entra' ? 'Entró' : 'Salió'), valor: m.tipo === 'entra' ? m.valor : -m.valor });
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
  const delMesV = guardado ? (guardado.filas || []) : nuevosPrimero(filas.filter((f) => f.fecha.slice(0, 7) === mes));
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
    ${guardado ? '' : `<div class="fran-dos fran-virtual__botones"><button type="button" class="fran-boton-secundario fran-boton-entra" data-nuevo="entra"><span class="fran-signo fran-signo--mas" aria-hidden="true"></span>Entró</button><button type="button" class="fran-boton-secundario fran-boton-sale" data-nuevo="sale"><span class="fran-signo fran-signo--menos" aria-hidden="true"></span>Salió</button></div>
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
    marcarEntraSale(raiz, b, formMov, tipoMov === 'entra');
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
      ${icono3dDe(icono)}
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
    case 'tarjetas': return renderTarjetas(contenedor, ctx);
    case 'liquidez': return renderLiquidez(contenedor, ctx);
    case 'miplata': return renderMiPlata(contenedor, ctx);
    case 'libreta': return renderLibreta(contenedor, ctx);
    case 'credito': return renderCredito(contenedor, params.id, ctx);
    case 'soloIntereses': return renderSoloIntereses(contenedor, ctx);
    case 'propiedad': {
      const { delAnio } = arriendosDelAnio(ctx);
      const anio = vista.anioPropiedad === 'todo' ? '' : ` · ${vista.anioPropiedad}`;
      const gastosProp = deTipo(delLibro(asientos(ctx), 'arriendos'), 'gasto').filter((a) => a.propiedad === params.nombre && (vista.anioPropiedad === 'todo' || a.fecha.startsWith(vista.anioPropiedad)));
      return renderDetalle(contenedor, 'arriendos', `${params.nombre === 'Arriendos del mes' ? 'Sin repartir' : params.nombre}${anio}`, [...delAnio.filter((a) => a.categoria === params.nombre), ...gastosProp], '#/libro/arriendos/propiedades', ctx);
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
