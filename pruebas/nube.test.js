// Pruebas de la decisión de sincronización de nube.js.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir, configurada, fusionar } from '../js/nube.js';

describe('nube.decidir', () => {
  test('nube más nueva y sin cambios locales: bajar', () => {
    assert.equal(decidir({ revisionVista: 3, remota: 5, pendiente: false }), 'bajar');
  });
  test('cambios locales y nube quieta: subir', () => {
    assert.equal(decidir({ revisionVista: 3, remota: 3, pendiente: true }), 'subir');
  });
  test('cambiaron los dos: choque', () => {
    assert.equal(decidir({ revisionVista: 3, remota: 4, pendiente: true }), 'choque');
  });
  test('todo igual: nada', () => {
    assert.equal(decidir({ revisionVista: 3, remota: 3, pendiente: false }), 'nada');
  });
  test('nube vacía y aparato sin cambios: nada (el arranque decide si sube)', () => {
    assert.equal(decidir({ revisionVista: 0, remota: 0, pendiente: false }), 'nada');
  });
});

describe('nube.configurada', () => {
  test('con la conexión llena, la nube está encendida', () => {
    assert.equal(configurada(), true);
  });
});

describe('nube.fusionar', () => {
  const local = { clientes: [{ id: 'c1', nombre: 'Ana' }], prestamos: [], pagos: [], movimientos: [{ id: 'm1' }], fran: { asientos: [{ id: 'a1', valor: 1 }, { id: 'a2', valor: 2 }], pension: { tasa: 3700 } } };
  const remoto = { clientes: [{ id: 'c1', nombre: 'Ana vieja' }, { id: 'c2', nombre: 'Beto' }], prestamos: [{ id: 'p9' }], pagos: [], movimientos: [], fran: { asientos: [{ id: 'a1', valor: 99 }, { id: 'a3', valor: 3 }] } };
  const junto = fusionar(local, remoto);
  test('agrega lo que solo tenía el otro aparato', () => {
    assert.deepEqual(junto.clientes.map((c) => c.id), ['c1', 'c2']);
    assert.deepEqual(junto.prestamos.map((p) => p.id), ['p9']);
    assert.deepEqual(junto.fran.asientos.map((a) => a.id), ['a1', 'a2', 'a3']);
  });
  test('si los dos editaron lo mismo, queda lo local', () => {
    assert.equal(junto.clientes[0].nombre, 'Ana');
    assert.equal(junto.fran.asientos[0].valor, 1);
  });
  test('no toca el estado original ni lo demás de fran', () => {
    assert.equal(local.clientes.length, 1);
    assert.equal(junto.fran.pension.tasa, 3700);
  });
});

describe('nube.fusionar con lo borrado', () => {
  const prestamo = { id: 'p1', clienteId: 'c1' };
  const local = {
    clientes: [{ id: 'c1', nombre: 'Ana' }], prestamos: [], pagos: [], movimientos: [],
    fran: { asientos: [{ id: 'a1' }], notas: [{ id: 'n2', texto: 'nueva' }], agenda: [], categoriasExtra: { 'cuentas:propias': ['Daviplata'] } },
    borrados: { 'prestamos:p1': '2026-11-14T10:00:00.000Z', 'fran.notas:n1': '2026-11-14T10:00:00.000Z' },
  };
  const remoto = {
    clientes: [{ id: 'c1', nombre: 'Ana' }], prestamos: [prestamo], pagos: [{ id: 'g1', prestamoId: 'p1' }],
    movimientos: [{ id: 'm1', prestamoId: 'p1' }, { id: 'm2', pagoId: 'g1' }, { id: 'm3' }],
    fran: { asientos: [{ id: 'a1' }, { id: 'a2' }], notas: [{ id: 'n1', texto: 'vieja' }], agenda: [{ id: 'ag1', nombre: 'Cobro' }], conteos: [{ id: 'k1' }], categoriasExtra: { 'cuentas:propias': ['Nu'] } },
    borrados: { 'fran.asientos:a1': '2026-11-14T11:00:00.000Z' },
  };
  const junto = fusionar(local, remoto);
  test('el préstamo borrado aquí no vuelve, ni sus pagos ni su caja', () => {
    assert.deepEqual(junto.prestamos, []);
    assert.deepEqual(junto.pagos, []);
    assert.deepEqual(junto.movimientos.map((m) => m.id), ['m3']);
  });
  test('lo que borró el otro aparato también se quita de aquí', () => {
    assert.deepEqual(junto.fran.asientos.map((a) => a.id), ['a2']);
  });
  test('notas, agenda y conteos de los dos aparatos se juntan', () => {
    assert.deepEqual(junto.fran.notas.map((n) => n.id), ['n2']);
    assert.deepEqual(junto.fran.agenda.map((n) => n.id), ['ag1']);
    assert.deepEqual(junto.fran.conteos.map((n) => n.id), ['k1']);
    assert.deepEqual(junto.fran.categoriasExtra['cuentas:propias'], ['Daviplata', 'Nu']);
  });
  test('la lista de borrados de los dos queda junta', () => {
    assert.deepEqual(Object.keys(junto.borrados).sort(), ['fran.asientos:a1', 'fran.notas:n1', 'prestamos:p1']);
  });
  test('un cliente borrado allá con préstamo nuevo aquí se queda', () => {
    const j = fusionar({ clientes: [{ id: 'c9', nombre: 'Luz' }], prestamos: [{ id: 'p9', clienteId: 'c9' }], pagos: [], movimientos: [], fran: { asientos: [] } },
      { clientes: [], prestamos: [], pagos: [], movimientos: [], fran: { asientos: [] }, borrados: { 'clientes:c9': '2026-11-14T09:00:00.000Z' } });
    assert.deepEqual(j.clientes.map((c) => c.id), ['c9']);
    assert.deepEqual(j.prestamos.map((c) => c.id), ['p9']);
  });
});
