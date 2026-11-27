// Categorías de Agregar y nombres de los ingresos en Finanzas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adivinarCategoria, categoriasDe, delLibro, evaluarMonto, INGRESOS_DE_OTRO_LIBRO, repartirPagos, gananciasDe, cobrosDeCliente, renglonesPrestamos, estadoCredito } from '../js/pantallas/fran.js';

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

test('la ganancia junta los negocios y deja por fuera lo personal y lo de terceros', () => {
  const lista = [
    { libro: 'prestamos', tipo: 'ingreso', valor: 10, fecha: '2026-11-03' },
    { libro: 'arriendos', tipo: 'ingreso', valor: 20, fecha: '2026-11-03' },
    { libro: 'personal', tipo: 'ingreso', valor: 30, fecha: '2026-11-03' },
    { libro: 'terceros', tipo: 'ingreso', valor: 40, fecha: '2026-11-03' },
    { libro: 'productos', tipo: 'ingreso', valor: 50, fecha: '2026-11-03', soloLibro: true },
    { libro: 'ganancias', tipo: 'retiro', valor: 4, fecha: '2026-11-03' },
  ];
  const g = gananciasDe(lista);
  assert.equal(g.entradas.reduce((s, a) => s + a.valor, 0), 30);
  assert.equal(g.retiros.length, 1);
  assert.equal(delLibro(lista, 'personal').some((a) => a.libro === 'ganancias'), false);
});

test('el cobro dice capital, interés y nota, y no inventa lo que no se sabe', () => {
  const cliente = { nombre: 'Rosa' };
  const [pago, perdon, viejo, conNota] = cobrosDeCliente(
    [{ id: 'a', tipo: 'abono', valor: 100, fecha: '2026-10-31', descripcion: 'Rosa' }, { id: 'b', tipo: 'ingreso', valor: 7, fecha: '2026-10-31', descripcion: 'Rosa pago' }],
    [{ id: 'g', fecha: '2026-11-03', monto: 1000, capital: 600, interes: 400, medio: 'efectivo', nota: 'Listo', prestamoId: 'p' }, { id: 'h', tipo: 'perdon', fecha: '2026-11-03', monto: 5, capital: 0, interes: 5, prestamoId: 'p' }],
    cliente,
  );
  assert.deepEqual([pago.titulo, pago.capital, pago.interes, pago.medio, pago.nota], ['Pago', 600, 400, 'Efectivo', 'Listo']);
  assert.deepEqual([perdon.titulo, perdon.perdon, perdon.interes], ['Perdón de intereses', true, 0]);
  assert.deepEqual([viejo.titulo, viejo.capital, viejo.medio, viejo.nota, viejo.prestamoId], ['Abono a capital', 100, '', '', '']);
  assert.equal(conNota.nota, 'Rosa pago');
});

test('tabla de préstamos: un renglón por préstamo, el más reciente primero, los sin fecha al final', () => {
  const estado = {
    clientes: [{ id: 'c1', nombre: 'Familia Uno' }, { id: 'c2', nombre: 'Cliente Dos' }],
    prestamos: [
      { id: 'p1', clienteId: 'c2', fecha: '2000-01-01', capital: 300, porConfirmar: { fecha: '15 del mes' } },
      { id: 'p2', clienteId: 'c2', fecha: '2026-10-03', capital: 500, nombreExcel: 'Dos' },
      { id: 'p3', clienteId: 'c1', fecha: '2024-05-11', capital: 900, detalle: [{ nombre: 'Hija', fecha: '2025-02-01', capital: 400 }, { nombre: 'Mamá', capital: 500, texto: '25 del mes' }] },
    ],
  };
  const filas = renglonesPrestamos(estado, (p) => (p.id === 'p2' ? 'al_dia' : ''));
  assert.deepEqual(filas.map((f) => [f.nombre, f.fecha, f.capital]), [['Dos', '2026-10-03', 500], ['Hija', '2025-02-01', 400], ['Cliente Dos', null, 300], ['Mamá', null, 500]].sort((a, b) => (b[1] || '').localeCompare(a[1] || '') || b[2] - a[2]));
  assert.equal(filas.find((f) => f.nombre === 'Cliente Dos').textoFecha, '15 del mes');
  assert.equal(filas.find((f) => f.nombre === 'Hija').cliente, 'Familia Uno');
  assert.equal(filas.find((f) => f.nombre === 'Dos').estado, 'al_dia');
  assert.equal(filas.reduce((s, f) => s + f.capital, 0), 1700);
});

test('crédito de banco: lo que hay en el banco, lo prestado y lo que se debe', () => {
  const c = { monto: 5000000, movimientos: [
    { tipo: 'presto', valor: 2000000 }, { tipo: 'cobro', valor: 200000 },
    { tipo: 'pago', valor: 3100000, capital: 3000000 }, { tipo: 'devolvio', valor: 500000 },
  ] };
  const e = estadoCredito(c);
  assert.equal(e.prestado, 1500000);
  assert.equal(e.enBanco, 5000000 - 2000000 + 500000 + 200000 - 3100000);
  assert.equal(e.deboBanco, 2000000);
  assert.equal(e.ganado, 200000);
});

test('3.65.0: cada cierre se cierra solo, con su diferencia en su fecha', async () => {
  const { cierresDeEfectivo } = await import('../js/pantallas/fran.js');
  const conteos = [
    { caja: 'efectivo', fecha: '2026-11-12', contado: 700000, creadoEn: '2026-11-12T19:00:00Z' },
    { caja: 'efectivo', fecha: '2026-11-15', contado: 1400000, creadoEn: '2026-11-15T23:00:00Z' },
    { caja: 'efectivo', fecha: '2026-11-26', contado: 1600000, creadoEn: '2026-11-26T20:00:00Z' },
  ];
  const filas = [
    { fecha: '2026-11-12', creadoEn: '2026-11-12T10:00:00Z', titulo: 'antes del conteo', valor: -5000 },
    { fecha: '2026-11-13', creadoEn: '2026-11-27T10:00:00Z', titulo: 'Pago', valor: 750000 },
    { fecha: '2026-11-15', creadoEn: '2026-11-27T10:00:00Z', grupo: 'Descuadre o Perdida', titulo: 'Descuadre', valor: -50000 },
    { fecha: '2026-11-20', creadoEn: '2026-11-20T10:00:00Z', titulo: 'Gasto', valor: -100000 },
    { fecha: '2026-11-26', creadoEn: '2026-11-27T10:00:00Z', manual: true, titulo: 'Sobró en el cierre', valor: 300000 },
    { fecha: '2026-11-26', creadoEn: '2026-11-27T11:00:00Z', titulo: 'Después del conteo', valor: -9000 },
  ];
  const [segundo, primero] = cierresDeEfectivo(filas, conteos);
  assert.equal(primero.debia, 1450000);
  assert.equal(primero.diferencia, -50000);
  assert.equal(segundo.debia, 1300000);
  assert.equal(segundo.diferencia, 300000);
  assert.equal(segundo.salio.length, 1);
});
