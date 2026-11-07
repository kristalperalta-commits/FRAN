/*
  Service worker de Mis Préstamos.
  Estrategia: caché primero. Todos los archivos de la app se guardan al instalar y
  se sirven desde el caché; si uno no está, se pide a la red y se guarda.
  Al cambiar VERSION se crea un caché nuevo y se borran los viejos al activar.
*/

const VERSION = '3.29.0';
const NOMBRE_CACHE = `mis-prestamos-v${VERSION}`;

// Lista fija de todo lo que compone la app (incluye archivos de pantallas aunque
// todavía no existan: si alguno falta, la instalación sigue sin él).
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './iconos/icono.svg',
  './iconos/icono-180.png',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  './iconos/3d/billetera.png',
  './iconos/3d/banco.png',
  './iconos/3d/alcancia.png',
  './iconos/3d/portatil.png',
  './iconos/3d/edificio.png',
  './iconos/3d/personas.png',
  './iconos/3d/manos.png',
  './iconos/3d/billete.png',
  './iconos/3d/celular.png',
  './iconos/3d/tarjeta.png',
  './iconos/3d/grafica.png',
  './iconos/3d/clasico.png',
  './iconos/3d/bolsa.png',
  './css/estilos.css',
  './css/pantallas/inicio.css',
  './css/pantallas/clientes.css',
  './css/pantallas/prestamo.css',
  './css/pantallas/caja.css',
  './css/pantallas/agenda.css',
  './css/pantallas/ajustes.css',
  './css/pantallas/fran.css',
  './css/lila.css',
  './fuentes/poppins-300.woff2',
  './fuentes/poppins-400.woff2',
  './fuentes/poppins-500.woff2',
  './js/tema.js',
  './js/apariencia.js',
  './js/app.js',
  './js/candado.js',
  './js/texto.js',
  './js/fotos.js',
  './js/recordatorios.js',
  './js/nube.js',
  './js/nube-config.js',
  './js/ui.js',
  './js/datos.js',
  './js/motor.js',
  './js/fechas.js',
  './js/dinero.js',
  './js/casos.js',
  './js/pantallas/inicio.js',
  './js/pantallas/clientes.js',
  './js/pantallas/prestamo.js',
  './js/pantallas/caja.js',
  './js/pantallas/agenda.js',
  './js/pantallas/ajustes.js',
  './js/pantallas/fran.js',
  './iconos/icono.svg',
  './iconos/icono-maskable.svg'
];

// Instalación: guarda cada archivo por separado para que uno faltante no rompa todo.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(async (cache) => {
      await Promise.allSettled(
        ARCHIVOS.map(async (ruta) => {
          try {
            const respuesta = await fetch(ruta, { cache: 'no-cache' });
            if (respuesta.ok) await cache.put(ruta, respuesta);
          } catch (_error) {
            // Sin red o archivo inexistente: se omite y se intentará después.
          }
        })
      );
      await self.skipWaiting();
    })
  );
});

// Activación: borra cachés de versiones anteriores y toma control de las pestañas abiertas.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then(async (nombres) => {
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith('mis-prestamos-') && nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })
  );
});

// Peticiones: caché primero; si no está, red y se guarda la copia.
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // nunca se piden cosas de fuera

  evento.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then(async (enCache) => {
      if (enCache) return enCache;
      try {
        const respuesta = await fetch(peticion);
        if (respuesta.ok) {
          const cache = await caches.open(NOMBRE_CACHE);
          cache.put(peticion, respuesta.clone());
        }
        return respuesta;
      } catch (_error) {
        // Sin red: para navegaciones se devuelve el index para que la app arranque igual.
        if (peticion.mode === 'navigate') {
          const indice = await caches.match('./index.html');
          if (indice) return indice;
        }
        return new Response('Sin conexión y el archivo no está guardado.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })
  );
});
