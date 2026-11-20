import test from 'node:test';
import assert from 'node:assert/strict';
import { armarComprobante } from '../js/comprobante.js';
import * as motor from '../js/motor.js';

const estado = {
  clientes: [{ id: 'c1', nombre: 'Cliente Uno' }],
  prestamos: [
    { id: 'a', clienteId: 'c1', fecha: '2026-10-08', capital: 8000000, tasa: 10, modalidad: 'interes_mensual' },
    { id: 'b', clienteId: 'c1', fecha: '2026-10-29', capital: 3000000, tasa: 10, modalidad: 'interes_mensual' },
  ],
  pagos: [
    { id: 'p1', prestamoId: 'a', clienteId: 'c1', fecha: '2026-11-20', tipo: 'pago', monto: 1146667, interes: 1146667, capital: 0, medio: 'efectivo' },
    { id: 'p2', prestamoId: 'b', clienteId: 'c1', fecha: '2026-11-20', tipo: 'pago', monto: 230000, interes: 230000, capital: 0, medio: 'efectivo' },
  ],
};

test('junta los pagos de un día de varios préstamos en una sola ficha', () => {
  const c = armarComprobante(estado, motor, 'c1', '2026-11-20', '2026-11-20');
  assert.equal(c.filas.length, 2);
  assert.equal(c.total, 1376667);
  assert.equal(c.interes, 1376667);
  assert.equal(c.titulo, 'Intereses pagados');
  assert.equal(c.textoTotal, 'Total pagado en efectivo');
  assert.match(c.pie[1], /11\.000\.000/);
});

test('sin pagos ese día no hay ficha', () => {
  assert.equal(armarComprobante(estado, motor, 'c1', '2026-11-19', '2026-11-20'), null);
});
