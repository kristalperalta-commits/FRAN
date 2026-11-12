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

  // Sombreado y relieve en porcentaje: 100 es como viene, 0 es plano, hasta 200 con halos más anchos.
  const CLAVE_RELIEVE = 'fran-relieve';
  const limitarRelieve = (n) => Math.min(200, Math.max(0, Math.round(n / 10) * 10));
  function relieveActual() {
    try { const v = Number(window.localStorage.getItem(CLAVE_RELIEVE)); return Number.isFinite(v) && window.localStorage.getItem(CLAVE_RELIEVE) !== null ? limitarRelieve(v) : 100; } catch (_error) { return 100; }
  }
  function aplicarRelieve(pct) {
    const n = limitarRelieve(pct);
    // En el estilo Sencillo todo va plano, sin importar la barra.
    const efectivo = estiloActual() === 'sencillo' ? 0 : n;
    document.documentElement.style.setProperty('--relieve', String(efectivo / 100));
    // El iPhone no entiende calc() dentro de color-mix: la luz se volvía transparente. Va el porcentaje ya hecho.
    document.documentElement.style.setProperty('--luz-alfa', `${Math.min(efectivo, 100)}%`);
    document.documentElement.setAttribute('data-relieve', efectivo <= 30 ? 'plano' : (efectivo > 100 ? 'fuerte' : 'normal'));
    return n;
  }
  function elegirRelieve(pct) {
    const n = aplicarRelieve(pct);
    try { window.localStorage.setItem(CLAVE_RELIEVE, String(n)); } catch (_error) { /* dura hasta cerrar la app */ }
    return n;
  }
  window.Relieve = { min: 0, max: 200, paso: 10, actual: relieveActual, elegir: elegirRelieve };

  // Estilo de toda la app: cómo se ve, aparte del color. Cada uno trae sus ajustes en la tuerquita.
  const CLAVE_ESTILO = 'fran-estilo';
  const ESTILOS = [
    { id: 'relieve', nombre: 'Sombras', ajustes: ['color', 'letra', 'sombreado'] },
    { id: 'sencillo', nombre: 'Sencillo', ajustes: ['color', 'letra'] },
    { id: 'lineas', nombre: 'Líneas', ajustes: ['color', 'letra', 'sombreado'] },
    { id: 'dibujos', nombre: 'Dibujitos', ajustes: ['color', 'letra', 'sombreado'] },
  ];
  function estiloActual() {
    try { const v = window.localStorage.getItem(CLAVE_ESTILO); return ESTILOS.some((e) => e.id === v) ? v : 'relieve'; } catch (_error) { return 'relieve'; }
  }
  function elegirEstilo(id) {
    const e = ESTILOS.some((x) => x.id === id) ? id : 'relieve';
    try { window.localStorage.setItem(CLAVE_ESTILO, e); } catch (_error) { /* dura hasta cerrar la app */ }
    document.documentElement.setAttribute('data-estilo', e);
    aplicarRelieve(relieveActual());
    return e;
  }
  window.Estilo = { lista: ESTILOS, actual: estiloActual, elegir: elegirEstilo };
  document.documentElement.setAttribute('data-estilo', estiloActual());
  aplicarRelieve(relieveActual());
})();
