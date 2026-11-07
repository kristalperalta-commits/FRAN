/*
  Temas de la app. Se carga antes de los estilos para que no parpadee al abrir.
  El tema elegido se guarda en este aparato; si no se puede guardar, se usa el oscuro.
  Los colores de cada tema están en css/estilos.css, bajo [data-tema="..."].
*/
(function () {
  'use strict';

  const CLAVE = 'mis-prestamos-tema';
  const POR_DEFECTO = 'oscuro';

  // Noche morada se quitó: quedaba casi igual al Lila oscuro. Quien la tenía pasa al Lila oscuro.
  // fondo y texto solo sirven para pintar la muestra y la barra del teléfono.
  const LISTA = [
    { id: 'oscuro', nombre: 'Lila oscuro', detalle: '(predeterminado)', fondo: '#13112B', texto: '#FFFFFF', muestra: '#8B6CFF' },
    { id: 'claro', nombre: 'Lila claro', fondo: '#F4F2FB', texto: '#1F1B33', muestra: '#6A3DE8' },
    { id: 'menta', nombre: 'Verde menta', fondo: '#ECFBF4', texto: '#0E2E25', muestra: '#34C79A' },
    { id: 'rosa', nombre: 'Rosa', fondo: '#FDF1F7', texto: '#3A1230', muestra: '#EE6AAE' },
    { id: 'dorado', nombre: 'Dorado', fondo: '#221505', texto: '#FFFFFF', muestra: '#FCD34D' }
  ];

  function buscar(id) {
    return LISTA.find((tema) => tema.id === id) || LISTA.find((tema) => tema.id === POR_DEFECTO);
  }

  function actual() {
    try {
      return buscar(window.localStorage.getItem(CLAVE)).id;
    } catch (_error) {
      return POR_DEFECTO;
    }
  }

  function aplicar(id) {
    const tema = buscar(id);
    document.documentElement.setAttribute('data-tema', tema.id);
    const barra = document.querySelector('meta[name="theme-color"]');
    if (barra) barra.setAttribute('content', tema.fondo);
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
    return t && LISTA.some((x) => x.id === t) ? t : null;
  }
  function aplicarPara(libro) {
    libroVisible = libro || null;
    return aplicar(temaDeLibro(libroVisible) || actual());
  }
  function elegir(id) {
    const elegido = buscar(id).id;
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

  window.Tema = { lista: LISTA, actual, elegir, temaDeLibro, elegirParaLibro, aplicarPara, libroVisible: () => libroVisible };
  aplicar(actual());

  // Tamaño de la letra en porcentaje: agranda toda la app por igual (letras, números, botones y cuadros).
  const CLAVE_LETRA = 'fran-letra';
  const VIEJOS = { normal: 100, grande: 112, 'muy-grande': 125, enorme: 138 };
  const MIN = 85;
  const MAX = 150;
  const limitar = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)));
  function letraActual() {
    try {
      const v = window.localStorage.getItem(CLAVE_LETRA);
      if (v in VIEJOS) return VIEJOS[v];
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
