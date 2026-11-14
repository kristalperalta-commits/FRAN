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

import { CATEGORIAS_BASE, INGRESOS_DE_OTRO_LIBRO, LIBROS, categoriasDe, iconoDe, icono3dDe } from './fran.js';
import { calendarioIcs } from '../recordatorios.js';
import { abrirApariencia } from '../apariencia.js';
import * as avisos from '../avisos.js';

export const titulo = 'Yo';

// Lo abierto en Yo sigue abierto cuando la pantalla se vuelve a dibujar.
const abiertos = new Set();
let ultimoSalto = '';
// Yo: qué grupo y qué cuadro están abiertos (se recuerda mientras la app esté abierta).
let seleccionYo = { grupo: '', item: '' };

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
      </div>` : ''}
      <div id="nube-copias"></div>`;
    // Copias que Fran guarda sola en este aparato antes de cambiar los datos (las últimas 5).
    if (nube.copiasLocales) nube.copiasLocales().then((copias) => {
      const caja = cuerpo.querySelector('#nube-copias');
      if (!caja || !copias.length) return;
      caja.innerHTML = `<p class="ajustes-ayuda">Copias de seguridad de este aparato. Fran guarda una antes de bajar o juntar datos de la nube, importar o borrar todo.</p>
        ${copias.map((c, i) => `<div class="ajustes-botones"><button type="button" class="boton boton--secundario boton--grande" data-copia="${i}">${ui.esc(`${new Date(c.cuando).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${c.motivo}`)}</button></div>`).join('')}`;
      caja.querySelectorAll('[data-copia]').forEach((b) => b.addEventListener('click', async () => {
        const copia = copias[Number(b.dataset.copia)];
        if (!(await ui.confirmar('¿Dejar los datos como estaban en esa copia? Lo de ahora queda guardado como otra copia, por si quiere devolverse.', { aceptar: 'Sí, volver a esa copia', peligro: true }))) return;
        try { await nube.restaurarCopiaLocal(copia.cuando); ui.toast('Listo: los datos quedaron como en esa copia.', 5000); } catch (error) { ui.toast(textoError(error), 6000); }
        pintar();
      }));
    }).catch(() => {});
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
      `¿Importar "${archivo.name}"? Se reemplaza TODO lo que hay ahora: ${cantidad.clientes} clientes, ${cantidad.prestamos} préstamos, ${cantidad.pagos} pagos y también los libros (gastos, arriendos, agenda, notas). Si está en la nube, el cambio llega al otro aparato. Antes de hacerlo queda una copia guardada en este aparato.`,
      { aceptar: 'Sí, importar', peligro: true }
    );
    if (!seguro) return;
    botonImportar.disabled = true;
    try {
      const texto = await leerArchivoComoTexto(archivo);
      if (ctx.nube && ctx.nube.guardarCopiaLocal) await ctx.nube.guardarCopiaLocal('antes de importar una copia');
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
        Borra TODO: clientes, préstamos, pagos, caja y también los libros (gastos, arriendos, agenda, notas).
        Si está en la nube, también se borra en el otro aparato. Antes de borrar queda una copia guardada en este aparato.
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
      `¿Borrar todos los datos? Se van ${cantidadClientes} clientes, ${cantidadPrestamos} préstamos y todos los libros, aquí y en la nube.`,
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
      if (ctx.nube && ctx.nube.guardarCopiaLocal) await ctx.nube.guardarCopiaLocal('antes de borrar todo');
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
  const opciones = [[0, 'Al salir'], [5, '5 min'], [30, '30 min'], [120, '2 horas'], [480, '8 horas']];

  async function pintar() {
    if (!candado) { cuerpo.innerHTML = '<p class="ajustes-texto">No disponible.</p>'; return; }
    const e = candado.estado();
    if (e.activo) {
      cuerpo.innerHTML = `
        <p class="ajustes-texto">Activo en este aparato. Fran pide tu cara (o el código del iPhone si falla) solo si no la has usado en el tiempo que elijas.</p>
        <p class="ajustes-ayuda">Pedir la cara si no la uso en:</p>
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

// Descargar: flecha hacia abajo que reposa sobre una raya, con el color del tema (pedido el 7 nov 2026).
const SVG_YO = {
  descargar: '<svg class="fran-3d fran-svg-yo" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="yo-desc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--luz)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs><path d="M32 8v32M18 27l14 14 14-14" fill="none" stroke="url(#yo-desc)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="12" y="49" width="40" height="7" rx="3.5" fill="url(#yo-desc)"/></svg>',
};
function iconoYo(archivo, clase = '') {
  if (archivo.startsWith('svg:')) return SVG_YO[archivo.slice(4)].replace('class="fran-3d', `class="fran-3d ${clase}`);
  return `<img class="fran-3d ${clase}" src="iconos/3d/${archivo}.png" alt="" aria-hidden="true" decoding="async">`;
}

const ICONO_3D_YO = { 'Categorías': 'carpeta', 'Recordatorios': 'reloj', 'Transacciones recurrentes': 'repetir', 'Respaldo y exportar Excel': 'nube', 'Face ID': 'candado', 'Nube': 'mundo', 'Instalar en el teléfono': 'celular', 'Acerca de la app': 'info' };
const icono3dYo = (clave, emoji) => (ICONO_3D_YO[clave] ? `<img class="fran-3d fran-3d--40" src="iconos/3d/${ICONO_3D_YO[clave]}-azul.png" alt="" aria-hidden="true" decoding="async">` : `<span>${emoji}</span>`);

function plegable(icono, texto, seccion, ui) {
  const caja = ui.el(`<details class="fran-ajuste"${abiertos.has(texto) ? ' open' : ''}><summary>${icono3dYo(texto, icono)}${ui.esc(texto)}<i class="fran-ajuste__flecha" aria-hidden="true"></i></summary></details>`);
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
      ${icono3dDe(c)}
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
    <div class="fran-renglon fran-renglon--dato" id="estado-push"><img class="fran-3d fran-3d--40" src="iconos/3d/reloj-azul.png" alt="" aria-hidden="true"><span class="fran-renglon__texto"><span>Avisos en el teléfono</span><small>Cargando…</small></span></div>
    <div class="ajustes-botones"><button type="button" class="fran-boton-principal" id="boton-push">Activar avisos en el teléfono</button><button type="button" class="fran-boton-secundario" id="boton-push-probar">Ver un aviso de prueba</button></div>
    <p class="ajustes-ayuda">Los pendientes de la agenda te llegan como notificación aunque Fran esté cerrada, con los botones "Ya lo hice" y "Todavía no". Si no lo marcas, vuelve a avisar. En iPhone, Fran debe estar agregada a la pantalla de inicio.</p>
    <div class="ajustes-botones"><button type="button" class="fran-boton-secundario" id="boton-avisos">Poner avisos en el calendario</button></div>
    <p class="ajustes-ayuda">Se descarga un archivo. Ábrelo y elige Agregar: el calendario te avisa a esas horas aunque Fran esté cerrada. Si cambian los cobros, vuelve a tocar este botón.</p>
    <p class="ajustes-ayuda">Dentro de Fran, el inicio te muestra los cobros de hoy y te recuerda anotar.</p>
  </section>`);
  const guardarHoras = async () => {
    const f = { cobros: s.querySelector('[name="cobros"]').value, gastos: s.querySelector('[name="gastos"]').value };
    if (f.cobros && f.gastos) await datos.actualizarFran({ recordatorios: f });
  };
  s.querySelectorAll('input').forEach((i) => i.addEventListener('change', guardarHoras));
  const pintarPush = async () => {
    const e = s.querySelector('#estado-push small');
    const b = s.querySelector('#boton-push');
    if (!avisos.disponible()) { e.textContent = 'Este navegador no puede recibir avisos.'; b.disabled = true; return; }
    if (!avisos.instaladaEnIphone()) { e.textContent = 'Primero agrega Fran a la pantalla de inicio (compartir → Agregar a inicio).'; b.disabled = true; return; }
    if (avisos.estado() === 'denied') { e.textContent = 'Los avisos están bloqueados en los ajustes del teléfono.'; b.disabled = true; return; }
    const activa = await avisos.activada();
    e.textContent = activa ? 'Activos en este aparato.' : 'Apagados en este aparato.';
    b.textContent = activa ? 'Quitar los avisos de este aparato' : 'Activar avisos en el teléfono';
    b.dataset.activa = activa ? '1' : '';
  };
  s.querySelector('#boton-push').addEventListener('click', async () => {
    const b = s.querySelector('#boton-push');
    try {
      if (b.dataset.activa) { await avisos.desactivar(ctx.nube); ui.toast('Avisos apagados en este aparato.'); }
      else {
        const r = await avisos.activar(ctx.nube);
        const textos = { ok: 'Listo: los pendientes te van a llegar al teléfono.', negado: 'No diste permiso. Puedes darlo en los ajustes del teléfono.', 'sin-nube': 'Primero entra a la nube en Yo → Nube.', 'sin-instalar': 'Agrega Fran a la pantalla de inicio y vuelve a intentar.', 'no-soportado': 'Este navegador no puede recibir avisos.' };
        ui.toast(textos[r] || r, 6000);
      }
    } catch (error) { ui.toast(error.message, 7000); }
    pintarPush();
  });
  s.querySelector('#boton-push-probar').addEventListener('click', async () => {
    try {
      if (avisos.estado() !== 'granted') { const r = await Notification.requestPermission(); if (r !== 'granted') { ui.toast('No diste permiso para avisos.'); return; } }
      await avisos.probar();
    } catch (error) { ui.toast(error.message, 6000); }
  });
  pintarPush();
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
      ${icono3dDe(r.categoria)}
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
  const irA = { categorias: 'Categorías', recordatorios: 'Recordatorios', recurrentes: 'Transacciones recurrentes', nube: 'Nube' }[params && params.seccion];
  const saltar = irA && irA !== ultimoSalto;
  ultimoSalto = irA || '';
  // Tres grupos con símbolo; al tocar uno se despliegan sus cuadros (icono grande, dos por fila).
  const GRUPOS = [
    { id: 'ajustes', nombre: 'Ajustes', icono: 'engranaje-azul', items: [
      ['Categorías', 'carpeta-azul', () => seccionCategorias(ctx)],
      ['Moneda COP · tasa USD', 'monedas', null, '#/libro/pension'],
      ['Recordatorios', 'reloj-azul', () => seccionRecordatorios(ctx)],
      ['Transacciones recurrentes', 'repetir-azul', () => seccionRecurrentes(ctx)],
    ] },
    { id: 'seguridad', nombre: 'Seguridad', icono: 'candado-azul', items: [
      ['Respaldo y exportar Excel', 'tabla-azul', () => { const d = document.createElement('div'); d.append(seccionCopia(ctx), seccionHistoricos(ctx), seccionBorrar(ctx)); return d; }],
      ['Face ID', 'candado-azul', () => seccionCandado(ctx)],
    ] },
    { id: 'app', nombre: 'Esta app', icono: 'celular-azul', items: [
      ['Nube', 'nube-azul', () => seccionNube(ctx)],
      ['Instalar en el teléfono', 'svg:descargar', () => seccionInstalar(ctx)],
      ['Acerca de la app', 'info-azul', () => seccionAcerca(ctx)],
    ] },
  ];
  if (saltar) { const g = GRUPOS.find((x) => x.items.some((it) => it[0] === irA)); seleccionYo = { grupo: g ? g.id : '', item: irA }; }
  contenedor.append(ui.el(`<header class="fran-titulo"><a href="#/inicio" class="fran-titulo__atras" aria-label="Volver">‹</a><h1>Yo</h1><button type="button" class="fran-titulo__der fran-titulo__paleta" aria-label="Apariencia: temas, letra y sombreado"><img class="fran-3d" src="iconos/3d/paleta.png" alt="" aria-hidden="true"></button></header>`));
  contenedor.querySelector('.fran-titulo__paleta').addEventListener('click', () => abrirApariencia(''));
  const grupos = ui.el(`<div class="fran-yo-grupos">${GRUPOS.map((g) => `<button type="button" class="fran-yo-grupo" data-grupo="${g.id}" aria-pressed="false"><img class="fran-3d" src="iconos/3d/${g.icono}.png" alt="" aria-hidden="true" decoding="async"><span>${ui.esc(g.nombre)}</span></button>`).join('')}</div>`);
  const cuadros = ui.el('<div class="fran-yo-cuadros"></div>');
  const panel = ui.el('<div class="fran-yo-panel"></div>');
  const pintar = () => {
    grupos.querySelectorAll('[data-grupo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.grupo === seleccionYo.grupo)));
    const g = GRUPOS.find((x) => x.id === seleccionYo.grupo);
    cuadros.innerHTML = g ? g.items.map(([texto, archivo, , ruta]) => {
      const dentro = `${iconoYo(archivo)}<span>${ui.esc(texto)}</span>`;
      return ruta ? `<a class="fran-yo-cuadro" href="${ruta}">${dentro}</a>` : `<button type="button" class="fran-yo-cuadro" data-item="${ui.esc(texto)}" aria-pressed="${String(texto === seleccionYo.item)}">${dentro}</button>`;
    }).join('') : '';
    cuadros.classList.toggle('abierto', !!g);
    panel.innerHTML = '';
    const it = g && g.items.find((x) => x[0] === seleccionYo.item);
    if (it && it[2]) {
      const caja = ui.el(`<section class="fran-yo-panel__caja"><h2>${iconoYo(it[1], 'fran-3d--28')}${ui.esc(it[0])}</h2></section>`);
      caja.append(it[2]());
      panel.append(caja);
    }
  };
  grupos.addEventListener('click', (e) => { const b = e.target.closest('[data-grupo]'); if (!b) return; seleccionYo = { grupo: seleccionYo.grupo === b.dataset.grupo ? '' : b.dataset.grupo, item: '' }; pintar(); });
  cuadros.addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]'); if (!b) return;
    seleccionYo.item = seleccionYo.item === b.dataset.item ? '' : b.dataset.item; pintar();
    if (seleccionYo.item) setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  });
  contenedor.append(grupos, cuadros, panel);
  pintar();
  contenedor.append(ui.el(`<p class="fran-version"><span class="fran-version__pildora">Versión ${ui.esc(ctx.version || '')}</span></p>`));
  if (saltar) setTimeout(() => panel.scrollIntoView({ block: 'start' }), 80);
}
