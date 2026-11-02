/*
  ui.js: ayudas de interfaz para las pantallas de Mis Préstamos.
  No toca datos ni motor. Solo crea HTML, avisos y diálogos.

  EJEMPLOS DE USO
  ---------------

  import { el, esc, toast, confirmar, campo, campoDinero, campoFecha,
           leerFormulario, chipEstado, encabezado, vacio } from '../ui.js';

  // el(html): crea un elemento real a partir de texto HTML (devuelve el primer nodo).
  const tarjeta = el(`<div class="tarjeta"><p>Hola</p></div>`);
  contenedor.append(tarjeta);

  // esc(texto): escapa texto que viene de la usuaria antes de meterlo en HTML.
  contenedor.innerHTML = `<h2>${esc(cliente.nombre)}</h2>`;

  // toast(texto): aviso breve abajo que desaparece solo.
  toast('Pago guardado');

  // confirmar(texto): diálogo propio con "Cancelar" y "Sí". Devuelve true o false.
  if (await confirmar('¿Borrar este pago?')) { ... }
  if (await confirmar('¿Borrar todo?', { aceptar: 'Sí, borrar', peligro: true })) { ... }

  // campo({...}): HTML de un campo de formulario. tipo: text, tel, number, select, textarea, checkbox...
  form.innerHTML = campo({ etiqueta: 'Nombre', nombre: 'nombre', requerido: true, ayuda: 'Como lo conoce' })
    + campo({ etiqueta: 'Tipo', nombre: 'tipo', tipo: 'select', valor: 'cliente',
              opciones: [{ valor: 'cliente', texto: 'Cliente' }, { valor: 'familia', texto: 'Familia' }] })
    + campo({ etiqueta: 'Nota', nombre: 'nota', tipo: 'textarea' });

  // campoDinero({...}): igual que campo pero con teclado numérico y puntos de miles automáticos.
  //   Al leer el formulario devuelve un entero (acepta 1.234.567, 1234567, 200k, 1.5M).
  form.innerHTML += campoDinero({ etiqueta: 'Capital', nombre: 'capital', valor: 1000000, requerido: true });

  // campoFecha({...}): campo de fecha. valor en texto AAAA-MM-DD.
  form.innerHTML += campoFecha({ etiqueta: 'Fecha', nombre: 'fecha', valor: ctx.hoy(), requerido: true });

  // leerFormulario(form): objeto { nombre: valor } con dinero en enteros, number en Number,
  //   checkbox en true/false y lo demás en texto sin espacios a los lados.
  const valores = leerFormulario(form);   // { nombre: 'Ramiro', capital: 1000000, fecha: '2026-11-02' }

  // chipEstado(estado): etiqueta de color para al_dia, atrasado, vencido, pagado, perdido, legal, congelado, familia.
  fila.innerHTML = `${esc(nombre)} ${chipEstado(resumen.estado)}`;

  // encabezado(titulo, { atras, accion }): barra de arriba con flecha atrás y un botón a la derecha.
  //   atras: true (vuelve atrás) o una ruta '#/clientes'. accion: { texto, ruta } o { texto, id } para
  //   engancharle un click después con document.getElementById(id).
  contenedor.innerHTML = encabezado('Clientes', { accion: { texto: 'Nuevo', ruta: '#/clientes/nuevo' } });
  contenedor.innerHTML = encabezado(cliente.nombre, { atras: '#/clientes', accion: { texto: 'Editar', id: 'boton-editar' } });

  // vacio(texto): mensaje centrado cuando no hay nada que mostrar.
  contenedor.innerHTML += vacio('Todavía no tienes clientes');
*/

// ---------- Textos de los estados ----------
const TEXTO_ESTADO = {
  al_dia: 'Al día',
  atrasado: 'Atrasado',
  vencido: 'Vencido',
  pagado: 'Pagado',
  perdido: 'Perdido',
  legal: 'Legal',
  congelado: 'Congelado',
  familia: 'Familia',
  por_confirmar: 'Por confirmar'
};

// ---------- Creación de elementos y escape ----------

/**
 * Crea un elemento a partir de texto HTML. Devuelve el primer elemento del texto.
 * Si el texto tiene varios nodos hermanos, devuelve solo el primero: envuélvelos en un div.
 */
export function el(html) {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = String(html).trim();
  return plantilla.content.firstElementChild;
}

/**
 * Escapa un texto para meterlo dentro de HTML sin riesgo.
 * Acepta null o undefined y devuelve texto vacío.
 */
export function esc(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Avisos (toast) ----------

let contenedorToast = null;

function obtenerContenedorToast() {
  if (!contenedorToast || !document.body.contains(contenedorToast)) {
    contenedorToast = document.createElement('div');
    contenedorToast.className = 'toast-contenedor';
    contenedorToast.setAttribute('role', 'status');
    contenedorToast.setAttribute('aria-live', 'polite');
    document.body.append(contenedorToast);
  }
  return contenedorToast;
}

/**
 * Muestra un aviso breve en la parte baja de la pantalla. Desaparece solo.
 * @param {string} texto
 * @param {number} [duracionMs=2600]
 */
export function toast(texto, duracionMs = 2600) {
  const contenedor = obtenerContenedorToast();
  const aviso = document.createElement('div');
  aviso.className = 'toast';
  aviso.textContent = String(texto);
  contenedor.append(aviso);
  setTimeout(() => {
    aviso.classList.add('toast--saliendo');
    setTimeout(() => aviso.remove(), 320);
  }, duracionMs);
}

// ---------- Diálogo de confirmación ----------

/**
 * Pregunta con un diálogo propio (no window.confirm). Devuelve una promesa con true o false.
 * @param {string} texto Pregunta que se muestra.
 * @param {{aceptar?: string, cancelar?: string, peligro?: boolean}} [opciones]
 *   aceptar: texto del botón de sí (por defecto "Sí"); cancelar: texto del botón de no
 *   (por defecto "Cancelar"); peligro: pinta el botón de sí en rojo.
 */
export function confirmar(texto, opciones = {}) {
  const { aceptar = 'Sí', cancelar = 'Cancelar', peligro = false } = opciones;
  return new Promise((resolver) => {
    const fondo = el(`
      <div class="dialogo-fondo">
        <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-texto">
          <p class="dialogo__texto" id="dialogo-texto">${esc(texto)}</p>
          <div class="dialogo__botones">
            <button type="button" class="boton boton--secundario" data-respuesta="no">${esc(cancelar)}</button>
            <button type="button" class="boton ${peligro ? 'boton--peligro' : 'boton--primario'}" data-respuesta="si">${esc(aceptar)}</button>
          </div>
        </div>
      </div>
    `);

    const elementoActivo = document.activeElement;

    function cerrar(respuesta) {
      fondo.remove();
      document.removeEventListener('keydown', alTeclear);
      if (elementoActivo && typeof elementoActivo.focus === 'function') elementoActivo.focus();
      resolver(respuesta);
    }

    function alTeclear(evento) {
      if (evento.key === 'Escape') cerrar(false);
    }

    fondo.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-respuesta]');
      if (boton) {
        cerrar(boton.dataset.respuesta === 'si');
      } else if (evento.target === fondo) {
        cerrar(false); // tocar fuera del cuadro cancela
      }
    });
    document.addEventListener('keydown', alTeclear);

    document.body.append(fondo);
    fondo.querySelector('[data-respuesta="no"]').focus();
  });
}

// ---------- Campos de formulario ----------

function atributosExtra(atributos) {
  if (!atributos) return '';
  return Object.entries(atributos)
    .map(([clave, valor]) => (valor === true ? ` ${clave}` : ` ${clave}="${esc(valor)}"`))
    .join('');
}

function etiquetaHtml(etiqueta, id, requerido) {
  if (!etiqueta) return '';
  return `<span class="campo__etiqueta" id="${id}-etiqueta">${esc(etiqueta)}${requerido ? ' <span class="campo__requerido" aria-hidden="true">*</span>' : ''}</span>`;
}

function ayudaHtml(ayuda, id) {
  return ayuda ? `<span class="campo__ayuda" id="${id}-ayuda">${esc(ayuda)}</span>` : '';
}

/**
 * Devuelve el HTML de un campo de formulario (etiqueta + entrada + ayuda).
 * @param {object} def
 * @param {string} def.etiqueta Texto visible encima del campo.
 * @param {string} def.nombre Atributo name; con él se lee en leerFormulario.
 * @param {string} [def.tipo='text'] text, tel, number, email, date, select, textarea, checkbox, hidden...
 * @param {*} [def.valor=''] Valor inicial.
 * @param {boolean} [def.requerido=false]
 * @param {string} [def.ayuda=''] Texto pequeño debajo.
 * @param {Array} [def.opciones] Solo para select: [{valor, texto}] o ['a', 'b'].
 * @param {string} [def.placeholder]
 * @param {object} [def.atributos] Atributos extra, por ejemplo { min: 0, step: 1, autocomplete: 'off' }.
 * @returns {string} HTML.
 */
export function campo(def) {
  const {
    etiqueta = '',
    nombre,
    tipo = 'text',
    valor = '',
    requerido = false,
    ayuda = '',
    opciones = null,
    placeholder = '',
    atributos = null
  } = def;
  const id = `campo-${nombre}`;
  const comunes = `id="${id}" name="${esc(nombre)}"${requerido ? ' required' : ''}${ayuda ? ` aria-describedby="${id}-ayuda"` : ''}${atributosExtra(atributos)}`;
  const valorTexto = valor === null || valor === undefined ? '' : String(valor);

  if (tipo === 'hidden') {
    return `<input type="hidden" ${comunes} value="${esc(valorTexto)}">`;
  }

  if (tipo === 'checkbox') {
    return `<label class="campo campo--casilla">
      <input type="checkbox" ${comunes}${valor ? ' checked' : ''} value="1">
      <span class="campo__etiqueta sin-margen">${esc(etiqueta)}</span>
      ${ayudaHtml(ayuda, id)}
    </label>`;
  }

  let entrada;
  if (tipo === 'select') {
    const lista = (opciones || []).map((opcion) => {
      const esObjeto = opcion && typeof opcion === 'object';
      const valorOpcion = esObjeto ? opcion.valor : opcion;
      const textoOpcion = esObjeto ? opcion.texto : opcion;
      const seleccionada = String(valorOpcion) === valorTexto ? ' selected' : '';
      return `<option value="${esc(valorOpcion)}"${seleccionada}>${esc(textoOpcion)}</option>`;
    }).join('');
    entrada = `<select ${comunes}>${lista}</select>`;
  } else if (tipo === 'textarea') {
    entrada = `<textarea ${comunes}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''} rows="3">${esc(valorTexto)}</textarea>`;
  } else {
    const modo = tipo === 'tel' ? ' inputmode="tel"' : tipo === 'number' ? ' inputmode="numeric"' : '';
    entrada = `<input type="${esc(tipo)}" ${comunes}${modo} value="${esc(valorTexto)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}>`;
  }

  return `<label class="campo" for="${id}">
    ${etiquetaHtml(etiqueta, id, requerido)}
    ${entrada}
    ${ayudaHtml(ayuda, id)}
  </label>`;
}

/**
 * Campo de dinero: teclado numérico, puntos de miles automáticos mientras escribe.
 * El valor se lee como entero en pesos con leerFormulario. Acepta también 200k y 1.5M.
 * Mismos parámetros que campo(); valor es un entero.
 */
export function campoDinero(def) {
  const { valor = '', atributos = null, placeholder = '0', ...resto } = def;
  const valorFormateado = valor === '' || valor === null || valor === undefined ? '' : formatearDinero(valor);
  return campo({
    ...resto,
    tipo: 'text',
    valor: valorFormateado,
    placeholder,
    atributos: { inputmode: 'numeric', autocomplete: 'off', 'data-dinero': true, ...(atributos || {}) }
  });
}

/**
 * Campo de fecha. valor en texto AAAA-MM-DD. Se lee como texto.
 * Mismos parámetros que campo().
 */
export function campoFecha(def) {
  return campo({ ...def, tipo: 'date' });
}

/**
 * Lee un formulario y devuelve un objeto { nombre: valor }.
 * - Campos con data-dinero: entero en pesos.
 * - type=number: Number (null si está vacío).
 * - checkbox: true o false. radio: el valor marcado.
 * - Todo lo demás: texto sin espacios a los lados.
 * @param {HTMLFormElement|HTMLElement} form
 */
export function leerFormulario(form) {
  const resultado = {};
  const elementos = form.elements ? Array.from(form.elements) : Array.from(form.querySelectorAll('input, select, textarea'));
  for (const elemento of elementos) {
    const nombre = elemento.name;
    if (!nombre || elemento.disabled) continue;
    if (elemento.tagName === 'BUTTON' || elemento.type === 'submit' || elemento.type === 'button') continue;

    if (elemento.type === 'checkbox') {
      resultado[nombre] = elemento.checked;
    } else if (elemento.type === 'radio') {
      if (elemento.checked) resultado[nombre] = elemento.value;
      else if (!(nombre in resultado)) resultado[nombre] = '';
    } else if (elemento.dataset.dinero !== undefined) {
      resultado[nombre] = leerDinero(elemento.value);
    } else if (elemento.type === 'number') {
      resultado[nombre] = elemento.value.trim() === '' ? null : Number(elemento.value);
    } else {
      resultado[nombre] = String(elemento.value).trim();
    }
  }
  return resultado;
}

// ---------- Dinero (formato y lectura local, sin depender de dinero.js) ----------

/**
 * Formatea un entero como 1.234.567. Negativos con signo adelante.
 */
export function formatearDinero(numero) {
  const entero = Math.round(Number(numero) || 0);
  const signo = entero < 0 ? '-' : '';
  const texto = String(Math.abs(entero));
  return signo + texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Convierte texto escrito por la usuaria a entero en pesos.
 * Acepta "1.234.567", "1234567", "$ 300.000", "200k", "1.5M", "1,5M". Devuelve 0 si no entiende.
 */
export function leerDinero(texto) {
  if (typeof texto === 'number') return Math.round(texto);
  let limpio = String(texto || '').trim().replace(/[$\s]/g, '');
  if (!limpio) return 0;
  const negativo = limpio.startsWith('-');
  if (negativo) limpio = limpio.slice(1);

  let multiplicador = 1;
  const sufijo = limpio.slice(-1).toLowerCase();
  if (sufijo === 'k') { multiplicador = 1000; limpio = limpio.slice(0, -1); }
  else if (sufijo === 'm') { multiplicador = 1000000; limpio = limpio.slice(0, -1); }

  let valor;
  if (multiplicador > 1) {
    // Con sufijo, el punto o la coma son decimales: 1.5M = 1.500.000
    valor = parseFloat(limpio.replace(',', '.'));
  } else {
    // Sin sufijo, los puntos son separadores de miles; una coma sería decimal y se descarta
    valor = parseInt(limpio.replace(/\./g, '').split(',')[0], 10);
  }
  if (!Number.isFinite(valor)) return 0;
  const resultado = Math.round(valor * multiplicador);
  return negativo ? -resultado : resultado;
}

/**
 * Indica si el texto parece un decimal a medio escribir ("1.", "1.5", "1.50"):
 * un solo punto o coma al final, o un solo punto seguido de uno o dos dígitos.
 * En ese caso no se reformatea, para que "1.5M" no termine en 15.000.000.
 */
export function pareceDecimalEnCurso(texto) {
  const crudo = String(texto || '');
  if (/[.,]$/.test(crudo)) return true;
  return /^\d+\.\d{1,2}$/.test(crudo);
}

// Formato automático en campos data-dinero: solo cuando el texto es dígitos y puntos
// y no parece un decimal a medio escribir (1.5 → 1.5M). Si escribe "200k" o "1.5M"
// se respeta hasta que salga del campo, y ahí se convierte.
if (typeof document !== 'undefined') {
  document.addEventListener('input', (evento) => {
    const entrada = evento.target;
    if (!(entrada instanceof HTMLInputElement) || entrada.dataset.dinero === undefined) return;
    const crudo = entrada.value;
    if (crudo === '' || /[^\d.]/.test(crudo)) return;
    if (pareceDecimalEnCurso(crudo)) return;
    const digitos = crudo.replace(/\D/g, '');
    entrada.value = digitos ? formatearDinero(parseInt(digitos, 10)) : '';
  });

  document.addEventListener('focusout', (evento) => {
    const entrada = evento.target;
    if (!(entrada instanceof HTMLInputElement) || entrada.dataset.dinero === undefined) return;
    if (entrada.value.trim() === '') return;
    entrada.value = formatearDinero(leerDinero(entrada.value));
  });
}

// ---------- Chips, encabezado y vacío ----------

/**
 * HTML de la etiqueta de color de un estado: al_dia, atrasado, vencido, pagado,
 * perdido, legal, congelado, familia. Un estado desconocido sale gris con su texto.
 */
export function chipEstado(estado) {
  const clave = String(estado || '').toLowerCase();
  const texto = TEXTO_ESTADO[clave] || (clave ? clave.replace(/_/g, ' ') : 'Sin estado');
  return `<span class="chip-estado chip-estado--${esc(clave || 'pagado')}">${esc(texto)}</span>`;
}

/**
 * Texto en español de un estado, sin HTML.
 */
export function textoEstado(estado) {
  return TEXTO_ESTADO[String(estado || '').toLowerCase()] || String(estado || '');
}

/**
 * HTML del encabezado de una pantalla.
 * @param {string} titulo
 * @param {{atras?: boolean|string, accion?: {texto: string, ruta?: string, id?: string, clase?: string}}} [opciones]
 *   atras: true vuelve a la página anterior; un texto es una ruta tipo '#/clientes'.
 *   accion: botón a la derecha. Con ruta es un enlace; con id es un botón al que la
 *   pantalla le engancha el click.
 */
export function encabezado(titulo, opciones = {}) {
  const { atras = false, accion = null } = opciones;
  let htmlAtras = '';
  if (atras === true) {
    htmlAtras = `<button type="button" class="encabezado__atras" data-atras aria-label="Volver">‹</button>`;
  } else if (typeof atras === 'string' && atras) {
    htmlAtras = `<a href="${esc(atras)}" class="encabezado__atras" aria-label="Volver">‹</a>`;
  }

  let htmlAccion = '';
  if (accion && accion.texto) {
    const clase = `boton boton--pequeno ${accion.clase || 'boton--primario'} encabezado__accion`;
    if (accion.ruta) {
      htmlAccion = `<a href="${esc(accion.ruta)}" class="${clase}">${esc(accion.texto)}</a>`;
    } else {
      htmlAccion = `<button type="button" class="${clase}"${accion.id ? ` id="${esc(accion.id)}"` : ''}>${esc(accion.texto)}</button>`;
    }
  }

  return `<header class="encabezado">
    ${htmlAtras}
    <h1 class="encabezado__titulo">${esc(titulo)}</h1>
    ${htmlAccion}
  </header>`;
}

// El botón "atrás" sin ruta vuelve en el historial; si no hay historial, va al inicio.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-atras]');
    if (!boton) return;
    evento.preventDefault();
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/inicio';
  });
}

/**
 * HTML de un mensaje centrado para cuando no hay nada que mostrar.
 */
export function vacio(texto) {
  return `<div class="vacio">${esc(texto)}</div>`;
}
