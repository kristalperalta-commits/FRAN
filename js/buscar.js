/*
  buscar.js — buscador de nombres que entiende cómo se escribe de verdad (3.61.0).

  - Por las primeras letras de cualquier nombre o apellido: "a" trae Ana y Andrés; "ana" solo Ana.
  - Sin importar tildes ni mayúsculas.
  - Perdona la ortografía que suena igual: s/z/c, b/v, y/ll/i, h muda, k/q/c, g/j.
    "Sofia" encuentra "Zofia"; "Yuleidi" encuentra "Yuleidy".
  - Si se equivoca en una letra (desde 4 letras escritas), igual sugiere el parecido.
  Los mejores van primero: los que empiezan igual, luego los que suenan igual, luego los parecidos.
*/

export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Cómo suena una palabra: letras que en Colombia se pronuncian igual quedan iguales. */
export function sonido(palabra) {
  return normalizar(palabra)
    .replace(/ch/g, '§')
    .replace(/h/g, '')
    .replace(/§/g, 'ch')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/c([ei])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/g([ei])/g, 'j$1')
    .replace(/x/g, 'ks')
    .replace(/y(?=[^aeiou]|$)/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = guardado;
    }
  }
  return fila[b.length];
}

/** Qué tan bien una palabra buscada calza con alguna palabra del nombre: 3 igual, 2 suena igual, 1 contiene, 0.5 parecido, 0 nada. */
function calce(q, palabras) {
  let mejor = 0;
  const qs = sonido(q);
  for (const w of palabras) {
    if (w.startsWith(q)) return 3;
    if (qs && sonido(w).startsWith(qs)) mejor = Math.max(mejor, 2);
    else if (q.length >= 3 && w.includes(q)) mejor = Math.max(mejor, 1);
    else if (q.length >= 4) {
      const tope = q.length >= 7 ? 2 : 1;
      if (distancia(q, w.slice(0, q.length)) <= tope || distancia(qs, sonido(w).slice(0, qs.length)) <= tope) mejor = Math.max(mejor, 0.5);
    }
  }
  return mejor;
}

/** Puntaje de un texto (nombre, alias…) para lo buscado. 0 = no sale. */
export function puntaje(texto, buscado) {
  const q = normalizar(buscado);
  if (!q) return 1;
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  if (!palabras.length) return 0;
  const entero = palabras.join(' ');
  if (entero.startsWith(q)) return 4;
  let total = 0;
  for (const parte of q.split(' ')) {
    const c = calce(parte, palabras);
    if (!c) return 0;
    total += c;
  }
  return total / q.split(' ').length;
}

/** Filtra y ordena: primero los que mejor calzan, luego por nombre. textoDe(item) da el texto donde buscar. */
export function buscarEn(lista, buscado, textoDe) {
  if (!normalizar(buscado)) return [...lista];
  return lista
    .map((item) => ({ item, p: puntaje(textoDe(item), buscado) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || String(textoDe(a.item)).localeCompare(String(textoDe(b.item)), 'es'))
    .map((x) => x.item);
}
