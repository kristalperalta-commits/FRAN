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
  test('sin url ni clave, la nube está apagada', () => {
    assert.equal(configurada(), false);
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
