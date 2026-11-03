// Pruebas del archivo de calendario de los recordatorios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarioIcs } from '../js/recordatorios.js';

const horas = { cobros: '07:00', gastos: '19:00' };

test('trae los avisos diarios a las horas de Ajustes', () => {
  const t = calendarioIcs([], horas, '2026-11-02');
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(t.endsWith('END:VCALENDAR\r\n'));
  assert.ok(t.includes('DTSTART:20261102T070000'));
  assert.ok(t.includes('DTSTART:20261102T190000'));
  assert.equal(t.split('RRULE:FREQ=DAILY').length - 1, 2);
});

test('un cobro con fecha trae su aviso y su seguimiento; lo hecho y lo pasado no salen', () => {
  const agenda = [
    { id: 'a', nombre: 'Rosa', fecha: '2026-11-03', monto: 500000 },
    { id: 'b', nombre: 'Marta', fecha: '2026-10-01', monto: 1000 },
    { id: 'c', nombre: 'Julian', fecha: '2026-11-05', hecho: true },
    { id: 'd', nombre: 'Ernesto', repite: 'diario', monto: 40000 },
  ];
  const t = calendarioIcs(agenda, horas, '2026-11-02', (v) => String(v));
  assert.ok(t.includes('Cobrar a Rosa 500000'));
  assert.ok(t.includes('¿Ya cobraste a Rosa? Anótalo.'));
  assert.ok(!t.includes('Marta'));
  assert.ok(!t.includes('Julian'));
  assert.ok(t.includes('Todos los días: Ernesto 40000'));
});

test('escapa comas y punto y coma, como pide el formato', () => {
  const t = calendarioIcs([{ id: 'a', nombre: 'Uno, dos; tres', fecha: '2026-11-03' }], horas, '2026-11-02');
  assert.ok(t.includes('Uno\\, dos\\; tres'));
});
