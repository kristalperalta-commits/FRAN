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
let cambiosLocales = 0;    // cuenta los guardados locales, para saber si hubo alguno durante una subida
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
  // desconectada: este aparato ya estuvo en la nube y ahora no tiene sesión (se cerró sola).
  const desconectada = estadoSync.activa && !estadoSync.sesion && leerLocal(CLAVE_REVISION, null) != null;
  return { ...estadoSync, desconectada, sesion: estadoSync.sesion ? { correo: estadoSync.sesion.correo } : null };
}

/** Id de la persona que entró, o null. */
export function usuario() {
  return estadoSync.sesion ? estadoSync.sesion.usuario : null;
}

/** Llamada a la nube con la sesión de ella (renueva el permiso si venció). */
export function pedir(ruta, opciones = {}) {
  if (!estadoSync.sesion) throw new Error('Primero entra a la nube.');
  return llamar(ruta, opciones);
}

/** true mientras se están aplicando datos que llegaron del otro aparato. */
export function aplicandoDatosRemotos() {
  return aplicandoRemoto;
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
 * y en todas las listas de fran que llevan id (asientos, agenda, notas, créditos, conteos…).
 * Si los dos editaron el mismo registro, queda el local.
 * Lo borrado en cualquiera de los dos (estado.borrados) no vuelve (3.45.0).
 */
export function fusionar(local, remoto) {
  const resultado = JSON.parse(JSON.stringify(local));
  const otro = remoto || {};
  const conId = (lista) => Array.isArray(lista) && lista.some((x) => x && typeof x === 'object' && x.id);
  const unir = (lista, otra) => {
    const ids = new Set((lista || []).map((x) => x && x.id));
    for (const x of otra || []) if (x && x.id && !ids.has(x.id)) lista.push(x);
  };
  const COLECCIONES = ['clientes', 'prestamos', 'pagos', 'movimientos'];
  for (const c of COLECCIONES) {
    if (!Array.isArray(resultado[c])) resultado[c] = [];
    unir(resultado[c], otro[c]);
  }
  if (!resultado.fran) resultado.fran = {};
  const franOtro = otro.fran || {};
  for (const k of ['asientos', 'virtualMov']) if (!Array.isArray(resultado.fran[k])) resultado.fran[k] = [];
  for (const k of new Set([...Object.keys(resultado.fran), ...Object.keys(franOtro)])) {
    const mia = resultado.fran[k];
    const suya = franOtro[k];
    if (!conId(mia) && !conId(suya)) continue;
    if (mia != null && !Array.isArray(mia)) continue;
    if (!Array.isArray(mia)) resultado.fran[k] = [];
    unir(resultado.fran[k], suya);
  }
  // Categorías y cuentas que ella agregó en cualquiera de los dos aparatos.
  const extra = resultado.fran.categoriasExtra;
  const extraOtro = franOtro.categoriasExtra;
  if (extraOtro && typeof extraOtro === 'object') {
    if (!extra || typeof extra !== 'object') resultado.fran.categoriasExtra = { ...extraOtro };
    else for (const [llave, nombres] of Object.entries(extraOtro)) {
      if (!Array.isArray(nombres)) continue;
      const mios = Array.isArray(extra[llave]) ? extra[llave] : [];
      extra[llave] = [...mios, ...nombres.filter((n) => !mios.includes(n))];
    }
  }

  // Lo borrado: se juntan las dos listas (queda la fecha más reciente) y se quita de todo.
  const borrados = {};
  for (const origen of [otro.borrados, local.borrados]) {
    if (!origen || typeof origen !== 'object') continue;
    for (const [clave, cuando] of Object.entries(origen)) {
      if (typeof cuando === 'string' && (!borrados[clave] || cuando > borrados[clave])) borrados[clave] = cuando;
    }
  }
  const fue = (clave) => Object.prototype.hasOwnProperty.call(borrados, clave);
  // Un cliente borrado en un aparato al que el otro le hizo un préstamo: el cliente se queda.
  for (const p of resultado.prestamos) {
    if (p && p.clienteId && !fue(`prestamos:${p.id}`)) delete borrados[`clientes:${p.clienteId}`];
  }
  for (const c of COLECCIONES) resultado[c] = resultado[c].filter((x) => !(x && x.id && fue(`${c}:${x.id}`)));
  for (const k of Object.keys(resultado.fran)) {
    if (Array.isArray(resultado.fran[k])) resultado.fran[k] = resultado.fran[k].filter((x) => !(x && typeof x === 'object' && x.id && fue(`fran.${k}:${x.id}`)));
  }
  // En cascada: pagos y movimientos de caja de préstamos o pagos que ya no están.
  const prestamosVivos = new Set(resultado.prestamos.map((x) => x.id));
  const pagosAntes = resultado.pagos;
  resultado.pagos = pagosAntes.filter((g) => !g.prestamoId || prestamosVivos.has(g.prestamoId) || !fue(`prestamos:${g.prestamoId}`));
  const pagosVivos = new Set(resultado.pagos.map((x) => x.id));
  const pagosIdos = new Set(pagosAntes.filter((g) => !pagosVivos.has(g.id)).map((g) => g.id));
  resultado.movimientos = resultado.movimientos.filter((m) => !(m.prestamoId && fue(`prestamos:${m.prestamoId}`))
    && !(m.pagoId && (fue(`pagos:${m.pagoId}`) || pagosIdos.has(m.pagoId))));
  resultado.borrados = borrados;
  return resultado;
}

/* ---------- Llamadas a Supabase ---------- */

function cabeceras(conSesion = true) {
  const h = { apikey: NUBE.clave, 'Content-Type': 'application/json' };
  if (conSesion && estadoSync.sesion) h.Authorization = `Bearer ${estadoSync.sesion.token}`;
  return h;
}

async function llamar(ruta, opciones = {}, reintentar = true) {
  const limite = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(60000) } : {};
  const respuesta = await fetch(`${NUBE.url}${ruta}`, { ...limite, ...opciones, headers: { ...cabeceras(opciones.sinSesion !== true), ...(opciones.headers || {}) } });
  if (respuesta.status === 401 && reintentar && estadoSync.sesion) {
    await refrescarSesion();
    return llamar(ruta, opciones, false);
  }
  if (!respuesta.ok) {
    let detalle = '';
    try { const j = await respuesta.json(); detalle = j.msg || j.message || j.error_description || j.error || JSON.stringify(j); } catch { /* sin cuerpo */ }
    const error = new Error(traducir(detalle) || `La nube respondió ${respuesta.status}.`);
    error.estado = respuesta.status;
    throw error;
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
    // Otra pestaña o la app instalada pudo renovar la sesión antes: se usa esa.
    const guardada = leerLocal(CLAVE_SESION, null);
    if (guardada && guardada.refresco && guardada.refresco !== s.refresco) { cambiar({ sesion: guardada }); return; }
    // Sin internet o con la nube caída la sesión se conserva; solo se cierra si de verdad venció.
    if (![400, 401, 403].includes(error && error.estado)) throw error;
    cerrarSesionSola();
    throw new Error('La sesión de la nube se cerró. Entra de nuevo en Yo.');
  }
}

/** La sesión venció sin que ella saliera: se quita, pero queda anotado qué había visto y qué falta subir. */
function cerrarSesionSola() {
  escribirLocal(CLAVE_SESION, null);
  if (leerLocal(CLAVE_REVISION, null) == null) escribirLocal(CLAVE_REVISION, 0);
  cambiar({ sesion: null, ultimaVez: null, error: null });
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
  cambiar({ sesion: null, ultimaVez: null, error: null });
}

async function bajarFila() {
  const filas = await llamar(`/rest/v1/${TABLA}?select=datos,revision,actualizado_en&user_id=eq.${estadoSync.sesion.usuario}`, { method: 'GET', headers: { Accept: 'application/json' } });
  return Array.isArray(filas) && filas[0] ? filas[0] : null;
}

async function subirFila(texto, revision, base = 0) {
  const cuerpo = { datos: JSON.parse(texto), revision, actualizado_en: new Date().toISOString() };
  if (base > 0) {
    // Ya hay datos en la nube: solo se escriben si la nube sigue en la revisión que este aparato vio.
    // Si el otro aparato subió entre tanto, no se pisa: se vuelve a sincronizar y se juntan (3.47.0).
    const filas = await llamar(`/rest/v1/${TABLA}?user_id=eq.${estadoSync.sesion.usuario}&revision=eq.${base}&select=revision`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation', Accept: 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    if (!Array.isArray(filas) || filas.length === 0) {
      const error = new Error('La nube cambió mientras se subía.');
      error.choque = true;
      throw error;
    }
    return;
  }
  await llamar(`/rest/v1/${TABLA}?on_conflict=user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: estadoSync.sesion.usuario, ...cuerpo })
  });
}

/* ---------- Copias de seguridad de este aparato ---------- */

const BASE_COPIAS = 'fran-copias';

function abrirCopias() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE_COPIAS, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('copias');
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

/** Guarda lo que hay en este aparato antes de que la nube lo cambie. Quedan las últimas 5. */
export async function guardarCopiaLocal(motivo) {
  if (typeof indexedDB === 'undefined') return;
  try {
    const texto = datos.exportarJSON();
    const db = await abrirCopias();
    await new Promise((resolver, rechazar) => {
      const t = db.transaction('copias', 'readwrite');
      const almacen = t.objectStore('copias');
      almacen.put({ motivo, texto }, new Date().toISOString());
      const claves = almacen.getAllKeys();
      claves.onsuccess = () => { for (const vieja of claves.result.sort().slice(0, -5)) almacen.delete(vieja); };
      t.oncomplete = () => resolver();
      t.onerror = () => rechazar(t.error);
    });
  } catch (error) {
    console.error('No se pudo guardar la copia de seguridad:', error);
  }
}

/** Las copias guardadas en este aparato: [{ cuando, motivo, texto }], la más nueva primero. */
export async function copiasLocales() {
  if (typeof indexedDB === 'undefined') return [];
  const db = await abrirCopias();
  return new Promise((resolver, rechazar) => {
    const almacen = db.transaction('copias').objectStore('copias');
    const salida = [];
    const cursor = almacen.openCursor(null, 'prev');
    cursor.onsuccess = () => { const c = cursor.result; if (!c) { resolver(salida); return; } salida.push({ cuando: c.key, ...c.value }); c.continue(); };
    cursor.onerror = () => rechazar(cursor.error);
  });
}

/** Vuelve a dejar los datos como estaban en esa copia. Lo de ahora queda guardado como otra copia. */
export async function restaurarCopiaLocal(cuando) {
  const copia = (await copiasLocales()).find((c) => c.cuando === cuando);
  if (!copia) throw new Error('No encontré esa copia.');
  await guardarCopiaLocal('antes de volver a una copia');
  await datos.importarJSON(copia.texto);
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
let sincronizacionEnCurso = null;

export function sincronizar(motivo = 'manual') {
  if (sincronizacionEnCurso) return sincronizacionEnCurso;
  sincronizacionEnCurso = sincronizarUnaVez(motivo).finally(() => { sincronizacionEnCurso = null; });
  return sincronizacionEnCurso;
}

async function sincronizarUnaVez(motivo) {
  if (!configurada() || !estadoSync.sesion || !datos) return 'apagada';
  if (subiendo) await subiendo;
  cambiar({ sincronizando: true });
  try {
    const fila = await bajarFila();
    const remota = fila ? fila.revision : 0;
    const revisionVista = leerLocal(CLAVE_REVISION, 0);
    const pendiente = leerLocal(CLAVE_PENDIENTE, false);
    const hayDatosLocales = datos.estado.clientes.length + datos.estado.prestamos.length + ((datos.estado.fran && datos.estado.fran.asientos.length) || 0) > 0;
    const hayDatosNube = !!(fila && fila.datos && ((fila.datos.clientes || []).length + (fila.datos.prestamos || []).length + (((fila.datos.fran || {}).asientos || []).length) > 0));
    let accion = decidir({ revisionVista, remota, pendiente });
    // Primera entrada en un aparato con datos y nube vacía: se suben. Nube con datos y aparato vacío: se bajan.
    if (accion === 'nada' && !fila && hayDatosLocales) accion = 'subir';
    if (accion === 'choque' && !hayDatosLocales) accion = 'bajar';
    // Este aparato no sabe qué vio de la nube (entrada nueva o sesión que se cerró sola) y tiene datos: se juntan, nunca se pisan.
    if (accion === 'bajar' && !revisionVista && hayDatosLocales) accion = 'choque';
    // Un aparato vacío nunca sube su vacío encima de una nube con datos.
    if (accion === 'subir' && !hayDatosLocales && hayDatosNube) accion = 'bajar';

    if (accion === 'bajar') {
      if (hayDatosLocales) await guardarCopiaLocal('antes de bajar de la nube');
      await aplicarRemoto(fila);
      if (motivo !== 'entrada') avisar('Datos actualizados desde la nube.');
    } else if (accion === 'subir' || accion === 'choque') {
      if (accion === 'choque') {
        await guardarCopiaLocal('antes de juntar con la nube');
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
    const sinRed = /Failed to fetch|NetworkError|Load failed|timed out|TimeoutError|aborted/i.test(String(error && error.message));
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
  const marca = cambiosLocales;
  subiendo = (async () => {
    try {
      await subirFila(texto, revision, base);
      escribirLocal(CLAVE_REVISION, revision);
      const cambioMientras = cambiosLocales !== marca;
      escribirLocal(CLAVE_PENDIENTE, cambioMientras);
      cambiar({ pendiente: cambioMientras, enLinea: true, error: null, ultimaVez: new Date().toISOString() });
      if (cambioMientras) { clearTimeout(temporizador); temporizador = setTimeout(() => sincronizar('guardado'), 1500); }
    } catch (error) {
      if (error && error.choque) {
        // El otro aparato subió primero: queda pendiente y se vuelve a sincronizar para juntar.
        escribirLocal(CLAVE_PENDIENTE, true);
        cambiar({ pendiente: true });
        clearTimeout(temporizador);
        temporizador = setTimeout(() => sincronizar('guardado'), 800);
        return;
      }
      const sinRed = /Failed to fetch|NetworkError|Load failed|timed out|TimeoutError|aborted/i.test(String(error && error.message));
      escribirLocal(CLAVE_PENDIENTE, true);
      cambiar({ pendiente: true, enLinea: !sinRed, error: sinRed ? null : (error && error.message) || String(error) });
    } finally {
      subiendo = null;
    }
  })();
  await subiendo;
}

function programarSubida() {
  if (aplicandoRemoto) return;
  // Sin sesión también queda anotado que hay cambios sin subir: al volver a entrar se juntan, no se pisan.
  cambiosLocales += 1;
  escribirLocal(CLAVE_PENDIENTE, true);
  if (!estadoSync.sesion) { if (!estadoSync.pendiente) cambiar({ pendiente: true }); return; }
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
  window.addEventListener('storage', (evento) => {
    if (evento.key !== CLAVE_SESION) return;
    const nueva = leerLocal(CLAVE_SESION, null);
    if (nueva && (!estadoSync.sesion || nueva.refresco !== estadoSync.sesion.refresco)) cambiar({ sesion: nueva });
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar('vuelta'); });
  if (sesion) sincronizar('arranque');
}
