/*
  Temas de la app. Se carga antes de los estilos para que no parpadee al abrir.
  El tema elegido se guarda en este aparato; si no se puede guardar, se usa el oscuro.
  Los colores de cada tema están en css/estilos.css, bajo [data-tema="..."].
*/
(function () {
  'use strict';

  const CLAVE = 'mis-prestamos-tema';
  const POR_DEFECTO = 'oscuro';

  // fondo, tarjeta, color y texto solo sirven para pintar la muestra y la barra del teléfono.
  const LISTA = [
    { id: 'oscuro', nombre: 'Oscuro', fondo: '#14161a', tarjeta: '#1f2228', color: '#60a5fa', texto: '#eef0f3' },
    { id: 'claro', nombre: 'Claro', fondo: '#e4e6ea', tarjeta: '#f1f2f4', color: '#1d4ed8', texto: '#1c2026' },
    { id: 'morada', nombre: 'Noche morada', fondo: '#17121f', tarjeta: '#231c31', color: '#b794f6', texto: '#f1edf8' },
    { id: 'menta', nombre: 'Verde menta', fondo: '#dcebe5', tarjeta: '#ecf5f1', color: '#0c655e', texto: '#12241d' },
    { id: 'rosa', nombre: 'Rosa', fondo: '#f1e2e8', tarjeta: '#f9f0f4', color: '#be185d', texto: '#2a1620' },
    { id: 'dorado', nombre: 'Dorado', fondo: '#ece5d3', tarjeta: '#f6f1e4', color: '#745704', texto: '#241d0d' }
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
