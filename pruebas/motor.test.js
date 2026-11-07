// Pruebas del motor de préstamos. Se escriben solo a partir de la especificación
// (ESPECIFICACION-MODULO-1.md), secciones 4 y 5, sin mirar motor.js.
// Se corren con `npm test` desde app/ (node --test pruebas/).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import * as modMotor from '../js/motor.js';
import * as modFechas from '../js/fechas.js';
import * as modDinero from '../js/dinero.js';
import { casos } from '../js/casos.js';

// Los módulos pueden exportar funciones sueltas o un objeto con el mismo nombre.
const motor = modMotor.motor ?? modMotor.default ?? modMotor;
const fechas = modFechas.fechas ?? modFechas.default ?? modFechas;
const dinero = modDinero.dinero ?? modDinero.default ?? modDinero;

// ---------- Ayudas ----------

// Busca el caso de casos.js que contiene un cliente con ese id.
function casoDe(clienteId) {
  const caso = casos.find((c) => c.clientes.some((cl) => cl.id === clienteId));
  assert.ok(caso, `No existe en casos.js un caso con el cliente ${clienteId}`);
  return caso;
}

function prestamoDe(caso, prestamoId) {
  const p = caso.prestamos.find((x) => x.id === prestamoId);
  assert.ok(p, `No existe el préstamo ${prestamoId}`);
  return p;
}

function pagosDe(caso, prestamoId) {
  return caso.pagos.filter((x) => x.prestamoId === prestamoId);
}

// Calcula un préstamo de un caso con la fecha "hoy" del caso (o la indicada).
function calcular(caso, prestamoId, hoy = caso.hoy) {
  return motor.calcularPrestamo(prestamoDe(caso, prestamoId), pagosDe(caso, prestamoId), hoy);
}

// Periodos ya causados: fecha de cobro menor o igual a hoy.
function causados(resultado, hoy) {
  return resultado.periodos.filter((p) => p.hasta <= hoy);
}

function periodoMes(resultado, mes) {
  const p = resultado.periodos.find((x) => x.mes === mes);
  assert.ok(p, `No existe el periodo con mes ${mes}`);
  return p;
}

// Préstamo sintético completo con valores por defecto; se sobreescribe lo necesario.
let contadorSintetico = 0;
function prestamoSintetico(cambios = {}) {
  contadorSintetico += 1;
  const base = {
    id: `pre-sintetico-${contadorSintetico}`,
    clienteId: 'cli-sintetico',
    fecha: '2026-01-10',
    capital: 1000000,
    tasa: 20,
    modalidad: 'interes_mensual',
    totalPactado: null,
    plazoMeses: null,
    topeInteres: null,
    medio: 'efectivo',
    fuentes: [{ origen: 'caja_efectivo', monto: 1000000, nota: '' }],
    garantia: '',
    estadoManual: null,
    fechaEstado: null,
    nota: '',
    creadoEn: '2026-01-10',
  };
  const p = { ...base, ...cambios };
  if (!cambios.fuentes) {
    p.fuentes = [{ origen: p.medio === 'virtual' ? 'caja_virtual' : 'caja_efectivo', monto: p.capital, nota: '' }];
  }
  return p;
}

let contadorPago = 0;
function pagoSintetico(prestamo, cambios = {}) {
  contadorPago += 1;
  const interes = cambios.interes ?? 0;
  const capital = cambios.capital ?? 0;
  return {
    id: `pag-sintetico-${contadorPago}`,
    prestamoId: prestamo.id,
    clienteId: prestamo.clienteId,
    fecha: cambios.fecha ?? prestamo.fecha,
    tipo: cambios.tipo ?? 'pago',
    monto: interes + capital,
    interes,
    capital,
    medio: cambios.medio ?? 'efectivo',
    descripcion: cambios.descripcion ?? '',
    nota: cambios.nota ?? '',
    creadoEn: cambios.fecha ?? prestamo.fecha,
  };
}

const clienteSintetico = {
  id: 'cli-sintetico',
  nombre: 'Cliente sintético',
  alias: '',
  telefono: '',
  direccion: '',
  nota: '',
  grupo: '',
  tipo: 'cliente',
  creadoEn: '2026-01-10',
};

// Estado completo a partir de una lista de casos.
function estadoDe(listaCasos, movimientos = []) {
  return {
    version: 1,
    clientes: listaCasos.flatMap((c) => c.clientes),
    prestamos: listaCasos.flatMap((c) => c.prestamos),
    pagos: listaCasos.flatMap((c) => c.pagos),
    movimientos,
    config: { nombreNegocio: 'Mis Préstamos' },
  };
}

// ======================================================================
// Validez de casos.js (modelo de la sección 3)
// ======================================================================

describe('casos.js: datos completos y válidos según el modelo', () => {
  test('cada caso tiene nombre, descripcion, hoy, clientes, prestamos y pagos', () => {
    for (const caso of casos) {
      assert.equal(typeof caso.nombre, 'string');
      assert.equal(typeof caso.descripcion, 'string');
      assert.match(caso.hoy, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Array.isArray(caso.clientes));
      assert.ok(Array.isArray(caso.prestamos));
      assert.ok(Array.isArray(caso.pagos));
    }
  });

  test('están Ramiro, Ernesto, Marta y un cliente familia', () => {
    assert.ok(casoDe('cli-ramiro'));
    assert.ok(casoDe('cli-ernesto'));
    assert.ok(casoDe('cli-marta'));
    const mama = casoDe('cli-mama');
    assert.equal(mama.clientes[0].tipo, 'familia');
  });

  test('las fuentes de cada préstamo suman el capital', () => {
    for (const caso of casos) {
      for (const p of caso.prestamos) {
        const suma = p.fuentes.reduce((acum, f) => acum + f.monto, 0);
        assert.equal(suma, p.capital, `Fuentes de ${p.id} no suman el capital`);
      }
    }
  });

  test('cada pago cumple monto = interes + capital y apunta a un préstamo del caso', () => {
    for (const caso of casos) {
      for (const pg of caso.pagos) {
        assert.equal(pg.monto, pg.interes + pg.capital, `Pago ${pg.id} mal repartido`);
        assert.ok(caso.prestamos.some((p) => p.id === pg.prestamoId), `Pago ${pg.id} sin préstamo`);
        assert.ok(caso.clientes.some((c) => c.id === pg.clienteId), `Pago ${pg.id} sin cliente`);
        assert.ok(['pago', 'perdon'].includes(pg.tipo));
        assert.ok(['efectivo', 'virtual', 'especie'].includes(pg.medio));
      }
    }
  });

  test('los identificadores no se repiten entre casos', () => {
    const ids = casos.flatMap((c) => [...c.clientes, ...c.prestamos, ...c.pagos]).map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('todo dinero es entero y toda fecha es AAAA-MM-DD', () => {
    for (const caso of casos) {
      for (const p of caso.prestamos) {
        assert.ok(Number.isInteger(p.capital));
        assert.match(p.fecha, /^\d{4}-\d{2}-\d{2}$/);
      }
      for (const pg of caso.pagos) {
        assert.ok(Number.isInteger(pg.monto));
        assert.match(pg.fecha, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

// ======================================================================
// 5.1 Ramiro Ejemplo, hoy = 2026-10-31
// ======================================================================

describe('5.1 Ramiro Ejemplo, hoy 2026-10-31', () => {
  const caso = casoDe('cli-ramiro');
  const hoy = '2026-10-31';
  const A = calcular(caso, 'pre-ramiro-a', hoy);
  const B = calcular(caso, 'pre-ramiro-b', hoy);

  test('regla 1 y 6: préstamo A tiene 6 periodos causados, de mayo a octubre', () => {
    const lista = causados(A, hoy);
    assert.equal(lista.length, 6);
    assert.deepEqual(
      lista.map((p) => p.mes),
      ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
    );
  });

  test('regla 1: el primer periodo de A va del 2026-04-11 al 2026-05-11 y se cobra en mayo', () => {
    const p1 = A.periodos[0];
    assert.equal(p1.numero, 1);
    assert.equal(p1.desde, '2026-04-11');
    assert.equal(p1.hasta, '2026-05-11');
    assert.equal(p1.mes, '2026-05');
  });

  test('regla 4: cada periodo de A causa 200.000 sobre capital base 1.000.000', () => {
    for (const p of causados(A, hoy)) {
      assert.equal(p.capitalBase, 1000000);
      assert.equal(p.causado, 200000);
    }
  });

  test('regla 5: interés simple, el pendiente acumulado no genera interés', () => {
    assert.equal(A.interesCausado, 1200000);
  });

  test('regla 7: los pagos de mayo y junio quedan en sus propios periodos', () => {
    assert.equal(periodoMes(A, '2026-05').pagado, 200000);
    assert.equal(periodoMes(A, '2026-05').pendiente, 0);
    assert.equal(periodoMes(A, '2026-06').pagado, 200000);
    assert.equal(periodoMes(A, '2026-06').pendiente, 0);
    assert.equal(periodoMes(A, '2026-07').pagado, 0);
    assert.equal(periodoMes(A, '2026-07').pendiente, 200000);
  });

  test('A: interesPagado 400.000', () => {
    assert.equal(A.interesPagado, 400000);
  });

  test('A: interesPendiente 800.000', () => {
    assert.equal(A.interesPendiente, 800000);
  });

  test('A: capitalPendiente 1.000.000 y capitalPagado 0', () => {
    assert.equal(A.capitalPendiente, 1000000);
    assert.equal(A.capitalPagado, 0);
  });

  test('A: deudaCliente 1.800.000', () => {
    assert.equal(A.deudaCliente, 1800000);
  });

  test('A: totalRecibido 400.000, ganancia 400.000 y netoRecuperar 600.000', () => {
    assert.equal(A.totalRecibido, 400000);
    assert.equal(A.ganancia, 400000);
    assert.equal(A.netoRecuperar, 600000);
  });

  test('regla 12: A tiene 4 meses atrasados (julio a octubre)', () => {
    assert.equal(A.mesesAtrasados, 4);
    assert.equal(periodoMes(A, '2026-07').atrasado, true);
    assert.equal(periodoMes(A, '2026-10').atrasado, true);
    assert.equal(periodoMes(A, '2026-06').atrasado, false);
  });

  test('A: estado atrasado', () => {
    assert.equal(A.estado, 'atrasado');
  });

  test('A: proximoCobro es el periodo pendiente más antiguo, julio por 200.000', () => {
    assert.deepEqual(A.proximoCobro, { fecha: '2026-07-11', monto: 200000 });
  });

  test('A: sin plazo no hay vencimiento ni advertencias', () => {
    assert.equal(A.vencimiento, null);
    assert.deepEqual(A.advertencias, []);
  });

  test('A: campos de identificación del resultado', () => {
    assert.equal(A.prestamoId, 'pre-ramiro-a');
    assert.equal(A.clienteId, 'cli-ramiro');
    assert.equal(A.modalidad, 'interes_mensual');
    assert.equal(A.capital, 1000000);
    assert.equal(A.tasa, 20);
    assert.equal(A.fecha, '2026-04-11');
  });

  test('B: 4 periodos causados, de julio a octubre', () => {
    const lista = causados(B, hoy);
    assert.equal(lista.length, 4);
    assert.deepEqual(lista.map((p) => p.mes), ['2026-07', '2026-08', '2026-09', '2026-10']);
  });

  test('B: interesPendiente 800.000 y deudaCliente 1.800.000', () => {
    assert.equal(B.interesPendiente, 800000);
    assert.equal(B.deudaCliente, 1800000);
  });

  test('B: sin pagos, interesPagado 0, totalRecibido 0, 4 meses atrasados', () => {
    assert.equal(B.interesPagado, 0);
    assert.equal(B.totalRecibido, 0);
    assert.equal(B.mesesAtrasados, 4);
    assert.equal(B.estado, 'atrasado');
  });

  test('Cliente: deudaCliente 3.600.000 e interesPendiente 1.600.000', () => {
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.deudaCliente, 3600000);
    assert.equal(r.interesPendiente, 1600000);
  });

  test('Cliente: capitalPendiente 2.000.000, totalRecibido 400.000, ganancia 400.000', () => {
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.capitalPendiente, 2000000);
    assert.equal(r.totalRecibido, 400000);
    assert.equal(r.ganancia, 400000);
  });

  test('Cliente: mesesAtrasados es el máximo (4), estado el peor (atrasado), 2 préstamos activos', () => {
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.mesesAtrasados, 4);
    assert.equal(r.estado, 'atrasado');
    assert.equal(r.prestamosActivos, 2);
  });

  test('Cliente: proximoCobro es el más cercano, el de B del 2026-07-03', () => {
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.proximoCobro.fecha, '2026-07-03');
    assert.equal(r.proximoCobro.monto, 200000);
  });
});

// ======================================================================
// 5.2 Ernesto Muestra, hoy = 2026-10-31
// ======================================================================

describe('5.2 Ernesto Muestra, hoy 2026-10-31', () => {
  const caso = casoDe('cli-ernesto');
  const hoy = '2026-10-31';
  const A = calcular(caso, 'pre-ernesto-a', hoy);
  const B = calcular(caso, 'pre-ernesto-b', hoy);

  // Pendiente de un mes sumando los dos préstamos por la etiqueta `mes`.
  function pendienteMes(mes) {
    return [A, B]
      .flatMap((r) => r.periodos)
      .filter((p) => p.mes === mes)
      .reduce((acum, p) => acum + p.pendiente, 0);
  }

  const esperado = {
    '2026-01': 100000,
    '2026-02': 0,
    '2026-03': 0,
    '2026-04': 220000,
    '2026-05': 70000,
    '2026-06': 70000,
    '2026-07': 70000,
    '2026-08': 0,
    '2026-09': 70000,
    '2026-10': 220000,
  };

  for (const [mes, valor] of Object.entries(esperado)) {
    test(`pendiente del mes ${mes} sumando los dos préstamos = ${valor}`, () => {
      assert.equal(pendienteMes(mes), valor);
    });
  }

  test('total pendiente de 2026 = 820.000', () => {
    const total = Object.keys(esperado).reduce((acum, mes) => acum + pendienteMes(mes), 0);
    assert.equal(total, 820000);
  });

  test('regla 3: A cobra los 10 y B los 15, con etiqueta del mes de cobro', () => {
    assert.equal(periodoMes(A, '2026-02').hasta, '2026-02-10');
    assert.equal(periodoMes(B, '2026-02').hasta, '2026-02-15');
    assert.equal(periodoMes(A, '2025-12').hasta, '2025-12-10');
  });

  test('regla 4: A causa 100.000 por periodo y B 120.000', () => {
    assert.equal(periodoMes(A, '2026-04').causado, 100000);
    assert.equal(periodoMes(B, '2026-04').causado, 120000);
  });

  test('enero: solo A tiene periodo y no lo pagó', () => {
    assert.equal(periodoMes(A, '2026-01').pendiente, 100000);
    assert.equal(B.periodos.some((p) => p.mes === '2026-01'), false);
  });

  test('regla 8: el perdón de febrero se cuenta como perdonado en B, no como pagado', () => {
    const feb = periodoMes(B, '2026-02');
    assert.equal(feb.causado, 120000);
    assert.equal(feb.pagado, 100000);
    assert.equal(feb.perdonado, 20000);
    assert.equal(feb.pendiente, 0);
  });

  test('interesPerdonado total 20.000 (todo en B)', () => {
    assert.equal(A.interesPerdonado, 0);
    assert.equal(B.interesPerdonado, 20000);
  });

  test('regla 7 confirmada: en mayo B pagó 50.000 y debe 70.000 de mayo aunque abril siga sin pagar', () => {
    assert.equal(periodoMes(B, '2026-05').pagado, 50000);
    assert.equal(periodoMes(B, '2026-05').pendiente, 70000);
    assert.equal(periodoMes(B, '2026-04').pagado, 0);
    assert.equal(periodoMes(B, '2026-04').pendiente, 120000);
  });

  test('diciembre de 2025 de A queda aparte, pendiente 100.000', () => {
    assert.equal(periodoMes(A, '2025-12').pendiente, 100000);
  });

  test('interesPagado total 1.240.000 (A 700.000, B 540.000)', () => {
    assert.equal(A.interesPagado, 700000);
    assert.equal(B.interesPagado, 540000);
  });

  test('capital pendiente 1.100.000 (A 500.000, B 600.000)', () => {
    assert.equal(A.capitalPendiente, 500000);
    assert.equal(B.capitalPendiente, 600000);
  });

  test('deuda del cliente contando diciembre de 2025: 2.020.000', () => {
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.deudaCliente, 2020000);
    assert.equal(r.interesPendiente, 920000);
    assert.equal(r.capitalPendiente, 1100000);
  });

  test('regla 12: A tiene 4 meses atrasados y B 6; el cliente lleva el máximo, 6', () => {
    assert.equal(A.mesesAtrasados, 4);
    assert.equal(B.mesesAtrasados, 6);
    const r = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, hoy);
    assert.equal(r.mesesAtrasados, 6);
    assert.equal(r.estado, 'atrasado');
  });

  test('el perdón no cuenta en totalRecibido: B recibió 540.000', () => {
    assert.equal(B.totalRecibido, 540000);
  });
});

// ======================================================================
// 5.3 Marta, capital primero
// ======================================================================

describe('5.3 Marta, capital primero, hoy 2026-11-20', () => {
  const caso = casoDe('cli-marta');
  const hoy = '2026-11-20';
  const prestamo = prestamoDe(caso, 'pre-marta');
  const todos = pagosDe(caso, 'pre-marta');
  assert.equal(todos.length, 16, 'El caso de Marta debe tener 16 pagos');
  const tres = motor.calcularPrestamo(prestamo, todos.slice(0, 3), hoy);
  const dieciseis = motor.calcularPrestamo(prestamo, todos, hoy);

  test('con 3 pagos de 40.000: capitalPendiente 486.000', () => {
    assert.equal(tres.capitalPendiente, 486000);
    assert.equal(tres.capitalPagado, 120000);
  });

  test('con 3 pagos: deudaCliente 1.545.000 (totalPactado − totalRecibido)', () => {
    assert.equal(tres.totalRecibido, 120000);
    assert.equal(tres.deudaCliente, 1545000);
  });

  test('con 3 pagos: ganancia 0', () => {
    assert.equal(tres.ganancia, 0);
  });

  test('con 16 pagos (640.000): capitalPendiente 0', () => {
    assert.equal(dieciseis.totalRecibido, 640000);
    assert.equal(dieciseis.capitalPendiente, 0);
    assert.equal(dieciseis.capitalPagado, 606000);
  });

  test('con 16 pagos: ganancia 34.000 (totalRecibido − capital)', () => {
    assert.equal(dieciseis.ganancia, 34000);
  });

  test('con 16 pagos: deudaCliente 1.025.000', () => {
    assert.equal(dieciseis.deudaCliente, 1025000);
  });

  test('con 16 pagos: netoRecuperar −34.000, ya recuperó su plata', () => {
    assert.equal(dieciseis.netoRecuperar, -34000);
  });

  test('capital primero no tiene periodos ni atraso', () => {
    assert.equal(dieciseis.periodos.length, 0);
    assert.equal(dieciseis.mesesAtrasados, 0);
    assert.equal(dieciseis.modalidad, 'capital_primero');
  });

  test('con 16 pagos todavía debe, así que no queda pagado', () => {
    assert.notEqual(dieciseis.estado, 'pagado');
  });

  test('el reparto lo hace el motor: el capital anotado en el pago se ignora', () => {
    const pagosConReparto = todos.slice(0, 3).map((p) => ({ ...p, interes: 40000, capital: 0 }));
    const r = motor.calcularPrestamo(prestamo, pagosConReparto, hoy);
    assert.equal(r.capitalPendiente, 486000);
    assert.equal(r.deudaCliente, 1545000);
  });
});

// ======================================================================
// 5.4 Casos sintéticos
// ======================================================================

describe('5.4 Abono a capital (regla 9 y regla 4)', () => {
  const p = prestamoSintetico({ fecha: '2026-01-10', capital: 1000000, tasa: 20 });
  const pagos = [pagoSintetico(p, { fecha: '2026-03-10', interes: 200000, capital: 400000 })];
  const r = motor.calcularPrestamo(p, pagos, '2026-04-30');

  test('el periodo de marzo (cobro 2026-03-10) causó 200.000 sobre 1.000.000', () => {
    const marzo = periodoMes(r, '2026-03');
    assert.equal(marzo.hasta, '2026-03-10');
    assert.equal(marzo.capitalBase, 1000000);
    assert.equal(marzo.causado, 200000);
  });

  test('el periodo de abril (cobro 2026-04-10) causa 120.000 sobre 600.000', () => {
    const abril = periodoMes(r, '2026-04');
    assert.equal(abril.hasta, '2026-04-10');
    assert.equal(abril.capitalBase, 600000);
    assert.equal(abril.causado, 120000);
  });

  test('el abono reduce el capital pendiente a 600.000', () => {
    assert.equal(r.capitalPagado, 400000);
    assert.equal(r.capitalPendiente, 600000);
    assert.equal(r.totalRecibido, 600000);
  });

  test('si el abono excede el capital, se aplica hasta cero y se reporta en advertencias', () => {
    const p2 = prestamoSintetico({ fecha: '2026-01-10', capital: 1000000 });
    const pagos2 = [pagoSintetico(p2, { fecha: '2026-02-10', interes: 200000, capital: 1200000 })];
    const r2 = motor.calcularPrestamo(p2, pagos2, '2026-02-28');
    assert.equal(r2.capitalPendiente, 0);
    assert.equal(r2.capitalPagado, 1000000);
    assert.ok(r2.advertencias.length >= 1);
    assert.equal(typeof r2.advertencias[0], 'string');
  });
});

describe('5.4 Tope de intereses (regla 10)', () => {
  test('500.000 al 20% con tope 500.000, doce meses después: interesCausado 500.000', () => {
    const caso = casoDe('cli-tope');
    const r = calcular(caso, 'pre-tope', '2026-11-02');
    assert.equal(r.interesCausado, 500000);
    assert.equal(r.interesPendiente, 500000);
    assert.equal(r.deudaCliente, 1000000);
  });

  test('el último periodo se recorta: tope 250.000 da periodos de 100.000, 100.000 y 50.000', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', capital: 500000, tasa: 20, topeInteres: 250000 });
    const r = motor.calcularPrestamo(p, [], '2026-12-31');
    assert.equal(r.interesCausado, 250000);
    assert.equal(periodoMes(r, '2026-02').causado, 100000);
    assert.equal(periodoMes(r, '2026-03').causado, 100000);
    assert.equal(periodoMes(r, '2026-04').causado, 50000);
    const posteriores = r.periodos.filter((x) => x.mes > '2026-04');
    assert.equal(posteriores.reduce((acum, x) => acum + x.causado, 0), 0);
  });
});

describe('5.4 Tope de día (regla 2)', () => {
  test('préstamo del 2026-01-31: cobros 2026-02-28, 2026-03-31 y 2026-04-30', () => {
    const p = prestamoSintetico({ fecha: '2026-01-31' });
    const r = motor.calcularPrestamo(p, [], '2026-05-01');
    const lista = causados(r, '2026-05-01');
    assert.deepEqual(lista.map((x) => x.hasta), ['2026-02-28', '2026-03-31', '2026-04-30']);
    assert.deepEqual(lista.map((x) => x.mes), ['2026-02', '2026-03', '2026-04']);
  });

  test('cada periodo empieza donde terminó el anterior, partiendo de la fecha original', () => {
    const p = prestamoSintetico({ fecha: '2026-01-31' });
    const r = motor.calcularPrestamo(p, [], '2026-05-01');
    assert.equal(r.periodos[0].desde, '2026-01-31');
    assert.equal(r.periodos[1].desde, '2026-02-28');
    assert.equal(r.periodos[2].desde, '2026-03-31');
  });

  test('fechas.sumarMeses respeta el tope de día y el año bisiesto', () => {
    assert.equal(fechas.sumarMeses('2026-01-31', 1), '2026-02-28');
    assert.equal(fechas.sumarMeses('2026-01-31', 2), '2026-03-31');
    assert.equal(fechas.sumarMeses('2026-01-31', 3), '2026-04-30');
    assert.equal(fechas.sumarMeses('2028-01-31', 1), '2028-02-29');
    assert.equal(fechas.sumarMeses('2026-11-10', 2), '2027-01-10');
    assert.equal(fechas.sumarMeses('2026-04-11', 1), '2026-05-11');
  });
});

describe('5.4 Pago adelantado (reglas 6 y 7)', () => {
  test('pago del 2026-10-05 se aplica al periodo 2026-10 (cobro 2026-10-11), no al más antiguo', () => {
    const p = prestamoSintetico({ fecha: '2026-01-11' });
    const pagos = [pagoSintetico(p, { fecha: '2026-10-05', interes: 200000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-10-31');
    const octubre = periodoMes(r, '2026-10');
    assert.equal(octubre.hasta, '2026-10-11');
    assert.equal(octubre.pagado, 200000);
    assert.equal(octubre.pendiente, 0);
    assert.equal(periodoMes(r, '2026-02').pagado, 0);
    assert.equal(periodoMes(r, '2026-02').pendiente, 200000);
  });

  test('se generan periodos hasta la fecha del último pago aunque hoy sea antes del cobro', () => {
    const p = prestamoSintetico({ fecha: '2026-01-11' });
    const pagos = [pagoSintetico(p, { fecha: '2026-10-05', interes: 200000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-10-05');
    const octubre = periodoMes(r, '2026-10');
    assert.equal(octubre.pagado, 200000);
    // Octubre todavía no se causa (cobro 2026-10-11 > hoy), así que no cuenta en el pendiente.
    assert.equal(r.interesPendiente, 8 * 200000);
    assert.equal(r.interesPagado, 200000);
  });
});

describe('5.4 Sobrante de interés (regla 7)', () => {
  test('pago de 300.000 en un mes de 200.000: 200.000 al mes del pago y 100.000 al más antiguo', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [pagoSintetico(p, { fecha: '2026-03-10', interes: 300000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-03-31');
    assert.equal(periodoMes(r, '2026-03').pagado, 200000);
    assert.equal(periodoMes(r, '2026-03').pendiente, 0);
    assert.equal(periodoMes(r, '2026-02').pagado, 100000);
    assert.equal(periodoMes(r, '2026-02').pendiente, 100000);
    assert.equal(r.interesPendiente, 100000);
    assert.equal(r.capitalPendiente, 1000000);
  });

  test('el sobrante sigue al periodo siguiente, incluso futuro, y nunca al capital', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', interes: 500000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-02-28');
    assert.equal(periodoMes(r, '2026-02').pagado, 200000);
    assert.equal(periodoMes(r, '2026-03').pagado, 200000);
    assert.equal(periodoMes(r, '2026-04').pagado, 100000);
    assert.equal(r.capitalPendiente, 1000000);
    assert.equal(r.interesPagado, 500000);
  });
});

describe('5.4 Pago en especie y perdón', () => {
  test('pago en especie cuenta en totalRecibido y en interesPagado', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [
      pagoSintetico(p, { fecha: '2026-02-10', interes: 200000, medio: 'especie', descripcion: 'Lechonas' }),
    ];
    const r = motor.calcularPrestamo(p, pagos, '2026-02-28');
    assert.equal(r.totalRecibido, 200000);
    assert.equal(r.interesPagado, 200000);
    assert.equal(periodoMes(r, '2026-02').pendiente, 0);
  });

  test('perdón no cuenta en totalRecibido pero sí baja el pendiente', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', tipo: 'perdon', interes: 50000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-02-28');
    assert.equal(r.totalRecibido, 0);
    assert.equal(r.interesPagado, 0);
    assert.equal(r.interesPerdonado, 50000);
    assert.equal(periodoMes(r, '2026-02').perdonado, 50000);
    assert.equal(periodoMes(r, '2026-02').pendiente, 150000);
    assert.equal(r.interesPendiente, 150000);
  });

  test('ganancia en interés mensual es el interés pagado, sin el perdonado', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [
      pagoSintetico(p, { fecha: '2026-02-10', interes: 150000 }),
      pagoSintetico(p, { fecha: '2026-02-10', tipo: 'perdon', interes: 50000 }),
    ];
    const r = motor.calcularPrestamo(p, pagos, '2026-02-28');
    assert.equal(r.ganancia, 150000);
    assert.equal(r.interesPendiente, 0);
  });
});

describe('5.4 Sin interés, familia (4.3)', () => {
  const caso = casoDe('cli-mama');
  const r = calcular(caso, 'pre-mama', '2026-10-31');

  test('familia 150.000, pagó 52.000 y 30.000 en especie: deuda 68.000', () => {
    assert.equal(r.totalRecibido, 82000);
    assert.equal(r.deudaCliente, 68000);
    assert.equal(r.capitalPendiente, 68000);
  });

  test('sin intereses, sin atraso, ganancia 0, estado familia', () => {
    assert.equal(r.interesCausado, 0);
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.mesesAtrasados, 0);
    assert.equal(r.ganancia, 0);
    assert.equal(r.estado, 'familia');
  });

  test('resumenCliente de familia también queda en estado familia', () => {
    const rc = motor.resumenCliente(caso.clientes[0], caso.prestamos, caso.pagos, '2026-10-31');
    assert.equal(rc.estado, 'familia');
    assert.equal(rc.deudaCliente, 68000);
  });
});

describe('5.4 Estado manual (regla 15)', () => {
  test('perdido con fechaEstado: no causa periodos después de esa fecha', () => {
    const caso = casoDe('cli-perdido');
    const r = calcular(caso, 'pre-perdido', '2026-10-31');
    assert.equal(r.estado, 'perdido');
    const conInteres = r.periodos.filter((x) => x.causado > 0);
    assert.deepEqual(conInteres.map((x) => x.mes), ['2026-02', '2026-03', '2026-04']);
    assert.equal(r.interesCausado, 600000);
    assert.equal(r.capitalPendiente, 1000000);
  });

  test('congelado con fechaEstado: tampoco causa después de esa fecha', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'congelado', fechaEstado: '2026-03-20' });
    const r = motor.calcularPrestamo(p, [], '2026-10-31');
    assert.equal(r.estado, 'congelado');
    assert.equal(r.interesCausado, 400000);
  });

  test('congelado sin pendientes: no proyecta un próximo cobro que nunca se va a causar', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'congelado', fechaEstado: '2026-03-20' });
    const pagos = [
      pagoSintetico(p, { fecha: '2026-02-10', interes: 200000 }),
      pagoSintetico(p, { fecha: '2026-03-10', interes: 200000 }),
    ];
    const r = motor.calcularPrestamo(p, pagos, '2026-10-31');
    assert.equal(r.estado, 'congelado');
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.proximoCobro, null);
  });

  test('congelado con un periodo pendiente: el próximo cobro es ese pendiente', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'congelado', fechaEstado: '2026-03-20' });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', interes: 200000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-10-31');
    assert.deepEqual(r.proximoCobro, { fecha: '2026-03-10', monto: 200000 });
  });

  test('legal sigue causando y sí proyecta el siguiente cobro', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'legal', fechaEstado: '2026-03-20' });
    const pagos = ['2026-02-10', '2026-03-10', '2026-04-10'].map((fecha) => pagoSintetico(p, { fecha, interes: 200000 }));
    const r = motor.calcularPrestamo(p, pagos, '2026-04-10');
    assert.deepEqual(r.proximoCobro, { fecha: '2026-05-10', monto: 200000 });
  });

  test('legal manda sobre el calculado aunque esté atrasado', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'legal', fechaEstado: '2026-06-01' });
    const r = motor.calcularPrestamo(p, [], '2026-10-31');
    assert.equal(r.estado, 'legal');
  });

  test('pagado manual manda aunque haya deuda', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', estadoManual: 'pagado', fechaEstado: '2026-06-01' });
    const r = motor.calcularPrestamo(p, [], '2026-10-31');
    assert.equal(r.estado, 'pagado');
  });
});

describe('5.4 Pagado automático (regla 14)', () => {
  test('capital e interés en cero con pagos: estado pagado', () => {
    const caso = casoDe('cli-pagado');
    const r = calcular(caso, 'pre-pagado', '2026-10-31');
    assert.equal(r.capitalPendiente, 0);
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.estado, 'pagado');
    assert.equal(r.totalRecibido, 1400000);
    assert.equal(r.ganancia, 400000);
    assert.equal(r.netoRecuperar, -400000);
  });

  test('un préstamo pagado deja de causar intereses', () => {
    const caso = casoDe('cli-pagado');
    const r = calcular(caso, 'pre-pagado', '2026-10-31');
    assert.equal(r.interesCausado, 400000);
  });

  test('Pedro Ejemplo: capital 0 pero quedan intereses, sigue activo', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', interes: 0, capital: 1000000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-03-31');
    assert.equal(r.capitalPendiente, 0);
    assert.equal(r.interesPendiente, 200000);
    assert.notEqual(r.estado, 'pagado');
    assert.equal(r.estado, 'atrasado');
  });

});

describe('Reglas 11, 12 y 13: pendiente, atraso y vencimiento', () => {
  test('un periodo cuyo cobro es hoy no está atrasado; el préstamo sigue al día', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const r = motor.calcularPrestamo(p, [], '2026-02-10');
    assert.equal(causados(r, '2026-02-10').length, 1);
    assert.equal(periodoMes(r, '2026-02').pendiente, 200000);
    assert.equal(periodoMes(r, '2026-02').atrasado, false);
    assert.equal(r.mesesAtrasados, 0);
    assert.equal(r.estado, 'al_dia');
    assert.deepEqual(r.proximoCobro, { fecha: '2026-02-10', monto: 200000 });
  });

  test('un día después del cobro sin pagar ya está atrasado', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const r = motor.calcularPrestamo(p, [], '2026-02-11');
    assert.equal(periodoMes(r, '2026-02').atrasado, true);
    assert.equal(r.mesesAtrasados, 1);
    assert.equal(r.estado, 'atrasado');
  });

  test('antes del primer cobro: nada causado, al día, proximoCobro es el siguiente por causar', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const r = motor.calcularPrestamo(p, [], '2026-01-20');
    assert.equal(r.interesCausado, 0);
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.deudaCliente, 1000000);
    assert.equal(r.estado, 'al_dia');
    assert.deepEqual(r.proximoCobro, { fecha: '2026-02-10', monto: 200000 });
  });

  test('el pendiente de un periodo nunca es negativo', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', interes: 250000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-02-28');
    for (const x of r.periodos) assert.ok(x.pendiente >= 0);
    assert.equal(periodoMes(r, '2026-02').pendiente, 0);
  });

  test('plazoMeses da vencimiento = fecha + plazo', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', plazoMeses: 3 });
    const r = motor.calcularPrestamo(p, [], '2026-02-01');
    assert.equal(r.vencimiento, '2026-04-10');
    assert.equal(r.estado, 'al_dia');
  });

  test('vencido si hoy > vencimiento y hay capital pendiente; vencido manda sobre atrasado', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', plazoMeses: 3 });
    const r = motor.calcularPrestamo(p, [], '2026-04-11');
    assert.equal(r.estado, 'vencido');
    assert.ok(r.mesesAtrasados >= 1);
  });

  test('en la fecha exacta de vencimiento todavía no está vencido', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', plazoMeses: 3 });
    const pagos = [
      pagoSintetico(p, { fecha: '2026-02-10', interes: 200000 }),
      pagoSintetico(p, { fecha: '2026-03-10', interes: 200000 }),
    ];
    const r = motor.calcularPrestamo(p, pagos, '2026-04-10');
    assert.notEqual(r.estado, 'vencido');
  });

  test('vencido pero con capital en cero no es vencido', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', plazoMeses: 1 });
    const pagos = [pagoSintetico(p, { fecha: '2026-02-10', interes: 0, capital: 1000000 })];
    const r = motor.calcularPrestamo(p, pagos, '2026-03-31');
    assert.notEqual(r.estado, 'vencido');
  });
});

describe('Pagos desordenados y tasa distinta', () => {
  test('los pagos se procesan por fecha aunque lleguen en otro orden', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10' });
    const pagos = [
      pagoSintetico(p, { fecha: '2026-03-10', interes: 200000 }),
      pagoSintetico(p, { fecha: '2026-02-10', interes: 200000 }),
    ];
    const r = motor.calcularPrestamo(p, pagos, '2026-03-31');
    assert.equal(periodoMes(r, '2026-02').pagado, 200000);
    assert.equal(periodoMes(r, '2026-03').pagado, 200000);
    assert.equal(r.interesPendiente, 0);
  });

  test('el interés se redondea a entero: 333.333 al 10% causa 33.333', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', capital: 333333, tasa: 10 });
    const r = motor.calcularPrestamo(p, [], '2026-02-10');
    const feb = periodoMes(r, '2026-02');
    assert.ok(Number.isInteger(feb.causado));
    assert.equal(feb.causado, 33333);
  });

  test('tasa 15% sobre 2.000.000 causa 300.000', () => {
    const p = prestamoSintetico({ fecha: '2026-01-10', capital: 2000000, tasa: 15 });
    const r = motor.calcularPrestamo(p, [], '2026-02-10');
    assert.equal(periodoMes(r, '2026-02').causado, 300000);
  });
});

// ======================================================================
// 4.5 Otras funciones del motor
// ======================================================================

describe('4.5 resumenNegocio', () => {
  const ramiro = casoDe('cli-ramiro');
  const mama = casoDe('cli-mama');
  const movimientos = [
    { id: 'mov-1', fecha: '2026-01-01', caja: 'efectivo', tipo: 'saldo_inicial', monto: 1000000, signo: 1, origen: 'propio', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-01-01' },
    { id: 'mov-2', fecha: '2026-02-01', caja: 'efectivo', tipo: 'prestamo', monto: 400000, signo: -1, origen: '', prestamoId: 'pre-x', pagoId: null, nota: '', creadoEn: '2026-02-01' },
    { id: 'mov-3', fecha: '2026-01-05', caja: 'virtual', tipo: 'aporte', monto: 300000, signo: 1, origen: 'arriendo', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-01-05' },
    { id: 'mov-4', fecha: '2026-10-15', caja: 'efectivo', tipo: 'ganancia_a_personal', monto: 150000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-10-15' },
    { id: 'mov-5', fecha: '2026-09-15', caja: 'efectivo', tipo: 'ganancia_a_personal', monto: 80000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-09-15' },
  ];
  const estado = estadoDe([ramiro, mama], movimientos);
  const hoy = '2026-10-31';
  const r = motor.resumenNegocio(estado, hoy);

  test('capitalEnCalle solo cuenta clientes, no familia: 2.000.000', () => {
    assert.equal(r.capitalEnCalle, 2000000);
  });

  test('capitalEnRiesgo son los préstamos atrasados o vencidos: 2.000.000', () => {
    assert.equal(r.capitalEnRiesgo, 2000000);
  });

  test('interesesPendientes 1.600.000', () => {
    assert.equal(r.interesesPendientes, 1600000);
  });

  test('interesesCobradosAnio 400.000 e interesesCobradosMes 0 en octubre', () => {
    assert.equal(r.interesesCobradosAnio, 400000);
    assert.equal(r.interesesCobradosMes, 0);
  });

  test('interesesCobradosMes con hoy en junio: 200.000', () => {
    const rJunio = motor.resumenNegocio(estado, '2026-06-30');
    assert.equal(rJunio.interesesCobradosMes, 200000);
  });

  test('capitalPerdido, capitalLegal y capitalCongelado en cero si no hay estados manuales', () => {
    assert.equal(r.capitalPerdido, 0);
    assert.equal(r.capitalLegal, 0);
    assert.equal(r.capitalCongelado, 0);
  });

  test('capitalPerdido suma los préstamos con estadoManual perdido', () => {
    const perdido = casoDe('cli-perdido');
    const r2 = motor.resumenNegocio(estadoDe([ramiro, perdido]), hoy);
    assert.equal(r2.capitalPerdido, 1000000);
  });

  test('cajas: efectivo 370.000 y virtual 300.000', () => {
    assert.equal(r.cajas.efectivo, 370000);
    assert.equal(r.cajas.virtual, 300000);
  });

  test('gananciaRetiradaMes solo cuenta ganancia_a_personal del mes de hoy: 150.000', () => {
    assert.equal(r.gananciaRetiradaMes, 150000);
  });

  test('clientesAtrasados: 1 (Ramiro); la familia no cuenta', () => {
    assert.equal(r.clientesAtrasados, 1);
  });

  test('prestamosFamilia viene en el resumen (la especificación no fija su forma)', () => {
    assert.ok(r.prestamosFamilia !== undefined && r.prestamosFamilia !== null);
  });

  test('el interés de un pago que no tuvo periodo donde aplicarse no cuenta como cobrado', () => {
    // Capital en cero desde el 2026-02-10; el interés del 2026-03-10 queda en advertencias.
    const prestamo = prestamoSintetico({});
    const pagos = [
      pagoSintetico(prestamo, { fecha: '2026-02-10', interes: 200000, capital: 1000000 }),
      pagoSintetico(prestamo, { fecha: '2026-03-10', interes: 200000 }),
    ];
    const hoyMarzo = '2026-03-31';
    const rp = motor.calcularPrestamo(prestamo, pagos, hoyMarzo);
    assert.equal(rp.interesPagado, 200000);
    assert.equal(rp.ganancia, 200000);
    assert.ok(rp.advertencias.some((t) => t.includes('sobran')));
    const estadoSobrante = { ...estadoDe([]), clientes: [clienteSintetico], prestamos: [prestamo], pagos };
    const rn = motor.resumenNegocio(estadoSobrante, hoyMarzo);
    assert.equal(rn.interesesCobradosTotal, 200000);
    assert.equal(rn.interesesCobradosAnio, 200000);
    assert.equal(rn.interesesCobradosMes, 0);
    assert.equal(rn.gananciaDisponible, 200000);
    const porPago = motor.gananciaPorPago(prestamo, pagos, hoyMarzo);
    assert.deepEqual(porPago.map((x) => x.ganancia), [200000, 0]);
  });

  test('la suma de intereses cobrados del negocio es igual a la suma de interesPagado de los préstamos', () => {
    const ernesto = casoDe('cli-ernesto');
    const estadoTodos = estadoDe([ramiro, ernesto, mama]);
    const rn = motor.resumenNegocio(estadoTodos, hoy);
    const resultados = motor.calcularTodos(estadoTodos, hoy);
    const suma = Object.values(resultados)
      .filter((x) => x.modalidad === 'interes_mensual')
      .reduce((acum, x) => acum + x.interesPagado, 0);
    assert.equal(rn.interesesCobradosTotal, suma);
  });

  test('con el estado vacío todo queda en cero', () => {
    const vacio = estadoDe([]);
    const r0 = motor.resumenNegocio(vacio, hoy);
    assert.equal(r0.capitalEnCalle, 0);
    assert.equal(r0.capitalEnRiesgo, 0);
    assert.equal(r0.interesesPendientes, 0);
    assert.equal(r0.cajas.efectivo, 0);
    assert.equal(r0.cajas.virtual, 0);
    assert.equal(r0.clientesAtrasados, 0);
  });
});

describe('4.5 agendaCobros', () => {
  const ramiro = casoDe('cli-ramiro');
  const mama = casoDe('cli-mama');
  const estado = estadoDe([ramiro, mama]);
  const hoy = '2026-10-31';

  test('devuelve los atrasados primero y luego lo que vence en los próximos 7 días', () => {
    const agenda = motor.agendaCobros(estado, hoy, 7);
    assert.ok(Array.isArray(agenda));
    assert.ok(agenda.length >= 3);
    const primerNoAtrasado = agenda.findIndex((x) => x.motivo !== 'atrasado');
    const ultimoAtrasado = agenda.map((x) => x.motivo).lastIndexOf('atrasado');
    assert.ok(ultimoAtrasado >= 0, 'Debe haber atrasados');
    if (primerNoAtrasado >= 0) assert.ok(ultimoAtrasado < primerNoAtrasado);
  });

  test('cada atrasado de Ramiro trae su nombre, clienteId y meses de atraso', () => {
    const agenda = motor.agendaCobros(estado, hoy, 7);
    const deA = agenda.filter((x) => x.prestamoId === 'pre-ramiro-a' && x.motivo === 'atrasado');
    assert.ok(deA.length >= 1);
    assert.equal(deA[0].clienteId, 'cli-ramiro');
    assert.equal(deA[0].nombre, 'Ramiro Ejemplo');
    assert.equal(deA[0].mesesAtrasados, 4);
    assert.match(deA[0].fecha, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('el cobro de B del 2026-11-03 entra en los próximos 7 días como interés de 200.000', () => {
    const agenda = motor.agendaCobros(estado, hoy, 7);
    const proximo = agenda.find((x) => x.prestamoId === 'pre-ramiro-b' && x.fecha === '2026-11-03');
    assert.ok(proximo, 'Falta el cobro del 2026-11-03');
    assert.equal(proximo.motivo, 'interes');
    assert.equal(proximo.monto, 200000);
  });

  test('el cobro de A del 2026-11-11 no entra con 7 días pero sí con 30', () => {
    const con7 = motor.agendaCobros(estado, hoy, 7);
    assert.equal(con7.some((x) => x.fecha === '2026-11-11'), false);
    const con30 = motor.agendaCobros(estado, hoy, 30);
    const cobro = con30.find((x) => x.prestamoId === 'pre-ramiro-a' && x.fecha === '2026-11-11');
    assert.ok(cobro, 'Falta el cobro del 2026-11-11');
    assert.equal(cobro.monto, 200000);
  });

  test('los no atrasados vienen ordenados por fecha', () => {
    const agenda = motor.agendaCobros(estado, hoy, 30).filter((x) => x.motivo !== 'atrasado');
    for (let i = 1; i < agenda.length; i += 1) {
      assert.ok(agenda[i - 1].fecha <= agenda[i].fecha);
    }
  });

  test('la familia no aparece en la agenda', () => {
    const agenda = motor.agendaCobros(estado, hoy, 30);
    assert.equal(agenda.some((x) => x.clienteId === 'cli-mama'), false);
  });

  test('dias por defecto es 7', () => {
    const porDefecto = motor.agendaCobros(estado, hoy);
    const con7 = motor.agendaCobros(estado, hoy, 7);
    assert.deepEqual(porDefecto, con7);
  });

  test('un préstamo vencido con intereses atrasados muestra también la línea del capital vencido', () => {
    // 1.000.000 al 20% del 2026-01-10, plazo 3 meses (vence 2026-04-10), sin pagos, hoy 2026-06-30.
    const prestamo = prestamoSintetico({ plazoMeses: 3 });
    const estadoVencido = { ...estadoDe([]), clientes: [clienteSintetico], prestamos: [prestamo] };
    const agenda = motor.agendaCobros(estadoVencido, '2026-06-30', 30);
    const atrasados = agenda.filter((x) => x.motivo === 'atrasado');
    assert.equal(atrasados.length, 2);
    const interes = atrasados.find((x) => x.mesesAtrasados > 0);
    const capital = atrasados.find((x) => x.mesesAtrasados === 0);
    assert.ok(interes, 'Falta la línea de intereses atrasados');
    assert.ok(capital, 'Falta la línea de capital vencido');
    assert.equal(interes.fecha, '2026-02-10');
    assert.equal(interes.monto, 1000000);
    assert.equal(interes.mesesAtrasados, 5);
    assert.equal(capital.fecha, '2026-04-10');
    assert.equal(capital.monto, 1000000);
    const totalAtrasado = atrasados.reduce((acum, x) => acum + x.monto, 0);
    assert.equal(totalAtrasado, 2000000);
  });

  test('un préstamo vencido sin intereses atrasados sigue mostrando solo el capital vencido', () => {
    const prestamo = prestamoSintetico({ plazoMeses: 2 });
    const pagos = [
      pagoSintetico(prestamo, { fecha: '2026-02-10', interes: 200000 }),
      pagoSintetico(prestamo, { fecha: '2026-03-10', interes: 200000 }),
    ];
    const estadoVencido = { ...estadoDe([]), clientes: [clienteSintetico], prestamos: [prestamo], pagos };
    const agenda = motor.agendaCobros(estadoVencido, '2026-03-20', 7);
    const atrasados = agenda.filter((x) => x.motivo === 'atrasado');
    assert.equal(atrasados.length, 1);
    assert.equal(atrasados[0].fecha, '2026-03-10');
    assert.equal(atrasados[0].monto, 1000000);
    assert.equal(atrasados[0].mesesAtrasados, 0);
  });
});

describe('4.5 saldoCaja', () => {
  const movimientos = [
    { id: 'mov-1', fecha: '2026-01-01', caja: 'efectivo', tipo: 'saldo_inicial', monto: 1000000, signo: 1, origen: 'propio', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-01-01' },
    { id: 'mov-2', fecha: '2026-02-01', caja: 'efectivo', tipo: 'prestamo', monto: 400000, signo: -1, origen: '', prestamoId: 'pre-x', pagoId: null, nota: '', creadoEn: '2026-02-01' },
    { id: 'mov-3', fecha: '2026-03-01', caja: 'efectivo', tipo: 'pago', monto: 100000, signo: 1, origen: '', prestamoId: 'pre-x', pagoId: 'pag-x', nota: '', creadoEn: '2026-03-01' },
    { id: 'mov-4', fecha: '2026-01-05', caja: 'virtual', tipo: 'aporte', monto: 300000, signo: 1, origen: 'arriendo', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-01-05' },
    { id: 'mov-5', fecha: '2026-04-01', caja: 'efectivo', tipo: 'traslado', monto: 200000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: 'A virtual', creadoEn: '2026-04-01' },
    { id: 'mov-6', fecha: '2026-04-01', caja: 'virtual', tipo: 'traslado', monto: 200000, signo: 1, origen: '', prestamoId: null, pagoId: null, nota: 'De efectivo', creadoEn: '2026-04-01' },
    { id: 'mov-7', fecha: '2026-05-01', caja: 'efectivo', tipo: 'ganancia_a_personal', monto: 50000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-05-01' },
  ];

  test('saldo de efectivo = suma de monto * signo: 450.000', () => {
    assert.equal(motor.saldoCaja(movimientos, 'efectivo'), 450000);
  });

  test('saldo de virtual: 500.000', () => {
    assert.equal(motor.saldoCaja(movimientos, 'virtual'), 500000);
  });

  test('con hastaFecha solo cuenta movimientos hasta esa fecha', () => {
    assert.equal(motor.saldoCaja(movimientos, 'efectivo', '2026-02-15'), 600000);
    assert.equal(motor.saldoCaja(movimientos, 'virtual', '2026-03-15'), 300000);
  });

  test('sin movimientos el saldo es 0', () => {
    assert.equal(motor.saldoCaja([], 'efectivo'), 0);
  });
});

describe('Caja virtual mes a mes (cajaPorMes)', () => {
  // Como ella lo lleva: saldo inicial negativo (plata de la pareja que debía), luego
  // entran pagos por transferencia y salen préstamos y gastos desde lo virtual.
  const movimientos = [
    { id: 'v-0', fecha: '2026-11-01', caja: 'virtual', tipo: 'saldo_inicial', monto: 1006000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: 'Deuda con la pareja', creadoEn: '2026-11-01' },
    { id: 'v-1', fecha: '2026-11-05', caja: 'virtual', tipo: 'pago', monto: 1855000, signo: 1, origen: '', prestamoId: 'pre-a', pagoId: 'pag-a', nota: '', creadoEn: '2026-11-05' },
    { id: 'v-2', fecha: '2026-11-20', caja: 'virtual', tipo: 'prestamo', monto: 500000, signo: -1, origen: '', prestamoId: 'pre-b', pagoId: null, nota: '', creadoEn: '2026-11-20' },
    { id: 'v-3', fecha: '2027-01-10', caja: 'virtual', tipo: 'retiro', monto: 400000, signo: -1, origen: '', prestamoId: null, pagoId: null, nota: 'Tarjeta', creadoEn: '2027-01-10' },
    { id: 'e-1', fecha: '2026-11-03', caja: 'efectivo', tipo: 'aporte', monto: 999999, signo: 1, origen: 'propio', prestamoId: null, pagoId: null, nota: '', creadoEn: '2026-11-03' },
  ];

  test('una fila por mes desde el primer movimiento hasta hastaMes, con los meses vacíos', () => {
    const filas = motor.cajaPorMes(movimientos, 'virtual', '2027-01');
    assert.deepEqual(filas.map((f) => f.mes), ['2026-11', '2026-12', '2027-01']);
  });

  test('entró, salió, saldo del mes, anterior y acumulado', () => {
    const [nov, dic, ene] = motor.cajaPorMes(movimientos, 'virtual', '2027-01');
    assert.deepEqual(nov, { mes: '2026-11', entro: 1855000, salio: 1506000, saldoMes: 349000, anterior: 0, acumulado: 349000 });
    assert.deepEqual(dic, { mes: '2026-12', entro: 0, salio: 0, saldoMes: 0, anterior: 349000, acumulado: 349000 });
    assert.deepEqual(ene, { mes: '2027-01', entro: 0, salio: 400000, saldoMes: -400000, anterior: 349000, acumulado: -51000 });
  });

  test('el acumulado del último mes coincide con saldoCaja', () => {
    const filas = motor.cajaPorMes(movimientos, 'virtual', '2027-01');
    assert.equal(filas[filas.length - 1].acumulado, motor.saldoCaja(movimientos, 'virtual'));
  });

  test('no mezcla cajas y sin movimientos devuelve lista vacía', () => {
    const filas = motor.cajaPorMes(movimientos, 'efectivo', '2026-11');
    assert.deepEqual(filas, [{ mes: '2026-11', entro: 999999, salio: 0, saldoMes: 999999, anterior: 0, acumulado: 999999 }]);
    assert.deepEqual(motor.cajaPorMes([], 'virtual', '2026-11'), []);
  });

  test('si hastaMes es anterior al primer movimiento, solo sale el primer mes', () => {
    const filas = motor.cajaPorMes(movimientos, 'virtual', '2025-01');
    assert.equal(filas.length, 1);
    assert.equal(filas[0].mes, '2026-11');
  });
});

describe('4.5 repartirPagoCliente', () => {
  const caso = casoDe('cli-ramiro');
  const hoy = '2026-10-31';
  const A = calcular(caso, 'pre-ramiro-a', hoy);
  const B = calcular(caso, 'pre-ramiro-b', hoy);

  // Normaliza la sugerencia a un mapa prestamoId → { interes, capital }.
  function porPrestamo(sugerencia) {
    const lista = Array.isArray(sugerencia) ? sugerencia : sugerencia.reparto ?? sugerencia.prestamos ?? [];
    const mapa = {};
    for (const item of lista) {
      mapa[item.prestamoId] = { interes: item.interes ?? 0, capital: item.capital ?? 0 };
    }
    return mapa;
  }

  test('500.000 va todo a interés atrasado, del periodo más antiguo en adelante: B 300.000, A 200.000', () => {
    const sugerencia = motor.repartirPagoCliente([A, B], 500000);
    const mapa = porPrestamo(sugerencia);
    const totalInteres = Object.values(mapa).reduce((acum, x) => acum + x.interes, 0);
    const totalCapital = Object.values(mapa).reduce((acum, x) => acum + x.capital, 0);
    assert.equal(totalInteres, 500000);
    assert.equal(totalCapital, 0);
    // Periodos atrasados por fecha: B julio (03), A julio (11), B agosto (03)...
    assert.equal(mapa['pre-ramiro-b'].interes, 300000);
    assert.equal(mapa['pre-ramiro-a'].interes, 200000);
  });

  test('2.400.000 cubre los 1.600.000 atrasados, los 400.000 del periodo en curso y el resto va al capital del préstamo más antiguo', () => {
    // Al 2026-10-31 el periodo en curso de A es el de noviembre (cobro 11-11) y el de B el de noviembre (cobro 11-03).
    const sugerencia = motor.repartirPagoCliente([A, B], 2400000);
    const mapa = porPrestamo(sugerencia);
    assert.equal(mapa['pre-ramiro-a'].interes + mapa['pre-ramiro-b'].interes, 2000000);
    assert.equal(mapa['pre-ramiro-a'].capital, 400000);
    assert.equal(mapa['pre-ramiro-b'].capital, 0);
  });

  test('pago adelantado del mes sin fecha: el interés del periodo en curso va a interés, no a capital (Ernesto paga el 5 el cobro del 15)', () => {
    const prestamo = prestamoSintetico({ fecha: '2026-01-15', capital: 600000 });
    const pagos = ['2026-02-15', '2026-03-15', '2026-04-15'].map((fecha) => pagoSintetico(prestamo, { fecha, interes: 120000 }));
    const rB = motor.calcularPrestamo(prestamo, pagos, '2026-05-05');
    const sinFecha = porPrestamo(motor.repartirPagoCliente([rB], 120000));
    assert.equal(sinFecha[prestamo.id].interes, 120000);
    assert.equal(sinFecha[prestamo.id].capital, 0);
    const conFecha = porPrestamo(motor.repartirPagoCliente([rB], 120000, '2026-05-05'));
    assert.deepEqual(conFecha, sinFecha);
  });

  test('solo entra un periodo en curso por préstamo: lo demás proyectado va a capital', () => {
    // Hoy 2026-10-31: periodo en curso de A es noviembre (200.000); el resto a capital.
    const soloA = motor.repartirPagoCliente([A], 1000000 + 200000 + 300000);
    const mapa = porPrestamo(soloA);
    assert.equal(mapa['pre-ramiro-a'].interes, 800000 + 200000);
    assert.equal(mapa['pre-ramiro-a'].capital, 500000);
  });

  test('la suma del reparto nunca pasa del monto', () => {
    const sugerencia = motor.repartirPagoCliente([A, B], 123456);
    const mapa = porPrestamo(sugerencia);
    const total = Object.values(mapa).reduce((acum, x) => acum + x.interes + x.capital, 0);
    assert.equal(total, 123456);
  });
});

// ======================================================================
// fechas.js y dinero.js
// ======================================================================

describe('fechas.sumarMeses', () => {
  test('suma meses normales sin cambiar el día', () => {
    assert.equal(fechas.sumarMeses('2026-04-11', 1), '2026-05-11');
    assert.equal(fechas.sumarMeses('2026-06-03', 4), '2026-10-03');
  });

  test('cruza el año', () => {
    assert.equal(fechas.sumarMeses('2025-11-10', 1), '2025-12-10');
    assert.equal(fechas.sumarMeses('2025-11-10', 2), '2026-01-10');
    assert.equal(fechas.sumarMeses('2025-11-10', 12), '2026-11-10');
  });

  test('tope de día: 31 de enero + 1 mes = 28 de febrero, + 2 meses = 31 de marzo', () => {
    assert.equal(fechas.sumarMeses('2026-01-31', 1), '2026-02-28');
    assert.equal(fechas.sumarMeses('2026-01-31', 2), '2026-03-31');
  });

  test('bisiesto: 31 de enero de 2028 + 1 mes = 29 de febrero', () => {
    assert.equal(fechas.sumarMeses('2028-01-31', 1), '2028-02-29');
    assert.equal(fechas.sumarMeses('2024-01-30', 1), '2024-02-29');
  });

  test('sumar 0 meses devuelve la misma fecha', () => {
    assert.equal(fechas.sumarMeses('2026-10-31', 0), '2026-10-31');
  });
});

describe('dinero.leer y dinero.formatear', () => {
  test('leer acepta 1.234.567', () => {
    assert.equal(dinero.leer('1.234.567'), 1234567);
  });

  test('leer acepta 1234567', () => {
    assert.equal(dinero.leer('1234567'), 1234567);
  });

  test('leer acepta 200k', () => {
    assert.equal(dinero.leer('200k'), 200000);
    assert.equal(dinero.leer('200K'), 200000);
  });

  test('leer acepta 1.5M', () => {
    assert.equal(dinero.leer('1.5M'), 1500000);
    assert.equal(dinero.leer('1.5m'), 1500000);
  });

  test('leer acepta $ 300.000', () => {
    assert.equal(dinero.leer('$ 300.000'), 300000);
    assert.equal(dinero.leer('$300.000'), 300000);
  });

  test('leer devuelve entero', () => {
    assert.ok(Number.isInteger(dinero.leer('1.5M')));
    assert.ok(Number.isInteger(dinero.leer('1.234.567')));
  });

  test('formatear usa puntos de miles: 1.234.567', () => {
    assert.equal(dinero.formatear(1234567), '1.234.567');
    assert.equal(dinero.formatear(200000), '200.000');
    assert.equal(dinero.formatear(0), '0');
    assert.equal(dinero.formatear(999), '999');
  });

  test('formatear y leer son inversas', () => {
    assert.equal(dinero.leer(dinero.formatear(3600000)), 3600000);
  });

  // Defecto corregido: montos copiados de Excel con dos decimales se leían por cien.
  test('leer descarta los decimales ,00 de Excel: 1.000.000,00 → 1.000.000', () => {
    assert.equal(dinero.leer('1.000.000,00'), 1000000);
    assert.equal(dinero.leer('300.000,00'), 300000);
    assert.equal(dinero.leer('1,000.50'), 1001);
    assert.equal(dinero.leer('-1.000,50'), -1000);
  });

  test('leer redondea un decimal suelto sin sufijo: 1.5 → 2, 300,50 → 301', () => {
    assert.equal(dinero.leer('1.5'), 2);
    assert.equal(dinero.leer('300,50'), 301);
    assert.equal(dinero.leer('0,50'), 1);
  });

  test('leer sigue tomando grupos de 3 como miles: 300.000, 1,000, 1.234.567', () => {
    assert.equal(dinero.leer('300.000'), 300000);
    assert.equal(dinero.leer('1,000'), 1000);
    assert.equal(dinero.leer('1.234.567'), 1234567);
  });

  test('leer rechaza mezclas ambiguas con null', () => {
    assert.equal(dinero.leer('1.5.5'), null);
    assert.equal(dinero.leer('1,2.3'), null);
    assert.equal(dinero.leer('12.3456'), null);
    assert.equal(dinero.leer('1.000,000'), null);
    assert.equal(dinero.leer('1..000'), null);
    assert.equal(dinero.leer('.5'), null);
  });
});

test('quien ya devolvió el capital y debe intereses queda como solo intereses', () => {
  const cliente = { id: 'c', nombre: 'Rosa', tipo: 'cliente' };
  const prestamo = { id: 'p', clienteId: 'c', fecha: '2025-01-01', capital: 686000, tasa: 0, modalidad: 'capital_primero', totalPactado: 1745000 };
  const pago = (id, monto) => ({ id, prestamoId: 'p', clienteId: 'c', fecha: '2026-11-03', tipo: 'pago', monto, interes: 0, capital: monto, medio: 'efectivo' });
  const antes = modMotor.resumenCliente(cliente, [prestamo], [pago('a', 80000)], '2026-11-03');
  assert.equal(antes.soloIntereses, false);
  const r = modMotor.resumenCliente(cliente, [prestamo], [pago('a', 80000), pago('b', 1000000)], '2026-11-03');
  assert.equal(r.capitalPendiente, 0);
  assert.equal(r.deudaCliente, 665000);
  assert.equal(r.soloIntereses, true);
  const pagado = modMotor.resumenCliente(cliente, [prestamo], [pago('a', 1745000)], '2026-11-03');
  assert.equal(pagado.soloIntereses, false);
  const congelado = modMotor.resumenCliente(cliente, [{ ...prestamo, estadoManual: 'congelado' }], [pago('a', 1000000)], '2026-11-03');
  assert.equal(congelado.soloIntereses, false);
});

describe('interés de los días corridos (pedido por ella el 6 nov 2026)', () => {
  const prestamo = { id: 'p-dias', clienteId: 'c', fecha: '2026-11-03', capital: 3000000, tasa: 10, modalidad: 'interes_mensual' };

  test('del 3 al 6 de noviembre son 4 días a 10.000 cada uno', () => {
    const r = modMotor.calcularPrestamo(prestamo, [], '2026-11-06');
    assert.equal(r.interesDiario, 10000);
    assert.equal(r.diasCorridos, 4);
    assert.equal(r.interesCorrido, 40000);
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.debeHoy, 3040000);
  });

  test('el mismo día del préstamo cuenta 1 día', () => {
    assert.equal(modMotor.calcularPrestamo(prestamo, [], '2026-11-03').interesCorrido, 10000);
  });

  test('nunca pasa del interés del mes', () => {
    const r = modMotor.calcularPrestamo(prestamo, [], '2026-12-02');
    assert.equal(r.interesCorrido, 300000);
  });

  test('cumplido el mes, el mes entra a pendiente y empieza a correr el siguiente', () => {
    const r = modMotor.calcularPrestamo(prestamo, [], '2026-12-04');
    assert.equal(r.interesPendiente, 300000);
    assert.equal(r.diasCorridos, 2);
    assert.equal(r.interesCorrido, 20000);
    assert.equal(r.debeHoy, 3000000 + 300000 + 20000);
  });

  test('lo pagado por adelantado de ese mes se descuenta', () => {
    const pago = { id: 'g1', prestamoId: 'p-dias', fecha: '2026-11-05', monto: 30000, interes: 30000, capital: 0, tipo: 'pago' };
    const r = modMotor.calcularPrestamo(prestamo, [pago], '2026-11-06');
    assert.equal(r.interesCorrido, 10000);
  });

  test('sin tasa no corre nada', () => {
    const r = modMotor.calcularPrestamo({ ...prestamo, tasa: 0 }, [], '2026-11-06');
    assert.equal(r.interesCorrido, 0);
    assert.equal(r.debeHoy, 3000000);
  });
});

describe('intereses pagados hasta una fecha', () => {
  test('préstamo del 3 sep al 10 %, pagado hasta el 3 nov: al 6 nov lleva 4 días a 6.667', () => {
    const p = { id: 'p-sep', clienteId: 'c', fecha: '2026-09-03', capital: 2000000, tasa: 10, modalidad: 'interes_mensual', interesesPagadosHasta: '2026-11-03' };
    const r = modMotor.calcularPrestamo(p, [], '2026-11-06');
    assert.equal(r.interesPendiente, 0);
    assert.equal(r.mesesAtrasados, 0);
    assert.equal(r.interesDelMes, 200000);
    assert.equal(r.diasCorridos, 4);
    assert.equal(r.interesCorrido, 26667);
    assert.equal(r.debeHoy, 2026667);
  });

  test('sin esa fecha cuenta desde el día del préstamo', () => {
    const p = { id: 'p-sep2', clienteId: 'c', fecha: '2026-09-03', capital: 2000000, tasa: 10, modalidad: 'interes_mensual' };
    assert.equal(modMotor.calcularPrestamo(p, [], '2026-11-06').interesPendiente, 400000);
  });
});
