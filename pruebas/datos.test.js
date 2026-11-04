// Pruebas de datos.js: caja, validaciones, exportar e importar.
// Se corre con `node --test pruebas/` desde app/. Usa una capa de almacenamiento en
// memoria, así que no toca IndexedDB ni localStorage.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  datos, usarAlmacenamiento, crearAlmacenamientoMemoria, crearAlmacenamientoNavegador, VERSION_ACTUAL, siguienteRecurrente,
} from '../js/datos.js';

const HOY = '2026-11-02';

// IndexedDB falso, con lo mínimo que usa datos.js: open → base con transaction →
// objectStore con get, put y delete. Los eventos se disparan en una microtarea, como en
// el navegador. `fallarPut = true` simula que la base está llena (QuotaExceededError).
function crearIndexedDBFalso() {
  const registros = new Map();
  function responder(transaccion, accion) {
    const solicitud = {};
    queueMicrotask(() => {
      try {
        solicitud.result = accion();
        if (solicitud.onsuccess) solicitud.onsuccess();
        if (transaccion.oncomplete) transaccion.oncomplete();
      } catch (error) {
        solicitud.error = error;
        transaccion.error = error;
        if (solicitud.onerror) solicitud.onerror();
        if (transaccion.onabort) transaccion.onabort();
      }
    });
    return solicitud;
  }
  const falso = {
    fallarPut: false,
    registros,
    open() {
      const solicitud = {};
      queueMicrotask(() => {
        solicitud.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            const transaccion = {};
            transaccion.objectStore = () => ({
              get: (clave) => responder(transaccion, () => registros.get(clave)),
              put: (valor, clave) => responder(transaccion, () => {
                if (falso.fallarPut) throw new Error('QuotaExceededError');
                registros.set(clave, valor);
              }),
              delete: (clave) => responder(transaccion, () => { registros.delete(clave); }),
            });
            return transaccion;
          },
        };
        if (solicitud.onsuccess) solicitud.onsuccess();
      });
      return solicitud;
    },
  };
  return falso;
}

function crearLocalStorageFalso() {
  const mapa = new Map();
  return {
    mapa,
    getItem: (clave) => (mapa.has(clave) ? mapa.get(clave) : null),
    setItem: (clave, valor) => { mapa.set(clave, String(valor)); },
    removeItem: (clave) => { mapa.delete(clave); },
  };
}

// Corre `fn` con un indexedDB y un localStorage falsos puestos como globales.
async function conNavegadorFalso(fn) {
  const base = crearIndexedDBFalso();
  const local = crearLocalStorageFalso();
  globalThis.indexedDB = base;
  globalThis.localStorage = local;
  try {
    await fn(base, local);
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.localStorage;
  }
}

function clientesDe(texto) {
  return JSON.parse(texto).clientes.map((c) => c.nombre);
}

// Saldo de una caja = suma de monto * signo de sus movimientos (misma regla del motor).
function saldo(caja) {
  return datos.listar('movimientos', { caja }).reduce((suma, m) => suma + m.monto * m.signo, 0);
}

async function clienteDePrueba(extra = {}) {
  return datos.agregarCliente({ nombre: 'Ramiro Ejemplo', telefono: '3001234567', ...extra });
}

async function prestamoDePrueba(cliente, extra = {}) {
  return datos.crearPrestamo({
    clienteId: cliente.id,
    fecha: '2026-04-11',
    capital: 1000000,
    tasa: 20,
    modalidad: 'interes_mensual',
    medio: 'efectivo',
    ...extra,
  });
}

describe('datos.js', () => {
  let memoria;

  beforeEach(async () => {
    memoria = crearAlmacenamientoMemoria();
    usarAlmacenamiento(memoria);
    await datos.borrarTodo();
  });

  describe('movimientos recurrentes', () => {
    test('el mes siguiente conserva el día, y febrero usa su último día', () => {
      assert.equal(siguienteRecurrente('2026-01-31', 'mensual', 31), '2026-02-28');
      assert.equal(siguienteRecurrente('2026-02-28', 'mensual', 31), '2026-03-31');
      assert.equal(siguienteRecurrente('2026-12-15', 'mensual', 15), '2027-01-15');
      assert.equal(siguienteRecurrente('2026-11-02', 'semanal', 2), '2026-11-09');
      assert.equal(siguienteRecurrente('2026-11-20', 'quincenal', 20), '2026-12-05');
    });

    test('anota lo vencido una sola vez y sobrevive a exportar e importar', async () => {
      await datos.agregarRecurrente({ libro: 'personal', tipo: 'gasto', categoria: 'Servicios públicos', descripcion: 'wifi', valor: 60000, frecuencia: 'mensual', proxima: '2026-09-10' });
      assert.equal(await datos.aplicarRecurrentes('2026-11-02'), 2);
      assert.equal(await datos.aplicarRecurrentes('2026-11-02'), 0);
      assert.deepEqual(datos.estado.fran.asientos.map((a) => a.fecha), ['2026-09-10', '2026-10-10']);
      assert.equal(datos.estado.fran.recurrentes[0].proxima, '2026-11-10');
      await datos.importarJSON(datos.exportarJSON());
      assert.equal(datos.estado.fran.recurrentes.length, 1);
      assert.equal(await datos.aplicarRecurrentes('2026-11-10'), 1);
    });

    test('editar un movimiento cambia solo ese movimiento', async () => {
      const a = await datos.agregarAsiento({ libro: 'personal', fecha: HOY, tipo: 'gasto', categoria: 'Agua', descripcion: 'x', valor: 1000 });
      await datos.actualizarAsiento(a.id, { fecha: HOY, valor: 2500, categoria: 'Alimentos', descripcion: 'pan' });
      const b = datos.estado.fran.asientos.find((x) => x.id === a.id);
      assert.equal(b.valor, 2500);
      assert.equal(b.categoria, 'Alimentos');
      assert.equal(b.tipo, 'gasto');
    });
  });

  describe('cuenta virtual', () => {
    test('lo anotado se guarda, cruza exportar e importar y se puede quitar', async () => {
      const m = await datos.agregarVirtual({ fecha: HOY, tipo: 'sale', concepto: 'tarjeta', valor: 50000 });
      await datos.importarJSON(datos.exportarJSON());
      assert.equal(datos.estado.fran.virtualMov[0].concepto, 'tarjeta');
      await datos.eliminarVirtual(m.id);
      assert.equal(datos.estado.fran.virtualMov.length, 0);
    });

    test('la cifra de las cuentas que ella cambió no la pisa la copia', async () => {
      const copia = { fran: { asientos: [{ id: 'h', libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', valor: 1, importado: true }], virtualCuentas: { valor: 107565, fecha: '2026-11-01' }, virtualHistorial: [{ mes: '2026-09', queda: -875000 }] } };
      await datos.actualizarHistoricos(JSON.stringify(copia));
      assert.equal(datos.estado.fran.virtualCuentas.valor, 107565);
      await datos.actualizarFran({ virtualCuentas: { valor: 90000, fecha: HOY } });
      await datos.actualizarHistoricos(JSON.stringify(copia));
      assert.equal(datos.estado.fran.virtualCuentas.valor, 90000);
      assert.equal(datos.estado.fran.virtualHistorial[0].queda, -875000);
    });
  });

  describe('acuerdos que juntan préstamos', () => {
    test('reemplaza los préstamos sueltos, conserva el detalle y respeta los que tienen pagos', async () => {
      const c = await datos.agregarCliente({ nombre: 'Rosa' });
      const conPlata = await datos.crearPrestamo({ clienteId: c.id, fecha: '2025-03-01', capital: 50000, tasa: 10, medio: 'efectivo' });
      const base = JSON.parse(datos.exportarJSON());
      const suelto = (id, capital) => ({ id, clienteId: c.id, fecha: '2025-01-01', capital, tasa: 0, medio: 'efectivo', fuentes: [{ origen: 'caja_efectivo', monto: capital, nota: '' }], creadoEn: HOY });
      base.prestamos.push(suelto('a', 100000), suelto('b', 200000));
      await datos.importarJSON(JSON.stringify(base));
      await datos.actualizarHistoricos(JSON.stringify({
        prestamosQuitar: ['a', 'b', conPlata.id],
        prestamos: [{ ...suelto('acuerdo-rosa', 300000), actualizar: true, modalidad: 'capital_primero', totalPactado: 500000, detalle: [{ fecha: '2025-01-01', nombre: 'uno', capital: 100000 }], acuerdoTexto: 'cada mes' }],
        fran: { asientos: [{ id: 'h', libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', valor: 1, importado: true }] },
      }));
      assert.deepEqual(datos.estado.prestamos.map((p) => p.id).sort(), ['acuerdo-rosa', conPlata.id].sort());
      await datos.importarJSON(datos.exportarJSON());
      const p = datos.obtener('prestamos', 'acuerdo-rosa');
      assert.equal(p.totalPactado, 500000);
      assert.equal(p.detalle.length, 1);
      assert.equal(p.acuerdoTexto, 'cada mes');
    });
  });

  describe('corregir históricos', () => {
    const fila = (id, descripcion, valor) => ({ id, libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', descripcion, valor, importado: true });
    test('lo editado y lo borrado no vuelve al cargar otra vez, aunque cambien los números internos', async () => {
      await datos.actualizarHistoricos(JSON.stringify({ fran: { asientos: [fila('mg1', 'a', 1000), fila('mg2', 'b', 2000), fila('mg3', 'c', 3000)] } }));
      await datos.actualizarAsiento('mg1', { fecha: '2025-01-03', valor: 1500, categoria: 'Compras', descripcion: 'a2' });
      await datos.eliminarAsiento('mg2');
      await datos.importarJSON(datos.exportarJSON());
      await datos.actualizarHistoricos(JSON.stringify({ fran: { asientos: [fila('mg7', 'a', 1000), fila('mg8', 'b', 2000), fila('mg9', 'c', 3000), fila('mg10', 'd', 4000)] } }));
      const v = datos.estado.fran.asientos.map((a) => a.valor).sort((x, y) => x - y);
      assert.deepEqual(v, [1500, 3000, 4000]);
      assert.equal(datos.estado.fran.asientos.find((a) => a.valor === 1500).descripcion, 'a2');
    });

    test('si hay dos iguales y borra uno, el otro se queda', async () => {
      await datos.actualizarHistoricos(JSON.stringify({ fran: { asientos: [fila('mg1', 'pollo', 1000), fila('mg2', 'pollo', 1000)] } }));
      await datos.eliminarAsiento('mg1');
      await datos.actualizarHistoricos(JSON.stringify({ fran: { asientos: [fila('mg1', 'pollo', 1000), fila('mg2', 'pollo', 1000)] } }));
      assert.equal(datos.estado.fran.asientos.length, 1);
    });
  });

  describe('lo dictado por el chat', () => {
    test('la nota de un cobro histórico sobrevive a actualizar históricos', async () => {
      const fran = { asientos: [{ id: 'h1', libro: 'prestamos', fecha: '2026-10-31', tipo: 'abono', categoria: 'Abono a capital', descripcion: 'X', valor: 100, importado: true }] };
      await datos.actualizarHistoricos(JSON.stringify({ fran }));
      await datos.detallarCobro('h1', { nota: 'Recogió otro préstamo', medio: 'efectivo', prestamoId: '' });
      await datos.actualizarHistoricos(JSON.stringify({ fran }));
      const iguales = datos.estado.fran.asientos.filter((x) => x.descripcion === 'X');
      assert.equal(iguales.length, 1);
      assert.equal(iguales[0].nota, 'Recogió otro préstamo');
      assert.equal(iguales[0].medio, 'efectivo');
    });

    test('se anota una sola vez, cuadra la caja y cruza exportar e importar', async () => {
      const c = await datos.agregarCliente({ nombre: 'Rosa' });
      const o = await datos.agregarCliente({ nombre: 'Marta' });
      const p = await datos.crearPrestamo({ clienteId: c.id, fecha: '2025-01-01', capital: 686000, tasa: 0, modalidad: 'capital_primero', totalPactado: 1745000, medio: 'efectivo' });
      const ops = [
        { op: 'asiento', id: 'd1', libro: 'personal', fecha: '2026-11-02', tipo: 'gasto', categoria: 'Alimentos', descripcion: 'pollo', valor: 9500, cuenta: 'Tarjeta comida' },
        { op: 'pago', id: 'd2', clienteId: c.id, modalidad: 'capital_primero', fecha: '2026-11-03', monto: 1000000, medio: 'efectivo', nota: '' },
        { op: 'perdon', id: 'd3', clienteId: c.id, modalidad: 'capital_primero', fecha: '2026-11-03', monto: 5000, nota: 'Perdón' },
        { op: 'prestamo', id: 'd4', clienteId: o.id, fecha: '2026-11-03', capital: 2600000, tasa: 300000 / 26000, modalidad: 'interes_mensual', medio: 'efectivo', nota: 'x', acuerdoTexto: 'Para ella son 3.000.000' },
        { op: 'prestamo', id: 'd5', clienteId: 'no-existe', fecha: '2026-11-03', capital: 1000, tasa: 10, modalidad: 'interes_mensual', medio: 'efectivo' },
      ];
      const r = await datos.aplicarDictado(ops);
      assert.equal(r.anotadas, 4);
      assert.deepEqual(r.faltan, ['d5']);
      assert.equal((await datos.aplicarDictado(ops)).anotadas, 0);
      const repetido = await datos.aplicarDictado([
        { op: 'asiento', id: 'otro1', libro: 'personal', fecha: '2026-11-02', tipo: 'gasto', categoria: 'Alimentos', descripcion: 'a mano', valor: 9500, cuenta: '' },
        { op: 'pago', id: 'otro2', clienteId: c.id, modalidad: 'capital_primero', fecha: '2026-11-03', monto: 1000000, medio: 'efectivo', nota: '' },
      ]);
      assert.deepEqual([repetido.anotadas, repetido.yaEstaban], [0, 2]);
      assert.equal(datos.estado.pagos.filter((g) => g.prestamoId === p.id).length, 2);
      await datos.importarJSON(datos.exportarJSON());
      assert.equal(datos.obtener('prestamos', 'd4').acuerdoTexto, 'Para ella son 3.000.000');
      assert.equal(datos.obtener('pagos', 'd3').tipo, 'perdon');
      assert.equal(datos.estado.fran.asientos.find((a) => a.id === 'd1').valor, 9500);
    });
  });

  describe('agenda en los históricos', () => {
    test('agrega lo nuevo, completa la nota vacía y no revive lo ya cobrado', async () => {
      await datos.actualizarFran({ agenda: [{ id: 'a', nombre: 'Rosa', fecha: '2026-11-03', nota: '', hecho: true }] });
      const fran = { asientos: [{ id: 'h', libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', valor: 1, importado: true }], agenda: [{ id: 'a', nombre: 'Rosa', fecha: '2026-11-03', nota: 'Recoger tarjeta' }, { id: 'b', nombre: 'Marta', nota: 'Escribirle' }] };
      await datos.actualizarHistoricos(JSON.stringify({ fran }));
      const a = datos.estado.fran.agenda.find((x) => x.id === 'a');
      assert.equal(a.nota, 'Recoger tarjeta');
      assert.equal(a.hecho, true);
      assert.equal(datos.estado.fran.agenda.length, 2);
    });
  });

  describe('origen de la pensión', () => {
    test('llega con los históricos, no borra la tasa y cruza exportar e importar', async () => {
      await datos.actualizarFran({ pension: { tasa: 4000, cuentas: [], otros: [] } });
      await datos.actualizarHistoricos(JSON.stringify({ fran: { pension: { origen: 'De los préstamos' }, asientos: [{ id: 'h', libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', valor: 1, importado: true }] } }));
      assert.equal(datos.estado.fran.pension.origen, 'De los préstamos');
      assert.equal(datos.estado.fran.pension.tasa, 4000);
      await datos.importarJSON(datos.exportarJSON());
      assert.equal(datos.estado.fran.pension.origen, 'De los préstamos');
    });
  });

  describe('actualizar históricos', () => {
    const copia = {
      movimientos: [{ id: 'ini-v', fecha: '2026-11-01', caja: 'virtual', tipo: 'saldo_inicial', monto: 107565, signo: 1, creadoEn: '2026-11-02' }],
      fran: { asientos: [{ id: 'h1', libro: 'personal', fecha: '2025-01-02', tipo: 'gasto', categoria: 'Agua', valor: 3000, importado: true }], agenda: [{ id: 'ag1', nombre: 'Ana' }] },
    };
    test('corrige un préstamo marcado, agrega su pago y la copia se sigue pudiendo importar', async () => {
      const cliente = await datos.agregarCliente({ nombre: 'Ana' });
      const p = await datos.crearPrestamo({ clienteId: cliente.id, fecha: '2026-01-01', capital: 600000, tasa: 10, medio: 'efectivo' });
      const mov = datos.estado.movimientos.length;
      await datos.actualizarHistoricos(JSON.stringify({
        ...copia,
        prestamos: [{ id: p.id, actualizar: true, capital: 686000, modalidad: 'capital_primero', totalPactado: 1745000, fuentes: [{ origen: 'caja_efectivo', monto: 686000, nota: '' }] }],
        pagos: [{ id: 'plan-1', prestamoId: p.id, clienteId: cliente.id, fecha: '2026-10-31', tipo: 'pago', monto: 80000, interes: 0, capital: 80000, medio: 'efectivo', creadoEn: '2026-11-02' }],
      }));
      assert.equal(datos.obtener('prestamos', p.id).capital, 686000);
      assert.equal(datos.estado.pagos.length, 1);
      assert.equal(datos.estado.movimientos.length, mov + 1); // solo el saldo inicial
      await datos.importarJSON(datos.exportarJSON());
      assert.equal(datos.obtener('prestamos', p.id).totalPactado, 1745000);
    });

    test('conserva lo anotado, reemplaza lo importado y corrige el saldo inicial', async () => {
      await datos.agregarAsiento({ libro: 'personal', fecha: '2026-11-02', tipo: 'gasto', categoria: 'Agua', valor: 2000 });
      await datos.actualizarHistoricos(JSON.stringify(copia));
      await datos.actualizarHistoricos(JSON.stringify(copia));
      assert.equal(datos.estado.fran.asientos.length, 2);
      assert.equal(saldo('virtual'), 107565);
      assert.equal(datos.estado.fran.agenda.length, 1);
    });
  });

  describe('caja (sección 5.4, último punto)', () => {
    test('saldo inicial negativo en virtual: plata de la pareja que ya debía', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'virtual', monto: 1006000, fecha: '2026-11-01', negativo: true });
      assert.equal(saldo('virtual'), -1006000);
      const [movimiento] = datos.listar('movimientos');
      assert.equal(movimiento.signo, -1);
      assert.equal(movimiento.monto, 1006000);
    });

    test('saldo inicial sin "negativo" sigue siendo una entrada', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'virtual', monto: 107565, fecha: '2026-11-01', negativo: false });
      assert.equal(saldo('virtual'), 107565);
    });

    test('crear préstamo desde caja efectivo baja el saldo de efectivo', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'efectivo', monto: 3000000, fecha: '2026-01-01' });
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);

      assert.equal(saldo('efectivo'), 2000000);
      assert.equal(saldo('virtual'), 0);
      const movimientos = datos.listar('movimientos', { prestamoId: prestamo.id });
      assert.equal(movimientos.length, 1);
      assert.equal(movimientos[0].tipo, 'prestamo');
      assert.equal(movimientos[0].signo, -1);
      assert.equal(movimientos[0].fecha, '2026-04-11');
      assert.deepEqual(prestamo.fuentes, [{ origen: 'caja_efectivo', monto: 1000000, nota: '' }]);
    });

    test('registrar pago en virtual sube el saldo virtual', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      const pago = await datos.registrarPago({
        prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 200000, capital: 0, medio: 'virtual',
      });

      assert.equal(saldo('virtual'), 200000);
      assert.equal(saldo('efectivo'), -1000000);
      const movimiento = datos.listar('movimientos', { pagoId: pago.id })[0];
      assert.equal(movimiento.tipo, 'pago');
      assert.equal(movimiento.caja, 'virtual');
      assert.equal(movimiento.signo, 1);
      assert.equal(pago.clienteId, cliente.id);
      assert.equal(pago.tipo, 'pago');
    });

    test('perdón y pago en especie no mueven la caja', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      const antes = datos.listar('movimientos').length;

      const perdon = await datos.registrarPerdon({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 20000, nota: 'mayo' });
      const especie = await datos.registrarPago({
        prestamoId: prestamo.id, fecha: '2026-06-11', monto: 200000, interes: 200000, capital: 0, medio: 'especie', descripcion: 'lechonas',
      });

      assert.equal(datos.listar('movimientos').length, antes);
      assert.equal(saldo('efectivo'), -1000000);
      assert.equal(saldo('virtual'), 0);
      assert.equal(perdon.tipo, 'perdon');
      assert.equal(perdon.interes, 20000);
      assert.equal(perdon.capital, 0);
      assert.equal(especie.medio, 'especie');
      assert.equal(datos.listar('pagos').length, 2);
    });

    test('fuentes externas crean aporte (+1) y préstamo (−1) en la caja del medio', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente, {
        medio: 'virtual',
        fuentes: [
          { origen: 'caja_virtual', monto: 400000 },
          { origen: 'arriendo', monto: 600000, nota: 'arriendo de octubre' },
        ],
      });
      const movimientos = datos.listar('movimientos', { prestamoId: prestamo.id });
      assert.equal(movimientos.length, 3);
      const aporte = movimientos.find((m) => m.tipo === 'aporte');
      assert.equal(aporte.origen, 'arriendo');
      assert.equal(aporte.signo, 1);
      assert.equal(aporte.caja, 'virtual');
      assert.equal(aporte.monto, 600000);
      assert.equal(saldo('virtual'), -400000); // −400.000 de caja, +600.000 −600.000 del arriendo
      assert.equal(saldo('efectivo'), 0);
    });

    test('traslado crea dos movimientos y se borran juntos', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'efectivo', monto: 500000, fecha: '2026-01-01' });
      const [salida, entrada] = await datos.movimientoCaja({ tipo: 'traslado', de: 'efectivo', a: 'virtual', monto: 200000, fecha: '2026-02-01' });
      assert.equal(saldo('efectivo'), 300000);
      assert.equal(saldo('virtual'), 200000);
      assert.equal(salida.parId, entrada.id);

      await datos.eliminarMovimiento(entrada.id);
      assert.equal(saldo('efectivo'), 500000);
      assert.equal(saldo('virtual'), 0);
    });

    test('ganancia a personal y retiro salen de la caja; aporte entra con origen', async () => {
      await datos.movimientoCaja({ tipo: 'aporte', caja: 'efectivo', monto: 1000000, origen: 'esposo', fecha: '2026-01-01' });
      await datos.movimientoCaja({ tipo: 'ganancia_a_personal', caja: 'efectivo', monto: 150000, fecha: '2026-01-31' });
      await datos.movimientoCaja({ tipo: 'retiro', caja: 'efectivo', monto: 50000, fecha: '2026-01-31' });
      assert.equal(saldo('efectivo'), 800000);
      assert.equal(datos.listar('movimientos', { tipo: 'aporte' })[0].origen, 'esposo');
    });

    test('eliminar pago borra también su movimiento', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      const pago = await datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 200000, capital: 0, medio: 'efectivo' });
      assert.equal(saldo('efectivo'), -800000);
      await datos.eliminarPago(pago.id);
      assert.equal(saldo('efectivo'), -1000000);
      assert.equal(datos.listar('pagos').length, 0);
      assert.equal(datos.listar('movimientos', { pagoId: pago.id }).length, 0);
    });

    test('no se borra desde la caja un movimiento que viene de un préstamo o pago', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      const movimiento = datos.listar('movimientos', { prestamoId: prestamo.id })[0];
      await assert.rejects(() => datos.eliminarMovimiento(movimiento.id), /viene de un préstamo o de un pago/);
    });

    test('un traslado importado sin parId se empareja al importar y se borra entero', async () => {
      const copia = JSON.stringify({
        version: VERSION_ACTUAL,
        clientes: [], prestamos: [], pagos: [],
        movimientos: [
          { id: 'inicial', fecha: '2026-01-01', caja: 'efectivo', tipo: 'saldo_inicial', monto: 500000, signo: 1, creadoEn: '2026-01-01' },
          { id: 't-sal', fecha: '2026-02-01', caja: 'efectivo', tipo: 'traslado', monto: 200000, signo: -1, creadoEn: '2026-02-01' },
          { id: 't-ent', fecha: '2026-02-01', caja: 'virtual', tipo: 'traslado', monto: 200000, signo: 1, creadoEn: '2026-02-01' },
        ],
      });
      await datos.importarJSON(copia);
      assert.equal(datos.obtener('movimientos', 't-sal').parId, 't-ent');
      assert.equal(datos.obtener('movimientos', 't-ent').parId, 't-sal');
      assert.equal(saldo('efectivo'), 300000);
      assert.equal(saldo('virtual'), 200000);

      await datos.eliminarMovimiento('t-ent');
      assert.equal(saldo('efectivo'), 500000);
      assert.equal(saldo('virtual'), 0);
      assert.equal(datos.listar('movimientos').length, 1);
    });

    test('un traslado sin su otra mitad se rechaza al importar', async () => {
      const copia = JSON.stringify({
        version: VERSION_ACTUAL,
        clientes: [], prestamos: [], pagos: [],
        movimientos: [
          { id: 't-sal', fecha: '2026-02-01', caja: 'efectivo', tipo: 'traslado', monto: 200000, signo: -1, creadoEn: '2026-02-01' },
        ],
      });
      await assert.rejects(() => datos.importarJSON(copia), /no tiene su otra mitad/);
    });

    test('al borrar un traslado sin parId en memoria se busca la otra mitad por sus campos', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'efectivo', monto: 500000, fecha: '2026-01-01' });
      const [salida, entrada] = await datos.movimientoCaja({ tipo: 'traslado', de: 'efectivo', a: 'virtual', monto: 200000, fecha: '2026-02-01' });
      // Se simula una copia vieja en memoria donde las mitades no se conocen.
      datos.obtener('movimientos', salida.id).parId = null;
      datos.obtener('movimientos', entrada.id).parId = null;

      await datos.eliminarMovimiento(salida.id);
      assert.equal(saldo('efectivo'), 500000);
      assert.equal(saldo('virtual'), 0);
      assert.equal(datos.listar('movimientos').length, 1);
    });
  });

  describe('exportar e importar', () => {
    test('exportar e importar deja el estado idéntico', async () => {
      await datos.movimientoCaja({ tipo: 'saldo_inicial', caja: 'efectivo', monto: 3000000, fecha: '2026-01-01' });
      const cliente = await clienteDePrueba({ alias: 'Mauri', grupo: '' });
      const prestamo = await prestamoDePrueba(cliente, { garantia: 'moto a mi nombre' });
      await datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 200000, capital: 0, medio: 'virtual' });
      await datos.registrarPerdon({ prestamoId: prestamo.id, fecha: '2026-06-11', monto: 20000 });
      await datos.movimientoCaja({ tipo: 'traslado', de: 'efectivo', a: 'virtual', monto: 100000, fecha: '2026-07-01' });

      const antes = JSON.parse(JSON.stringify(datos.estado));
      const texto = datos.exportarJSON();
      assert.equal(JSON.parse(texto).version, VERSION_ACTUAL);

      await datos.borrarTodo();
      assert.equal(datos.listar('clientes').length, 0);

      await datos.importarJSON(texto);
      assert.deepEqual(datos.estado, antes);
      assert.equal(datos.exportarJSON(), texto);
    });

    test('importar rechaza texto que no es JSON ni copia de la app', async () => {
      await assert.rejects(() => datos.importarJSON('esto no es json'), /no es un JSON válido/);
      await assert.rejects(() => datos.importarJSON('{"hola": 1}'), /no contiene clientes/);
      await assert.rejects(() => datos.importarJSON(''), /vacío/);
    });

    test('importar rechaza una versión más nueva y migra datos sin versión', async () => {
      const nuevo = JSON.stringify({ version: VERSION_ACTUAL + 1, clientes: [], prestamos: [], pagos: [], movimientos: [] });
      await assert.rejects(() => datos.importarJSON(nuevo), /versión más nueva/);

      const viejo = JSON.stringify({
        clientes: [{ id: 'c1', nombre: 'Marta' }],
        prestamos: [{ id: 'p1', clienteId: 'c1', fecha: '2024-09-26', capital: 606000, tasa: 0, modalidad: 'capital_primero', totalPactado: 1665000 }],
        pagos: [{ id: 'g1', prestamoId: 'p1', fecha: '2024-10-26', monto: 40000, interes: 0, capital: 40000, medio: 'efectivo' }],
      });
      const estado = await datos.importarJSON(viejo);
      assert.equal(estado.version, VERSION_ACTUAL);
      assert.equal(estado.clientes[0].tipo, 'cliente');
      assert.equal(estado.clientes[0].alias, '');
      assert.deepEqual(estado.prestamos[0].fuentes, [{ origen: 'caja_efectivo', monto: 606000, nota: '' }]);
      assert.equal(estado.config.nombreNegocio, 'Fran');
    });

    test('importar rechaza referencias rotas', async () => {
      const roto = JSON.stringify({
        version: 1,
        clientes: [],
        prestamos: [{ id: 'p1', clienteId: 'nadie', fecha: '2026-01-01', capital: 1000 }],
        pagos: [],
        movimientos: [],
      });
      await assert.rejects(() => datos.importarJSON(roto), /cliente que no existe/);
      assert.equal(datos.listar('prestamos').length, 0); // no reemplazó nada
    });
  });

  describe('persistencia', () => {
    test('cargar() recupera lo guardado en la capa de almacenamiento', async () => {
      const cliente = await clienteDePrueba();
      await prestamoDePrueba(cliente);
      const exportado = datos.exportarJSON();

      // Misma capa de memoria, estado en memoria limpio: simula reabrir la app.
      usarAlmacenamiento(memoria);
      const estado = await datos.cargar();
      assert.equal(estado.clientes.length, 1);
      assert.equal(datos.exportarJSON(), exportado);
    });

    test('cargar() arranca vacío si no hay nada guardado o está dañado', async () => {
      usarAlmacenamiento(crearAlmacenamientoMemoria());
      let estado = await datos.cargar();
      assert.deepEqual(estado.clientes, []);
      assert.equal(estado.version, VERSION_ACTUAL);

      const dañado = crearAlmacenamientoMemoria();
      await dañado.guardar('{esto no es json');
      usarAlmacenamiento(dañado);
      estado = await datos.cargar();
      assert.deepEqual(estado.clientes, []);
    });

    test('un estado guardado que no se puede usar se conserva aparte y no se pisa al guardar', async () => {
      // Capital como texto: no valida. Antes, el primer guardado lo borraba para siempre.
      const guardado = JSON.stringify({
        version: VERSION_ACTUAL,
        clientes: [{ id: 'c1', nombre: 'Real' }],
        prestamos: [{ id: 'p1', clienteId: 'c1', fecha: '2026-01-10', capital: '1000000', tasa: 20 }],
        pagos: [], movimientos: [],
      });
      const almacen = crearAlmacenamientoMemoria();
      await almacen.guardar(guardado);
      usarAlmacenamiento(almacen);

      let estado = await datos.cargar();
      assert.equal(estado.clientes.length, 0);
      assert.equal(datos.almacenamiento.copiaNoUsable, guardado);
      assert.match(datos.almacenamiento.errorCarga.message, /entero en pesos/);

      await datos.agregarCliente({ nombre: 'Nuevo' });
      assert.deepEqual(clientesDe(await almacen.leer()), ['Nuevo']);
      assert.equal(await almacen.leerNoUsable(), guardado); // sigue ahí para descargarla

      // Al reabrir, la copia conservada sigue disponible aunque el estado ya sea válido.
      usarAlmacenamiento(almacen);
      estado = await datos.cargar();
      assert.deepEqual(estado.clientes.map((c) => c.nombre), ['Nuevo']);
      assert.equal(datos.almacenamiento.copiaNoUsable, guardado);
      assert.equal(datos.almacenamiento.errorCarga, null);

      await datos.descartarCopiaNoUsable();
      assert.equal(datos.almacenamiento.copiaNoUsable, null);
      assert.equal(await almacen.leerNoUsable(), null);
    });

    test('un estado de una versión más nueva también se conserva, y borrar todo lo descarta', async () => {
      const nuevo = JSON.stringify({ version: VERSION_ACTUAL + 1, clientes: [{ id: 'c1', nombre: 'Real' }], prestamos: [], pagos: [], movimientos: [] });
      const almacen = crearAlmacenamientoMemoria();
      await almacen.guardar(nuevo);
      usarAlmacenamiento(almacen);

      await datos.cargar();
      assert.match(datos.almacenamiento.errorCarga.message, /versión más nueva/);
      assert.equal(datos.almacenamiento.copiaNoUsable, nuevo);
      await datos.agregarCliente({ nombre: 'Nuevo' });
      assert.equal(await almacen.leerNoUsable(), nuevo);

      await datos.borrarTodo();
      assert.equal(datos.almacenamiento.copiaNoUsable, null);
      assert.equal(await almacen.leerNoUsable(), null);
    });

    test('la app sigue funcionando si el almacenamiento falla al guardar', async () => {
      usarAlmacenamiento({
        nombre: 'roto',
        async leer() { return null; },
        async guardar() { throw new Error('disco lleno'); },
      });
      const cliente = await datos.agregarCliente({ nombre: 'Ernesto Muestra' });
      assert.equal(datos.obtener('clientes', cliente.id).nombre, 'Ernesto Muestra');
      assert.match(datos.almacenamiento.ultimoError.message, /disco lleno/);
    });

    test('suscribir avisa después de cada guardado y permite darse de baja', async () => {
      let avisos = 0;
      const baja = datos.suscribir(() => { avisos += 1; });
      await datos.agregarCliente({ nombre: 'Uno' });
      await datos.agregarCliente({ nombre: 'Dos' });
      assert.equal(avisos, 2);
      baja();
      await datos.agregarCliente({ nombre: 'Tres' });
      assert.equal(avisos, 2);
    });
  });

  describe('almacenamiento del navegador (IndexedDB con respaldo en localStorage)', () => {
    test('si el guardado solo llega a localStorage, al reabrir manda esa copia y se repara IndexedDB', async () => {
      await conNavegadorFalso(async (base, local) => {
        usarAlmacenamiento(crearAlmacenamientoNavegador());
        await datos.borrarTodo();
        await datos.agregarCliente({ nombre: 'Primero' });
        assert.equal(datos.almacenamiento.ultimoError, null);
        assert.deepEqual(clientesDe(base.registros.get('actual')), ['Primero']);
        assert.deepEqual(clientesDe(local.getItem('mis-prestamos:estado')), ['Primero']);

        // IndexedDB se llena: el guardado solo llega al respaldo y debe avisarse.
        base.fallarPut = true;
        await datos.agregarCliente({ nombre: 'Segundo' });
        assert.match(datos.almacenamiento.ultimoError.message, /copia de respaldo/);
        assert.equal(local.getItem('mis-prestamos:respaldo-mas-nuevo'), '1');
        assert.deepEqual(clientesDe(base.registros.get('actual')), ['Primero']);
        assert.deepEqual(clientesDe(local.getItem('mis-prestamos:estado')), ['Primero', 'Segundo']);

        // Se reabre la app: la copia de localStorage es la buena y vuelve a IndexedDB.
        base.fallarPut = false;
        usarAlmacenamiento(crearAlmacenamientoNavegador());
        const estado = await datos.cargar();
        assert.deepEqual(estado.clientes.map((c) => c.nombre), ['Primero', 'Segundo']);
        assert.deepEqual(clientesDe(base.registros.get('actual')), ['Primero', 'Segundo']);
        assert.equal(local.getItem('mis-prestamos:respaldo-mas-nuevo'), null);

        // Un guardado que vuelve a llegar a IndexedDB limpia el aviso.
        await datos.agregarCliente({ nombre: 'Tercero' });
        assert.equal(datos.almacenamiento.ultimoError, null);
        assert.deepEqual(clientesDe(base.registros.get('actual')), ['Primero', 'Segundo', 'Tercero']);
      });
    });

    test('con IndexedDB al día, manda su copia aunque localStorage tenga otra vieja', async () => {
      await conNavegadorFalso(async (base, local) => {
        usarAlmacenamiento(crearAlmacenamientoNavegador());
        await datos.borrarTodo();
        await datos.agregarCliente({ nombre: 'Primero' });
        local.setItem('mis-prestamos:estado', JSON.stringify({ version: VERSION_ACTUAL, clientes: [], prestamos: [], pagos: [], movimientos: [] }));

        usarAlmacenamiento(crearAlmacenamientoNavegador());
        const estado = await datos.cargar();
        assert.deepEqual(estado.clientes.map((c) => c.nombre), ['Primero']);
      });
    });

    test('la copia que no se pudo usar se conserva en IndexedDB y en localStorage', async () => {
      await conNavegadorFalso(async (base, local) => {
        const dañado = JSON.stringify({ version: VERSION_ACTUAL + 1, clientes: [{ id: 'c1', nombre: 'Real' }], prestamos: [], pagos: [], movimientos: [] });
        base.registros.set('actual', dañado);
        usarAlmacenamiento(crearAlmacenamientoNavegador());
        await datos.cargar();
        assert.equal(datos.almacenamiento.copiaNoUsable, dañado);
        assert.equal(base.registros.get('no-usable'), dañado);
        assert.equal(local.getItem('mis-prestamos:estado-no-usable'), dañado);

        await datos.agregarCliente({ nombre: 'Nuevo' });
        assert.deepEqual(clientesDe(base.registros.get('actual')), ['Nuevo']);
        assert.equal(base.registros.get('no-usable'), dañado);

        await datos.descartarCopiaNoUsable();
        assert.equal(base.registros.get('no-usable'), undefined);
        assert.equal(local.getItem('mis-prestamos:estado-no-usable'), null);
      });
    });
  });

  describe('validaciones', () => {
    test('montos deben ser enteros positivos', async () => {
      const cliente = await clienteDePrueba();
      await assert.rejects(() => prestamoDePrueba(cliente, { capital: 0 }), /entero en pesos/);
      await assert.rejects(() => prestamoDePrueba(cliente, { capital: 1000.5 }), /entero en pesos/);
      await assert.rejects(() => prestamoDePrueba(cliente, { capital: '1000000' }), /entero en pesos/);
      await assert.rejects(() => prestamoDePrueba(cliente, { capital: -5 }), /entero en pesos/);
    });

    test('fechas deben ser AAAA-MM-DD reales', async () => {
      const cliente = await clienteDePrueba();
      await assert.rejects(() => prestamoDePrueba(cliente, { fecha: '2026-02-30' }), /fecha del préstamo no es válida/);
      await assert.rejects(() => prestamoDePrueba(cliente, { fecha: '11/04/2026' }), /fecha del préstamo no es válida/);
      await assert.rejects(() => prestamoDePrueba(cliente, { fecha: '2026-13-01' }), /fecha del préstamo no es válida/);
      await prestamoDePrueba(cliente, { fecha: '2024-02-29' }); // bisiesto, válida
    });

    test('reparto interés + capital debe ser igual al monto', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      await assert.rejects(
        () => datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 150000, capital: 0, medio: 'efectivo' }),
        /debe ser igual al monto/,
      );
      await assert.rejects(
        () => datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 250000, capital: -50000, medio: 'efectivo' }),
        /abono a capital/,
      );
      await assert.rejects(
        () => datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, medio: 'efectivo' }),
        /Indica cuánto/,
      );
      // Si solo da una parte, la otra se completa.
      const pago = await datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 200000, interes: 150000, medio: 'efectivo' });
      assert.equal(pago.capital, 50000);
    });

    test('pago sin reparto en capital_primero y sin_interes va todo a capital', async () => {
      const marta = await datos.agregarCliente({ nombre: 'Marta' });
      const prestamo = await prestamoDePrueba(marta, { fecha: '2024-09-26', capital: 606000, tasa: 0, modalidad: 'capital_primero', totalPactado: 1665000 });
      const pago = await datos.registrarPago({ prestamoId: prestamo.id, fecha: '2024-10-26', monto: 40000, medio: 'efectivo' });
      assert.equal(pago.interes, 0);
      assert.equal(pago.capital, 40000);

      const mama = await datos.agregarCliente({ nombre: 'Mamá', tipo: 'familia' });
      const familiar = await datos.crearPrestamo({ clienteId: mama.id, fecha: '2026-01-10', capital: 150000 });
      assert.equal(familiar.modalidad, 'sin_interes');
      assert.equal(familiar.tasa, 0);
      await assert.rejects(
        () => datos.registrarPago({ prestamoId: familiar.id, fecha: '2026-02-10', monto: 10000, interes: 10000, capital: 0, medio: 'efectivo' }),
        /sin interés/,
      );
    });

    test('fuentes deben sumar el capital', async () => {
      const cliente = await clienteDePrueba();
      await assert.rejects(
        () => prestamoDePrueba(cliente, { fuentes: [{ origen: 'caja_efectivo', monto: 600000 }, { origen: 'esposo', monto: 300000 }] }),
        /Las fuentes suman 900000 y el capital es 1000000/,
      );
      await assert.rejects(
        () => prestamoDePrueba(cliente, { fuentes: [{ origen: 'banco', monto: 1000000 }] }),
        /no es válida/,
      );
    });

    test('no se elimina un cliente con préstamos', async () => {
      const cliente = await clienteDePrueba();
      await prestamoDePrueba(cliente);
      await assert.rejects(() => datos.eliminarCliente(cliente.id), /tiene un préstamo registrado/);
      const otro = await datos.agregarCliente({ nombre: 'Sin préstamos' });
      await datos.eliminarCliente(otro.id);
      assert.equal(datos.obtener('clientes', otro.id), null);
    });

    test('no se cambia capital ni fecha de un préstamo con pagos; sí nota, garantía y estado', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);

      // Sin pagos sí se puede corregir, y se rehacen los movimientos.
      await datos.actualizarPrestamo({ id: prestamo.id, capital: 1200000 });
      assert.equal(saldo('efectivo'), -1200000);
      assert.equal(datos.listar('movimientos', { prestamoId: prestamo.id }).length, 1);

      await datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-05-11', monto: 240000, interes: 240000, capital: 0, medio: 'efectivo' });
      await assert.rejects(() => datos.actualizarPrestamo({ id: prestamo.id, capital: 1500000 }), /No se puede cambiar el capital/);
      await assert.rejects(() => datos.actualizarPrestamo({ id: prestamo.id, fecha: '2026-04-12' }), /No se puede cambiar la fecha/);

      const cambiado = await datos.actualizarPrestamo({
        id: prestamo.id, nota: 'se voló', garantia: 'papel firmado', estadoManual: 'perdido', fechaEstado: HOY, plazoMeses: 6,
      });
      assert.equal(cambiado.nota, 'se voló');
      assert.equal(cambiado.garantia, 'papel firmado');
      assert.equal(cambiado.estadoManual, 'perdido');
      assert.equal(cambiado.fechaEstado, HOY);
      assert.equal(cambiado.plazoMeses, 6);
      assert.equal(cambiado.capital, 1200000);

      const activo = await datos.actualizarPrestamo({ id: prestamo.id, estadoManual: null });
      assert.equal(activo.estadoManual, null);
      assert.equal(activo.fechaEstado, null);
    });

    test('cliente necesita nombre y tipo válido; préstamo necesita cliente existente', async () => {
      await assert.rejects(() => datos.agregarCliente({ nombre: '   ' }), /nombre del cliente es obligatorio/);
      await assert.rejects(() => datos.agregarCliente({ nombre: 'X', tipo: 'amigo' }), /cliente.*familia/);
      await assert.rejects(() => datos.crearPrestamo({ clienteId: 'nadie', fecha: HOY, capital: 1000 }), /cliente existente/);
    });

    test('pago y perdón no pueden ser anteriores al préstamo', async () => {
      const cliente = await clienteDePrueba();
      const prestamo = await prestamoDePrueba(cliente);
      await assert.rejects(
        () => datos.registrarPago({ prestamoId: prestamo.id, fecha: '2026-04-10', monto: 1000, interes: 1000, capital: 0, medio: 'efectivo' }),
        /anterior a la fecha del préstamo/,
      );
      await assert.rejects(() => datos.registrarPerdon({ prestamoId: prestamo.id, fecha: '2026-04-10', monto: 1000 }), /anterior a la fecha del préstamo/);
    });
  });

  describe('casos de prueba', () => {
    test('cargarCasos acepta una lista de casos con préstamos y pagos anidados', async () => {
      await datos.cargarCasos([
        {
          cliente: { id: 'ramiro', nombre: 'Ramiro Ejemplo' },
          prestamos: [
            {
              id: 'ramiro-a', fecha: '2026-04-11', capital: 1000000, tasa: 20, modalidad: 'interes_mensual',
              pagos: [
                { fecha: '2026-05-11', monto: 200000, interes: 200000, capital: 0, medio: 'efectivo' },
                { fecha: '2026-06-11', monto: 200000, interes: 200000, capital: 0, medio: 'efectivo' },
              ],
            },
            { id: 'ramiro-b', fecha: '2026-06-03', capital: 1000000, tasa: 20, modalidad: 'interes_mensual' },
          ],
        },
        {
          cliente: { id: 'ernesto', nombre: 'Ernesto Muestra', alias: 'Ernesto Empresa' },
          prestamos: [{
            id: 'ernesto-b', fecha: '2026-01-15', capital: 600000, tasa: 20,
            pagos: [{ tipo: 'perdon', fecha: '2026-02-15', monto: 20000 }],
          }],
        },
      ]);
      assert.equal(datos.listar('clientes').length, 2);
      assert.equal(datos.obtener('prestamos', 'ramiro-a').clienteId, 'ramiro');
      assert.equal(datos.listar('pagos', { prestamoId: 'ramiro-a' }).length, 2);
      assert.equal(datos.listar('pagos', { tipo: 'perdon' })[0].prestamoId, 'ernesto-b');
      assert.equal(saldo('efectivo'), -2600000 + 400000);
    });

    test('cargarCasos acepta un objeto con forma de estado y no pierde lo anterior si falla', async () => {
      await datos.agregarCliente({ nombre: 'Existente' });
      await assert.rejects(
        () => datos.cargarCasos({ clientes: [{ nombre: 'X' }], prestamos: [{ clienteId: 'nadie', fecha: HOY, capital: 1 }] }),
        /cliente existente/,
      );
      assert.equal(datos.listar('clientes')[0].nombre, 'Existente');

      await datos.cargarCasos({
        clientes: [{ id: 'c1', nombre: 'Marta' }],
        prestamos: [{ id: 'p1', clienteId: 'c1', fecha: '2024-09-26', capital: 606000, tasa: 0, modalidad: 'capital_primero', totalPactado: 1665000 }],
        pagos: [{ prestamoId: 'p1', fecha: '2024-10-26', monto: 40000, medio: 'efectivo' }],
      });
      assert.equal(datos.listar('clientes').length, 1);
      assert.equal(datos.listar('pagos')[0].capital, 40000);
    });
  });
});
