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
