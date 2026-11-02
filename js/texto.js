/*
  texto.js: entiende lo que se escribe o se dicta en "¿Para qué y cuánto cuesta?".
  "almuerzo 15000" → { descripcion: 'almuerzo', valor: 15000 }
  "60 mil gasolina" → { descripcion: 'gasolina', valor: 60000 }
  "cama 1.5M" → { descripcion: 'cama', valor: 1500000 }
*/

const PATRON = /(^|\s)\$?\s*(\d[\d.,]*)\s*(k|mil|m|millon|millón|millones)?(?=\s|$)/i;

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
  const hallado = original.match(PATRON);
  if (!hallado) return { descripcion: original, valor: null };
  const valor = aEntero(hallado[2], hallado[3]);
  const descripcion = original.replace(hallado[0], ' ').replace(/\s+/g, ' ').trim();
  return { descripcion, valor: valor > 0 ? valor : null };
}
