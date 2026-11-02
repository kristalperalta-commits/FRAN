import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { leerTexto } from '../js/texto.js';

describe('leerTexto', () => {
  const casos = [
    ['almuerzo 15000', 'almuerzo', 15000],
    ['60 mil gasolina', 'gasolina', 60000],
    ['cama 1.5M', 'cama', 1500000],
    ['arriendo 1.500.000', 'arriendo', 1500000],
    ['60k almuerzo', 'almuerzo', 60000],
    ['2 millones lote', 'lote', 2000000],
    ['15000', '', 15000],
  ];
  for (const [texto, descripcion, valor] of casos) {
    test(texto, () => assert.deepEqual(leerTexto(texto), { descripcion, valor }));
  }
  test('sin número no inventa valor', () => {
    assert.deepEqual(leerTexto('almuerzo'), { descripcion: 'almuerzo', valor: null });
  });
});
