/*
  recordatorios.js: arma un archivo de calendario (.ics) con los avisos del plan.
  Una app web no puede avisar sola con el teléfono cerrado si no hay un servidor que envíe el aviso.
  El calendario del teléfono sí avisa: a la hora de los cobros y a la hora de anotar gastos.
*/

const compacta = (fecha) => fecha.replace(/-/g, '');
const hora = (h) => `${h.replace(':', '')}00`;
const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function evento({ uid, fecha, h, titulo, nota = '', regla = '' }, sello) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@fran`,
    `DTSTAMP:${sello}`,
    `DTSTART:${compacta(fecha)}T${hora(h)}`,
    `DURATION:PT15M`,
    regla ? `RRULE:${regla}` : '',
    `SUMMARY:${esc(titulo)}`,
    nota ? `DESCRIPTION:${esc(nota)}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(titulo)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
}

const REGLAS = { diario: 'FREQ=DAILY', semanal: 'FREQ=WEEKLY', quincenal: 'FREQ=DAILY;INTERVAL=15', mensual: 'FREQ=MONTHLY' };

/** Texto del archivo .ics. Las horas son las de Ajustes; los cobros salen de la agenda. */
export function calendarioIcs(agenda, recordatorios, hoy, formatear = String) {
  const sello = `${compacta(hoy)}T000000`;
  const pendientes = (agenda || []).filter((x) => !x.hecho);
  const diarios = pendientes.filter((x) => x.repite === 'diario').map((x) => (x.monto ? `${x.nombre} ${formatear(x.monto)}` : x.nombre));
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fran//Recordatorios//ES', 'CALSCALE:GREGORIAN',
    ...evento({ uid: 'cobros', fecha: hoy, h: recordatorios.cobros, titulo: 'Fran · Cobros de hoy', nota: diarios.length ? `Todos los días: ${diarios.join(' · ')}. Abre Fran para ver el resto.` : 'Abre Fran para ver a quién le toca.', regla: REGLAS.diario }, sello),
    ...evento({ uid: 'gastos', fecha: hoy, h: recordatorios.gastos, titulo: 'Fran · ¿Ya anotaste hoy?', nota: '¿Gastos o ingresos? Anótalos ya.', regla: REGLAS.diario }, sello),
  ];
  for (const x of pendientes) {
    if (x.repite === 'diario' || !x.fecha) continue;
    if (!x.repite && x.fecha < hoy) continue;
    const valor = x.monto ? ` ${formatear(x.monto)}` : '';
    const regla = x.repite ? REGLAS[x.repite] || '' : '';
    lineas.push(...evento({ uid: `cobro-${x.id}`, fecha: x.fecha, h: recordatorios.cobros, titulo: `Fran · Cobrar a ${x.nombre}${valor}`, nota: x.nota, regla }, sello));
    lineas.push(...evento({ uid: `sigue-${x.id}`, fecha: x.fecha, h: recordatorios.gastos, titulo: `Fran · ¿Ya cobraste a ${x.nombre}? Anótalo.`, regla }, sello));
  }
  lineas.push('END:VCALENDAR');
  return `${lineas.join('\r\n')}\r\n`;
}
