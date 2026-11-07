/*
  candado.js: entrada con Face ID, o con el código del aparato si Face ID falla.
  Usa WebAuthn, la llave del propio aparato (Face ID, huella o Windows Hello): la app nunca ve
  la cara ni el código. Cada aparato activa su propia llave.
  Si la llave se pierde, se entra con la contraseña de Fran en la nube.
  Es un candado para abrir la app; no cifra lo que está guardado en el aparato.
*/

const CLAVE = 'fran-candado';
// Si usó Fran hace menos de esto, abre directo sin pedir la cara. Ella lo puede cambiar en Yo.
const MINUTOS_POR_DEFECTO = 5;

let ctx = null;
let capa = null;
let cerradoAhora = false;
let verificando = false;
let salidaEn = 0;
let alAbrir = null;

function leer() {
  try { return JSON.parse(window.localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}

function escribir(valor) {
  try { window.localStorage.setItem(CLAVE, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}

function aTexto(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aBytes(texto) {
  const b = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function azar(n = 32) {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Verdadero si este aparato tiene Face ID, huella o Windows Hello disponibles. */
export async function disponible() {
  try {
    return !!(window.PublicKeyCredential
      && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export function estado() {
  const c = leer();
  return { activo: !!c.credId, minutos: Number.isInteger(c.minutos) ? c.minutos : MINUTOS_POR_DEFECTO };
}

export function cerrado() {
  return cerradoAhora;
}

export function fijarMinutos(minutos) {
  escribir({ ...leer(), minutos });
}

export function desactivar() {
  const { minutos } = leer();
  escribir({ pospuesto: true, minutos });
}

/** Crea la llave de este aparato. El sistema pide Face ID o el código. */
export async function activar() {
  verificando = true;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: azar(),
        rp: { name: 'Fran', id: window.location.hostname },
        user: { id: azar(16), name: 'Fran', displayName: 'Fran' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none',
      },
    });
    escribir({ ...leer(), credId: aTexto(cred.rawId), pospuesto: false, reactivado: true });
  } finally {
    verificando = false;
    salidaEn = 0;
  }
}

async function verificar() {
  const c = leer();
  verificando = true;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: azar(),
        allowCredentials: [{ type: 'public-key', id: aBytes(c.credId), transports: ['internal'] }],
        userVerification: 'required',
        rpId: window.location.hostname,
        timeout: 60000,
      },
    });
  } finally {
    verificando = false;
    salidaEn = 0;
  }
}

/* ---------- Pantalla ---------- */

const CARA = '<svg class="candado__cara" viewBox="0 0 96 40" aria-hidden="true"><circle cx="16" cy="18" r="13"/><circle class="ojo" cx="16" cy="18" r="7"/><circle cx="80" cy="18" r="13"/><circle class="ojo" cx="80" cy="18" r="7"/><path d="M36 30c6 6 18 6 24 0"/></svg>';

let turnoAuto = 0;

function colorBarra(color) {
  const barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute('content', color);
}

/** Guarda cuándo la usó por última vez: al volver a abrir antes del tiempo elegido, no pide la cara. */
function marcarUso() {
  escribir({ ...leer(), ultimaVez: Date.now() });
}

function abrir() {
  turnoAuto++;
  cerradoAhora = false;
  marcarUso();
  if (capa) { capa.remove(); capa = null; }
  document.body.classList.remove('con-candado');
  if (window.Tema && window.Tema.aplicarPara) window.Tema.aplicarPara(window.Tema.libroVisible());
  if (alAbrir) { const fn = alAbrir; alAbrir = null; fn(); }
}

function pintar(html) {
  if (!capa) {
    capa = document.createElement('div');
    capa.className = 'candado';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-label', 'Entrada a Fran');
    document.body.append(capa);
    document.body.classList.add('con-candado');
  }
  colorBarra('#111214');
  capa.innerHTML = `<div class="candado__caja"><p class="candado__logo">Fran</p>${html}</div>`;
  return capa;
}

function mensajeDe(error) {
  if (error && error.name === 'NotAllowedError') return 'No se confirmó. Toca la pantalla para intentar otra vez.';
  return (error && error.message) || 'No se pudo. Toca la pantalla para intentar otra vez.';
}

/** Boceto 1. Toda la pantalla sirve para lanzar Face ID: no hay botón que buscar. */
function pantallaBloqueo(mensaje = '', conSalida = false) {
  const c = pintar(`
    ${CARA}
    <p class="candado__titulo">Face ID</p>
    <p class="candado__nota">Si falla → código del teléfono</p>
    <p class="candado__error" aria-live="polite">${mensaje}</p>
    ${conSalida ? '<button type="button" class="candado__enlace" id="candado-perdi">No puedo entrar</button>' : ''}`);
  c.onclick = (e) => {
    if (e.target.closest('#candado-perdi')) { c.onclick = null; pantallaContrasena(); return; }
    intentar();
  };
}

/** Con un toque. El toque es el permiso que el iPhone exige en algunas versiones. */
async function intentar() {
  if (verificando) return;
  turnoAuto++;
  try {
    await verificar();
    abrir();
  } catch (error) {
    pantallaBloqueo(mensajeDe(error), true);
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sin tocar nada: lanza Face ID en cuanto la app está al frente. Si el iPhone lo rechaza de
 * inmediato (no alcanzó a preguntar), reintenta dos veces. Un rechazo lento es que ella canceló
 * o que Face ID falló: ahí no se insiste, para no quedar en un ciclo.
 */
async function automatico() {
  const turno = ++turnoAuto;
  for (let i = 0; i < 3; i++) {
    await dormir(i === 0 ? 250 : 700);
    if (turno !== turnoAuto || !cerradoAhora) return;
    if (document.visibilityState !== 'visible') return;
    if (verificando) return;
    const inicio = Date.now();
    try {
      await verificar();
      if (turno === turnoAuto) abrir();
      return;
    } catch (error) {
      if (turno !== turnoAuto) return;
      if (Date.now() - inicio > 1500) { pantallaBloqueo(mensajeDe(error), true); return; }
    }
  }
  if (turno === turnoAuto) pantallaBloqueo('Toca la pantalla para usar Face ID.', true);
}

/** Salida si la llave se perdió: la contraseña de Fran en la nube, con internet. */
function pantallaContrasena() {
  const nube = ctx && ctx.nube;
  const correo = nube && nube.estado().sesion ? nube.estado().sesion.correo : '';
  turnoAuto++;
  const c = pintar(`
    <form id="candado-form" class="candado__form" novalidate>
      <label>Correo<input name="correo" type="email" autocomplete="username" value="${String(correo).replace(/"/g, '&quot;')}"></label>
      <label>Contraseña de Fran<input name="contrasena" type="password" autocomplete="current-password"></label>
      <button class="candado__boton">Entrar</button>
    </form>
    <p class="candado__nota">Necesita internet. Después podrás activar Face ID otra vez en Yo.</p>
    <p class="candado__error" id="candado-msg" aria-live="polite"></p>
    <button type="button" class="candado__enlace" id="candado-volver">Volver a Face ID</button>`);
  c.onclick = null;
  c.querySelector('#candado-volver').addEventListener('click', () => { pantallaBloqueo(); intentar(); });
  c.querySelector('#candado-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = c.querySelector('#candado-msg');
    if (!nube || !nube.configurada()) { msg.textContent = 'La nube no está conectada en esta versión.'; return; }
    if (!f.correo.value.trim() || !f.contrasena.value) { msg.textContent = 'Escribe el correo y la contraseña.'; return; }
    msg.textContent = 'Comprobando…';
    try {
      await nube.entrar(f.correo.value.trim(), f.contrasena.value);
      desactivar();
      abrir();
    } catch (error) {
      msg.textContent = (error && error.message) || 'No se pudo entrar.';
    }
  });
}

function pantallaPrimeraVez(mensaje = '') {
  const c = pintar(`
    ${CARA}
    <p class="candado__texto">Activa Face ID para que solo tú puedas abrir Fran en este aparato.</p>
    <button type="button" class="candado__boton" id="candado-activar">Activar Face ID</button>
    <p class="candado__error" aria-live="polite">${mensaje}</p>
    <button type="button" class="candado__enlace" id="candado-luego">Ahora no</button>`);
  c.onclick = null;
  c.querySelector('#candado-activar').addEventListener('click', async () => {
    try {
      await activar();
      abrir();
    } catch (error) {
      pantallaPrimeraVez(mensajeDe(error).replace('Toca la pantalla para intentar otra vez.', 'Inténtalo otra vez.'));
    }
  });
  c.querySelector('#candado-luego').addEventListener('click', () => {
    escribir({ ...leer(), pospuesto: true });
    abrir();
  });
}

function vigilar() {
  window.addEventListener('pagehide', () => { if (!cerradoAhora && estado().activo) marcarUso(); });
  document.addEventListener('visibilitychange', () => {
    if (verificando) return;
    const { activo, minutos } = estado();
    if (!activo) return;
    if (document.visibilityState === 'hidden') {
      salidaEn = Date.now();
      if (!cerradoAhora) marcarUso();
      return;
    }
    if (!salidaEn) return;
    const fuera = Date.now() - salidaEn;
    salidaEn = 0;
    if (cerradoAhora) {
      automatico();
      return;
    }
    if (fuera >= minutos * 60000) {
      cerradoAhora = true;
      pantallaBloqueo();
      automatico();
    }
  });
}

/**
 * Se llama al arrancar. Devuelve una promesa que se cumple cuando la app ya se puede mostrar.
 * alVolverAAbrir se usa al desbloquear después de haber vuelto a cerrar.
 */
export function exigir(contexto) {
  ctx = contexto;
  vigilar();
  return new Promise((resolver) => {
    (async () => {
      const c = leer();
      // El iPhone cierra la app seguido: si la usó hace poco, abre sin pedir la cara.
      const reciente = c.credId && c.ultimaVez && Date.now() - c.ultimaVez < estado().minutos * 60000;
      if (reciente) {
        marcarUso();
        resolver();
        return;
      }
      if (c.credId) {
        alAbrir = resolver;
        cerradoAhora = true;
        pantallaBloqueo();
        automatico();
        return;
      }
      if (!c.pospuesto && await disponible()) {
        alAbrir = resolver;
        cerradoAhora = true;
        pantallaPrimeraVez();
        return;
      }
      resolver();
    })();
  });
}
