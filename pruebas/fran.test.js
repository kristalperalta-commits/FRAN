// Categorías de Agregar y nombres de los ingresos en Finanzas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adivinarCategoria, categoriasDe, delLibro, evaluarMonto, INGRESOS_DE_OTRO_LIBRO, repartirPagos } from '../js/pantallas/fran.js';

const vacio = { categoriasExtra: {}, categoriasOcultas: {} };
const gasto = (categoria, fecha) => ({ libro: 'personal', tipo: 'gasto', categoria, fecha, valor: 1 });

test('primero la que usó en más meses, aunque otra tenga más movimientos', () => {
  const asientos = [gasto('Compras', '2026-01-01'), gasto('Compras', '2026-01-02'), gasto('Compras', '2026-01-03'), gasto('Agua', '2026-01-01'), gasto('Agua', '2026-02-01')];
  const { visibles } = categoriasDe({ ...vacio, asientos }, 'personal', 'gasto', 'gasto');
  assert.deepEqual(visibles.slice(0, 2), ['Agua', 'Compras']);
});

test('un total sin detalle no cuenta como uso', () => {
  const asientos = [{ ...gasto('Abogados', '2026-01-01'), sinDetalle: true }, gasto('Agua', '2026-01-01')];
  assert.equal(categoriasDe({ ...vacio, asientos }, 'personal', 'gasto', 'gasto').visibles[0], 'Agua');
});

test('las propiedades guardadas en sus datos salen en los ingresos de Arriendos', () => {
  const fran = { ...vacio, asientos: [], propiedades: [{ nombre: 'Casa uno', duena: 'Tuya' }] };
  assert.deepEqual(categoriasDe(fran, 'arriendos', 'ingreso', 'ingreso').visibles, ['Casa uno']);
});

test('la ganancia de préstamos sale primero en los ingresos de Finanzas', () => {
  const { visibles } = categoriasDe({ ...vacio, asientos: [] }, 'personal', 'ingreso', 'ingreso');
  assert.equal(visibles[0], 'Ganancia de préstamos');
  assert.ok(INGRESOS_DE_OTRO_LIBRO[visibles[0]]);
  assert.ok(!visibles.includes('Premios'));
});

test('Finanzas muestra los intereses como ganancia, sin cambiar el libro de préstamos', () => {
  const lista = [
    { libro: 'prestamos', tipo: 'ingreso', categoria: 'Intereses cobrados', fecha: '2026-01-01', valor: 5 },
    { libro: 'arriendos', tipo: 'ingreso', categoria: 'Prado', fecha: '2026-01-01', valor: 7 },
    { libro: 'prestamos', tipo: 'abono', categoria: 'Abono a capital', fecha: '2026-01-01', valor: 9 },
  ];
  assert.deepEqual(delLibro(lista, 'personal').map((a) => a.categoria), ['Ganancia de préstamos', 'Arriendos']);
  assert.equal(delLibro(lista, 'prestamos')[0].categoria, 'Intereses cobrados');
});

test('el teclado suma y resta', () => {
  assert.equal(evaluarMonto('9500'), 9500);
  assert.equal(evaluarMonto('12000+500−200'), 12300);
  assert.equal(evaluarMonto('1000+'), 1000);
  assert.equal(evaluarMonto(''), 0);
});

test('sugiere la categoría ya usada y no se inventa una', () => {
  const lista = [
    { libro: 'personal', tipo: 'gasto', categoria: 'Alimentos', descripcion: 'pollo' },
    { libro: 'personal', tipo: 'gasto', categoria: 'Alimentos', descripcion: 'pollo asado' },
    { libro: 'personal', tipo: 'gasto', categoria: 'Compras', descripcion: 'cinta' },
  ];
  const ok = ['Alimentos', 'Compras'];
  assert.equal(adivinarCategoria(lista, 'personal', 'gasto', 'Pollo', ok), 'Alimentos');
  assert.equal(adivinarCategoria(lista, 'personal', 'gasto', 'pollo ara', ok), 'Alimentos');
  assert.equal(adivinarCategoria(lista, 'personal', 'gasto', 'zapatos', ok), null);
  assert.equal(adivinarCategoria(lista, 'personal', 'ingreso', 'pollo', ok), null);
});

test('en capital primero lo que pasa del capital es ganancia', () => {
  const prestamos = [{ id: 'p', modalidad: 'capital_primero', capital: 686000 }, { id: 'q', modalidad: 'interes_mensual', capital: 100 }];
  const pagos = [
    { id: 'a', prestamoId: 'p', fecha: '2026-10-31', monto: 80000, interes: 0, capital: 80000 },
    { id: 'b', prestamoId: 'p', fecha: '2026-11-03', monto: 1000000, interes: 0, capital: 1000000 },
    { id: 'c', prestamoId: 'p', fecha: '2026-11-04', monto: 40000, interes: 0, capital: 40000 },
    { id: 'd', prestamoId: 'q', fecha: '2026-11-04', monto: 10, interes: 7, capital: 3 },
  ];
  const r = repartirPagos(prestamos, pagos);
  assert.deepEqual(r.get('a'), { capital: 80000, interes: 0 });
  assert.deepEqual(r.get('b'), { capital: 606000, interes: 394000 });
  assert.deepEqual(r.get('c'), { capital: 0, interes: 40000 });
  assert.deepEqual(r.get('d'), { interes: 7, capital: 3 });
});
