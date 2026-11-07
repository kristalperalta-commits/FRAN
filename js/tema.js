/*
  Temas de la app. Se carga antes de los estilos para que no parpadee al abrir.
  El tema elegido se guarda en este aparato; si no se puede guardar, se usa el oscuro.
  Los colores de cada tema están en css/estilos.css, bajo [data-tema="..."].
*/
(function () {
  'use strict';

  const CLAVE = 'mis-prestamos-tema';
  const CLAVE_MODO = 'fran-modo';
  const POR_DEFECTO = 'lila';

  // Cinco colores; cada uno se ve en claro o en oscuro con el sol y la luna (pedido el 6 nov 2026).
  // fondo sirve para pintar la barra del teléfono en cada modo.
  const LISTA = [
    { id: 'lila', nombre: 'Lila', muestra: '#7C5CF0', fondo: { claro: '#F4F2FB', oscuro: '#13112B' } },
    { id: 'rosa', nombre: 'Rosa', muestra: '#EE6AAE', fondo: { claro: '#FDF1F7', oscuro: '#24081A' } },
    { id: 'azul', nombre: 'Azul', muestra: '#3B9BF5', fondo: { claro: '#EFF5FD', oscuro: '#0B1730' } },
    { id: 'naranja', nombre: 'Naranja', muestra: '#FB923C', fondo: { claro: '#FFF5EC', oscuro: '#22130A' } },
    { id: 'verde', nombre: 'Verde', muestra: '#34C79A', fondo: { claro: '#ECFBF4', oscuro: '#04211A' } }
  ];
  // Los temas de antes pasan a su color y a su modo.
  const VIEJOS = { oscuro: ['lila', 'oscuro'], claro: ['lila', 'claro'], morada: ['lila', 'oscuro'], menta: ['verde', 'claro'], rosa: ['rosa', null], dorado: ['naranja', 'oscuro'] };

  function buscar(id) {
    const viejo = VIEJOS[id];
    const color = viejo ? viejo[0] : id;
    return LISTA.find((tema) => tema.id === color) || LISTA.find((tema) => tema.id === POR_DEFECTO);
  }

  function leer(clave) {
    try { return window.localStorage.getItem(clave); } catch (_error) { return null; }
  }

  function actual() {
    return buscar(leer(CLAVE)).id;
  }

  function modo() {
    const guardado = leer(CLAVE_MODO);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    const viejo = VIEJOS[leer(CLAVE)];
    if (viejo && viejo[1]) return viejo[1];
    return leer(CLAVE) === 'rosa' ? 'claro' : 'oscuro';
  }

  function aplicar(id) {
    const tema = buscar(id);
    const m = modo();
    document.documentElement.setAttribute('data-tema', tema.id);
    document.documentElement.setAttribute('data-modo', m);
    const barra = document.querySelector('meta[name="theme-color"]');
    if (barra) barra.setAttribute('content', tema.fondo[m]);
    return tema.id;
  }

  // Cada libro puede tener su propio tema; si no tiene, usa el de toda la app.
  const CLAVE_LIBROS = 'fran-tema-libros';
  let libroVisible = null;
  function temasLibros() {
    try { return JSON.parse(window.localStorage.getItem(CLAVE_LIBROS)) || {}; } catch (_error) { return {}; }
  }
  function temaDeLibro(libro) {
    const t = libro ? temasLibros()[libro] : null;
    return t ? buscar(t).id : null;
  }
  function aplicarPara(libro) {
    libroVisible = libro || null;
    return aplicar(temaDeLibro(libroVisible) || actual());
  }
  function elegir(id) {
    const elegido = buscar(id).id;
    // Se guarda el modo antes de cambiar el color, para no perder el de un tema viejo.
    if (!leer(CLAVE_MODO)) { try { window.localStorage.setItem(CLAVE_MODO, modo()); } catch (_error) { /* nada */ } }
    try {
      window.localStorage.setItem(CLAVE, elegido);
    } catch (_error) {
      // Sin almacenamiento el tema dura hasta cerrar la app.
    }
    aplicarPara(libroVisible);
    return elegido;
  }
  function elegirParaLibro(libro, id) {
    const mapa = temasLibros();
    if (id) mapa[libro] = buscar(id).id; else delete mapa[libro];
    try { window.localStorage.setItem(CLAVE_LIBROS, JSON.stringify(mapa)); } catch (_error) { /* dura hasta cerrar */ }
    aplicarPara(libroVisible);
  }

  // El sol y la luna: claro u oscuro para toda la app.
  function cambiarModo(nuevo) {
    const m = nuevo || (modo() === 'oscuro' ? 'claro' : 'oscuro');
    try { window.localStorage.setItem(CLAVE_MODO, m); } catch (_error) { /* dura hasta cerrar la app */ }
    aplicarPara(libroVisible);
    return m;
  }

  window.Tema = { lista: LISTA, actual, elegir, temaDeLibro, elegirParaLibro, aplicarPara, modo, cambiarModo, libroVisible: () => libroVisible };
  aplicar(actual());

  // Tamaño de la letra en porcentaje: agranda toda la app por igual (letras, números, botones y cuadros).
  const CLAVE_LETRA = 'fran-letra';
  const LETRAS_VIEJAS = { normal: 100, grande: 112, 'muy-grande': 125, enorme: 138 };
  const MIN = 85;
  const MAX = 150;
  const limitar = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)));
  function letraActual() {
    try {
      const v = window.localStorage.getItem(CLAVE_LETRA);
      if (v in LETRAS_VIEJAS) return LETRAS_VIEJAS[v];
      return Number(v) > 0 ? limitar(Number(v)) : 100;
    } catch (_error) { return 100; }
  }
  function aplicarLetra(pct) {
    const n = limitar(pct);
    document.documentElement.style.zoom = n === 100 ? '' : String(n / 100);
    // Para los arreglos de CSS cuando la letra es muy grande.
    document.documentElement.setAttribute('data-letra', n >= 132 ? 'enorme' : (n >= 118 ? 'muy-grande' : 'normal'));
    return n;
  }
  function elegirLetra(pct) {
    const n = aplicarLetra(pct);
    try { window.localStorage.setItem(CLAVE_LETRA, String(n)); } catch (_error) { /* dura hasta cerrar la app */ }
    return n;
  }
  window.Letra = { min: MIN, max: MAX, paso: 5, actual: letraActual, elegir: elegirLetra };
  aplicarLetra(letraActual());
})();
