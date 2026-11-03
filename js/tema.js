/*
  Temas de la app. Se carga antes de los estilos para que no parpadee al abrir.
  El tema elegido se guarda en este aparato; si no se puede guardar, se usa el oscuro.
  Los colores de cada tema están en css/estilos.css, bajo [data-tema="..."].
*/
(function () {
  'use strict';

  const CLAVE = 'mis-prestamos-tema';
  const POR_DEFECTO = 'oscuro';

  // fondo y texto solo sirven para pintar la muestra y la barra del teléfono.
  const LISTA = [
    { id: 'oscuro', nombre: 'Oscuro', detalle: '(predeterminado)', fondo: '#14161a', texto: '#eef0f3' },
    { id: 'claro', nombre: 'Claro', fondo: '#e4e6ea', texto: '#1c2026' },
    { id: 'morada', nombre: 'Noche morada', fondo: '#1f1b3d', texto: '#c4b5fd' },
    { id: 'menta', nombre: 'Verde menta', fondo: '#0a3026', texto: '#6ee7b7' },
    { id: 'rosa', nombre: 'Rosa', fondo: '#350d27', texto: '#f9a8d4' },
    { id: 'dorado', nombre: 'Dorado', fondo: '#33200a', texto: '#fcd34d' }
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

  function elegir(id) {
    const elegido = aplicar(id);
    try {
      window.localStorage.setItem(CLAVE, elegido);
    } catch (_error) {
      // Sin almacenamiento el tema dura hasta cerrar la app.
    }
    return elegido;
  }

  window.Tema = { lista: LISTA, actual, elegir };
  aplicar(actual());
})();
