/*
  comprobante.js — la "fichita" de un pago para enviar por WhatsApp (3.60.0).

  armarComprobante: junta los pagos de un cliente en una fecha (varios préstamos = una sola ficha)
  y dice cómo quedó cada préstamo. Es una función pura, sin pantalla.
  dibujarComprobante: la pinta en un canvas y devuelve un PNG.
  compartirComprobante: la hoja de compartir del teléfono; si no hay, la descarga.
  La ficha no dice nada de la aplicación: es para el cliente.
*/

const formatoPesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fechaLarga(f) {
  const [a, m, d] = String(f).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
function fechaCorta(f) {
  const [, m, d] = String(f).split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/**
 * @param {{clientes:Array,prestamos:Array,pagos:Array}} estado  estado de la app
 * @param {{calcularPrestamo:Function}} motor
 * @returns {null | object} null si ese cliente no pagó nada ese día
 */
export function armarComprobante(estado, motor, clienteId, fecha, hoy) {
  const cliente = estado.clientes.find((c) => c.id === clienteId);
  const pagos = estado.pagos.filter((p) => p.clienteId === clienteId && p.fecha === fecha && p.tipo === 'pago');
  if (!cliente || pagos.length === 0) return null;
  const porPrestamo = new Map();
  for (const p of pagos) {
    if (!porPrestamo.has(p.prestamoId)) porPrestamo.set(p.prestamoId, []);
    porPrestamo.get(p.prestamoId).push(p);
  }
  const filas = [];
  let capitalPendiente = 0;
  let todosAlDia = true;
  let interes = 0;
  let capital = 0;
  const medios = new Set();
  for (const [prestamoId, lista] of porPrestamo) {
    const prestamo = estado.prestamos.find((x) => x.id === prestamoId);
    if (!prestamo) continue;
    const i = lista.reduce((s, x) => s + x.interes, 0);
    const c = lista.reduce((s, x) => s + x.capital, 0);
    lista.forEach((x) => medios.add(x.medio));
    interes += i;
    capital += c;
    const r = motor.calcularPrestamo(prestamo, estado.pagos.filter((x) => x.prestamoId === prestamoId), hoy);
    capitalPendiente += r.capitalPendiente;
    if (!(r.estado === 'al_dia' || r.estado === 'pagado')) todosAlDia = false;
    const partes = [];
    if (i > 0) partes.push(`Intereses ${formatoPesos(i)}`);
    if (c > 0) partes.push(`Capital ${formatoPesos(c)}`);
    filas.push({
      titulo: `Préstamo de ${formatoPesos(prestamo.capital)}`,
      sub: `Desde el ${fechaCorta(prestamo.fecha)}${partes.length > 1 || (i === 0 && c > 0) ? ` · ${partes.join(' · ')}` : ''}`,
      monto: i + c,
    });
  }
  if (filas.length === 0) return null;
  const total = interes + capital;
  const medio = medios.size === 1 ? [...medios][0] : 'varios';
  const pie = [
    todosAlDia ? `Quedan al día hoy, ${fechaCorta(fecha)}.` : 'Pago registrado.',
    capitalPendiente > 0 ? `Capital pendiente: ${formatoPesos(capitalPendiente)}` : 'Sin saldo pendiente',
  ];
  return {
    cliente: cliente.nombre, fecha, filas, interes, capital, total, medio, pie,
    titulo: capital > 0 && interes > 0 ? 'Pago recibido' : (capital > 0 ? 'Abono a capital' : 'Intereses pagados'),
    textoTotal: medio === 'efectivo' ? 'Total pagado en efectivo' : (medio === 'virtual' ? 'Total pagado por transferencia' : 'Total pagado'),
  };
}

function ajustar(ctx, texto, ancho) {
  const palabras = String(texto).split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Pinta la ficha y devuelve un Blob PNG. */
export function dibujarComprobante(c) {
  const W = 1080;
  const H = Math.max(1100, 760 + c.filas.length * 134 + 160);
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  const x = lienzo.getContext('2d');
  const fuente = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const fondo = x.createLinearGradient(0, 0, W, H);
  fondo.addColorStop(0, '#eef6f1');
  fondo.addColorStop(1, '#f7f3ea');
  x.fillStyle = fondo;
  x.fillRect(0, 0, W, H);
  const izq = 80, der = W - 80, ancho = der - izq;
  x.save();
  x.shadowColor = 'rgba(40,70,55,0.14)';
  x.shadowBlur = 50;
  x.shadowOffsetY = 18;
  x.fillStyle = '#fff';
  x.beginPath();
  x.roundRect(izq, 80, ancho, H - 160, 44);
  x.fill();
  x.restore();
  const ix = izq + 64, dx = der - 64;
  x.fillStyle = '#dff1e6';
  x.beginPath(); x.arc(W / 2, 190, 48, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#2f8a57'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(W / 2 - 22, 190); x.lineTo(W / 2 - 6, 207); x.lineTo(W / 2 + 24, 172); x.stroke();
  x.textAlign = 'center';
  x.fillStyle = '#26332c'; x.font = `700 54px ${fuente}`;
  x.fillText(c.titulo, W / 2, 310);
  x.fillStyle = '#6b7a72'; x.font = `400 30px ${fuente}`;
  let y = 362;
  for (const l of ajustar(x, `${c.cliente} · ${fechaLarga(c.fecha)}`, ancho - 128)) { x.fillText(l, W / 2, y); y += 40; }
  y += 22;
  x.textAlign = 'left';
  for (const f of c.filas) {
    x.fillStyle = '#edf1ee'; x.fillRect(ix, y, dx - ix, 2);
    x.fillStyle = '#26332c'; x.font = `400 32px ${fuente}`;
    x.fillText(f.titulo, ix, y + 58);
    x.fillStyle = '#7b8a82'; x.font = `400 25px ${fuente}`;
    x.fillText(f.sub, ix, y + 98);
    x.fillStyle = '#26332c'; x.font = `700 36px ${fuente}`;
    x.textAlign = 'right'; x.fillText(formatoPesos(f.monto), dx, y + 66); x.textAlign = 'left';
    y += 134;
  }
  y += 14;
  x.fillStyle = '#e9f5ee';
  x.beginPath(); x.roundRect(ix, y, dx - ix, 128, 26); x.fill();
  x.fillStyle = '#26332c'; x.font = `400 32px ${fuente}`;
  x.fillText(c.textoTotal, ix + 34, y + 76);
  x.fillStyle = '#1f6b42'; x.font = `700 50px ${fuente}`;
  x.textAlign = 'right'; x.fillText(formatoPesos(c.total), dx - 34, y + 84); x.textAlign = 'center';
  y += 128 + 60;
  x.fillStyle = '#6b7a72'; x.font = `400 26px ${fuente}`;
  for (const l of c.pie) for (const sl of ajustar(x, l, ancho - 128)) { x.fillText(sl, W / 2, y); y += 38; }
  return new Promise((resolver, rechazar) => lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo crear la imagen.'))), 'image/png'));
}

/** Comparte la ficha por la hoja del teléfono; si no se puede, la descarga. Devuelve 'compartido' o 'descargado'. */
export async function compartirComprobante(c) {
  const blob = await dibujarComprobante(c);
  const nombre = `comprobante-${c.fecha}.png`;
  const archivo = typeof File === 'function' ? new File([blob], nombre, { type: 'image/png' }) : null;
  if (archivo && navigator.share && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    await navigator.share({ files: [archivo] });
    return 'compartido';
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'descargado';
}
