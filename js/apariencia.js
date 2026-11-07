/*
  apariencia.js: la hoja de la tuerquita ⚙️. Tema de toda la app o de cada libro,
  y tamaño de la letra y sombreado con barras que se deslizan por porcentaje.
  Todo se guarda en este aparato (js/tema.js).
*/

const PARTES = [
  ['', '📱', 'Toda la app'],
  ['personal', '👛', 'Finanzas'],
  ['prestamos', '🏦', 'Préstamos'],
  ['pension', '🐷', 'Pensión'],
  ['productos', '💻', 'Tecnológico'],
  ['arriendos', '🏢', 'Arriendos'],
  ['redes', '👥', 'Redes'],
  ['terceros', '🤝', 'Terceros'],
];

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function abrirApariencia(libroInicial = '') {
  const Tema = window.Tema;
  const Letra = window.Letra;
  const Relieve = window.Relieve;
  const Estilo = window.Estilo;
  if (!Tema || !Letra || !Relieve || !Estilo) return;
  const antes = Tema.libroVisible ? Tema.libroVisible() : null;
  let parte = PARTES.some(([id]) => id === libroInicial) ? libroInicial : '';

  const fondo = document.createElement('div');
  fondo.className = 'fran-hoja-fondo';
  fondo.innerHTML = `<div class="fran-hoja fran-apariencia" role="dialog" aria-modal="true" aria-label="Apariencia">
    <h2>Apariencia</h2>
    <p class="fran-apariencia__etiqueta">Estilo</p>
    <div class="fran-apariencia__estilos">${Estilo.lista.map((e) => `<button type="button" data-estilo-elegir="${e.id}" aria-pressed="false"><i class="fran-estilo-muestra fran-estilo-muestra--${e.id}" aria-hidden="true"></i><span>${esc(e.nombre)}</span></button>`).join('')}</div>
    <div class="fran-apariencia__modo"><button type="button" data-modo-elegir="claro">☀️ Claro</button><button type="button" data-modo-elegir="oscuro">🌙 Oscuro</button></div>
    <p class="fran-apariencia__etiqueta">Color para</p>
    <div class="fran-apariencia__partes">${PARTES.map(([id, ic, nombre]) => `<button type="button" data-parte="${id}"><span>${ic}</span>${esc(nombre)}</button>`).join('')}</div>
    <div class="fran-apariencia__temas"></div>
    <p class="fran-apariencia__etiqueta">Tamaño de la letra <b data-pct></b></p>
    <div class="fran-apariencia__letra"><span aria-hidden="true">A</span><input type="range" name="letra" min="${Letra.min}" max="${Letra.max}" step="${Letra.paso}" value="${Letra.actual()}" aria-label="Tamaño de la letra en porcentaje"><span aria-hidden="true" class="grande">A</span></div>
    <p class="fran-apariencia__etiqueta" data-ajuste="sombreado">Sombreado y relieve <b data-pct-relieve></b></p>
    <div class="fran-apariencia__letra" data-ajuste="sombreado"><span aria-hidden="true">◌</span><input type="range" name="relieve" min="${Relieve.min}" max="${Relieve.max}" step="${Relieve.paso}" value="${Relieve.actual()}" aria-label="Sombreado y relieve en porcentaje"><span aria-hidden="true" class="grande">◉</span></div>
    <button type="button" class="fran-boton-principal" data-listo>Listo</button>
  </div>`;

  const pintarTemas = () => {
    fondo.querySelectorAll('[data-parte]').forEach((b) => b.classList.toggle('activo', b.dataset.parte === parte));
    const propio = parte ? Tema.temaDeLibro(parte) : Tema.actual();
    const opciones = parte ? [['', 'Igual que toda la app', null]] : [];
    for (const t of Tema.lista) opciones.push([t.id, t.nombre, t.muestra || t.fondo]);
    fondo.querySelector('.fran-apariencia__temas').innerHTML = opciones.map(([id, nombre, color]) => `<button type="button" class="ajustes-tema" data-tema-elegir="${id}" aria-pressed="${(propio || '') === id}">${color ? `<i class="ajustes-tema__color" style="background:${color}"></i>` : '<i class="ajustes-tema__color ajustes-tema__color--igual"></i>'}<span>${esc(nombre)}</span></button>`).join('');
    Tema.aplicarPara(parte || null);
  };
  const pintarModo = () => fondo.querySelectorAll('[data-modo-elegir]').forEach((b) => b.classList.toggle('activo', b.dataset.modoElegir === Tema.modo()));
  const pintarEstilo = () => {
    const actual = Estilo.actual();
    fondo.querySelectorAll('[data-estilo-elegir]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.estiloElegir === actual)));
    const ajustes = (Estilo.lista.find((e) => e.id === actual) || Estilo.lista[0]).ajustes;
    fondo.querySelectorAll('[data-ajuste]').forEach((x) => { x.hidden = !ajustes.includes(x.dataset.ajuste); });
  };
  const pintarLetra = () => { fondo.querySelector('[data-pct]').textContent = `${Letra.actual()} %`; fondo.querySelector('[data-pct-relieve]').textContent = `${Relieve.actual()} %`; };

  const cerrar = () => { fondo.remove(); Tema.aplicarPara(antes); };
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-listo]')) { cerrar(); return; }
    // Ojo: <html> lleva data-modo, por eso estos botones usan data-modo-elegir.
    const es = e.target.closest('[data-estilo-elegir]');
    if (es) { Estilo.elegir(es.dataset.estiloElegir); pintarEstilo(); return; }
    const m = e.target.closest('[data-modo-elegir]');
    if (m) { Tema.cambiarModo(m.dataset.modoElegir); Tema.aplicarPara(parte || null); pintarModo(); return; }
    const p = e.target.closest('[data-parte]');
    if (p) { parte = p.dataset.parte; pintarTemas(); return; }
    const t = e.target.closest('[data-tema-elegir]');
    if (t) {
      if (parte) Tema.elegirParaLibro(parte, t.dataset.temaElegir || null);
      else Tema.elegir(t.dataset.temaElegir);
      pintarTemas();
    }
  });
  fondo.querySelector('input[name="letra"]').addEventListener('input', (e) => { Letra.elegir(Number(e.target.value)); pintarLetra(); });
  fondo.querySelector('input[name="relieve"]').addEventListener('input', (e) => { Relieve.elegir(Number(e.target.value)); pintarLetra(); });
  pintarTemas();
  pintarModo();
  pintarLetra();
  pintarEstilo();
  document.body.append(fondo);
  const activo = fondo.querySelector('[data-parte].activo');
  if (activo) activo.scrollIntoView({ block: 'nearest', inline: 'center' });
}
