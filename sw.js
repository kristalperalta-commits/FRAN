/*
  Service worker de Mis Préstamos.
  Estrategia: caché primero. Todos los archivos de la app se guardan al instalar y
  se sirven desde el caché; si uno no está, se pide a la red y se guarda.
  Al cambiar VERSION se crea un caché nuevo y se borran los viejos al activar.
*/

const VERSION = '3.48.0';
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
  './iconos/3d/gota.png',
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
  './iconos/3d/paleta.png',
  './iconos/3d/engranaje.png',
  './iconos/3d/carpeta.png',
  './iconos/3d/monedas.png',
  './iconos/3d/reloj.png',
  './iconos/3d/repetir.png',
  './iconos/3d/nube.png',
  './iconos/3d/candado.png',
  './iconos/3d/mundo.png',
  './iconos/3d/info.png',
  './iconos/3d/documento.png',
  './iconos/3d/porcentaje.png',
  './iconos/3d/calendario.png',
  './iconos/3d/tabla.png',
  './iconos/3d/recibo.png',
  './iconos/3d/lista.png',
  './iconos/3d/telefono.png',
  './iconos/3d/chat.png',
  './iconos/3d/usuario.png',
  './iconos/3d/manzana.png',
  './iconos/3d/plato.png',
  './iconos/3d/casa.png',
  './iconos/3d/carro.png',
  './iconos/3d/gasolina.png',
  './iconos/3d/bombilla.png',
  './iconos/3d/bolsas.png',
  './iconos/3d/pastilla.png',
  './iconos/3d/balanza.png',
  './iconos/3d/avion.png',
  './iconos/3d/labial.png',
  './iconos/3d/balon.png',
  './iconos/3d/claqueta.png',
  './iconos/3d/bus.png',
  './iconos/3d/libros.png',
  './iconos/3d/regalo.png',
  './iconos/3d/camiseta.png',
  './iconos/3d/pregunta.png',
  './iconos/3d/obrero.png',
  './iconos/3d/ladrillo.png',
  './iconos/3d/tv.png',
  './iconos/3d/caja.png',
  './iconos/3d/mas.png',
  './iconos/3d/lapiz.png',
  './iconos/3d/marcador.png',
  './iconos/3d/carpeta-azul.png',
  './iconos/3d/reloj-azul.png',
  './iconos/3d/repetir-azul.png',
  './iconos/3d/nube-azul.png',
  './iconos/3d/candado-azul.png',
  './iconos/3d/mundo-azul.png',
  './iconos/3d/info-azul.png',
  './iconos/3d/celular-azul.png',
  './iconos/3d/calendario-azul.png',
  './iconos/3d/tabla-azul.png',
  './iconos/3d/recibo-azul.png',
  './iconos/3d/lista-azul.png',
  './iconos/3d/documento-azul.png',
  './iconos/3d/porcentaje-azul.png',
  './iconos/3d/personas-azul.png',
  './iconos/3d/grafica-azul.png',
  './iconos/3d/billete-azul.png',
  './iconos/3d/tarjeta-azul.png',
  './iconos/3d/clasico-azul.png',
  './iconos/3d/engranaje-azul.png',
  './css/estilos.css',
  './css/pantallas/inicio.css',
  './css/pantallas/clientes.css',
  './css/pantallas/prestamo.css',
  './css/pantallas/caja.css',
  './css/pantallas/agenda.css',
  './css/pantallas/ajustes.css',
  './css/pantallas/fran.css',
  './css/lila.css',
  './css/premium.css',
  './fuentes/poppins-300.woff2',
  './fuentes/poppins-400.woff2',
  './fuentes/poppins-500.woff2',
  './fuentes/inter-500.woff2',
  './fuentes/inter-600.woff2',
  './fuentes/inter-700.woff2',
  './js/tema.js',
  './js/apariencia.js',
  './js/avisos.js',
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

// Instalación: el código (html, css, js) tiene que bajar completo; si falta uno, esta versión no se
// instala y sigue la anterior entera, para no quedar con archivos viejos y nuevos mezclados (3.48.0).
// Las imágenes sí pueden faltar: se bajan después.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(async (cache) => {
      const esCodigo = (ruta) => ruta === './' || /\.(html|css|js|webmanifest)$/.test(ruta);
      const resultados = await Promise.all(
        ARCHIVOS.map(async (ruta) => {
          try {
            const respuesta = await fetch(ruta, { cache: 'reload' });
            if (!respuesta.ok) return !esCodigo(ruta);
            await cache.put(ruta, respuesta);
            return true;
          } catch (_error) {
            return !esCodigo(ruta);
          }
        })
      );
      if (resultados.includes(false)) {
        await caches.delete(NOMBRE_CACHE);
        throw new Error('No se pudo bajar la versión completa; se intenta después.');
      }
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
  // La consulta de "¿hay versión nueva?" va siempre a internet, nunca a lo guardado.
  if (url.pathname.endsWith('/sw.js') || peticion.cache === 'no-store') return;

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


// ---------- Avisos que llegan aunque Fran esté cerrada (Web Push) ----------
// La nube manda { titulo, cuerpo, id, url }. Se muestra con "Ya lo hice" y "Todavía no".
self.addEventListener('push', (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch (_error) { datos = { cuerpo: evento.data ? evento.data.text() : '' }; }
  const titulo = datos.titulo || 'Fran · pendiente de hoy';
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: datos.cuerpo || '',
    icon: './iconos/icono-192.png',
    badge: './iconos/icono-192.png',
    tag: `fran-${datos.id || 'aviso'}`,
    renotify: true,
    requireInteraction: true,
    data: { id: datos.id || '', url: datos.url || '#/agenda' },
    actions: [{ action: 'hecho', title: 'Ya lo hice' }, { action: 'luego', title: 'Todavía no' }],
  }));
});

// Al tocar: "Ya lo hice" lo tacha en la app (si está abierta) o deja la orden guardada para cuando abra.
self.addEventListener('notificationclick', (evento) => {
  const n = evento.notification;
  n.close();
  const accion = evento.action;
  const id = n.data && n.data.id;
  evento.waitUntil((async () => {
    if (accion === 'hecho' && id && id !== 'prueba') {
      const cache = await caches.open('fran-ordenes');
      const previas = await cache.match('./ordenes.json').then((r) => (r ? r.json() : [])).catch(() => []);
      await cache.put('./ordenes.json', new Response(JSON.stringify([...previas, { tipo: 'hecho', id, cuando: new Date().toISOString() }]), { headers: { 'Content-Type': 'application/json' } }));
    }
    if (accion === 'luego') return; // vuelve a avisar en el próximo turno de la nube
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const url = new URL((n.data && n.data.url) || '#/agenda', self.location.href).href;
    for (const c of clientes) { if ('focus' in c) { c.postMessage({ tipo: 'orden-aviso', accion, id }); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
