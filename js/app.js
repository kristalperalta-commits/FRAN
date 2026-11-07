/*
  app.js: arranque de Mis Préstamos.
  - Carga los módulos base (datos, motor, fechas, dinero) y ui.
  - Router por hash: resuelve la ruta, carga la pantalla con import() dinámico y
    llama render(contenedor, params, ctx).
  - Vuelve a dibujar cuando datos avisa por suscribir().
  - Marca la pestaña activa en la barra inferior.
  - Registra el service worker solo si la app se sirve por http o https.
  Si una pantalla no existe o falla, muestra el error en pantalla; nunca queda en blanco.
*/

import * as ui from './ui.js';

const VERSION_APP = '3.32.0';
const contenedor = document.getElementById('pantalla');

// ---------- Rutas (sección 7 de la especificación) ----------
// patron: segmentos separados por "/"; ":nombre" captura un parámetro.
// pantalla: módulo en ./pantallas/<pantalla>.js. vista: qué parte de la pantalla mostrar.
// pestana: qué pestaña de la barra se marca como activa.
const RUTAS = [
  { patron: '/inicio', pantalla: 'fran', vista: 'principal', pestana: null, sinBarra: true },
  { patron: '/otros', pantalla: 'fran', vista: 'otros', pestana: null, sinBarra: true },
  { patron: '/libro/arriendos/propiedades', pantalla: 'fran', vista: 'propiedades', pestana: 'inicio', libro: 'arriendos' },
  { patron: '/libro/arriendos/propiedad/:nombre', pantalla: 'fran', vista: 'propiedad', pestana: 'inicio', libro: 'arriendos' },
  { patron: '/credito/:id', pantalla: 'fran', vista: 'credito', pestana: 'inicio', libro: 'personal' },
  { patron: '/liquidez', pantalla: 'fran', vista: 'liquidez', pestana: 'inicio', libro: 'personal' },
  { patron: '/tarjetas', pantalla: 'fran', vista: 'tarjetas', pestana: 'inicio', libro: 'personal' },
  { patron: '/efectivo', pantalla: 'fran', vista: 'efectivo', pestana: 'inicio', libro: 'personal' },
  { patron: '/libro/prestamos/solo-intereses', pantalla: 'fran', vista: 'soloIntereses', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/libro/prestamos/tabla', pantalla: 'fran', vista: 'tablaPrestamos', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/libro/prestamos/personas',pantalla: 'fran', vista: 'personas', pestana: 'informes', libro: 'prestamos' },
  { patron: '/libro/prestamos/persona/:nombre', pantalla: 'fran', vista: 'persona', pestana: 'informes', libro: 'prestamos' },
  { patron: '/libro/prestamos/registrar/:tipo', pantalla: 'fran', vista: 'registrar', pestana: 'inicio', libro: 'prestamos', sinBarra: true },
  { patron: '/libro/prestamos/registrar/:tipo/:clienteId', pantalla: 'fran', vista: 'registrar', pestana: 'inicio', libro: 'prestamos', sinBarra: true },
  { patron: '/libro/pension/mover/:accion', pantalla: 'fran', vista: 'moverPension', pestana: 'inicio', libro: 'pension', sinBarra: true },
  { patron: '/libro/:libro', pantalla: 'fran', vista: 'libro', pestana: 'inicio' },
  { patron: '/libro/:libro/graficos', pantalla: 'fran', vista: 'graficos', pestana: 'graficos' },
  { patron: '/libro/:libro/calendario', pantalla: 'fran', vista: 'calendario', pestana: 'graficos' },
  { patron: '/libro/:libro/informes', pantalla: 'fran', vista: 'informes', pestana: 'informes' },
  { patron: '/libro/:libro/agregar/:tipo', pantalla: 'fran', vista: 'agregar', pestana: 'inicio', sinBarra: true },
  { patron: '/libro/:libro/categoria/:tipo/:categoria', pantalla: 'fran', vista: 'categoria', pestana: 'graficos' },
  { patron: '/clientes', pantalla: 'clientes', vista: 'lista', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/clientes/nuevo', pantalla: 'clientes', vista: 'nuevo', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/cliente/:id', pantalla: 'fran', vista: 'ficha', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/cliente/:id/editar', pantalla: 'clientes', vista: 'editar', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/cliente/:clienteId/pago', pantalla: 'prestamo', vista: 'pagoCliente', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/prestamo/nuevo/:clienteId', pantalla: 'prestamo', vista: 'nuevo', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/prestamo/:id', pantalla: 'prestamo', vista: 'ficha', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/prestamo/:id/pago', pantalla: 'prestamo', vista: 'pago', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/prestamo/:id/perdon', pantalla: 'prestamo', vista: 'perdon', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/caja', pantalla: 'caja', vista: 'lista', pestana: 'informes', libro: 'prestamos' },
  { patron: '/caja/movimiento/:tipo', pantalla: 'caja', vista: 'movimiento', pestana: 'informes', libro: 'prestamos' },
  { patron: '/agenda', pantalla: 'fran', vista: 'agenda', pestana: 'inicio', libro: 'prestamos' },
  { patron: '/virtual', pantalla: 'fran', vista: 'virtual', pestana: 'inicio', libro: 'personal' },
  { patron: '/ganancias', pantalla: 'fran', vista: 'ganancias', pestana: 'inicio', libro: 'personal' },
  { patron: '/ajustes', pantalla: 'ajustes', vista: 'ajustes', pestana: 'yo' },
  { patron: '/ajustes/:seccion', pantalla: 'ajustes', vista: 'ajustes', pestana: 'yo' }
];

/**
 * Convierte el hash actual en { ruta, pantalla, vista, pestana, params }.
 * params trae los parámetros de la ruta más `vista` y `ruta` para comodidad de la pantalla.
 * Devuelve null si ninguna ruta coincide.
 */
function resolverRuta(hash) {
  let ruta = (hash || '').replace(/^#/, '');
  if (!ruta || ruta === '/') ruta = '/inicio';
  if (!ruta.startsWith('/')) ruta = '/' + ruta;
  const [sinConsulta] = ruta.split('?');
  const segmentos = sinConsulta.split('/').filter(Boolean);

  for (const definicion of RUTAS) {
    const partes = definicion.patron.split('/').filter(Boolean);
    if (partes.length !== segmentos.length) continue;
    const params = {};
    let coincide = true;
    for (let i = 0; i < partes.length; i++) {
      if (partes[i].startsWith(':')) {
        params[partes[i].slice(1)] = decodeURIComponent(segmentos[i]);
      } else if (partes[i] !== segmentos[i]) {
        coincide = false;
        break;
      }
    }
    if (coincide) {
      params.vista = definicion.vista;
      params.ruta = sinConsulta;
      return { ruta: sinConsulta, pantalla: definicion.pantalla, vista: definicion.vista, pestana: definicion.pestana, libro: definicion.libro || params.libro || null, sinBarra: !!definicion.sinBarra, params };
    }
  }
  return null;
}

// ---------- Navegación ----------

/**
 * Cambia de pantalla. Acepta '#/clientes' o '/clientes'. Si la ruta es la misma,
 * vuelve a dibujar.
 */
function navegar(ruta) {
  const destino = String(ruta || '/inicio').startsWith('#') ? ruta : '#' + ruta;
  if (window.location.hash === destino) {
    renderizar({ conservarScroll: false });
  } else {
    window.location.hash = destino;
  }
}

// La barra es la de Mis Gastos: Inicio, Gráficos, +, Informes y Yo, siempre del libro actual.
let libroActual = 'personal';
const COLOR_LIBRO = { personal: 1, prestamos: 1, pension: 1, productos: 1, arriendos: 1, redes: 1, terceros: 1 };

// Sol y luna en todas las pantallas (pedido el 6 nov 2026). En Inicio va dentro de su cabecera.
const ICONO_SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
const ICONO_LUNA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5 8.5 8.5 0 1 0 20.5 14.6z"/></svg>';
let botonSolLuna = null;
function pintarSolLuna() {
  if (!botonSolLuna || !window.Tema) return;
  botonSolLuna.innerHTML = window.Tema.modo() === 'claro' ? ICONO_LUNA : ICONO_SOL;
}
function ponerSolLuna() {
  if (botonSolLuna) return;
  botonSolLuna = document.createElement('button');
  botonSolLuna.type = 'button';
  botonSolLuna.className = 'sol-luna';
  botonSolLuna.setAttribute('aria-label', 'Cambiar entre claro y oscuro');
  botonSolLuna.addEventListener('click', () => {
    if (window.Tema) window.Tema.cambiarModo();
    pintarSolLuna();
    const propio = document.querySelector('[data-modo-cambiar]');
    if (propio) propio.innerHTML = botonSolLuna.innerHTML;
  });
  document.body.append(botonSolLuna);
  pintarSolLuna();
}

function marcarPestana(nombre, resuelta = null) {
  document.body.classList.toggle('sin-barra', !!(resuelta && resuelta.sinBarra));
  if (resuelta && resuelta.libro && COLOR_LIBRO[resuelta.libro]) libroActual = resuelta.libro;
  // Diseño Lila: los libros ya no se pintan de su color; el acento sale del tema (css/lila.css).
  document.documentElement.dataset.libro = libroActual;
  document.body.classList.toggle('en-inicio', !!(resuelta && resuelta.ruta === '/inicio'));
  document.body.classList.toggle('en-yo', !!(resuelta && resuelta.ruta === '/ajustes'));
  ponerSolLuna();
  pintarSolLuna();
  // Si ese libro tiene su propio tema, se pone; en Inicio y lo demás, el de toda la app.
  if (window.Tema && window.Tema.aplicarPara) window.Tema.aplicarPara(resuelta && resuelta.libro ? resuelta.libro : null);
  const rutas = { inicio: `#/libro/${libroActual}`, graficos: `#/libro/${libroActual}/graficos`, informes: `#/libro/${libroActual}/informes`, yo: '#/ajustes' };
  document.querySelectorAll('.barra-inferior .pestana').forEach((pestana) => {
    const clave = pestana.dataset.pestana;
    if (rutas[clave]) pestana.setAttribute('href', rutas[clave]);
    const activa = clave === nombre;
    pestana.classList.toggle('pestana--activa', activa);
    if (activa) pestana.setAttribute('aria-current', 'page');
    else pestana.removeAttribute('aria-current');
  });
}

/**
 * Fecha de hoy como texto AAAA-MM-DD, con la hora local del teléfono.
 * Se usa fechas.hoy() si el módulo lo trae; si no, se arma a mano.
 */
function hoyLocal() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// ---------- Errores en pantalla ----------

function mostrarError(titulo, detalle, error) {
  const mensaje = error && error.message ? error.message : String(error || '');
  const pila = error && error.stack ? error.stack : '';
  contenedor.innerHTML = `
    ${ui.encabezado(titulo)}
    <div class="error-pantalla">
      <p>${ui.esc(detalle)}</p>
      ${mensaje ? `<p class="negrita">${ui.esc(mensaje)}</p>` : ''}
      ${pila ? `<pre>${ui.esc(pila)}</pre>` : ''}
    </div>
    <div class="botones">
      <button type="button" class="boton boton--primario" id="boton-reintentar">Intentar de nuevo</button>
      <a href="#/inicio" class="boton boton--secundario">Ir al inicio</a>
    </div>
  `;
  const reintentar = document.getElementById('boton-reintentar');
  if (reintentar) reintentar.addEventListener('click', () => renderizar({ conservarScroll: false }));
}

// ---------- Contexto compartido con las pantallas ----------

const ctx = {
  datos: null,
  motor: null,
  fechas: null,
  dinero: null,
  ui,
  navegar,
  hoy: hoyLocal,
  version: VERSION_APP
};

/**
 * Carga datos.js, motor.js, fechas.js y dinero.js con import() dinámico.
 * Devuelve la lista de módulos que fallaron (vacía si todo cargó).
 */
async function cargarModulosBase() {
  const nombres = ['datos', 'motor', 'fechas', 'dinero'];
  const resultados = await Promise.allSettled(nombres.map((nombre) => import(`./${nombre}.js`)));
  const fallos = [];
  resultados.forEach((resultado, i) => {
    const nombre = nombres[i];
    if (resultado.status === 'fulfilled') {
      const modulo = resultado.value;
      // Cada módulo puede exportar un objeto con su nombre o funciones sueltas.
      ctx[nombre] = modulo[nombre] || modulo.default || modulo;
    } else {
      fallos.push({ nombre, error: resultado.reason });
    }
  });
  if (ctx.fechas && typeof ctx.fechas.hoy === 'function') {
    ctx.hoy = () => ctx.fechas.hoy();
  }
  return fallos;
}

// ---------- Dibujo de pantallas ----------

let turnoRender = 0;        // para ignorar dibujos viejos si llegan tarde
let rutaActual = null;

/**
 * Dibuja la pantalla que corresponde al hash actual.
 * conservarScroll: true cuando se vuelve a dibujar la misma pantalla por un cambio de datos.
 */
async function renderizar({ conservarScroll = false } = {}) {
  if (ctx.candado && ctx.candado.cerrado()) return;
  const turno = ++turnoRender;
  const resuelta = resolverRuta(window.location.hash);

  if (!resuelta) {
    marcarPestana(null);
    document.title = 'Fran';
    contenedor.innerHTML = `
      ${ui.encabezado('Página no encontrada')}
      ${ui.vacio(`No existe la ruta "${window.location.hash}".`)}
      <a href="#/inicio" class="boton boton--primario boton--grande">Ir al inicio</a>
    `;
    return;
  }

  const mismaRuta = rutaActual === resuelta.ruta;
  rutaActual = resuelta.ruta;
  marcarPestana(resuelta.pestana, resuelta);
  const scrollAnterior = window.scrollY;

  try {
    const modulo = await import(`./pantallas/${resuelta.pantalla}.js`);
    if (turno !== turnoRender) return; // ya hay un dibujo más nuevo en camino

    if (typeof modulo.render !== 'function') {
      throw new Error(`La pantalla "${resuelta.pantalla}" no exporta la función render.`);
    }

    const titulo = typeof modulo.titulo === 'function' ? modulo.titulo(resuelta.params) : modulo.titulo;
    document.title = titulo ? `${titulo} · Fran` : 'Fran';

    contenedor.innerHTML = '';
    await modulo.render(contenedor, resuelta.params, ctx);
    if (turno !== turnoRender) return;

    if (conservarScroll && mismaRuta) {
      window.scrollTo(0, scrollAnterior);
    } else {
      window.scrollTo(0, 0);
    }
  } catch (error) {
    if (turno !== turnoRender) return;
    console.error(`Error en la pantalla "${resuelta.pantalla}":`, error);
    mostrarError(
      'Esta pantalla no se pudo abrir',
      `Hubo un problema al cargar la pantalla "${resuelta.pantalla}". Puedes intentar de nuevo o volver al inicio.`,
      error
    );
  }
}

// ---------- Service worker ----------

// La app no se agranda como una foto: Safari ignora el permiso de la página y hay que frenar el gesto.
function bloquearZoom() {
  for (const gesto of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(gesto, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

let registroSW = null;

/**
 * Deslizar hacia abajo en Inicio = actualizar (pedido el 6 nov 2026): sincroniza con la nube,
 * busca si hay versión nueva de Fran y vuelve a dibujar.
 */
/** Una línea de luz que recorre todo el contorno de la pantalla y desaparece (pedido el 7 nov 2026). */
function destelloBorde() {
  const viejo = document.querySelector('.destello-borde');
  if (viejo) viejo.remove();
  const capa = document.createElement('div');
  capa.className = 'destello-borde';
  capa.setAttribute('aria-hidden', 'true');
  capa.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" rx="8" ry="8" pathLength="100"/></svg>';
  document.body.append(capa);
  setTimeout(() => capa.remove(), 1700);
}

function activarDeslizarParaActualizar() {
  // Un círculo arriba: se llena mientras se hala, gira mientras actualiza y termina con ✓ (pedido el 7 nov 2026).
  const aviso = document.createElement('div');
  aviso.className = 'deslizar-circulo';
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-label', 'Actualizar');
  aviso.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="pista" cx="18" cy="18" r="13"/><circle class="arco" cx="18" cy="18" r="13"/><path class="chulo" d="M11.5 18.5l4.5 4.5 8.5-9"/></svg>';
  document.body.append(aviso);
  const arco = aviso.querySelector('.arco');
  const LARGO = 2 * Math.PI * 13;
  arco.style.strokeDasharray = `${LARGO}`;
  let inicioY = null;
  let tirando = 0;
  let ocupado = false;
  const UMBRAL = 80;
  const pantalla = document.getElementById('pantalla');
  const mover = (alto) => {
    const y = Math.min(alto, 120);
    aviso.style.transform = `translate(-50%, ${y * 0.7 - 50}px) rotate(${y * 2}deg)`;
    aviso.style.opacity = String(Math.min(1, alto / 40));
    arco.style.strokeDashoffset = String(LARGO * (1 - Math.min(1, alto / UMBRAL)));
    aviso.classList.toggle('listo-para-soltar', alto >= UMBRAL);
    pantalla.style.transition = alto ? 'none' : 'transform 0.35s cubic-bezier(.2,.7,.2,1)';
    pantalla.style.transform = alto ? `translateY(${Math.min(alto * 0.45, 70)}px)` : '';
  };
  const esconder = () => {
    aviso.className = 'deslizar-circulo';
    aviso.style.transition = 'transform .3s ease, opacity .3s ease';
    aviso.style.opacity = '0';
    aviso.style.transform = 'translate(-50%, -50px)';
    pantalla.style.transition = 'transform 0.35s cubic-bezier(.2,.7,.2,1)';
    pantalla.style.transform = '';
    setTimeout(() => { aviso.style.transition = ''; }, 320);
  };
  document.addEventListener('touchstart', (e) => {
    if (ocupado || e.touches.length !== 1 || !document.body.classList.contains('en-inicio') || window.scrollY > 0) { inicioY = null; return; }
    if (document.querySelector('.fran-hoja-fondo, .fran-meses-fondo, .dialogo-fondo')) { inicioY = null; return; }
    inicioY = e.touches[0].clientY;
    tirando = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (inicioY === null) return;
    tirando = Math.max(0, e.touches[0].clientY - inicioY);
    if (window.scrollY > 0) { inicioY = null; mover(0); return; }
    if (tirando > 6) mover(tirando);
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (inicioY === null) return;
    inicioY = null;
    if (tirando < UMBRAL) { esconder(); return; }
    ocupado = true;
    aviso.style.transition = 'transform .25s ease';
    aviso.style.transform = 'translate(-50%, 18px)';
    aviso.classList.add('girando');
    pantalla.style.transition = 'transform 0.3s ease';
    pantalla.style.transform = 'translateY(54px)';
    try {
      let resultado = 'apagada';
      if (ctx.nube) resultado = await ctx.nube.sincronizar('manual');
      if (registroSW) await registroSW.update().catch(() => {});
      await renderizar({ conservarScroll: false });
      aviso.classList.remove('girando');
      if (resultado === 'apagada') ui.toast('Para traer los datos de la nube, entra en Yo → Nube.');
      else if (resultado === 'error') ui.toast('No pude conectar con la nube. Revisa el internet e intenta otra vez.', 5000);
      else { aviso.classList.add('hecho'); destelloBorde(); await new Promise((r) => setTimeout(r, 700)); }
    } catch (error) {
      ui.toast(`No se pudo actualizar: ${error.message || error}`, 5000);
    } finally {
      ocupado = false;
      esconder();
    }
  });
}

/**
 * El iPhone a veces se queda con la app vieja guardada. Al abrir (y al volver a Fran) se mira en
 * internet cuál es la última versión; si esta es más vieja, se borra lo guardado y se recarga.
 * Una sola vez por versión, para no quedar en un ciclo.
 */
async function revisarVersion() {
  try {
    const texto = await (await fetch(`./sw.js?v=${Date.now()}`, { cache: 'no-store' })).text();
    const ultima = (texto.match(/VERSION = '([\d.]+)'/) || [])[1];
    if (!ultima || ultima === VERSION_APP) return;
    if (window.sessionStorage.getItem('fran-forzado') === ultima) return;
    window.sessionStorage.setItem('fran-forzado', ultima);
    if (registroSW) await registroSW.update().catch(() => {});
    if ('caches' in window) {
      const nombres = await caches.keys();
      await Promise.all(nombres.map((n) => caches.delete(n)));
    }
    window.location.reload();
  } catch (_error) {
    // Sin internet: sigue con la versión que tiene.
  }
}

function registrarServiceWorker() {
  const protocolo = window.location.protocol;
  if (protocolo !== 'http:' && protocolo !== 'https:') return;
  if (!('serviceWorker' in navigator)) return;
  // Si ya había una versión guardada y llega una nueva, se recarga una vez para mostrarla.
  const yaHabiaVersion = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!yaHabiaVersion || recargando) return;
    recargando = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((registro) => {
    registroSW = registro;
    registro.update().catch(() => {});
    setInterval(() => registro.update().catch(() => {}), 30 * 60000);
    revisarVersion();
    // Instalada en el teléfono, la app casi nunca se recarga: al volver a ella se busca la versión nueva.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { registro.update().catch(() => {}); revisarVersion(); }
    });
  }).catch((error) => {
    console.warn('No se pudo registrar el service worker:', error);
  });
}

// ---------- Arranque ----------

async function arrancar() {
  bloquearZoom();
  const fallos = await cargarModulosBase();
  if (fallos.length > 0) {
    const lista = fallos.map((f) => `${f.nombre}.js: ${f.error && f.error.message ? f.error.message : f.error}`).join('\n');
    mostrarError(
      'Faltan archivos de la app',
      'No se pudieron cargar estos módulos base. Sin ellos la app no puede funcionar.',
      new Error(lista)
    );
    marcarPestana(null);
    return;
  }

  try {
    await ctx.datos.cargar();
  } catch (error) {
    console.error('Error al cargar los datos:', error);
    mostrarError(
      'No se pudieron cargar los datos',
      'La app no pudo leer lo guardado en el teléfono. Si acabas de importar una copia, revisa el archivo.',
      error
    );
    return;
  }

  // Cada guardado vuelve a dibujar la pantalla actual conservando la posición.
  if (typeof ctx.datos.suscribir === 'function') {
    ctx.datos.suscribir(() => renderizar({ conservarScroll: true }));
  }

  try {
    const nube = await import('./nube.js');
    ctx.nube = nube;
    nube.iniciar(ctx.datos, { avisar: ui.toast });
  } catch (error) {
    console.warn('La nube no arrancó:', error);
  }

  window.addEventListener('hashchange', () => renderizar({ conservarScroll: false }));
  document.getElementById('boton-mas').addEventListener('click', async () => {
    const modulo = await import('./pantallas/fran.js');
    modulo.abrirMas(libroActual, ctx);
  });
  registrarServiceWorker();
  activarDeslizarParaActualizar();
  try {
    ctx.candado = await import('./candado.js');
    await ctx.candado.exigir(ctx);
  } catch (error) {
    console.warn('El candado no arrancó:', error);
  }
  try {
    const anotados = await ctx.datos.aplicarRecurrentes(ctx.hoy());
    if (anotados) ui.toast(`Anoté ${anotados} ${anotados === 1 ? 'movimiento recurrente' : 'movimientos recurrentes'}.`);
  } catch (error) {
    console.warn('No se pudieron anotar los recurrentes:', error);
  }
  await renderizar({ conservarScroll: false });
}

// Errores que nadie atrapó: se avisan, no se esconden.
window.addEventListener('unhandledrejection', (evento) => {
  const razon = evento.reason;
  const mensaje = razon && razon.message ? razon.message : String(razon);
  console.error('Error no atrapado:', razon);
  ui.toast(`Ocurrió un error: ${mensaje}`, 5000);
});

window.addEventListener('error', (evento) => {
  if (!evento.message) return;
  ui.toast(`Ocurrió un error: ${evento.message}`, 5000);
});

arrancar();

export { ctx, navegar, resolverRuta, RUTAS, VERSION_APP };
