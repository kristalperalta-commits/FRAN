/*
  fotos.js: la foto del recibo de un movimiento. Se reduce y queda guardada en este aparato,
  aparte de los datos: así la nube no se llena y cada guardado sigue siendo rápido.
*/

const BASE = 'fran-fotos';
const ALMACEN = 'fotos';

function abrir() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

export async function guardarFoto(id, texto) {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const t = db.transaction(ALMACEN, 'readwrite');
    t.objectStore(ALMACEN).put(texto, id);
    t.oncomplete = () => resolver();
    t.onerror = () => rechazar(t.error);
  });
}

export async function leerFoto(id) {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const pedido = db.transaction(ALMACEN).objectStore(ALMACEN).get(id);
    pedido.onsuccess = () => resolver(pedido.result || null);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

/** Todas las fotos de este aparato: { clave: foto }. Para meterlas en la copia de seguridad. */
export async function todasLasFotos() {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const salida = {};
    const cursor = db.transaction(ALMACEN).objectStore(ALMACEN).openCursor();
    cursor.onsuccess = () => { const c = cursor.result; if (!c) { resolver(salida); return; } salida[c.key] = c.value; c.continue(); };
    cursor.onerror = () => rechazar(cursor.error);
  });
}

/** Guarda en este aparato las fotos que venían en una copia. No borra las que ya hay. */
export async function restaurarFotos(fotos) {
  if (!fotos || typeof fotos !== 'object') return 0;
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const t = db.transaction(ALMACEN, 'readwrite');
    let n = 0;
    for (const [clave, valor] of Object.entries(fotos)) { t.objectStore(ALMACEN).put(valor, clave); n += 1; }
    t.oncomplete = () => resolver(n);
    t.onerror = () => rechazar(t.error);
  });
}

/** Devuelve la foto como texto JPEG, con el lado mayor de hasta `maximo` puntos. */
export function reducirFoto(archivo, maximo = 1200) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(imagen.width * escala);
      lienzo.height = Math.round(imagen.height * escala);
      lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL('image/jpeg', 0.7));
    };
    imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la foto.')); };
    imagen.src = url;
  });
}
