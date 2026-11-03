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

const VERSION_APP = '3.6.2';
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
  { patron: '/libro/prestamos/personas', pantalla: 'fran', vista: 'personas', pestana: 'informes', libro: 'prestamos' },
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
const COLOR_LIBRO = { personal: '#22C55E', prestamos: '#3B82F6', pension: '#A855F7', productos: '#F97316', arriendos: '#EAB308', redes: '#EC4899', terceros: '#64748B' };

const DEGRADADO_LIBRO = {
  personal: ['#15803d', '#14532d'], prestamos: ['#2563eb', '#1e3a8a'], pension: ['#9333ea', '#581c87'], productos: ['#c2410c', '#7c2d12'],
  arriendos: ['#a16207', '#713f12'], redes: ['#be185d', '#831843'], terceros: ['#475569', '#1e293b'],
};

function marcarPestana(nombre, resuelta = null) {
  document.body.classList.toggle('sin-barra', !!(resuelta && resuelta.sinBarra));
  if (resuelta && resuelta.libro && COLOR_LIBRO[resuelta.libro]) libroActual = resuelta.libro;
  document.documentElement.style.setProperty('--libro', COLOR_LIBRO[libroActual]);
  const [g1, g2] = DEGRADADO_LIBRO[libroActual];
  document.documentElement.style.setProperty('--libro-g1', g1);
  document.documentElement.style.setProperty('--libro-g2', g2);
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
    // Instalada en el teléfono, la app casi nunca se recarga: al volver a ella se busca la versión nueva.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {});
    });
  }).catch((error) => {
    console.warn('No se pudo registrar el service worker:', error);
  });
}

// ---------- Arranque ----------

async function arrancar() {
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
