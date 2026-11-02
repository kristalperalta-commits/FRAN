// dinero.js — dinero en pesos como enteros. Sección 1 de la especificación:
// nunca decimales; formato en pantalla '1.234.567'.

/** Redondea al peso entero más cercano. Devuelve 0 si no es un número. */
export function redondear(n) {
  const valor = Number(n);
  if (!Number.isFinite(valor)) return 0;
  const redondeado = Math.round(valor);
  return redondeado === 0 ? 0 : redondeado; // evita el -0
}

/** 1234567 → '1.234.567'. Negativos con guion: -1234 → '-1.234'. */
export function formatear(n) {
  const valor = redondear(n);
  const absoluto = Math.abs(valor);
  const digitos = String(absoluto);
  let salida = '';
  let cuenta = 0;
  for (let i = digitos.length - 1; i >= 0; i--) {
    salida = digitos[i] + salida;
    cuenta++;
    if (cuenta % 3 === 0 && i > 0) salida = `.${salida}`;
  }
  return valor < 0 ? `-${salida}` : salida;
}

/** Igual que formatear pero siempre con signo: '+1.234', '-1.234', '0'. */
export function formatearSigno(n) {
  const valor = redondear(n);
  if (valor > 0) return `+${formatear(valor)}`;
  return formatear(valor);
}

/** Formato con el signo de pesos: '$ 1.234.567'. */
export function formatearPesos(n) {
  return `$ ${formatear(n)}`;
}

/**
 * Interpreta un texto sin sufijo compuesto solo de dígitos, puntos y comas.
 * Devuelve un número (puede traer decimales) o null si es ambiguo.
 * Reglas:
 * - Un solo tipo de separador y todos los grupos después del primero de 3 dígitos:
 *   separadores de miles ('1.234.567', '300.000', '1,000').
 * - Un solo separador seguido de 1 o 2 dígitos: parte decimal ('1.5', '300,50').
 * - Punto y coma mezclados: el último separador es el decimal y debe llevar 1 o 2
 *   dígitos; el otro debe ser de miles con grupos de 3 ('1.000.000,00', '1,000.50').
 * - Cualquier otra mezcla ('1.5.5', '1,2.3', '12.3456') es ambigua: null.
 */
function interpretarSinSufijo(limpio) {
  if (!/^[\d.,]+$/.test(limpio)) return null;
  // Un separador suelto al final (escribiendo todavía) se ignora: '300.' → '300'.
  if (/[.,]$/.test(limpio)) limpio = limpio.slice(0, -1);
  if (limpio === '' || /[.,]$/.test(limpio)) return null;
  if (!/[.,]/.test(limpio)) return Number(limpio);

  const grupos = limpio.split(/[.,]/);
  if (grupos.some((g) => g === '')) return null; // '1..000' o '.5'
  const separadores = limpio.replace(/\d/g, '');
  const hayPunto = separadores.includes('.');
  const hayComa = separadores.includes(',');
  const ultimoGrupo = grupos[grupos.length - 1];
  const esMiles = (lista) => lista.every((g) => g.length === 3);

  if (hayPunto && hayComa) {
    // Mezcla: el último separador es decimal, el otro de miles.
    const decimal = separadores.slice(-1);
    const miles = separadores.slice(0, -1);
    if (miles.includes(decimal)) return null;        // '1,2.3,4' o '1.000,00.5'
    if (!/^\d{1,2}$/.test(ultimoGrupo)) return null;  // '1.000,000'
    const enteros = grupos.slice(1, -1);
    if (!esMiles(enteros)) return null;              // '1,2.3'
    return Number(`${grupos.slice(0, -1).join('')}.${ultimoGrupo}`);
  }

  // Un solo tipo de separador.
  if (esMiles(grupos.slice(1))) return Number(grupos.join(''));
  if (grupos.length === 2 && /^\d{1,2}$/.test(ultimoGrupo)) {
    return Number(`${grupos[0]}.${ultimoGrupo}`);   // '1.5', '300,50'
  }
  return null;                                       // '1.5.5', '12.3456'
}

/**
 * Lee lo que ella escribe y devuelve un entero en pesos, o null si no se entiende.
 * Acepta: '1.234.567', '1234567', '$ 300.000', '200k', '1.5M', '1,5M', '-500',
 * y montos copiados de Excel con decimales: '1.000.000,00' → 1000000, '300.000,00' → 300000.
 * Con sufijo k (miles) o M (millones) el punto o la coma es separador decimal.
 * Sin sufijo, ver interpretarSinSufijo: miles con grupos de 3, decimales de 1 o 2
 * dígitos (se redondean al peso), mezclas ambiguas devuelven null.
 */
export function leer(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? redondear(texto) : null;
  if (texto == null) return null;

  let limpio = String(texto).trim().toLowerCase();
  limpio = limpio.replace(/\$/g, '').replace(/\s+/g, '');
  if (limpio === '') return null;

  let negativo = false;
  if (limpio.startsWith('-')) {
    negativo = true;
    limpio = limpio.slice(1);
  }

  let multiplicador = 1;
  const ultimo = limpio.slice(-1);
  if (ultimo === 'k') {
    multiplicador = 1000;
    limpio = limpio.slice(0, -1);
  } else if (ultimo === 'm') {
    multiplicador = 1000000;
    limpio = limpio.slice(0, -1);
  }
  if (limpio === '') return null;

  let valor;
  if (multiplicador === 1) {
    valor = interpretarSinSufijo(limpio);
    if (valor === null) return null;
  } else {
    // Con sufijo: una sola parte decimal permitida, con punto o coma.
    if (!/^\d+([.,]\d+)?$/.test(limpio)) return null;
    valor = Number(limpio.replace(',', '.')) * multiplicador;
  }

  if (!Number.isFinite(valor)) return null;
  return redondear(negativo ? -valor : valor);
}

/** Porcentaje de un monto, redondeado a pesos: porcentaje(1000000, 20) → 200000. */
export function porcentaje(monto, tasa) {
  return redondear((Number(monto) || 0) * (Number(tasa) || 0) / 100);
}
