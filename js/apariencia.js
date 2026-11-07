/*
  apariencia.js: la hoja de la tuerquita ⚙️. Tema de toda la app o de cada libro,
  y tamaño de la letra con una barra que se desliza por porcentaje.
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
  if (!Tema || !Letra) return;
  const antes = Tema.libroVisible ? Tema.libroVisible() : null;
  let parte = PARTES.some(([id]) => id === libroInicial) ? libroInicial : '';

  const fondo = document.createElement('div');
  fondo.className = 'fran-hoja-fondo';
  fondo.innerHTML = `<div class="fran-hoja fran-apariencia" role="dialog" aria-modal="true" aria-label="Apariencia">
    <h2>Apariencia</h2>
    <p class="fran-apariencia__etiqueta">Tema para</p>
    <div class="fran-apariencia__partes">${PARTES.map(([id, ic, nombre]) => `<button type="button" data-parte="${id}"><span>${ic}</span>${esc(nombre)}</button>`).join('')}</div>
    <div class="fran-apariencia__temas"></div>
    <p class="fran-apariencia__etiqueta">Tamaño de la letra <b data-pct></b></p>
    <div class="fran-apariencia__letra"><span aria-hidden="true">A</span><input type="range" min="${Letra.min}" max="${Letra.max}" step="${Letra.paso}" value="${Letra.actual()}" aria-label="Tamaño de la letra en porcentaje"><span aria-hidden="true" class="grande">A</span></div>
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
  const pintarLetra = () => { fondo.querySelector('[data-pct]').textContent = `${Letra.actual()} %`; };

  const cerrar = () => { fondo.remove(); Tema.aplicarPara(antes); };
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-listo]')) { cerrar(); return; }
    const p = e.target.closest('[data-parte]');
    if (p) { parte = p.dataset.parte; pintarTemas(); return; }
    const t = e.target.closest('[data-tema-elegir]');
    if (t) {
      if (parte) Tema.elegirParaLibro(parte, t.dataset.temaElegir || null);
      else Tema.elegir(t.dataset.temaElegir);
      pintarTemas();
    }
  });
  fondo.querySelector('input[type="range"]').addEventListener('input', (e) => { Letra.elegir(Number(e.target.value)); pintarLetra(); });
  pintarTemas();
  pintarLetra();
  document.body.append(fondo);
  const activo = fondo.querySelector('[data-parte].activo');
  if (activo) activo.scrollIntoView({ block: 'nearest', inline: 'center' });
}
