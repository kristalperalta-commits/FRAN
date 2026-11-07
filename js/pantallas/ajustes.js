/*
  Pantalla de Ajustes (ruta #/ajustes). Dueño: agente pantalla ajustes.
  Secciones:
  - Temas: seis formas de ver la app.
  - Nombre del negocio.
  - Copia de seguridad: exportar (descarga copia-fran-AAAA-MM-DD.json) e importar.
  - Caja: atajo para registrar el saldo inicial.
  - Casos de prueba: reemplaza todo con los casos de casos.js (pide confirmación).
  - Borrar todo (doble confirmación).
  - Instalar en el teléfono: instrucciones para iPhone y Android.
  - Acerca de la app: versión, dónde se guarda, cuántos registros hay.

  Todo se pinta con ui.el y el texto que viene de la usuaria pasa por ui.esc.
  Toda operación que guarda va dentro de try/catch y avisa con ui.toast.
*/

import { CATEGORIAS_BASE, INGRESOS_DE_OTRO_LIBRO, LIBROS, categoriasDe, iconoDe } from './fran.js';
import { calendarioIcs } from '../recordatorios.js';

export const titulo = 'Yo';

// Lo abierto en Yo sigue abierto cuando la pantalla se vuelve a dibujar.
const abiertos = new Set();
let ultimoSalto = '';

/* ---------- Ayudas ---------- */

/** Nombre del archivo de la copia: copia-fran-AAAA-MM-DD.json */
function nombreArchivoCopia(hoy) {
  return `copia-fran-${hoy}.json`;
}

/** Verdadero si la app ya está abierta como instalada (pantalla de inicio). */
function estaInstalada() {
  try {
    if (window.navigator && window.navigator.standalone === true) return true;
    return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  } catch {
    return false;
  }
}

/** Intenta adivinar el teléfono para resaltar las instrucciones que le sirven. */
function tipoDeTelefono() {
  const agente = String((window.navigator && window.navigator.userAgent) || '');
  if (/iPhone|iPad|iPod/i.test(agente)) return 'iphone';
  if (/Android/i.test(agente)) return 'android';
  return 'otro';
}

/** Mensaje legible de un error. */
function textoError(error) {
  if (error && error.message) return error.message;
  return String(error || 'Ocurrió un error desconocido.');
}

/** Descarga un texto como archivo usando un enlace temporal. */
function descargarTexto(texto, nombreArchivo, tipo = 'application/json') {
  const archivo = new Blob([texto], { type: tipo });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.rel = 'noopener';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Verdadero si el teléfono permite compartir archivos con la hoja nativa. */
function puedeCompartirArchivos(nombreArchivo) {
  try {
    if (!window.navigator || typeof window.navigator.share !== 'function') return false;
    if (typeof window.navigator.canShare !== 'function' || typeof File !== 'function') return false;
    const prueba = new File(['{}'], nombreArchivo, { type: 'application/json' });
    return window.navigator.canShare({ files: [prueba] });
  } catch {
    return false;
  }
}

/** Lee un archivo elegido por la usuaria como texto. */
function leerArchivoComoTexto(archivo) {
  if (typeof archivo.text === 'function') return archivo.text();
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result || ''));
    lector.onerror = () => rechazar(lector.error || new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo);
  });
}

/* ---------- Piezas de la pantalla ---------- */

function seccionTemas(ctx) {
  const { ui } = ctx;
  const temas = window.Tema;
  if (!temas) return document.createDocumentFragment();

  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Temas</h2>
      <div class="ajustes-temas">
        ${temas.lista.map((tema) => `
          <button type="button" class="ajustes-tema" data-tema-opcion="${ui.esc(tema.id)}"
            aria-pressed="${tema.id === temas.actual()}">
            <i class="ajustes-tema__color" style="background:${ui.esc(tema.muestra || tema.fondo)}" aria-hidden="true"></i>
            <span class="ajustes-tema__nombre">${ui.esc(tema.nombre)}</span>
            ${tema.detalle ? `<small>${ui.esc(tema.detalle)}</small>` : ''}
          </button>
        `).join('')}
      </div>
    </section>
  `);

  const botones = [...seccion.querySelectorAll('[data-tema-opcion]')];
  botones.forEach((boton) => {
    boton.addEventListener('click', () => {
      const elegido = temas.elegir(boton.dataset.temaOpcion);
      botones.forEach((otro) => {
        otro.setAttribute('aria-pressed', String(otro.dataset.temaOpcion === elegido));
      });
    });
  });

  return seccion;
}

/** Tamaño de la letra: se ve el cambio enseguida, en este aparato. */
function seccionLetra(ctx) {
  const { ui } = ctx;
  const letra = window.Letra;
  if (!letra) return document.createDocumentFragment();
  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-letra__titulo">🔠 Tamaño de la letra</h2>
      <div class="ajustes-temas">
        ${letra.lista.map((l) => `<button type="button" class="ajustes-tema" data-letra-opcion="${ui.esc(l.id)}" aria-pressed="${l.id === letra.actual()}"><span class="ajustes-letra__muestra" style="font-size:${Math.round(13 * l.zoom)}px">Aa</span><span class="ajustes-tema__nombre">${ui.esc(l.nombre)}</span></button>`).join('')}
      </div>
    </section>
  `);
  const botones = [...seccion.querySelectorAll('[data-letra-opcion]')];
  botones.forEach((boton) => boton.addEventListener('click', () => {
    const elegida = letra.elegir(boton.dataset.letraOpcion);
    botones.forEach((otro) => otro.setAttribute('aria-pressed', String(otro.dataset.letraOpcion === elegida)));
  }));
  return seccion;
}

function seccionNombre(ctx) {
  const { ui, datos } = ctx;
  const nombreActual = (datos.estado.config && datos.estado.config.nombreNegocio) || 'Mis Préstamos';

  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Nombre del negocio</h2>
      <form class="formulario ajustes-formulario" id="formulario-nombre" novalidate>
        ${ui.campo({
          etiqueta: 'Cómo se llama tu negocio',
          nombre: 'nombreNegocio',
          valor: nombreActual,
          requerido: true,
          ayuda: 'Aparece en la copia de seguridad y en los reportes.',
          atributos: { maxlength: 60, autocomplete: 'off' }
        })}
        <button type="submit" class="boton boton--primario boton--grande">Guardar nombre</button>
      </form>
    </section>
  `);

  const formulario = seccion.querySelector('#formulario-nombre');
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const valores = ui.leerFormulario(formulario);
    const nombre = String(valores.nombreNegocio || '').trim();
    if (!nombre) {
      ui.toast('Escribe el nombre del negocio.');
      formulario.querySelector('[name="nombreNegocio"]').focus();
      return;
    }
    if (nombre === nombreActual) {
      ui.toast('El nombre ya está guardado.');
      return;
    }
    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      // datos.js no tiene una operación propia para la configuración: se toma el
      // estado completo, se cambia el nombre y se vuelve a importar (valida y guarda).
      const estado = JSON.parse(datos.exportarJSON());
      estado.config = { ...(estado.config || {}), nombreNegocio: nombre };
      await datos.importarJSON(JSON.stringify(estado));
      ui.toast('Nombre guardado.');
      ctx.navegar('#/ajustes');
    } catch (error) {
      ui.toast(`No se pudo guardar el nombre: ${textoError(error)}`, 5000);
      boton.disabled = false;
    }
  });

  return seccion;
}

function textoHace(iso) {
  if (!iso) return 'todavía no';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

function seccionNube(ctx) {
  const { ui, nube } = ctx;
  const seccion = ui.el('<section class="tarjeta ajustes-seccion"><h2 class="ajustes-seccion__titulo">Nube</h2><div id="nube-cuerpo"></div></section>');
  const cuerpo = seccion.querySelector('#nube-cuerpo');

  function pintar() {
    if (!nube || !nube.configurada()) {
      cuerpo.innerHTML = '<p class="ajustes-texto">La nube todavía no está conectada. Cuando esté, lo que anotes en un aparato aparece en los demás.</p>';
      return;
    }
    const e = nube.estado();
    if (!e.sesion) {
      cuerpo.innerHTML = `
        <p class="ajustes-texto">Entra con tu correo para que tus datos se guarden en la nube y se vean igual en el teléfono y en el computador.</p>
        <form class="formulario" id="nube-form" novalidate>
          ${ui.campo({ etiqueta: 'Correo', nombre: 'correo', tipo: 'email', requerido: true, atributos: { autocomplete: 'username', inputmode: 'email' } })}
          ${ui.campo({ etiqueta: 'Contraseña', nombre: 'contrasena', tipo: 'password', requerido: true, atributos: { autocomplete: 'current-password', minlength: 6 } })}
          <div class="ajustes-botones">
            <button type="submit" class="boton boton--primario boton--grande" data-accion="entrar">Entrar</button>
            <button type="submit" class="boton boton--secundario boton--grande" data-accion="registrar">Crear cuenta</button>
          </div>
          <p class="ajustes-ayuda" id="nube-mensaje" aria-live="polite"></p>
        </form>`;
      const form = cuerpo.querySelector('#nube-form');
      let accion = 'entrar';
      form.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener('click', () => { accion = b.dataset.accion; }));
      form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const v = ui.leerFormulario(form);
        const mensaje = form.querySelector('#nube-mensaje');
        if (!v.correo || !v.contrasena) { mensaje.textContent = 'Escribe el correo y la contraseña.'; return; }
        form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        mensaje.textContent = accion === 'entrar' ? 'Entrando…' : 'Creando la cuenta…';
        try {
          if (accion === 'entrar') await nube.entrar(v.correo.trim(), v.contrasena);
          else await nube.registrar(v.correo.trim(), v.contrasena);
          ui.toast('Conectada a la nube.');
          pintar();
        } catch (error) {
          mensaje.textContent = textoError(error);
          form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        }
      });
      return;
    }
    const r = nube.respaldo();
    let estadoTexto;
    if (e.sincronizando) estadoTexto = 'Sincronizando…';
    else if (!e.enLinea) estadoTexto = `Sin conexión. Se sube cuando vuelva la señal${e.pendiente ? ' (hay cambios pendientes)' : ''}.`;
    else if (e.error) estadoTexto = `Problema: ${e.error}`;
    else if (e.pendiente) estadoTexto = 'Hay cambios por subir.';
    else estadoTexto = `Al día. Última sincronización ${textoHace(e.ultimaVez)}.`;
    cuerpo.innerHTML = `
      <p class="ajustes-texto">Conectada como <span class="negrita">${ui.esc(e.sesion.correo || '')}</span>.</p>
      <p class="ajustes-texto" id="nube-estado">${ui.esc(estadoTexto)}</p>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--primario boton--grande" id="nube-sync">Sincronizar ahora</button>
        <button type="button" class="boton boton--secundario boton--grande" id="nube-salir">Salir de la nube en este aparato</button>
      </div>
      ${r ? `<p class="ajustes-ayuda">Hay una copia previa de la nube guardada (${ui.esc(textoHace(r.guardadoEn))}), de cuando dos aparatos cambiaron a la vez.</p>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--secundario boton--grande" id="nube-restaurar">Volver a esa copia</button>
        <button type="button" class="boton boton--secundario boton--grande" id="nube-olvidar">Borrar esa copia</button>
      </div>` : ''}`;
    cuerpo.querySelector('#nube-sync').addEventListener('click', async () => {
      const resultado = await nube.sincronizar('manual');
      ui.toast(resultado === 'error' ? 'No se pudo sincronizar.' : 'Sincronizado.');
      pintar();
    });
    cuerpo.querySelector('#nube-salir').addEventListener('click', async () => {
      if (!(await ui.confirmar('¿Salir de la nube en este aparato? Los datos siguen aquí y en la nube.', { aceptar: 'Sí, salir' }))) return;
      nube.salir();
      pintar();
    });
    const restaurar = cuerpo.querySelector('#nube-restaurar');
    if (restaurar) restaurar.addEventListener('click', async () => {
      if (!(await ui.confirmar('¿Reemplazar lo de ahora por la copia previa de la nube?', { aceptar: 'Sí, volver', peligro: true }))) return;
      try { await nube.restaurarRespaldo(); ui.toast('Copia previa restaurada.'); } catch (error) { ui.toast(textoError(error)); }
      pintar();
    });
    const olvidar = cuerpo.querySelector('#nube-olvidar');
    if (olvidar) olvidar.addEventListener('click', () => { nube.borrarRespaldo(); pintar(); });
  }

  pintar();
  if (nube && nube.configurada()) {
    const baja = nube.suscribir(() => { if (document.body.contains(seccion)) pintar(); else baja(); });
  }
  return seccion;
}

function seccionCopia(ctx) {
  const { ui, datos } = ctx;
  const hoy = ctx.hoy();
  const nombreArchivo = nombreArchivoCopia(hoy);
  const puedeCompartir = puedeCompartirArchivos(nombreArchivo);

  const cantidad = {
    clientes: datos.listar('clientes').length,
    prestamos: datos.listar('prestamos').length,
    pagos: datos.listar('pagos').length,
    movimientos: datos.listar('movimientos').length
  };

  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Copia de seguridad</h2>
      <p class="ajustes-texto">
        Saca una copia cada tanto y guárdala en
        tus archivos, en tu correo o en WhatsApp. Si cambias de teléfono, la importas y recuperas todo.
      </p>
      <ul class="ajustes-cuentas" aria-label="Lo que hay guardado">
        <li class="ajustes-cuentas__item"><span class="ajustes-cuentas__numero numero">${cantidad.clientes}</span><span class="ajustes-cuentas__texto">clientes</span></li>
        <li class="ajustes-cuentas__item"><span class="ajustes-cuentas__numero numero">${cantidad.prestamos}</span><span class="ajustes-cuentas__texto">préstamos</span></li>
        <li class="ajustes-cuentas__item"><span class="ajustes-cuentas__numero numero">${cantidad.pagos}</span><span class="ajustes-cuentas__texto">pagos</span></li>
        <li class="ajustes-cuentas__item"><span class="ajustes-cuentas__numero numero">${cantidad.movimientos}</span><span class="ajustes-cuentas__texto">movimientos</span></li>
      </ul>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--primario boton--grande" id="boton-exportar">Descargar copia</button>
        <button type="button" class="boton boton--secundario boton--grande" id="boton-excel">Exportar a Excel</button>
        ${puedeCompartir ? '<button type="button" class="boton boton--secundario boton--grande" id="boton-compartir">Compartir copia</button>' : ''}
        <button type="button" class="boton boton--secundario boton--grande" id="boton-importar">Importar copia</button>
        <input type="file" id="archivo-importar" class="oculto" accept=".json,application/json,text/plain" aria-label="Archivo de copia de seguridad">
      </div>
      <p class="ajustes-ayuda">El archivo se llama <span class="negrita">${ui.esc(nombreArchivo)}</span>. Al importar se reemplaza todo lo que tienes ahora.</p>
    </section>
  `);

  // Exportar: descarga el archivo.
  seccion.querySelector('#boton-exportar').addEventListener('click', () => {
    try {
      descargarTexto(datos.exportarJSON(), nombreArchivo);
      ui.toast('Copia lista. Revisa tus descargas o tus archivos.');
    } catch (error) {
      ui.toast(`No se pudo descargar la copia: ${textoError(error)}`, 5000);
    }
  });

  // Excel: un archivo que abre en Excel, con todos los movimientos de los libros.
  seccion.querySelector('#boton-excel').addEventListener('click', () => {
    try {
      const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const filas = (datos.estado.fran.asientos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
      const texto = [['Fecha', 'Libro', 'Tipo', 'Categoria', 'Descripcion', 'Valor', 'Cuenta'].join(';'),
        ...filas.map((a) => [a.fecha, a.libro, a.tipo, a.categoria, a.descripcion, a.valor, a.cuenta].map(celda).join(';'))].join('\r\n');
      descargarTexto(`\ufeff${texto}`, `fran-movimientos-${hoy}.csv`, 'text/csv;charset=utf-8');
      ui.toast('Archivo listo. Se abre con Excel.');
    } catch (error) {
      ui.toast(`No se pudo exportar: ${textoError(error)}`, 5000);
    }
  });

  // Compartir: hoja nativa del teléfono (guardar en archivos, enviar por WhatsApp, correo).
  const botonCompartir = seccion.querySelector('#boton-compartir');
  if (botonCompartir) {
    botonCompartir.addEventListener('click', async () => {
      try {
        const archivo = new File([datos.exportarJSON()], nombreArchivo, { type: 'application/json' });
        await window.navigator.share({ files: [archivo], title: 'Copia de Fran' });
        ui.toast('Copia compartida.');
      } catch (error) {
        // Si ella cierra la hoja de compartir, no es un error que haya que gritar.
        if (error && error.name === 'AbortError') return;
        ui.toast(`No se pudo compartir la copia: ${textoError(error)}`, 5000);
      }
    });
  }

  // Importar: abre el selector de archivos y, con confirmación, reemplaza todo.
  const entradaArchivo = seccion.querySelector('#archivo-importar');
  const botonImportar = seccion.querySelector('#boton-importar');
  botonImportar.addEventListener('click', () => {
    entradaArchivo.value = '';
    entradaArchivo.click();
  });
  entradaArchivo.addEventListener('change', async () => {
    const archivo = entradaArchivo.files && entradaArchivo.files[0];
    if (!archivo) return;
    const seguro = await ui.confirmar(
      `¿Importar "${archivo.name}"? Se reemplaza todo lo que tienes guardado ahora (${cantidad.clientes} clientes, ${cantidad.prestamos} préstamos, ${cantidad.pagos} pagos).`,
      { aceptar: 'Sí, importar', peligro: true }
    );
    if (!seguro) return;
    botonImportar.disabled = true;
    try {
      const texto = await leerArchivoComoTexto(archivo);
      const estado = await datos.importarJSON(texto);
      ui.toast(`Copia importada: ${estado.clientes.length} clientes y ${estado.prestamos.length} préstamos.`, 4000);
      ctx.navegar('#/inicio');
    } catch (error) {
      ui.toast(`No se pudo importar: ${textoError(error)}`, 6000);
      botonImportar.disabled = false;
    }
  });

  return seccion;
}

function seccionCaja(ctx) {
  const { ui } = ctx;
  return ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Caja</h2>
      <p class="ajustes-texto">Si empiezas a usar la app con plata ya en caja, registra el saldo inicial de efectivo y de virtual.</p>
      <div class="ajustes-botones">
        <a href="#/caja/movimiento/saldo_inicial" class="boton boton--secundario boton--grande">Registrar saldo inicial</a>
      </div>
    </section>
  `);
}

function seccionCasos(ctx) {
  const { ui, datos } = ctx;
  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Casos de prueba</h2>
      <p class="ajustes-texto">
        Carga clientes de ejemplo (Ramiro, Ernesto, Marta, la mamá y otros de prueba) para ver
        cómo funciona la app. Reemplaza todo lo que tengas guardado.
      </p>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--secundario boton--grande" id="boton-cargar-casos">Cargar casos de prueba</button>
      </div>
    </section>
  `);

  const boton = seccion.querySelector('#boton-cargar-casos');
  boton.addEventListener('click', async () => {
    const seguro = await ui.confirmar(
      '¿Cargar los casos de prueba? Se borra todo lo que tienes guardado y se reemplaza por los ejemplos. Si tienes datos reales, descarga una copia primero.',
      { aceptar: 'Sí, cargar', peligro: true }
    );
    if (!seguro) return;
    boton.disabled = true;
    try {
      const modulo = await import('../casos.js');
      const lista = modulo.casos || modulo.default;
      if (!Array.isArray(lista) || lista.length === 0) {
        throw new Error('El archivo de casos de prueba está vacío.');
      }
      const estado = await datos.cargarCasos(lista);
      ui.toast(`Casos cargados: ${estado.clientes.length} clientes y ${estado.prestamos.length} préstamos.`, 4000);
      ctx.navegar('#/clientes');
    } catch (error) {
      ui.toast(`No se pudieron cargar los casos: ${textoError(error)}`, 6000);
      boton.disabled = false;
    }
  });

  return seccion;
}

function seccionBorrar(ctx) {
  const { ui, datos } = ctx;
  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion ajustes-seccion--peligro">
      <h2 class="ajustes-seccion__titulo">Borrar todo</h2>
      <p class="ajustes-texto">
        Borra todos los clientes, préstamos, pagos y movimientos de caja de este teléfono.
        No se puede deshacer. Descarga una copia antes.
      </p>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--peligro boton--grande" id="boton-borrar-todo">Borrar todos los datos</button>
      </div>
    </section>
  `);

  const boton = seccion.querySelector('#boton-borrar-todo');
  boton.addEventListener('click', async () => {
    const cantidadClientes = datos.listar('clientes').length;
    const cantidadPrestamos = datos.listar('prestamos').length;
    const primera = await ui.confirmar(
      `¿Borrar todos los datos? Se van ${cantidadClientes} clientes y ${cantidadPrestamos} préstamos con todos sus pagos y movimientos.`,
      { aceptar: 'Sí, borrar', peligro: true }
    );
    if (!primera) return;
    const segunda = await ui.confirmar(
      'Última advertencia: esto no se puede deshacer. ¿Ya descargaste una copia? ¿Borrar de verdad?',
      { aceptar: 'Borrar de verdad', cancelar: 'No, dejar todo', peligro: true }
    );
    if (!segunda) return;
    boton.disabled = true;
    try {
      await datos.borrarTodo();
      ui.toast('Todo borrado. La app quedó vacía.');
      ctx.navegar('#/inicio');
    } catch (error) {
      ui.toast(`No se pudo borrar: ${textoError(error)}`, 6000);
      boton.disabled = false;
    }
  });

  return seccion;
}

function seccionInstalar(ctx) {
  const { ui } = ctx;
  const instalada = estaInstalada();
  const telefono = tipoDeTelefono();

  const avisoInstalada = instalada
    ? '<p class="ajustes-aviso-ok">La app ya está instalada en este teléfono.</p>'
    : '';

  return ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Instalar en el teléfono</h2>
      ${avisoInstalada}
      <p class="ajustes-texto">
        Instalada se abre como cualquier otra app, a pantalla completa y sin conexión. No se
        descarga de ninguna tienda y no cuesta nada.
      </p>
      <div class="ajustes-instrucciones">
        <article class="ajustes-instruccion ${telefono === 'iphone' ? 'ajustes-instruccion--resaltada' : ''}">
          <h3 class="ajustes-instruccion__titulo">iPhone</h3>
          <ol class="ajustes-pasos">
            <li>Abre esta página en <span class="negrita">Safari</span> (no sirve desde Chrome ni desde WhatsApp).</li>
            <li>Toca el botón <span class="negrita">Compartir</span> (el cuadrado con la flecha hacia arriba, abajo en el centro).</li>
            <li>Baja en la lista y toca <span class="negrita">Añadir a pantalla de inicio</span>.</li>
            <li>Toca <span class="negrita">Añadir</span> arriba a la derecha. Listo: queda el ícono con las demás apps.</li>
          </ol>
        </article>
        <article class="ajustes-instruccion ${telefono === 'android' ? 'ajustes-instruccion--resaltada' : ''}">
          <h3 class="ajustes-instruccion__titulo">Android</h3>
          <ol class="ajustes-pasos">
            <li>Abre esta página en <span class="negrita">Chrome</span>.</li>
            <li>Toca los <span class="negrita">tres puntos</span> arriba a la derecha.</li>
            <li>Toca <span class="negrita">Instalar aplicación</span> o <span class="negrita">Añadir a pantalla de inicio</span>.</li>
            <li>Confirma con <span class="negrita">Instalar</span>. Listo: queda el ícono con las demás apps.</li>
          </ol>
        </article>
      </div>
      <p class="ajustes-ayuda">Los datos quedan guardados en el teléfono aunque cierres la app. Igual descarga una copia de vez en cuando.</p>
    </section>
  `);
}

function seccionAcerca(ctx) {
  const { ui, datos } = ctx;
  const version = ctx.version || '1.0.0';
  const almacen = datos.almacenamiento || { nombre: '', ultimoError: null };
  const nombresAlmacen = {
    indexeddb: 'En el teléfono (base de datos del navegador)',
    localstorage: 'En el teléfono (respaldo del navegador)',
    memoria: 'Solo en memoria (se pierde al cerrar)',
    ninguno: 'No se pudo guardar en este navegador'
  };
  const dondeGuarda = nombresAlmacen[almacen.nombre] || 'En el teléfono';
  const avisoError = almacen.ultimoError
    ? `<p class="ajustes-aviso-error">Último guardado con problema: ${ui.esc(textoError(almacen.ultimoError))}. Descarga una copia ya.</p>`
    : '';

  return ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Acerca de la app</h2>
      <dl class="ajustes-datos">
        <div class="ajustes-datos__fila"><dt>Versión</dt><dd class="numero">${ui.esc(version)}</dd></div>
        <div class="ajustes-datos__fila"><dt>Fecha de hoy</dt><dd class="numero">${ui.esc(ctx.hoy())}</dd></div>
        <div class="ajustes-datos__fila"><dt>Dónde se guarda</dt><dd>${ui.esc(dondeGuarda)}</dd></div>
        <div class="ajustes-datos__fila"><dt>Internet</dt><dd>No usa internet ni manda datos a ningún lado.</dd></div>
      </dl>
      ${avisoError}
    </section>
  `);
}

/* ---------- Render ---------- */

function seccionCandado(ctx) {
  const { ui, candado } = ctx;
  const seccion = ui.el('<section class="tarjeta ajustes-seccion"><div id="candado-cuerpo"></div></section>');
  const cuerpo = seccion.querySelector('#candado-cuerpo');
  const opciones = [[0, 'Al salir'], [1, '1 min'], [5, '5 min'], [15, '15 min']];

  async function pintar() {
    if (!candado) { cuerpo.innerHTML = '<p class="ajustes-texto">No disponible.</p>'; return; }
    const e = candado.estado();
    if (e.activo) {
      cuerpo.innerHTML = `
        <p class="ajustes-texto">Activo en este aparato. Fran pide Face ID, o el código del aparato si falla, al abrir.</p>
        <p class="ajustes-ayuda">Volver a pedirlo si sales de la app por:</p>
        <div class="fran-chips">${opciones.map(([m, t]) => `<button type="button" data-min="${m}" class="${m === e.minutos ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <div class="ajustes-botones"><button type="button" class="boton boton--secundario boton--grande" id="candado-quitar">Quitar Face ID de este aparato</button></div>`;
      cuerpo.querySelectorAll('[data-min]').forEach((b) => b.addEventListener('click', () => { candado.fijarMinutos(Number(b.dataset.min)); pintar(); }));
      cuerpo.querySelector('#candado-quitar').addEventListener('click', async () => {
        if (await ui.confirmar('¿Quitar Face ID? Fran abrirá sin pedir nada en este aparato.', { aceptar: 'Sí, quitar', peligro: true })) { candado.desactivar(); pintar(); }
      });
      return;
    }
    if (!(await candado.disponible())) {
      cuerpo.innerHTML = '<p class="ajustes-texto">Este aparato no tiene Face ID, huella ni Windows Hello disponibles. Fran abre sin pedir nada aquí.</p>';
      return;
    }
    cuerpo.innerHTML = `
      <p class="ajustes-texto">Sin activar en este aparato: Fran abre sin pedir nada.</p>
      <div class="ajustes-botones"><button type="button" class="boton boton--primario boton--grande" id="candado-activar-yo">Activar Face ID</button></div>
      <p class="ajustes-ayuda" id="candado-msg-yo" aria-live="polite"></p>`;
    cuerpo.querySelector('#candado-activar-yo').addEventListener('click', async () => {
      try { await candado.activar(); ui.toast('Face ID activado.'); pintar(); } catch (error) {
        cuerpo.querySelector('#candado-msg-yo').textContent = error && error.name === 'NotAllowedError' ? 'No se confirmó. Inténtalo otra vez.' : textoError(error);
      }
    });
  }
  pintar();
  return seccion;
}

function plegable(icono, texto, seccion, ui) {
  const caja = ui.el(`<details class="fran-ajuste"${abiertos.has(texto) ? ' open' : ''}><summary><span>${icono}</span>${ui.esc(texto)}</summary></details>`);
  caja.append(seccion);
  caja.dataset.seccion = texto;
  caja.addEventListener('toggle', () => { if (caja.open) abiertos.add(texto); else abiertos.delete(texto); });
  return caja;
}

const LISTAS_CATEGORIAS = [
  ['personal', 'gasto', 'gasto', 'Finanzas personales · Gastos'], ['personal', 'ingreso', 'ingreso', 'Finanzas personales · Ingresos'],
  ['arriendos', 'gasto', 'gasto', 'Arriendos · Gastos'], ['arriendos', 'ingreso', 'ingreso', 'Arriendos · Ingresos'],
  ['redes', 'gasto', 'gasto', 'Redes · Gastos'], ['redes', 'ingreso', 'ingreso', 'Redes · Ingresos'],
  ['productos', 'inversion', 'gasto', 'Productos · Inversión'], ['productos', 'gasto', 'gasto', 'Productos · Gastos'], ['productos', 'ingreso', 'ingreso', 'Productos · Ventas'],
];
let listaCategorias = 0;

/** Boceto 16 · Categorías. Ocultar no borra nada: el historial sigue igual. */
function seccionCategorias(ctx) {
  const { ui, datos } = ctx;
  const fran = datos.estado.fran;
  const [id, clave, tipo] = LISTAS_CATEGORIAS[listaCategorias];
  const llave = `${id}:${clave}`;
  const { todas, ocultas } = categoriasDe(fran, id, clave, tipo);
  const s = ui.el(`<section class="tarjeta ajustes-seccion">
    <label class="fran-campo-yo"><small>Libro</small><select name="lista">${LISTAS_CATEGORIAS.map((l, i) => `<option value="${i}"${i === listaCategorias ? ' selected' : ''}>${ui.esc(l[3])}</option>`).join('')}</select></label>
    <div class="fran-lista">${todas.map((c) => `<div class="fran-fila">
      <span class="fran-ico">${ui.esc(iconoDe(c))}</span>
      <span class="fran-fila__texto"><strong>${ui.esc(c)}</strong></span>
      <button type="button" class="fran-borrar" data-cat="${ui.esc(c)}">${ocultas.includes(c) ? 'Mostrar' : 'Ocultar'}</button>
    </div>`).join('')}</div>
    <form class="fran-en-linea" novalidate><input class="fran-entrada" name="nueva" autocomplete="off" placeholder="Categoría nueva" aria-label="Categoría nueva"><button class="boton boton--primario">Agregar</button></form>
    <p class="ajustes-ayuda">Ocultar solo la quita de la pantalla Agregar. El historial no cambia.</p>
  </section>`);
  s.querySelector('[name="lista"]').addEventListener('change', (e) => {
    listaCategorias = Number(e.target.value);
    s.replaceWith(seccionCategorias(ctx));
  });
  s.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', async () => {
    const c = b.dataset.cat;
    const nuevas = ocultas.includes(c) ? ocultas.filter((x) => x !== c) : [...ocultas, c];
    await datos.actualizarFran({ categoriasOcultas: { ...fran.categoriasOcultas, [llave]: nuevas } });
  }));
  s.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = e.target.elements.nueva.value.trim();
    if (!nombre) { ui.toast('Escribe el nombre de la categoría.'); return; }
    if (todas.some((c) => c.toLowerCase() === nombre.toLowerCase())) { ui.toast('Esa categoría ya existe.'); return; }
    await datos.actualizarFran({ categoriasExtra: { ...fran.categoriasExtra, [llave]: [...(fran.categoriasExtra[llave] || []), nombre] } });
    ui.toast('Categoría agregada.');
  });
  return s;
}

/** Boceto 15. Con la app cerrada, los avisos los da el calendario del teléfono. */
function seccionRecordatorios(ctx) {
  const { ui, datos, dinero } = ctx;
  const r = datos.estado.fran.recordatorios;
  const s = ui.el(`<section class="tarjeta ajustes-seccion">
    <label class="fran-campo-yo"><small>Cobros de hoy</small><input type="time" name="cobros" value="${ui.esc(r.cobros)}"></label>
    <label class="fran-campo-yo"><small>Anotar gastos e ingresos</small><input type="time" name="gastos" value="${ui.esc(r.gastos)}"></label>
    <div class="ajustes-botones"><button type="button" class="boton boton--primario boton--grande" id="boton-avisos">Poner avisos en el calendario</button></div>
    <p class="ajustes-ayuda">Se descarga un archivo. Ábrelo y elige Agregar: el calendario te avisa a esas horas aunque Fran esté cerrada. Si cambian los cobros, vuelve a tocar este botón.</p>
    <p class="ajustes-ayuda">Dentro de Fran, el inicio te muestra los cobros de hoy y te recuerda anotar.</p>
  </section>`);
  const guardarHoras = async () => {
    const f = { cobros: s.querySelector('[name="cobros"]').value, gastos: s.querySelector('[name="gastos"]').value };
    if (f.cobros && f.gastos) await datos.actualizarFran({ recordatorios: f });
  };
  s.querySelectorAll('input').forEach((i) => i.addEventListener('change', guardarHoras));
  s.querySelector('#boton-avisos').addEventListener('click', async () => {
    try {
      await guardarHoras();
      const fran = datos.estado.fran;
      descargarTexto(calendarioIcs(fran.agenda, fran.recordatorios, ctx.hoy(), (v) => dinero.formatear(v)), 'fran-avisos.ics', 'text/calendar;charset=utf-8');
      ui.toast('Archivo listo. Ábrelo para agregarlo al calendario.');
    } catch (error) {
      ui.toast(`No se pudo: ${textoError(error)}`, 5000);
    }
  });
  return s;
}

const NOMBRE_FRECUENCIA = { mensual: 'Cada mes', quincenal: 'Cada 15 días', semanal: 'Cada semana', diario: 'Cada día' };

/** Boceto 16 · Transacciones recurrentes: se anotan solas cuando llega la fecha. */
function seccionRecurrentes(ctx) {
  const { ui, datos, dinero, fechas } = ctx;
  const lista = datos.estado.fran.recurrentes;
  const libros = ['personal', 'arriendos', 'redes', 'productos'];
  const s = ui.el(`<section class="tarjeta ajustes-seccion">
    <div class="fran-lista">${lista.map((r) => `<div class="fran-fila">
      <span class="fran-ico">${ui.esc(iconoDe(r.categoria))}</span>
      <span class="fran-fila__texto"><strong>${ui.esc(r.descripcion || r.categoria)}</strong><small>${ui.esc(NOMBRE_FRECUENCIA[r.frecuencia])} · sigue ${ui.esc(fechas.formatear(r.proxima))}</small></span>
      <span class="fran-fila__valor numero">${dinero.formatear(r.valor)}</span>
      <button type="button" class="fran-borrar" data-quitar="${ui.esc(r.id)}">Quitar</button>
    </div>`).join('') || '<p class="ajustes-ayuda">Todavía no hay ninguna. Agrega lo que pagas o cobras siempre igual.</p>'}</div>
    <form class="fran-campos" novalidate>
      <label><small>Nombre</small><input name="descripcion" autocomplete="off" placeholder="¿Qué es?"></label>
      <label><small>Valor</small><input name="valor" inputmode="numeric" autocomplete="off" placeholder="0"></label>
      <label><small>Libro</small><select name="libro">${libros.map((l) => `<option value="${l}">${ui.esc(LIBROS[l].nombre)}</option>`).join('')}</select></label>
      <label><small>Tipo</small><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></label>
      <label><small>Categoría</small><select name="categoria"></select></label>
      <label><small>Cada cuánto</small><select name="frecuencia">${Object.entries(NOMBRE_FRECUENCIA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label><small>Primera fecha</small><input type="date" name="proxima" value="${ui.esc(ctx.hoy())}"></label>
      <button class="boton boton--primario fran-guardar">Guardar</button>
    </form>
  </section>`);
  const f = s.querySelector('form').elements;
  const llenar = () => {
    const opciones = categoriasDe(datos.estado.fran, f.libro.value, f.tipo.value, f.tipo.value).visibles
      .filter((c) => !(f.libro.value === 'personal' && INGRESOS_DE_OTRO_LIBRO[c] && f.tipo.value === 'ingreso'));
    const todas = opciones.length ? opciones : (CATEGORIAS_BASE[f.libro.value] && CATEGORIAS_BASE[f.libro.value].inversion) || ['Otros'];
    f.categoria.innerHTML = todas.map((c) => `<option>${ui.esc(c)}</option>`).join('');
  };
  f.libro.addEventListener('change', llenar);
  f.tipo.addEventListener('change', llenar);
  llenar();
  s.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (await ui.confirmar('¿Quitar esta transacción recurrente? Lo ya anotado se queda.', { aceptar: 'Sí, quitar', peligro: true })) await datos.eliminarRecurrente(b.dataset.quitar);
  }));
  s.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!valor) { ui.toast('Escribe el valor.'); return; }
    try {
      await datos.agregarRecurrente({ libro: f.libro.value, tipo: f.tipo.value, categoria: f.categoria.value, descripcion: f.descripcion.value, valor, frecuencia: f.frecuencia.value, proxima: f.proxima.value });
      const n = await datos.aplicarRecurrentes(ctx.hoy());
      ui.toast(n ? `Guardada. Anoté ${n} que ya tocaba.` : 'Guardada.');
    } catch (error) { ui.toast(error.message); }
  });
  return s;
}

function seccionHistoricos(ctx) {
  const { ui, datos } = ctx;
  const seccion = ui.el(`
    <section class="tarjeta ajustes-seccion">
      <h2 class="ajustes-seccion__titulo">Actualizar históricos</h2>
      <p class="ajustes-texto">Trae los meses nuevos de Mis Gastos y la agenda, sin borrar lo que anotaste en la app.</p>
      <div class="ajustes-botones">
        <button type="button" class="boton boton--secundario boton--grande" id="boton-historicos">Actualizar históricos</button>
        <input type="file" id="archivo-historicos" class="oculto" accept=".json,application/json,text/plain" aria-label="Archivo de históricos">
      </div>
    </section>
  `);
  const entrada = seccion.querySelector('#archivo-historicos');
  seccion.querySelector('#boton-historicos').addEventListener('click', () => { entrada.value = ''; entrada.click(); });
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files && entrada.files[0];
    if (!archivo) return;
    try {
      const texto = await leerArchivoComoTexto(archivo);
      const dictado = JSON.parse(texto).dictado;
      if (Array.isArray(dictado)) {
        // Lo que ella dictó por el chat: solo agrega, no reemplaza nada.
        const d = await datos.aplicarDictado(dictado);
        const partes = [`Anoté ${d.anotadas}`];
        if (d.yaEstaban) partes.push(`${d.yaEstaban} ya estaban`);
        if (d.faltan.length) partes.push(`${d.faltan.length} no pude anotar`);
        ui.toast(`${partes.join('. ')}.`, 7000);
        return;
      }
      const r = await datos.actualizarHistoricos(texto);
      ui.toast(`Históricos actualizados. Se conservaron ${r.propios} movimientos tuyos.`, 5000);
    } catch (error) {
      ui.toast(`No se pudo actualizar: ${textoError(error)}`, 6000);
    }
  });
  return seccion;
}

/* ---------- Render ---------- */

export async function render(contenedor, params, ctx) {
  const { ui } = ctx;
  contenedor.innerHTML = '';
  const irA = { categorias: 'Categorías', recordatorios: 'Recordatorios', recurrentes: 'Transacciones recurrentes' }[params && params.seccion];
  const saltar = irA && irA !== ultimoSalto;
  ultimoSalto = irA || '';
  if (saltar) { abiertos.clear(); abiertos.add(irA); }
  contenedor.append(ui.el(`<header class="fran-titulo"><a href="#/inicio" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>Yo</h1></header>`));
  contenedor.append(seccionTemas(ctx));
  contenedor.append(seccionLetra(ctx));
  contenedor.append(ui.el('<p class="fran-seccion">Ajustes</p>'));
  contenedor.append(plegable('⚙️', 'Categorías', seccionCategorias(ctx), ui));
  contenedor.append(ui.el('<a class="fran-enlace" href="#/libro/pension"><span>💱</span>Moneda COP · tasa USD</a>'));
  contenedor.append(plegable('⏰', 'Recordatorios', seccionRecordatorios(ctx), ui));
  contenedor.append(plegable('🔁', 'Transacciones recurrentes', seccionRecurrentes(ctx), ui));
  const respaldo = plegable('☁️', 'Respaldo y exportar Excel', seccionCopia(ctx), ui);
  respaldo.append(seccionHistoricos(ctx));
  respaldo.append(seccionBorrar(ctx));
  contenedor.append(respaldo);
  contenedor.append(plegable('🔒', 'Face ID', seccionCandado(ctx), ui));
  contenedor.append(ui.el('<p class="fran-seccion">Esta app</p>'));
  contenedor.append(plegable('🌐', 'Nube', seccionNube(ctx), ui));
  contenedor.append(ui.el('<a class="fran-enlace" href="#/virtual"><span>📲</span>Plata virtual</a>'));
  contenedor.append(ui.el('<a class="fran-enlace" href="#/caja"><span>🧾</span>Caja efectivo y virtual</a>'));
  contenedor.append(plegable('📲', 'Instalar en el teléfono', seccionInstalar(ctx), ui));
  contenedor.append(plegable('ℹ️', 'Acerca de la app', seccionAcerca(ctx), ui));
  contenedor.append(ui.el(`<p class="fran-version">Versión ${ui.esc(ctx.version || '')}</p>`));
  if (saltar) {
    const destino = [...contenedor.querySelectorAll('.fran-ajuste')].find((x) => x.dataset.seccion === irA);
    if (destino) setTimeout(() => destino.scrollIntoView(), 80);
  }
}
