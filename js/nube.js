/*
  nube.js: guarda los datos de Fran en la nube (Supabase) para que el teléfono y el
  computador vean lo mismo.

  Cómo funciona:
  - Ella entra con correo y contraseña. La sesión queda en este aparato.
  - Cada vez que la app guarda, sube todo el estado (un solo registro por persona), con
    un número de revisión que crece de uno en uno.
  - Al abrir la app, al volver la conexión y al volver a la pantalla, baja lo que haya en
    la nube; si allá hay una revisión más nueva, reemplaza lo local y las pantallas se
    vuelven a dibujar.
  - Si los dos aparatos cambiaron a la vez sin conexión, gana el último que sube, y lo que
    se reemplaza queda guardado aparte en este aparato ("copia previa de la nube"), para
    que nada se pierda en silencio.

  Sin internet la app funciona igual; lo pendiente se sube cuando vuelva la señal.
*/

import { NUBE } from './nube-config.js';

const CLAVE_SESION = 'fran-nube-sesion';
const CLAVE_REVISION = 'fran-nube-revision';   // última revisión que este aparato vio en la nube
const CLAVE_PENDIENTE = 'fran-nube-pendiente'; // hay cambios locales sin subir
const CLAVE_RESPALDO = 'fran-nube-respaldo';   // copia previa de la nube cuando hubo choque
const TABLA = 'estados';

let datos = null;          // módulo datos.js
let avisar = () => {};     // (mensaje) → toast
let aplicandoRemoto = false;
let temporizador = null;
let subiendo = null;
const oyentes = new Set();
const estadoSync = { activa: false, sesion: null, ultimaVez: null, pendiente: false, enLinea: true, error: null, sincronizando: false };

/* ---------- Guardado local pequeño ---------- */

function leerLocal(clave, porDefecto = null) {
  try {
    const texto = window.localStorage.getItem(clave);
    return texto == null ? porDefecto : JSON.parse(texto);
  } catch {
    return porDefecto;
  }
}

function escribirLocal(clave, valor) {
  try {
    if (valor == null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin almacenamiento: la sesión dura hasta cerrar la app
  }
}

/* ---------- Estado visible para las pantallas ---------- */

export function configurada() {
  return !!(NUBE.url && NUBE.clave);
}

export function estado() {
  return { ...estadoSync, sesion: estadoSync.sesion ? { correo: estadoSync.sesion.correo } : null };
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function cambiar(parcial) {
  Object.assign(estadoSync, parcial);
  for (const fn of oyentes) {
    try { fn(estado()); } catch (error) { console.error(error); }
  }
}

/* ---------- Decisión: qué gana ---------- */

/**
 * Decide qué hacer al comparar lo local con lo que hay en la nube.
 * revisionVista: última revisión que este aparato vio. remota: revisión en la nube (0 si no hay).
 * pendiente: este aparato tiene cambios sin subir.
 * Devuelve 'bajar' (la nube es más nueva y aquí no hay cambios), 'subir' (aquí hay cambios y la
 * nube no avanzó), 'choque' (cambiaron los dos) o 'nada'.
 */
export function decidir({ revisionVista, remota, pendiente }) {
  const nubeAvanzo = remota > revisionVista;
  if (nubeAvanzo && pendiente) return 'choque';
  if (nubeAvanzo) return 'bajar';
  if (pendiente) return 'subir';
  return 'nada';
}

/**
 * Junta dos estados cuando cambiaron los dos aparatos a la vez. Se queda con lo local y
 * agrega lo que el otro aparato creó (por id) en clientes, préstamos, pagos, movimientos
 * y asientos de los libros. Si los dos editaron el mismo registro, queda el local.
 * Lo borrado en un aparato puede volver si el otro todavía lo tenía.
 */
export function fusionar(local, remoto) {
  const resultado = JSON.parse(JSON.stringify(local));
  const unir = (lista, otra) => {
    const ids = new Set((lista || []).map((x) => x.id));
    for (const x of otra || []) if (x && x.id && !ids.has(x.id)) lista.push(x);
  };
  for (const c of ['clientes', 'prestamos', 'pagos', 'movimientos']) {
    if (!Array.isArray(resultado[c])) resultado[c] = [];
    unir(resultado[c], remoto[c]);
  }
  if (!resultado.fran) resultado.fran = {};
  if (!Array.isArray(resultado.fran.asientos)) resultado.fran.asientos = [];
  unir(resultado.fran.asientos, remoto.fran && remoto.fran.asientos);
  return resultado;
}

/* ---------- Llamadas a Supabase ---------- */

function cabeceras(conSesion = true) {
  const h = { apikey: NUBE.clave, 'Content-Type': 'application/json' };
  if (conSesion && estadoSync.sesion) h.Authorization = `Bearer ${estadoSync.sesion.token}`;
  return h;
}

async function llamar(ruta, opciones = {}, reintentar = true) {
  const respuesta = await fetch(`${NUBE.url}${ruta}`, { ...opciones, headers: { ...cabeceras(opciones.sinSesion !== true), ...(opciones.headers || {}) } });
  if (respuesta.status === 401 && reintentar && estadoSync.sesion) {
    await refrescarSesion();
    return llamar(ruta, opciones, false);
  }
  if (!respuesta.ok) {
    let detalle = '';
    try { const j = await respuesta.json(); detalle = j.msg || j.message || j.error_description || j.error || JSON.stringify(j); } catch { /* sin cuerpo */ }
    throw new Error(traducir(detalle) || `La nube respondió ${respuesta.status}.`);
  }
  if (respuesta.status === 204) return null;
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}

function traducir(texto) {
  const t = String(texto || '');
  if (/invalid login credentials/i.test(t)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(t)) return 'Falta confirmar el correo. Revisa tu bandeja o apaga la confirmación en Supabase.';
  if (/already registered|already been registered/i.test(t)) return 'Ese correo ya tiene cuenta. Entra con tu contraseña.';
  if (/password should be at least/i.test(t)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/relation .* does not exist|Could not find the table/i.test(t)) return 'Falta crear la tabla "estados" en Supabase. Mira la guía.';
  if (/row-level security/i.test(t)) return 'Falta la regla de seguridad de la tabla. Mira la guía.';
  return t;
}

function decodificarUsuario(token) {
  try {
    const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(cuerpo)))).sub || null;
  } catch {
    return null;
  }
}

function guardarSesion(respuesta, correo) {
  const sesion = {
    token: respuesta.access_token,
    refresco: respuesta.refresh_token,
    usuario: decodificarUsuario(respuesta.access_token),
    correo: (respuesta.user && respuesta.user.email) || correo
  };
  escribirLocal(CLAVE_SESION, sesion);
  cambiar({ sesion, error: null });
  return sesion;
}

async function refrescarSesion() {
  const s = estadoSync.sesion;
  if (!s || !s.refresco) throw new Error('La sesión venció. Entra de nuevo.');
  try {
    const r = await llamar('/auth/v1/token?grant_type=refresh_token', { method: 'POST', sinSesion: true, body: JSON.stringify({ refresh_token: s.refresco }) }, false);
    guardarSesion(r, s.correo);
  } catch (error) {
    salir();
    throw new Error('La sesión venció. Entra de nuevo.');
  }
}

export async function registrar(correo, contrasena) {
  const r = await llamar('/auth/v1/signup', { method: 'POST', sinSesion: true, body: JSON.stringify({ email: correo, password: contrasena }) }, false);
  if (!r.access_token) throw new Error('Cuenta creada. Confirma el correo y luego entra.');
  guardarSesion(r, correo);
  await sincronizar('entrada');
}

export async function entrar(correo, contrasena) {
  const r = await llamar('/auth/v1/token?grant_type=password', { method: 'POST', sinSesion: true, body: JSON.stringify({ email: correo, password: contrasena }) }, false);
  guardarSesion(r, correo);
  await sincronizar('entrada');
}

export function salir() {
  escribirLocal(CLAVE_SESION, null);
  escribirLocal(CLAVE_REVISION, null);
  escribirLocal(CLAVE_PENDIENTE, null);
  cambiar({ sesion: null, ultimaVez: null, pendiente: false, error: null });
}

async function bajarFila() {
  const filas = await llamar(`/rest/v1/${TABLA}?select=datos,revision,actualizado_en&user_id=eq.${estadoSync.sesion.usuario}`, { method: 'GET', headers: { Accept: 'application/json' } });
  return Array.isArray(filas) && filas[0] ? filas[0] : null;
}

async function subirFila(texto, revision) {
  await llamar(`/rest/v1/${TABLA}?on_conflict=user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: estadoSync.sesion.usuario, datos: JSON.parse(texto), revision, actualizado_en: new Date().toISOString() })
  });
}

/* ---------- Sincronización ---------- */

async function aplicarRemoto(fila) {
  aplicandoRemoto = true;
  try {
    await datos.importarJSON(JSON.stringify(fila.datos));
    escribirLocal(CLAVE_REVISION, fila.revision);
    escribirLocal(CLAVE_PENDIENTE, false);
    cambiar({ pendiente: false, ultimaVez: new Date().toISOString(), error: null });
  } finally {
    aplicandoRemoto = false;
  }
}

/**
 * Compara con la nube y hace lo que toque. `motivo` solo sirve para los mensajes.
 */
export async function sincronizar(motivo = 'manual') {
  if (!configurada() || !estadoSync.sesion || !datos) return 'apagada';
  if (subiendo) await subiendo;
  cambiar({ sincronizando: true });
  try {
    const fila = await bajarFila();
    const remota = fila ? fila.revision : 0;
    const revisionVista = leerLocal(CLAVE_REVISION, 0);
    const pendiente = leerLocal(CLAVE_PENDIENTE, false);
    const hayDatosLocales = datos.estado.clientes.length + datos.estado.prestamos.length + ((datos.estado.fran && datos.estado.fran.asientos.length) || 0) > 0;
    let accion = decidir({ revisionVista, remota, pendiente });
    // Primera entrada en un aparato con datos y nube vacía: se suben. Nube con datos y aparato vacío: se bajan.
    if (accion === 'nada' && !fila && hayDatosLocales) accion = 'subir';
    if (accion === 'choque' && !hayDatosLocales) accion = 'bajar';

    if (accion === 'bajar') {
      await aplicarRemoto(fila);
      if (motivo !== 'entrada') avisar('Datos actualizados desde la nube.');
    } else if (accion === 'subir' || accion === 'choque') {
      if (accion === 'choque') {
        escribirLocal(CLAVE_RESPALDO, { guardadoEn: new Date().toISOString(), revision: remota, datos: fila.datos });
        const junto = fusionar(JSON.parse(datos.exportarJSON()), fila.datos);
        aplicandoRemoto = true;
        try { await datos.importarJSON(JSON.stringify(junto)); } finally { aplicandoRemoto = false; }
        avisar('Había cambios de otro aparato. Se juntaron con los de aquí; la versión anterior quedó guardada en Yo.', 7000);
      }
      await subirAhora(remota);
    }
    cambiar({ enLinea: true, error: null, ultimaVez: new Date().toISOString() });
    return accion;
  } catch (error) {
    const sinRed = /Failed to fetch|NetworkError|Load failed/i.test(String(error && error.message));
    cambiar({ enLinea: !sinRed, error: sinRed ? null : (error && error.message) || String(error) });
    if (!sinRed && motivo === 'entrada') throw error;
    return 'error';
  } finally {
    cambiar({ sincronizando: false });
  }
}

async function subirAhora(revisionBase = null) {
  if (!configurada() || !estadoSync.sesion) return;
  const texto = datos.exportarJSON();
  const base = revisionBase == null ? leerLocal(CLAVE_REVISION, 0) : revisionBase;
  const revision = base + 1;
  subiendo = (async () => {
    try {
      await subirFila(texto, revision);
      escribirLocal(CLAVE_REVISION, revision);
      escribirLocal(CLAVE_PENDIENTE, false);
      cambiar({ pendiente: false, enLinea: true, error: null, ultimaVez: new Date().toISOString() });
    } catch (error) {
      const sinRed = /Failed to fetch|NetworkError|Load failed/i.test(String(error && error.message));
      cambiar({ pendiente: true, enLinea: !sinRed, error: sinRed ? null : (error && error.message) || String(error) });
    } finally {
      subiendo = null;
    }
  })();
  await subiendo;
}

function programarSubida() {
  if (aplicandoRemoto || !estadoSync.sesion) return;
  escribirLocal(CLAVE_PENDIENTE, true);
  cambiar({ pendiente: true });
  clearTimeout(temporizador);
  temporizador = setTimeout(() => sincronizar('guardado'), 1500);
}

/* ---------- Copia previa cuando hubo choque ---------- */

export function respaldo() {
  return leerLocal(CLAVE_RESPALDO, null);
}

export async function restaurarRespaldo() {
  const r = respaldo();
  if (!r) throw new Error('No hay copia previa guardada.');
  await datos.importarJSON(JSON.stringify(r.datos));
  escribirLocal(CLAVE_RESPALDO, null);
}

export function borrarRespaldo() {
  escribirLocal(CLAVE_RESPALDO, null);
}

/* ---------- Arranque ---------- */

export function iniciar(moduloDatos, opciones = {}) {
  datos = moduloDatos;
  avisar = opciones.avisar || avisar;
  if (!configurada()) {
    cambiar({ activa: false });
    return;
  }
  const sesion = leerLocal(CLAVE_SESION, null);
  cambiar({ activa: true, sesion, pendiente: leerLocal(CLAVE_PENDIENTE, false), enLinea: typeof navigator === 'undefined' ? true : navigator.onLine !== false });
  datos.suscribir(programarSubida);
  window.addEventListener('online', () => sincronizar('conexion'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar('vuelta'); });
  if (sesion) sincronizar('arranque');
}
