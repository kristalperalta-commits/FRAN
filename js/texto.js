/*
  texto.js: entiende lo que se escribe o se dicta en "¿Para qué y cuánto cuesta?".
  "almuerzo 15000" → { descripcion: 'almuerzo', valor: 15000 }
  "60 mil gasolina" → { descripcion: 'gasolina', valor: 60000 }
  "cama 1.5M" → { descripcion: 'cama', valor: 1500000 }
  "pechuga 9 mil 500" → { descripcion: 'pechuga', valor: 9500 }
  "2 pechugas 9500" → { descripcion: '2 pechugas', valor: 9500 }: el valor es la cifra más alta.
*/

const PATRON = /(^|\s)\$?\s*(\d[\d.,]*)\s*(k|mil|m|millon|millón|millones)?(?=\s|$)/gi;
const MILLONES_Y_MIL = /(^|\s)(\d+)\s*(?:millon|millón|millones)\s+(\d{1,3})\s*mil(?:\s+(\d{3}))?(?=\s|$)/gi;
const MIL_Y_RESTO = /(^|\s)(\d+)\s*mil\s+(\d{3})(?=\s|$)/gi;

function aEntero(numero, sufijo) {
  const s = String(sufijo || '').toLowerCase();
  const multiplicador = s === 'k' || s === 'mil' ? 1000 : (s ? 1000000 : 1);
  if (multiplicador > 1) {
    const n = Number(numero.replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * multiplicador) : null;
  }
  // Sin sufijo los puntos y comas son separadores de miles: 1.500.000 o 15,000.
  const n = Number(numero.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function leerTexto(texto) {
  const original = String(texto || '').trim();
  const unido = original
    .replace(MILLONES_Y_MIL, (_, ini, m, k, r) => `${ini}${Number(m) * 1000000 + Number(k) * 1000 + Number(r || 0)}`)
    .replace(MIL_Y_RESTO, (_, ini, k, r) => `${ini}${Number(k) * 1000 + Number(r)}`);
  let mejor = null;
  for (const hallado of unido.matchAll(PATRON)) {
    const valor = aEntero(hallado[2], hallado[3]);
    if (valor > 0 && (!mejor || valor > mejor.valor)) mejor = { valor, texto: hallado[0] };
  }
  if (!mejor) return { descripcion: original, valor: null };
  const descripcion = unido.replace(mejor.texto, ' ').replace(/\bpesos\b/gi, ' ').replace(/\s+/g, ' ').replace(/[\s,.;:]+$/, '').trim();
  return { descripcion, valor: mejor.valor };
}
