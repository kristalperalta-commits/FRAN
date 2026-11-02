// fechas.js — aritmética de fechas como texto 'AAAA-MM-DD'.
// Sección 1 de la especificación: nunca new Date('AAAA-MM-DD') porque Safari
// lo interpreta en UTC. Todo se calcula a mano con año, mes y día.

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const NOMBRES_MES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dos dígitos con cero a la izquierda. */
function dosDigitos(n) {
  return n < 10 ? `0${n}` : String(n);
}

/** Año bisiesto según el calendario gregoriano. */
export function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** Cantidad de días del mes (1 a 12) en ese año. */
export function diasDelMes(anio, mes) {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  if (mes === 4 || mes === 6 || mes === 9 || mes === 11) return 30;
  return 31;
}

/** Verdadero si el texto es una fecha 'AAAA-MM-DD' que existe en el calendario. */
export function esFechaValida(texto) {
  if (typeof texto !== 'string') return false;
  const partes = PATRON_FECHA.exec(texto);
  if (!partes) return false;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > diasDelMes(anio, mes)) return false;
  return true;
}

/** Separa 'AAAA-MM-DD' en { anio, mes, dia } numéricos. Lanza error si no es válida. */
export function partir(fecha) {
  if (!esFechaValida(fecha)) throw new Error(`Fecha inválida: ${fecha}`);
  return {
    anio: Number(fecha.slice(0, 4)),
    mes: Number(fecha.slice(5, 7)),
    dia: Number(fecha.slice(8, 10)),
  };
}

/** Arma 'AAAA-MM-DD' a partir de números. */
export function armar(anio, mes, dia) {
  return `${String(anio).padStart(4, '0')}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

/**
 * Suma meses con tope de día, partiendo siempre de la fecha original (regla 4.1.2).
 * 31 de enero + 1 mes = 28 de febrero (29 en bisiesto); 31 de enero + 2 meses = 31 de marzo.
 * Acepta n negativo.
 */
export function sumarMeses(fecha, n) {
  const { anio, mes, dia } = partir(fecha);
  const totalMeses = anio * 12 + (mes - 1) + Math.trunc(n);
  const nuevoAnio = Math.floor(totalMeses / 12);
  const nuevoMes = totalMeses - nuevoAnio * 12 + 1;
  const nuevoDia = Math.min(dia, diasDelMes(nuevoAnio, nuevoMes));
  return armar(nuevoAnio, nuevoMes, nuevoDia);
}

/**
 * Número de días desde el 1 de enero de 1970 (puede ser negativo).
 * Algoritmo civil de calendario gregoriano, sin usar Date.
 */
function aNumeroDia(fecha) {
  const { anio, mes, dia } = partir(fecha);
  const a = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(a / 400);
  const anioDeEra = a - era * 400;
  const mesDesplazado = mes > 2 ? mes - 3 : mes + 9;
  const diaDelAnio = Math.floor((153 * mesDesplazado + 2) / 5) + dia - 1;
  const diaDeEra = anioDeEra * 365 + Math.floor(anioDeEra / 4) - Math.floor(anioDeEra / 100) + diaDelAnio;
  return era * 146097 + diaDeEra - 719468;
}

/** Inverso de aNumeroDia: número de días desde 1970 → 'AAAA-MM-DD'. */
function deNumeroDia(numero) {
  const z = numero + 719468;
  const era = Math.floor(z / 146097);
  const diaDeEra = z - era * 146097;
  const anioDeEra = Math.floor(
    (diaDeEra - Math.floor(diaDeEra / 1460) + Math.floor(diaDeEra / 36524) - Math.floor(diaDeEra / 146096)) / 365,
  );
  const a = anioDeEra + era * 400;
  const diaDelAnio = diaDeEra - (365 * anioDeEra + Math.floor(anioDeEra / 4) - Math.floor(anioDeEra / 100));
  const mesDesplazado = Math.floor((5 * diaDelAnio + 2) / 153);
  const dia = diaDelAnio - Math.floor((153 * mesDesplazado + 2) / 5) + 1;
  const mes = mesDesplazado < 10 ? mesDesplazado + 3 : mesDesplazado - 9;
  return armar(mes <= 2 ? a + 1 : a, mes, dia);
}

/** Suma n días (n puede ser negativo). */
export function sumarDias(fecha, n) {
  return deNumeroDia(aNumeroDia(fecha) + Math.trunc(n));
}

/** Compara dos fechas: -1 si a < b, 0 si iguales, 1 si a > b. */
export function comparar(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Días que van de a hasta b (b − a). Positivo si b es posterior. */
export function diferenciaDias(a, b) {
  return aNumeroDia(b) - aNumeroDia(a);
}

/** Fecha de hoy en hora local del teléfono, no UTC. */
export function hoy() {
  const d = new Date();
  return armar(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 'AAAA-MM-DD' → 'AAAA-MM' (etiqueta del periodo, regla 4.1.3). */
export function mesDe(fecha) {
  return String(fecha).slice(0, 7);
}

/** Primer día del mes: 'AAAA-MM' o 'AAAA-MM-DD' → 'AAAA-MM-01'. */
export function inicioDeMes(fecha) {
  return `${mesDe(fecha)}-01`;
}

/** Último día del mes: 'AAAA-MM' o 'AAAA-MM-DD' → 'AAAA-MM-28..31'. */
export function finDeMes(fecha) {
  const anio = Number(String(fecha).slice(0, 4));
  const mes = Number(String(fecha).slice(5, 7));
  return armar(anio, mes, diasDelMes(anio, mes));
}

/** Nombre del mes en español: 1 → 'enero'. */
export function nombreMes(mes, corto = false) {
  const lista = corto ? NOMBRES_MES_CORTOS : NOMBRES_MES;
  return lista[mes - 1] || '';
}

/** '2026-04-11' → '11 abr 2026'. Si la fecha no es válida devuelve el texto tal cual. */
export function formatear(fecha) {
  if (!esFechaValida(fecha)) return fecha == null ? '' : String(fecha);
  const { anio, mes, dia } = partir(fecha);
  return `${dia} ${NOMBRES_MES_CORTOS[mes - 1]} ${anio}`;
}

/** '2026-05' o '2026-05-11' → 'mayo 2026'. */
export function formatearMes(fecha) {
  const texto = String(fecha || '');
  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(5, 7));
  if (!anio || mes < 1 || mes > 12) return texto;
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

/** Verdadero si la fecha cae dentro de [desde, hasta], ambos incluidos. */
export function entre(fecha, desde, hasta) {
  return comparar(fecha, desde) >= 0 && comparar(fecha, hasta) <= 0;
}
