/*
  avisos.js: notificaciones que llegan al teléfono aunque Fran esté cerrada (Web Push).
  La app pide permiso, se suscribe con la llave pública VAPID y guarda la suscripción en la nube
  (tabla suscripciones_push, una fila por aparato). Una función programada en Supabase lee los
  pendientes de la agenda y manda el aviso; el service worker (sw.js) lo muestra con los botones
  "Ya lo hice" y "Todavía no".
  En iPhone solo funciona con Fran agregada a la pantalla de inicio (iOS 16.4 o más).
*/

import { NUBE } from './nube-config.js';

// Llave pública VAPID: es pública por diseño, solo sirve para que el navegador acepte avisos de Fran.
export const LLAVE_PUBLICA = 'BFD5JiwiZ8AONNLRrRHNAV93wMQ7_zDl6uq9ndcYv25uFWHFbteAN3J2llsas5ipkg456fEQ6I_zhZnRI8FWYuI';

function aBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Si este navegador puede recibir avisos (y, en iPhone, si Fran está instalada). */
export function disponible() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  return true;
}

export function instaladaEnIphone() {
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return !ios || instalada;
}

export function estado() {
  if (!disponible()) return 'no-soportado';
  return Notification.permission; // 'default', 'granted' o 'denied'
}

function cabeceras(sesion) {
  return { apikey: NUBE.clave, Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' };
}

/** Pide permiso, se suscribe y guarda la suscripción en la nube. Devuelve 'ok' o el motivo. */
export async function activar(nube) {
  if (!disponible()) return 'no-soportado';
  if (!instaladaEnIphone()) return 'sin-instalar';
  const sesion = nube && nube.estado().sesion;
  if (!sesion) return 'sin-nube';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'negado';
  const registro = await navigator.serviceWorker.ready;
  let sub = await registro.pushManager.getSubscription();
  // Si quedó una suscripción hecha con otra llave, se cambia por una con la llave de hoy.
  if (sub && sub.options && sub.options.applicationServerKey) {
    const actual = new Uint8Array(sub.options.applicationServerKey);
    const buena = aBytes(LLAVE_PUBLICA);
    if (actual.length !== buena.length || actual.some((x, i) => x !== buena[i])) { await sub.unsubscribe().catch(() => {}); sub = null; }
  }
  if (!sub) sub = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(LLAVE_PUBLICA) });
  const j = sub.toJSON();
  const fila = { user_id: sesion.usuario, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparato: navigator.userAgent.slice(0, 120), actualizado_en: new Date().toISOString() };
  const r = await fetch(`${NUBE.url}/rest/v1/suscripciones_push?on_conflict=endpoint`, {
    method: 'POST', headers: { ...cabeceras(sesion), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila),
  });
  if (!r.ok) {
    let detalle = '';
    try { detalle = (await r.json()).message || ''; } catch { /* nada */ }
    throw new Error(detalle.includes('suscripciones_push') ? 'La nube todavía no tiene la tabla de avisos. Falta el paso del panel de Supabase.' : (detalle || `La nube respondió ${r.status}.`));
  }
  try { window.localStorage.setItem('fran-avisos', 'si'); } catch { /* nada */ }
  return 'ok';
}

/** Quita la suscripción de este aparato. */
export async function desactivar(nube) {
  const registro = await navigator.serviceWorker.ready;
  const sub = await registro.pushManager.getSubscription();
  const sesion = nube && nube.estado().sesion;
  if (sub && sesion) {
    await fetch(`${NUBE.url}/rest/v1/suscripciones_push?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE', headers: cabeceras(sesion) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  try { window.localStorage.removeItem('fran-avisos'); } catch { /* nada */ }
}

export async function activada() {
  if (!disponible()) return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    return !!(await registro.pushManager.getSubscription()) && Notification.permission === 'granted';
  } catch { return false; }
}

/** Aviso de prueba, local (sin pasar por la nube), para ver cómo se ve. */
export async function probar() {
  const registro = await navigator.serviceWorker.ready;
  await registro.showNotification('Fran · prueba', {
    body: 'Así te van a llegar los pendientes. Toca un botón.',
    icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png', tag: 'fran-prueba',
    data: { id: 'prueba', url: '#/agenda' },
    actions: [{ action: 'hecho', title: 'Ya lo hice' }, { action: 'luego', title: 'Todavía no' }],
  });
}
