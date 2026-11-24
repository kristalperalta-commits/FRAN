import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarEn, puntaje } from '../js/buscar.js';

const nombres = ['Ana Pérez', 'Andrés', 'Araminta', 'Zofia Gómez', 'Yuleidy', 'Valentina', 'Bernardo'];
const b = (q) => buscarEn(nombres, q, (n) => n);

test('por la inicial salen todos los que empiezan así', () => {
  assert.deepEqual(b('a'), ['Ana Pérez', 'Andrés', 'Araminta']);
});
test('con la segunda letra se afina', () => {
  assert.deepEqual(b('ana'), ['Ana Pérez']);
});
test('por el apellido también', () => {
  assert.deepEqual(b('pere'), ['Ana Pérez']);
});
test('perdona s/z, y/i, b/v', () => {
  assert.ok(b('sofia').includes('Zofia Gómez'));
  assert.ok(b('yuleidi').includes('Yuleidy'));
  assert.ok(b('balentina').includes('Valentina'));
});
test('una letra equivocada igual sugiere', () => {
  assert.ok(b('andrez').includes('Andrés'));
});
test('lo que no se parece no sale', () => {
  assert.equal(puntaje('Bernardo', 'xyz'), 0);
});
