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
    ['pechuga ara 9 mil 500', 'pechuga ara', 9500],
    ['pechuga ara 9500 pesos', 'pechuga ara', 9500],
    ['Pechuga ara, 9500.', 'Pechuga ara', 9500],
    ['2 pechugas 9500', '2 pechugas', 9500],
    ['60 mil 2 pechugas', '2 pechugas', 60000],
    ['lote 2 millones 500 mil', 'lote', 2500000],
    ['pollo 1.200.000', 'pollo', 1200000],
  ];
  for (const [texto, descripcion, valor] of casos) {
    test(texto, () => assert.deepEqual(leerTexto(texto), { descripcion, valor }));
  }
  test('sin número no inventa valor', () => {
    assert.deepEqual(leerTexto('almuerzo'), { descripcion: 'almuerzo', valor: null });
  });
});
