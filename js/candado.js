/*
  candado.js: entrada con Face ID, o con el código del aparato si Face ID falla.
  Usa WebAuthn, la llave del propio aparato (Face ID, huella o Windows Hello): la app nunca ve
  la cara ni el código. Cada aparato activa su propia llave.
  Si la llave se pierde, se entra con la contraseña de Fran en la nube.
  Es un candado para abrir la app; no cifra lo que está guardado en el aparato.
*/

const CLAVE = 'fran-candado';
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
    escribir({ ...leer(), credId: aTexto(cred.rawId), pospuesto: false });
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

function abrir() {
  cerradoAhora = false;
  if (capa) { capa.remove(); capa = null; }
  document.body.classList.remove('con-candado');
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
  capa.innerHTML = `<div class="candado__caja"><span class="candado__logo">F</span><h1>Fran</h1>${html}</div>`;
  return capa;
}

function mensajeDe(error) {
  if (error && error.name === 'NotAllowedError') return 'No se confirmó. Inténtalo otra vez.';
  return (error && error.message) || 'No se pudo. Inténtalo otra vez.';
}

function pantallaBloqueo(mensaje = '') {
  const c = pintar(`
    <button type="button" class="candado__boton" id="candado-entrar">Entrar con Face ID</button>
    <p class="candado__nota">Si Face ID falla, el teléfono te pide su código.</p>
    <p class="candado__error" aria-live="polite">${mensaje}</p>
    <button type="button" class="candado__enlace" id="candado-perdi">No puedo entrar</button>`);
  c.querySelector('#candado-entrar').addEventListener('click', () => intentar(true));
  c.querySelector('#candado-perdi').addEventListener('click', pantallaContrasena);
}

async function intentar(conMensaje) {
  if (verificando) return;
  try {
    await verificar();
    abrir();
  } catch (error) {
    pantallaBloqueo(conMensaje ? mensajeDe(error) : '');
  }
}

/** Salida si la llave se perdió: la contraseña de Fran en la nube, con internet. */
function pantallaContrasena() {
  const nube = ctx && ctx.nube;
  const correo = nube && nube.estado().sesion ? nube.estado().sesion.correo : '';
  const c = pintar(`
    <form id="candado-form" class="candado__form" novalidate>
      <label>Correo<input name="correo" type="email" autocomplete="username" value="${String(correo).replace(/"/g, '&quot;')}"></label>
      <label>Contraseña de Fran<input name="contrasena" type="password" autocomplete="current-password"></label>
      <button class="candado__boton">Entrar</button>
    </form>
    <p class="candado__nota">Necesita internet. Después podrás activar Face ID otra vez en Yo.</p>
    <p class="candado__error" id="candado-msg" aria-live="polite"></p>
    <button type="button" class="candado__enlace" id="candado-volver">Volver a Face ID</button>`);
  c.querySelector('#candado-volver').addEventListener('click', () => pantallaBloqueo());
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
      msg.textContent = mensajeDe(error);
    }
  });
}

function pantallaPrimeraVez(mensaje = '') {
  const c = pintar(`
    <p class="candado__texto">Protege tu plata: activa Face ID para que solo tú puedas abrir Fran en este aparato.</p>
    <button type="button" class="candado__boton" id="candado-activar">Activar Face ID</button>
    <p class="candado__error" aria-live="polite">${mensaje}</p>
    <button type="button" class="candado__enlace" id="candado-luego">Ahora no</button>`);
  c.querySelector('#candado-activar').addEventListener('click', async () => {
    try {
      await activar();
      abrir();
    } catch (error) {
      pantallaPrimeraVez(mensajeDe(error));
    }
  });
  c.querySelector('#candado-luego').addEventListener('click', () => {
    escribir({ ...leer(), pospuesto: true });
    abrir();
  });
}

function vigilar() {
  document.addEventListener('visibilitychange', () => {
    if (verificando) return;
    const { activo, minutos } = estado();
    if (!activo) return;
    if (document.visibilityState === 'hidden') {
      salidaEn = Date.now();
      return;
    }
    if (!salidaEn || cerradoAhora) return;
    const fuera = Date.now() - salidaEn;
    salidaEn = 0;
    if (fuera >= minutos * 60000) {
      cerradoAhora = true;
      pantallaBloqueo();
      intentar(false);
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
      if (c.credId) {
        alAbrir = resolver;
        cerradoAhora = true;
        pantallaBloqueo();
        intentar(false);
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
