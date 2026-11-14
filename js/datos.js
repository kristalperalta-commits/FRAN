// datos.js — estado en memoria, persistencia, operaciones de dominio, exportar e importar.
// Dueño: agente datos. No toca el DOM. No depende del motor: las validaciones de aquí
// son de forma (montos, fechas, repartos, referencias); los cálculos viven en motor.js.
//
// Persistencia: IndexedDB (base 'mis-prestamos', almacén 'estado', clave 'actual') con
// copia en localStorage como respaldo. Si IndexedDB falla o no existe, se usa solo
// localStorage. Si nada funciona, la app sigue trabajando en memoria y avisa por consola.
// Si un guardado solo llega al respaldo, queda marcado para que al reabrir mande esa
// copia. Un estado guardado que no se puede usar se conserva aparte (clave 'no-usable')
// y se expone en `datos.almacenamiento.copiaNoUsable` para descargarlo desde Ajustes.
// La capa de almacenamiento se puede sustituir con `usarAlmacenamiento(...)`, por ejemplo
// con `crearAlmacenamientoMemoria()` en las pruebas.

export const VERSION_ACTUAL = 1;

const NOMBRE_BASE = 'mis-prestamos';
const NOMBRE_ALMACEN = 'estado';
const CLAVE_REGISTRO = 'actual';
const CLAVE_LOCAL = 'mis-prestamos:estado';
// Marca en localStorage: '1' cuando el último guardado solo llegó al respaldo, así al
// reabrir se sabe que la copia de localStorage es más nueva que la de IndexedDB.
const CLAVE_LOCAL_RESPALDO_MAS_NUEVO = 'mis-prestamos:respaldo-mas-nuevo';
// Copia de un estado guardado que no se pudo usar (dañado, inválido o de una versión
// más nueva). Se conserva aparte para que Ajustes permita descargarla.
const CLAVE_REGISTRO_NO_USABLE = 'no-usable';
const CLAVE_LOCAL_NO_USABLE = 'mis-prestamos:estado-no-usable';

const COLECCIONES = ['clientes', 'prestamos', 'pagos', 'movimientos'];
const TIPOS_CLIENTE = ['cliente', 'familia'];
const MODALIDADES = ['interes_mensual', 'capital_primero', 'sin_interes'];
const MEDIOS_PRESTAMO = ['efectivo', 'virtual'];
const MEDIOS_PAGO = ['efectivo', 'virtual', 'especie'];
const CAJAS = ['efectivo', 'virtual'];
const ORIGENES_FUENTE = ['caja_efectivo', 'caja_virtual', 'arriendo', 'esposo', 'pension', 'otro'];
const ORIGENES_APORTE = ['arriendo', 'esposo', 'pension', 'propio', 'otro'];
const ESTADOS_MANUALES = ['pagado', 'perdido', 'congelado', 'legal'];
const TIPOS_MOVIMIENTO_MANUAL = ['aporte', 'retiro', 'traslado', 'ganancia_a_personal', 'saldo_inicial'];
const TIPOS_MOVIMIENTO = ['prestamo', 'pago', ...TIPOS_MOVIMIENTO_MANUAL];

// ---------------------------------------------------------------------------
// Ayudas generales
// ---------------------------------------------------------------------------

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Respaldo para entornos sin crypto.randomUUID (muy raro hoy).
  let texto = '';
  for (let i = 0; i < 32; i++) texto += Math.floor(Math.random() * 16).toString(16);
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
}

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

// Fecha de hoy del teléfono como AAAA-MM-DD, sin pasar por UTC.
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasDelMes(anio, mes) {
  return [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

// Verdadero si el texto es una fecha real con forma AAAA-MM-DD.
export function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(5, 7));
  const dia = Number(texto.slice(8, 10));
  if (anio < 1900 || anio > 2200) return false;
  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasDelMes(anio, mes);
}

function esEnteroPositivo(n) {
  return Number.isInteger(n) && n > 0;
}

function esEnteroNoNegativo(n) {
  return Number.isInteger(n) && n >= 0;
}

function limpiarTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function textoONulo(valor) {
  const t = limpiarTexto(valor);
  return t === '' ? null : t;
}

function copiar(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

function exigirFecha(fecha, que) {
  exigir(esFechaValida(fecha), `La fecha ${que} no es válida. Usa el formato AAAA-MM-DD.`);
}

function exigirMonto(monto, que) {
  exigir(esEnteroPositivo(monto), `El ${que} debe ser un número entero en pesos, mayor que cero.`);
}

// ---------------------------------------------------------------------------
// Estado vacío, normalización y migraciones
// ---------------------------------------------------------------------------

// Los libros de Fran: movimientos por libro, pensión, terceros, tarjetas y deudas internas.
function franVacio() {
  return {
    asientos: [],
    virtualPorDefinir: false,
    pension: { tasa: 3700, cuentas: [], otros: [], origen: '' },
    terceros: [],
    tarjetas: [],
    deudasInternas: [],
    agenda: [],
    presupuestoMensual: 2000000,
    categoriasExtra: {},
    categoriasOcultas: {},
    recurrentes: [],
    recordatorios: { cobros: '07:00', gastos: '19:00' },
    propiedades: [],
    virtualMov: [],
    virtualHistorial: [],
    virtualCuentas: null,
    historicosBorrados: [],
    interesesSueltos: [],
    apartados: [],
    creditos: [],
    notas: [],
    conteos: [],
  };
}

/** Identifica un movimiento de Mis Gastos aunque cambie su número al cargar otros meses. */
function huellaAsiento(a) {
  return [a.fecha, a.libro, a.tipo, a.categoria, a.descripcion || '', a.valor].join('|');
}

/** Siguiente fecha de un movimiento recurrente. El día del mes se conserva cuando el mes lo tiene. */
export function siguienteRecurrente(fecha, frecuencia, dia) {
  const [a, m, d] = fecha.split('-').map(Number);
  const texto = (x) => x.toISOString().slice(0, 10);
  if (frecuencia === 'diario') return texto(new Date(Date.UTC(a, m - 1, d + 1)));
  if (frecuencia === 'semanal') return texto(new Date(Date.UTC(a, m - 1, d + 7)));
  if (frecuencia === 'quincenal') return texto(new Date(Date.UTC(a, m - 1, d + 15)));
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return texto(new Date(Date.UTC(a, m, Math.min(dia || d, ultimo))));
}

function completarFran(fran) {
  const base = franVacio();
  const f = fran && typeof fran === 'object' ? fran : {};
  const pension = f.pension && typeof f.pension === 'object' ? f.pension : {};
  const lista = (v) => (Array.isArray(v) ? v : []);
  return {
    asientos: lista(f.asientos).filter((a) => esFechaValida(a.fecha) && Number.isInteger(a.valor) && a.valor > 0),
    virtualPorDefinir: f.virtualPorDefinir === true,
    pension: {
      tasa: Number(pension.tasa) > 0 ? Number(pension.tasa) : base.pension.tasa,
      cuentas: lista(pension.cuentas),
      otros: lista(pension.otros),
      origen: typeof pension.origen === 'string' ? pension.origen : '',
    },
    terceros: lista(f.terceros),
    tarjetas: lista(f.tarjetas),
    deudasInternas: lista(f.deudasInternas),
    agenda: lista(f.agenda),
    presupuestoMensual: Number(f.presupuestoMensual) > 0 ? Number(f.presupuestoMensual) : base.presupuestoMensual,
    categoriasExtra: f.categoriasExtra && typeof f.categoriasExtra === 'object' ? f.categoriasExtra : {},
    categoriasOcultas: f.categoriasOcultas && typeof f.categoriasOcultas === 'object' ? f.categoriasOcultas : {},
    recurrentes: lista(f.recurrentes).filter((r) => r && r.id && esFechaValida(r.proxima) && Number.isInteger(r.valor) && r.valor > 0),
    recordatorios: {
      cobros: /^\d\d:\d\d$/.test(f.recordatorios && f.recordatorios.cobros) ? f.recordatorios.cobros : base.recordatorios.cobros,
      gastos: /^\d\d:\d\d$/.test(f.recordatorios && f.recordatorios.gastos) ? f.recordatorios.gastos : base.recordatorios.gastos,
    },
    propiedades: lista(f.propiedades).filter((p) => p && p.nombre),
    virtualMov: lista(f.virtualMov).filter((m) => m && m.id && esFechaValida(m.fecha) && Number.isInteger(m.valor) && m.valor > 0 && (m.tipo === 'entra' || m.tipo === 'sale')),
    virtualHistorial: lista(f.virtualHistorial),
    virtualCuentas: f.virtualCuentas && Number.isInteger(f.virtualCuentas.valor) ? f.virtualCuentas : null,
    historicosBorrados: lista(f.historicosBorrados).filter((h) => typeof h === 'string'),
    // Intereses que alguien debe sin préstamo de capital en Fran (por ejemplo, del Excel sin capital).
    interesesSueltos: lista(f.interesesSueltos).filter((x) => x && x.id && x.nombre && Number.isInteger(x.valor) && x.valor > 0),
    // Créditos que ella saca con un banco para prestar aparte del negocio (ej. Banco de Bogotá, 3 nov 2026).
    // Plata del efectivo que ella tiene separada (ej. un pago que no es para gastar). No cambia el saldo.
    apartados: lista(f.apartados).filter((x) => x && x.id && x.nombre && Number.isInteger(x.valor) && x.valor > 0),
    creditos: lista(f.creditos).filter((c) => c && c.id && Number.isInteger(c.monto) && c.monto > 0)
      .map((c) => ({ ...c, movimientos: lista(c.movimientos).filter((m) => m && m.id && esFechaValida(m.fecha) && Number.isInteger(m.valor) && m.valor > 0), plan: lista(c.plan) })),
    // Libreta: lo que ella anota rápido en texto para pasarlo después a su categoría.
    notas: lista(f.notas).filter((n) => n && n.id && typeof n.texto === 'string' && n.texto.trim()),
    // Las veces que ella contó la plata en la mano (3.40.0): fecha, lo contado y lo que Fran decía.
    conteos: lista(f.conteos).filter((x) => x && x.id && esFechaValida(x.fecha) && Number.isInteger(x.contado) && x.contado >= 0 && Number.isInteger(x.debia)),
  };
}

export function estadoVacio() {
  return {
    version: VERSION_ACTUAL,
    clientes: [],
    prestamos: [],
    pagos: [],
    movimientos: [],
    config: { nombreNegocio: 'Fran' },
    fran: franVacio(),
    // Lo que se borró aquí, con su momento ("coleccion:id" → ISO). Viaja a la nube para que
    // el otro aparato no lo reviva al juntar los datos (3.45.0).
    borrados: {},
  };
}

// Migraciones por versión de origen. Cada una recibe el estado y devuelve el estado
// con `version` aumentada en uno. Al crear la versión 2 se agrega `1(estado) {...}`.
const MIGRACIONES = {
  // Datos sin versión (anteriores a la versión 1): solo se asegura la forma básica.
  0(estado) {
    return { ...estado, version: 1 };
  },
};

function migrar(estado) {
  let actual = estado;
  let version = Number.isInteger(actual.version) ? actual.version : 0;
  exigir(
    version <= VERSION_ACTUAL,
    `Esta copia es de una versión más nueva de la app (versión ${version}). Actualiza la app antes de importarla.`,
  );
  while (version < VERSION_ACTUAL) {
    const migracion = MIGRACIONES[version];
    exigir(migracion, `No hay forma de migrar los datos desde la versión ${version}.`);
    actual = migracion(actual);
    exigir(actual.version === version + 1, `La migración desde la versión ${version} no avanzó.`);
    version = actual.version;
  }
  return actual;
}

// Completa campos faltantes sin validar; se usa al cargar o importar para que datos
// de versiones viejas o editados a mano no rompan las pantallas.
function completarEstado(estado) {
  const base = estadoVacio();
  const resultado = {
    version: VERSION_ACTUAL,
    clientes: [],
    prestamos: [],
    pagos: [],
    movimientos: [],
    config: { ...base.config, ...(estado.config && typeof estado.config === 'object' ? estado.config : {}) },
  };
  resultado.config.nombreNegocio = limpiarTexto(resultado.config.nombreNegocio) || base.config.nombreNegocio;

  for (const c of Array.isArray(estado.clientes) ? estado.clientes : []) {
    resultado.clientes.push({
      id: limpiarTexto(c.id) || generarId(),
      nombre: limpiarTexto(c.nombre),
      alias: limpiarTexto(c.alias),
      telefono: limpiarTexto(c.telefono),
      cedula: limpiarTexto(c.cedula),
      direccion: limpiarTexto(c.direccion),
      nota: limpiarTexto(c.nota),
      grupo: limpiarTexto(c.grupo),
      tipo: TIPOS_CLIENTE.includes(c.tipo) ? c.tipo : 'cliente',
      creadoEn: esFechaValida(c.creadoEn) ? c.creadoEn : hoy(),
    });
  }
  for (const p of Array.isArray(estado.prestamos) ? estado.prestamos : []) {
    const medio = MEDIOS_PRESTAMO.includes(p.medio) ? p.medio : 'efectivo';
    const fuentes = Array.isArray(p.fuentes) && p.fuentes.length > 0
      ? p.fuentes.map((f) => ({ origen: f.origen, monto: f.monto, nota: limpiarTexto(f.nota) }))
      : [{ origen: `caja_${medio}`, monto: p.capital, nota: '' }];
    resultado.prestamos.push({
      id: limpiarTexto(p.id) || generarId(),
      clienteId: limpiarTexto(p.clienteId),
      fecha: p.fecha,
      capital: p.capital,
      tasa: typeof p.tasa === 'number' ? p.tasa : 0,
      modalidad: MODALIDADES.includes(p.modalidad) ? p.modalidad : 'interes_mensual',
      totalPactado: p.totalPactado ?? null,
      plazoMeses: p.plazoMeses ?? null,
      topeInteres: p.topeInteres ?? null,
      medio,
      fuentes,
      garantia: limpiarTexto(p.garantia),
      estadoManual: ESTADOS_MANUALES.includes(p.estadoManual) ? p.estadoManual : null,
      fechaEstado: esFechaValida(p.fechaEstado) ? p.fechaEstado : null,
      acuerdo: p.acuerdo && typeof p.acuerdo === 'object' && esFechaValida(p.acuerdo.fecha)
        ? { fecha: p.acuerdo.fecha, texto: limpiarTexto(p.acuerdo.texto) }
        : null,
      nota: limpiarTexto(p.nota),
      ...(p.porConfirmar && typeof p.porConfirmar === 'object' ? { porConfirmar: p.porConfirmar } : {}),
      ...(Array.isArray(p.detalle) ? { detalle: p.detalle } : {}),
      ...(p.acuerdoTexto ? { acuerdoTexto: limpiarTexto(p.acuerdoTexto) } : {}),
      ...(limpiarTexto(p.nombreExcel) ? { nombreExcel: limpiarTexto(p.nombreExcel) } : {}),
      ...(esFechaValida(p.interesesPagadosHasta) ? { interesesPagadosHasta: p.interesesPagadosHasta } : {}),
      creadoEn: esFechaValida(p.creadoEn) ? p.creadoEn : hoy(),
    });
  }
  for (const g of Array.isArray(estado.pagos) ? estado.pagos : []) {
    resultado.pagos.push({
      id: limpiarTexto(g.id) || generarId(),
      prestamoId: limpiarTexto(g.prestamoId),
      clienteId: limpiarTexto(g.clienteId),
      fecha: g.fecha,
      tipo: g.tipo === 'perdon' ? 'perdon' : 'pago',
      monto: g.monto,
      interes: g.interes,
      capital: g.capital,
      medio: g.tipo === 'perdon' ? null : (MEDIOS_PAGO.includes(g.medio) ? g.medio : 'efectivo'),
      descripcion: limpiarTexto(g.descripcion),
      nota: limpiarTexto(g.nota),
      creadoEn: esFechaValida(g.creadoEn) ? g.creadoEn : hoy(),
    });
  }
  for (const m of Array.isArray(estado.movimientos) ? estado.movimientos : []) {
    resultado.movimientos.push({
      id: limpiarTexto(m.id) || generarId(),
      fecha: m.fecha,
      caja: m.caja,
      tipo: m.tipo,
      monto: m.monto,
      signo: m.signo === -1 ? -1 : 1,
      origen: limpiarTexto(m.origen),
      prestamoId: textoONulo(m.prestamoId),
      pagoId: textoONulo(m.pagoId),
      parId: textoONulo(m.parId),
      nota: limpiarTexto(m.nota),
      creadoEn: esFechaValida(m.creadoEn) ? m.creadoEn : hoy(),
      ...(typeof m.creadoHora === 'string' && m.creadoHora.length > 10 ? { creadoHora: m.creadoHora } : {}),
    });
  }
  emparejarTraslados(resultado.movimientos);
  resultado.fran = completarFran(estado.fran);
  resultado.borrados = {};
  if (estado.borrados && typeof estado.borrados === 'object' && !Array.isArray(estado.borrados)) {
    for (const [clave, cuando] of Object.entries(estado.borrados)) {
      if (typeof clave === 'string' && clave.includes(':') && typeof cuando === 'string' && cuando) resultado.borrados[clave] = cuando;
    }
  }
  return resultado;
}

// Dos movimientos son las dos mitades de un mismo traslado si tienen la misma fecha,
// el mismo monto, la misma fecha de creación, signos opuestos y cajas distintas.
function sonMitadesDeTraslado(a, b) {
  return coincidenMitadesDeTraslado(a, b) && a.creadoEn === b.creadoEn;
}

// Lo mínimo para que dos movimientos puedan ser un traslado: mismo tipo, fecha y monto,
// signos opuestos y cajas distintas (sin exigir la misma fecha de creación).
function coincidenMitadesDeTraslado(a, b) {
  return a !== b
    && a.tipo === 'traslado' && b.tipo === 'traslado'
    && a.fecha === b.fecha
    && a.monto === b.monto
    && a.signo === -b.signo
    && a.caja !== b.caja;
}

// Busca la otra mitad de un traslado: por `parId` si lo tiene; si no (copia hecha a
// mano o por otra herramienta), por los campos de `sonMitadesDeTraslado` entre los
// traslados que todavía no tienen pareja.
function contraparteDeTraslado(movimiento, movimientos) {
  if (movimiento.parId) return movimientos.find((m) => m.id === movimiento.parId) || null;
  return movimientos.find((m) => !m.parId && sonMitadesDeTraslado(movimiento, m)) || null;
}

// Asigna `parId` a los traslados que vienen sin él. Los que no encuentran pareja se
// quedan sin `parId` y los rechaza `validarEstado`.
function emparejarTraslados(movimientos) {
  for (const m of movimientos) {
    if (m.tipo !== 'traslado' || m.parId) continue;
    const pareja = contraparteDeTraslado(m, movimientos);
    if (!pareja) continue;
    m.parId = pareja.id;
    pareja.parId = m.id;
  }
}

// Revisa que un estado completo sea coherente. Lanza Error con el primer problema.
function validarEstado(estado) {
  const clientes = new Set();
  for (const c of estado.clientes) {
    exigir(c.nombre, `Hay un cliente sin nombre (id ${c.id}).`);
    exigir(!clientes.has(c.id), `Hay dos clientes con el mismo id (${c.id}).`);
    clientes.add(c.id);
  }
  const prestamos = new Set();
  for (const p of estado.prestamos) {
    exigir(!prestamos.has(p.id), `Hay dos préstamos con el mismo id (${p.id}).`);
    prestamos.add(p.id);
    exigir(clientes.has(p.clienteId), `El préstamo ${p.id} apunta a un cliente que no existe.`);
    exigirFecha(p.fecha, `del préstamo ${p.id}`);
    exigirMonto(p.capital, `capital del préstamo ${p.id}`);
    validarFuentes(p.fuentes, p.capital);
  }
  const pagos = new Set();
  for (const g of estado.pagos) {
    exigir(!pagos.has(g.id), `Hay dos pagos con el mismo id (${g.id}).`);
    pagos.add(g.id);
    exigir(prestamos.has(g.prestamoId), `El pago ${g.id} apunta a un préstamo que no existe.`);
    exigirFecha(g.fecha, `del pago ${g.id}`);
    exigirMonto(g.monto, `monto del pago ${g.id}`);
    exigir(esEnteroNoNegativo(g.interes) && esEnteroNoNegativo(g.capital), `El pago ${g.id} tiene un reparto inválido.`);
    exigir(g.interes + g.capital === g.monto, `En el pago ${g.id} interés más capital no suma el monto.`);
  }
  const movimientos = new Set();
  for (const m of estado.movimientos) {
    exigir(!movimientos.has(m.id), `Hay dos movimientos con el mismo id (${m.id}).`);
    movimientos.add(m.id);
    exigir(CAJAS.includes(m.caja), `El movimiento ${m.id} tiene una caja desconocida.`);
    exigir(TIPOS_MOVIMIENTO.includes(m.tipo), `El movimiento ${m.id} tiene un tipo desconocido.`);
    exigirFecha(m.fecha, `del movimiento ${m.id}`);
    exigirMonto(m.monto, `monto del movimiento ${m.id}`);
    exigir(!m.prestamoId || prestamos.has(m.prestamoId), `El movimiento ${m.id} apunta a un préstamo que no existe.`);
    exigir(!m.pagoId || pagos.has(m.pagoId), `El movimiento ${m.id} apunta a un pago que no existe.`);
  }
  // Un traslado son dos mitades que se borran juntas: cada una debe conocer a la otra.
  for (const m of estado.movimientos) {
    if (m.tipo !== 'traslado') continue;
    exigir(m.parId, `El traslado ${m.id} (${m.fecha}, ${m.monto}) no tiene su otra mitad en la otra caja.`);
    const pareja = estado.movimientos.find((x) => x.id === m.parId);
    exigir(
      pareja && pareja.parId === m.id && coincidenMitadesDeTraslado(m, pareja),
      `El traslado ${m.id} apunta a una contraparte que no existe o no coincide (fecha, monto, caja o signo).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Capa de almacenamiento
// Interfaz: { nombre, async leer() → texto | null, async guardar(texto), async borrar() }
// Opcionales, para conservar aparte una copia que no se pudo usar:
//   async leerNoUsable() → texto | null, async guardarNoUsable(texto), async borrarNoUsable()
// ---------------------------------------------------------------------------

let almacenamiento = null;

// Sustituye la capa de almacenamiento (pruebas, u otro medio en el futuro).
export function usarAlmacenamiento(nuevo) {
  exigir(nuevo && typeof nuevo.leer === 'function' && typeof nuevo.guardar === 'function', 'La capa de almacenamiento necesita leer() y guardar().');
  almacenamiento = nuevo;
}

// Almacenamiento en memoria: para pruebas. Vive mientras exista el objeto.
export function crearAlmacenamientoMemoria() {
  let texto = null;
  let textoNoUsable = null;
  return {
    nombre: 'memoria',
    async leer() { return texto; },
    async guardar(nuevo) { texto = nuevo; },
    async borrar() { texto = null; },
    async leerNoUsable() { return textoNoUsable; },
    async guardarNoUsable(nuevo) { textoNoUsable = nuevo; },
    async borrarNoUsable() { textoNoUsable = null; },
  };
}

function abrirBase() {
  return new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(NOMBRE_BASE, 1);
    solicitud.onupgradeneeded = () => {
      const base = solicitud.result;
      if (!base.objectStoreNames.contains(NOMBRE_ALMACEN)) base.createObjectStore(NOMBRE_ALMACEN);
    };
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error || new Error('No se pudo abrir IndexedDB.'));
    solicitud.onblocked = () => rechazar(new Error('IndexedDB está bloqueada por otra pestaña.'));
  });
}

function operarBase(modo, accion) {
  return abrirBase().then((base) => new Promise((resolver, rechazar) => {
    let resultado;
    try {
      const transaccion = base.transaction(NOMBRE_ALMACEN, modo);
      const almacen = transaccion.objectStore(NOMBRE_ALMACEN);
      const solicitud = accion(almacen);
      solicitud.onsuccess = () => { resultado = solicitud.result; };
      solicitud.onerror = () => rechazar(solicitud.error || new Error('Falló la operación en IndexedDB.'));
      transaccion.oncomplete = () => { base.close(); resolver(resultado); };
      transaccion.onabort = () => { base.close(); rechazar(transaccion.error || new Error('Se canceló la operación en IndexedDB.')); };
      transaccion.onerror = () => { rechazar(transaccion.error || new Error('Falló la transacción en IndexedDB.')); };
    } catch (error) {
      base.close();
      rechazar(error);
    }
  }));
}

// Almacenamiento del navegador: IndexedDB con copia en localStorage. Se exporta para
// poder probarlo con un indexedDB y un localStorage falsos.
//
// Cuál copia manda al leer: la de IndexedDB, salvo que el último guardado solo haya
// llegado a localStorage (marca CLAVE_LOCAL_RESPALDO_MAS_NUEVO). En ese caso manda la
// de localStorage y se vuelve a escribir en IndexedDB. Un guardado que solo llega al
// respaldo lanza error para que quede anotado y Ajustes avise.
export function crearAlmacenamientoNavegador() {
  const hayIndexedDB = typeof indexedDB !== 'undefined' && indexedDB !== null;
  let hayLocal = false;
  try {
    hayLocal = typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    hayLocal = false;
  }

  const local = {
    leer(clave = CLAVE_LOCAL) {
      try { return hayLocal ? localStorage.getItem(clave) : null; } catch { return null; }
    },
    guardar(texto, clave = CLAVE_LOCAL) {
      try {
        if (!hayLocal) return false;
        localStorage.setItem(clave, texto);
        return true;
      } catch {
        return false;
      }
    },
    borrar(clave = CLAVE_LOCAL) {
      try { if (hayLocal) localStorage.removeItem(clave); } catch { /* sin importancia */ }
    },
    respaldoEsMasNuevo() {
      return local.leer(CLAVE_LOCAL_RESPALDO_MAS_NUEVO) === '1';
    },
  };

  async function leerDeBase(clave) {
    const texto = await operarBase('readonly', (almacen) => almacen.get(clave));
    return typeof texto === 'string' && texto !== '' ? texto : null;
  }

  async function escribirEnBase(texto, clave) {
    await operarBase('readwrite', (almacen) => almacen.put(texto, clave));
  }

  return {
    nombre: hayIndexedDB ? 'indexeddb' : (hayLocal ? 'localstorage' : 'ninguno'),

    async leer() {
      const textoLocal = local.leer();
      if (!hayIndexedDB) return textoLocal;

      // El último guardado no llegó a IndexedDB: manda el respaldo y se repara la base.
      if (textoLocal !== null && local.respaldoEsMasNuevo()) {
        try {
          await escribirEnBase(textoLocal, CLAVE_REGISTRO);
          local.borrar(CLAVE_LOCAL_RESPALDO_MAS_NUEVO);
        } catch (error) {
          console.warn('No se pudo pasar la copia de respaldo a IndexedDB; se sigue con el respaldo.', error);
        }
        return textoLocal;
      }

      try {
        const texto = await leerDeBase(CLAVE_REGISTRO);
        if (texto !== null) return texto;
      } catch (error) {
        console.warn('No se pudo leer de IndexedDB; se usa la copia de respaldo.', error);
      }
      return textoLocal;
    },

    async guardar(texto) {
      let errorBase = null;
      if (hayIndexedDB) {
        try {
          await escribirEnBase(texto, CLAVE_REGISTRO);
        } catch (error) {
          errorBase = error;
          console.warn('No se pudo guardar en IndexedDB; se intenta el respaldo.', error);
        }
      }
      const enLocal = local.guardar(texto);

      if (hayIndexedDB && errorBase === null) {
        // IndexedDB tiene lo último: ya no manda el respaldo.
        local.borrar(CLAVE_LOCAL_RESPALDO_MAS_NUEVO);
        return;
      }
      exigir(enLocal, 'No se pudo guardar en el teléfono. Exporta una copia desde Ajustes.');
      if (hayIndexedDB) {
        // Solo llegó al respaldo: se marca para que al reabrir mande esa copia, y se
        // lanza para que el error quede anotado y Ajustes avise.
        local.guardar('1', CLAVE_LOCAL_RESPALDO_MAS_NUEVO);
        throw new Error(`Se guardó solo en la copia de respaldo del navegador (${errorBase && errorBase.message ? errorBase.message : 'falló IndexedDB'}). Exporta una copia desde Ajustes.`);
      }
    },

    async borrar() {
      if (hayIndexedDB) {
        try { await operarBase('readwrite', (almacen) => almacen.delete(CLAVE_REGISTRO)); } catch { /* ya se avisó al guardar */ }
      }
      local.borrar();
      local.borrar(CLAVE_LOCAL_RESPALDO_MAS_NUEVO);
    },

    // Copia aparte de un estado que no se pudo usar. Se intenta en los dos lados;
    // localStorage suele tener menos espacio, por eso IndexedDB va primero.
    async leerNoUsable() {
      if (hayIndexedDB) {
        try {
          const texto = await leerDeBase(CLAVE_REGISTRO_NO_USABLE);
          if (texto !== null) return texto;
        } catch { /* se mira el respaldo */ }
      }
      return local.leer(CLAVE_LOCAL_NO_USABLE);
    },

    async guardarNoUsable(texto) {
      let enBase = false;
      if (hayIndexedDB) {
        try {
          await escribirEnBase(texto, CLAVE_REGISTRO_NO_USABLE);
          enBase = true;
        } catch (error) {
          console.warn('No se pudo conservar en IndexedDB la copia que no se pudo usar.', error);
        }
      }
      const enLocal = local.guardar(texto, CLAVE_LOCAL_NO_USABLE);
      exigir(enBase || enLocal, 'No se pudo conservar en el teléfono la copia que no se pudo usar.');
    },

    async borrarNoUsable() {
      if (hayIndexedDB) {
        try { await operarBase('readwrite', (almacen) => almacen.delete(CLAVE_REGISTRO_NO_USABLE)); } catch { /* sin importancia */ }
      }
      local.borrar(CLAVE_LOCAL_NO_USABLE);
    },
  };
}

function obtenerAlmacenamiento() {
  if (!almacenamiento) almacenamiento = crearAlmacenamientoNavegador();
  return almacenamiento;
}

// ---------------------------------------------------------------------------
// Estado en memoria, guardado y suscriptores
// ---------------------------------------------------------------------------

let estadoActual = estadoVacio();
const suscriptores = new Set();
let colaGuardado = Promise.resolve();
let ultimoErrorGuardado = null;
// Texto de un estado guardado que no se pudo usar al cargar, y el error que lo explica.
// Se conserva para que Ajustes permita descargarlo; nunca se pisa con un guardado normal.
let textoNoUsable = null;
let errorCarga = null;

// Guarda aparte un estado que no se pudo usar. Si una copia conservada ya existe, se
// respeta: es la que tenía los datos reales antes de que la app arrancara vacía.
async function conservarNoUsable(texto, error) {
  errorCarga = error;
  const almacen = obtenerAlmacenamiento();
  if (textoNoUsable === null && typeof almacen.leerNoUsable === 'function') {
    try { textoNoUsable = await almacen.leerNoUsable(); } catch { textoNoUsable = null; }
  }
  if (textoNoUsable !== null && textoNoUsable !== texto) return;
  textoNoUsable = texto;
  if (typeof almacen.guardarNoUsable === 'function') {
    try {
      await almacen.guardarNoUsable(texto);
    } catch (errorConservar) {
      console.error('No se pudo conservar la copia que no se pudo usar; solo queda en memoria hasta cerrar la app.', errorConservar);
    }
  }
}

// Ids de todo lo que tiene id: las cuatro colecciones y las listas de fran.
function idsDe(estado) {
  const ids = new Set();
  for (const c of COLECCIONES) for (const x of estado[c] || []) if (x && x.id) ids.add(`${c}:${x.id}`);
  const fran = estado.fran || {};
  for (const k of Object.keys(fran)) {
    if (!Array.isArray(fran[k])) continue;
    for (const x of fran[k]) if (x && typeof x === 'object' && x.id) ids.add(`fran.${k}:${x.id}`);
  }
  return ids;
}

// Ids que había la última vez que se cargó o guardó. null = el estado se reemplazó entero
// (importar, bajar de la nube, borrar todo): ahí lo que falta no es un borrado de ella.
let idsBase = null;

function anotarBorrados() {
  const ahora = idsDe(estadoActual);
  if (!estadoActual.borrados || typeof estadoActual.borrados !== 'object') estadoActual.borrados = {};
  if (idsBase) {
    const cuando = new Date().toISOString();
    for (const clave of idsBase) if (!ahora.has(clave)) estadoActual.borrados[clave] = cuando;
  }
  for (const clave of Object.keys(estadoActual.borrados)) if (ahora.has(clave)) delete estadoActual.borrados[clave];
  idsBase = ahora;
}

function avisarSuscriptores() {
  for (const fn of suscriptores) {
    try { fn(); } catch (error) { console.error('Error en un suscriptor de datos:', error); }
  }
}

// Serializa el estado entero y lo guarda. Los guardados se encolan para que nunca se
// escriba uno viejo encima de uno nuevo. Un fallo de almacenamiento no lanza: se anota
// en `ultimoErrorGuardado` y la app sigue con lo que tiene en memoria.
function guardar() {
  anotarBorrados();
  const texto = JSON.stringify(estadoActual);
  colaGuardado = colaGuardado.then(async () => {
    try {
      await obtenerAlmacenamiento().guardar(texto);
      ultimoErrorGuardado = null;
    } catch (error) {
      ultimoErrorGuardado = error;
      console.error('No se pudo guardar el estado:', error);
    }
    avisarSuscriptores();
  });
  return colaGuardado;
}

function buscar(coleccion, id) {
  return estadoActual[coleccion].find((x) => x.id === id) || null;
}

function exigirColeccion(coleccion) {
  exigir(COLECCIONES.includes(coleccion), `No existe la colección "${coleccion}".`);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

function armarCliente(datosCliente, existente) {
  exigir(datosCliente && typeof datosCliente === 'object', 'Faltan los datos del cliente.');
  const nombre = limpiarTexto(datosCliente.nombre ?? existente?.nombre);
  exigir(nombre !== '', 'El nombre del cliente es obligatorio.');
  const tipo = datosCliente.tipo ?? existente?.tipo ?? 'cliente';
  exigir(TIPOS_CLIENTE.includes(tipo), 'El tipo de cliente debe ser "cliente" o "familia".');
  const creadoEn = datosCliente.creadoEn ?? existente?.creadoEn ?? hoy();
  exigirFecha(creadoEn, 'de creación del cliente');
  return {
    id: limpiarTexto(datosCliente.id) || existente?.id || generarId(),
    nombre,
    alias: limpiarTexto(datosCliente.alias ?? existente?.alias),
    telefono: limpiarTexto(datosCliente.telefono ?? existente?.telefono),
    cedula: limpiarTexto(datosCliente.cedula ?? existente?.cedula),
    direccion: limpiarTexto(datosCliente.direccion ?? existente?.direccion),
    nota: limpiarTexto(datosCliente.nota ?? existente?.nota),
    grupo: limpiarTexto(datosCliente.grupo ?? existente?.grupo),
    tipo,
    creadoEn,
  };
}

function insertarCliente(datosCliente) {
  const cliente = armarCliente(datosCliente, null);
  exigir(!buscar('clientes', cliente.id), `Ya existe un cliente con el id ${cliente.id}.`);
  estadoActual.clientes.push(cliente);
  return cliente;
}

function cambiarCliente(datosCliente) {
  exigir(datosCliente && datosCliente.id, 'Falta el id del cliente que quieres actualizar.');
  const indice = estadoActual.clientes.findIndex((c) => c.id === datosCliente.id);
  exigir(indice >= 0, 'No se encontró el cliente que quieres actualizar.');
  const cliente = armarCliente(datosCliente, estadoActual.clientes[indice]);
  estadoActual.clientes[indice] = cliente;
  return cliente;
}

function quitarCliente(id) {
  const cliente = buscar('clientes', id);
  exigir(cliente, 'No se encontró el cliente que quieres eliminar.');
  const cuantos = estadoActual.prestamos.filter((p) => p.clienteId === id).length;
  exigir(
    cuantos === 0,
    `No se puede eliminar a ${cliente.nombre}: tiene ${cuantos === 1 ? 'un préstamo registrado' : `${cuantos} préstamos registrados`}.`,
  );
  estadoActual.clientes = estadoActual.clientes.filter((c) => c.id !== id);
  return cliente;
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

function validarFuentes(fuentes, capital) {
  exigir(Array.isArray(fuentes) && fuentes.length > 0, 'El préstamo necesita al menos una fuente de la plata.');
  let suma = 0;
  for (const fuente of fuentes) {
    exigir(fuente && ORIGENES_FUENTE.includes(fuente.origen), `La fuente "${fuente && fuente.origen}" no es válida. Usa caja_efectivo, caja_virtual, arriendo, esposo, pension u otro.`);
    exigirMonto(fuente.monto, 'monto de cada fuente');
    suma += fuente.monto;
  }
  exigir(suma === capital, `Las fuentes suman ${suma} y el capital es ${capital}. Deben ser iguales.`);
}

function normalizarFuentes(fuentes, medio, capital) {
  if (fuentes === undefined || fuentes === null || (Array.isArray(fuentes) && fuentes.length === 0)) {
    return [{ origen: `caja_${medio}`, monto: capital, nota: '' }];
  }
  exigir(Array.isArray(fuentes), 'Las fuentes deben ser una lista.');
  const lista = fuentes.map((f) => ({
    origen: f && f.origen,
    monto: f && f.monto,
    nota: limpiarTexto(f && f.nota),
  }));
  validarFuentes(lista, capital);
  return lista;
}

function enteroOpcional(valor, que, minimo = 1) {
  if (valor === undefined || valor === null || valor === '') return null;
  exigir(Number.isInteger(valor) && valor >= minimo, `El ${que} debe ser un número entero${minimo > 0 ? ' mayor que cero' : ''}.`);
  return valor;
}

function armarPrestamo(datosPrestamo, existente) {
  exigir(datosPrestamo && typeof datosPrestamo === 'object', 'Faltan los datos del préstamo.');
  const clienteId = limpiarTexto(datosPrestamo.clienteId ?? existente?.clienteId);
  const cliente = buscar('clientes', clienteId);
  exigir(cliente, 'El préstamo debe pertenecer a un cliente existente.');

  const fecha = datosPrestamo.fecha ?? existente?.fecha;
  exigirFecha(fecha, 'del préstamo');
  if (!existente || fecha !== existente.fecha) exigir(fecha <= hoy(), 'La fecha del préstamo no puede ser de un día que todavía no llega. Revise el día, el mes y el año.');
  const capital = datosPrestamo.capital ?? existente?.capital;
  exigirMonto(capital, 'capital');

  const modalidad = datosPrestamo.modalidad ?? existente?.modalidad ?? (cliente.tipo === 'familia' ? 'sin_interes' : 'interes_mensual');
  exigir(MODALIDADES.includes(modalidad), 'La modalidad debe ser interés mensual, capital primero o sin interés.');

  let tasa = datosPrestamo.tasa ?? existente?.tasa ?? (modalidad === 'sin_interes' ? 0 : null);
  if (modalidad === 'sin_interes') tasa = 0;
  exigir(typeof tasa === 'number' && Number.isFinite(tasa) && tasa >= 0, 'La tasa debe ser un número de por ciento mensual, cero o mayor.');

  const medio = datosPrestamo.medio ?? existente?.medio ?? 'efectivo';
  exigir(MEDIOS_PRESTAMO.includes(medio), 'El medio de entrega debe ser efectivo o virtual.');

  let fuentesEntrada = datosPrestamo.fuentes !== undefined ? datosPrestamo.fuentes : existente?.fuentes;
  if (datosPrestamo.fuentes === undefined && existente && capital !== existente.capital) {
    // Corrigen el capital sin tocar las fuentes: si era una sola, se ajusta sola.
    exigir(existente.fuentes.length === 1, 'Al cambiar el capital de un préstamo con varias fuentes debes indicar de nuevo las fuentes.');
    fuentesEntrada = [{ ...existente.fuentes[0], monto: capital }];
  }
  const fuentes = normalizarFuentes(fuentesEntrada, medio, capital);

  const totalPactado = modalidad === 'capital_primero'
    ? enteroOpcional(datosPrestamo.totalPactado ?? existente?.totalPactado, 'total pactado')
    : null;
  if (totalPactado !== null) {
    exigir(totalPactado >= capital, 'El total pactado no puede ser menor que el capital.');
  }
  const plazoMeses = enteroOpcional(datosPrestamo.plazoMeses ?? existente?.plazoMeses, 'plazo en meses');
  const topeInteres = modalidad === 'interes_mensual'
    ? enteroOpcional(datosPrestamo.topeInteres ?? existente?.topeInteres, 'tope de intereses')
    : null;

  const estadoManual = datosPrestamo.estadoManual !== undefined ? datosPrestamo.estadoManual : (existente?.estadoManual ?? null);
  exigir(estadoManual === null || ESTADOS_MANUALES.includes(estadoManual), 'El estado manual debe ser pagado, perdido, congelado, legal o ninguno.');
  let fechaEstado = datosPrestamo.fechaEstado !== undefined ? datosPrestamo.fechaEstado : (existente?.fechaEstado ?? null);
  if (estadoManual === null) {
    fechaEstado = null;
  } else {
    if (!fechaEstado) fechaEstado = hoy();
    exigirFecha(fechaEstado, 'del cambio de estado');
  }

  let acuerdo = datosPrestamo.acuerdo !== undefined ? datosPrestamo.acuerdo : (existente?.acuerdo ?? null);
  if (acuerdo && typeof acuerdo === 'object') {
    exigirFecha(acuerdo.fecha, 'del acuerdo de pago');
    acuerdo = { fecha: acuerdo.fecha, texto: limpiarTexto(acuerdo.texto) };
  } else {
    acuerdo = null;
  }

  const creadoEn = datosPrestamo.creadoEn ?? existente?.creadoEn ?? hoy();
  exigirFecha(creadoEn, 'de creación del préstamo');

  const acuerdoTexto = limpiarTexto(datosPrestamo.acuerdoTexto ?? existente?.acuerdoTexto);
  const detalle = datosPrestamo.detalle ?? existente?.detalle;
  // El nombre que traía en el Excel se conserva. "Por confirmar" se quita: al corregirlo, ella lo confirma.
  const nombreExcel = limpiarTexto(datosPrestamo.nombreExcel ?? existente?.nombreExcel);
  // "Pagó los intereses hasta tal día": desde ahí corren los meses de interés.
  const interesesPagadosHasta = datosPrestamo.interesesPagadosHasta !== undefined ? datosPrestamo.interesesPagadosHasta : (existente?.interesesPagadosHasta ?? null);
  if (interesesPagadosHasta) {
    exigirFecha(interesesPagadosHasta, 'hasta la que pagó intereses');
    exigir(interesesPagadosHasta >= fecha, 'La fecha hasta la que pagó intereses no puede ser anterior al préstamo.');
  }
  // "Por confirmar" se conserva al editar la nota o el estado. Al corregir la fecha o la tasa se quita solo esa parte.
  let porConfirmar = datosPrestamo.porConfirmar !== undefined ? datosPrestamo.porConfirmar : (existente?.porConfirmar ?? null);
  if (porConfirmar && typeof porConfirmar === 'object' && existente) {
    const queda = { ...porConfirmar };
    if (fecha !== existente.fecha) delete queda.fecha;
    if (tasa !== existente.tasa) delete queda.tasa;
    porConfirmar = Object.keys(queda).some((k) => queda[k]) ? queda : null;
  }
  return {
    ...(porConfirmar && typeof porConfirmar === 'object' ? { porConfirmar } : {}),
    ...(acuerdoTexto ? { acuerdoTexto } : {}),
    ...(Array.isArray(detalle) ? { detalle } : {}),
    ...(nombreExcel ? { nombreExcel } : {}),
    ...(interesesPagadosHasta ? { interesesPagadosHasta } : {}),
    id: limpiarTexto(datosPrestamo.id) || existente?.id || generarId(),
    clienteId,
    fecha,
    capital,
    tasa,
    modalidad,
    totalPactado,
    plazoMeses,
    topeInteres,
    medio,
    fuentes,
    garantia: limpiarTexto(datosPrestamo.garantia ?? existente?.garantia),
    estadoManual,
    fechaEstado,
    acuerdo,
    nota: limpiarTexto(datosPrestamo.nota ?? existente?.nota),
    creadoEn,
  };
}

function nuevoMovimiento(campos) {
  return {
    id: generarId(),
    fecha: campos.fecha,
    caja: campos.caja,
    tipo: campos.tipo,
    monto: campos.monto,
    signo: campos.signo,
    origen: limpiarTexto(campos.origen),
    prestamoId: campos.prestamoId ?? null,
    pagoId: campos.pagoId ?? null,
    parId: campos.parId ?? null,
    nota: limpiarTexto(campos.nota),
    creadoEn: campos.creadoEn ?? hoy(),
    creadoHora: new Date().toISOString(),
  };
}

// Sección 6: por cada fuente de caja, un movimiento `prestamo` (−1) en esa caja. Por cada
// fuente externa (arriendo, esposo, pension, otro), un `aporte` (+1) con origen y un
// `prestamo` (−1), ambos en la caja del medio. Así la caja cuadra y queda el rastro.
function movimientosDePrestamo(prestamo) {
  const lista = [];
  for (const fuente of prestamo.fuentes) {
    if (fuente.origen === 'caja_efectivo' || fuente.origen === 'caja_virtual') {
      lista.push(nuevoMovimiento({
        fecha: prestamo.fecha,
        caja: fuente.origen === 'caja_efectivo' ? 'efectivo' : 'virtual',
        tipo: 'prestamo',
        monto: fuente.monto,
        signo: -1,
        prestamoId: prestamo.id,
        nota: fuente.nota,
        creadoEn: prestamo.creadoEn,
      }));
    } else {
      lista.push(nuevoMovimiento({
        fecha: prestamo.fecha,
        caja: prestamo.medio,
        tipo: 'aporte',
        monto: fuente.monto,
        signo: 1,
        origen: fuente.origen,
        prestamoId: prestamo.id,
        nota: fuente.nota,
        creadoEn: prestamo.creadoEn,
      }));
      lista.push(nuevoMovimiento({
        fecha: prestamo.fecha,
        caja: prestamo.medio,
        tipo: 'prestamo',
        monto: fuente.monto,
        signo: -1,
        origen: fuente.origen,
        prestamoId: prestamo.id,
        nota: fuente.nota,
        creadoEn: prestamo.creadoEn,
      }));
    }
  }
  return lista;
}

function insertarPrestamo(datosPrestamo) {
  const prestamo = armarPrestamo(datosPrestamo, null);
  exigir(!buscar('prestamos', prestamo.id), `Ya existe un préstamo con el id ${prestamo.id}.`);
  estadoActual.prestamos.push(prestamo);
  estadoActual.movimientos.push(...movimientosDePrestamo(prestamo));
  return prestamo;
}

function pagosDelPrestamo(prestamoId) {
  return estadoActual.pagos.filter((g) => g.prestamoId === prestamoId);
}

function mismasFuentes(a, b) {
  if (a.length !== b.length) return false;
  return a.every((f, i) => f.origen === b[i].origen && f.monto === b[i].monto && f.nota === b[i].nota);
}

function cambiarPrestamo(datosPrestamo) {
  exigir(datosPrestamo && datosPrestamo.id, 'Falta el id del préstamo que quieres actualizar.');
  const indice = estadoActual.prestamos.findIndex((p) => p.id === datosPrestamo.id);
  exigir(indice >= 0, 'No se encontró el préstamo que quieres actualizar.');
  const anterior = estadoActual.prestamos[indice];
  const nuevo = armarPrestamo(datosPrestamo, anterior);

  const cambiaPlata = nuevo.capital !== anterior.capital
    || nuevo.fecha !== anterior.fecha
    || nuevo.medio !== anterior.medio
    || !mismasFuentes(nuevo.fuentes, anterior.fuentes);
  const cambiaModalidad = nuevo.modalidad !== anterior.modalidad;
  const tienePagos = pagosDelPrestamo(anterior.id).length > 0;

  if (tienePagos) {
    exigir(nuevo.capital === anterior.capital, 'No se puede cambiar el capital de un préstamo que ya tiene pagos. Si prestó más plata, crea un préstamo nuevo.');
    exigir(nuevo.fecha === anterior.fecha, 'No se puede cambiar la fecha de un préstamo que ya tiene pagos.');
    exigir(!cambiaModalidad, 'No se puede cambiar la modalidad de un préstamo que ya tiene pagos.');
  }
  if (nuevo.clienteId !== anterior.clienteId) {
    exigir(buscar('clientes', nuevo.clienteId), 'No se encontró el cliente al que quieres pasar el préstamo.');
    for (const g of estadoActual.pagos) if (g.prestamoId === nuevo.id) g.clienteId = nuevo.clienteId;
  }

  estadoActual.prestamos[indice] = nuevo;
  if (cambiaPlata) {
    // Sin pagos se permite corregir plata, fecha o fuentes: se rehacen sus movimientos.
    estadoActual.movimientos = estadoActual.movimientos.filter((m) => !(m.prestamoId === nuevo.id && !m.pagoId));
    estadoActual.movimientos.push(...movimientosDePrestamo(nuevo));
  }
  return nuevo;
}

// ---------------------------------------------------------------------------
// Pagos y perdones
// ---------------------------------------------------------------------------

function armarPago(datosPago) {
  exigir(datosPago && typeof datosPago === 'object', 'Faltan los datos del pago.');
  const prestamo = buscar('prestamos', limpiarTexto(datosPago.prestamoId));
  exigir(prestamo, 'El pago debe pertenecer a un préstamo existente.');
  exigirFecha(datosPago.fecha, 'del pago');
  exigir(datosPago.fecha <= hoy(), 'La fecha del pago no puede ser de un día que todavía no llega. Revise el día, el mes y el año.');
  exigir(datosPago.fecha >= prestamo.fecha, `El pago no puede ser anterior a la fecha del préstamo (${prestamo.fecha}).`);
  const monto = datosPago.monto;
  exigirMonto(monto, 'monto del pago');

  let interes = datosPago.interes;
  let capital = datosPago.capital;
  const sinInteres = interes === undefined || interes === null;
  const sinCapital = capital === undefined || capital === null;
  if (sinInteres && sinCapital) {
    if (prestamo.modalidad === 'interes_mensual') {
      throw new Error('Indica cuánto del pago es interés y cuánto es abono a capital.');
    }
    // capital_primero y sin_interes: el reparto lo hace el motor; se guarda todo como capital.
    interes = 0;
    capital = monto;
  } else if (sinInteres) {
    interes = monto - capital;
  } else if (sinCapital) {
    capital = monto - interes;
  }
  exigir(esEnteroNoNegativo(interes), 'El interés del pago debe ser un número entero, cero o mayor.');
  exigir(esEnteroNoNegativo(capital), 'El abono a capital debe ser un número entero, cero o mayor.');
  exigir(interes + capital === monto, `Interés (${interes}) más capital (${capital}) debe ser igual al monto del pago (${monto}).`);
  if (prestamo.modalidad === 'sin_interes') {
    exigir(interes === 0, 'Un préstamo sin interés no puede recibir pagos de interés.');
  }

  const medio = datosPago.medio ?? 'efectivo';
  exigir(MEDIOS_PAGO.includes(medio), 'El medio del pago debe ser efectivo, virtual o especie.');
  const creadoEn = datosPago.creadoEn ?? hoy();
  exigirFecha(creadoEn, 'de creación del pago');

  return {
    id: limpiarTexto(datosPago.id) || generarId(),
    prestamoId: prestamo.id,
    clienteId: prestamo.clienteId,
    fecha: datosPago.fecha,
    tipo: 'pago',
    monto,
    interes,
    capital,
    medio,
    descripcion: limpiarTexto(datosPago.descripcion),
    nota: limpiarTexto(datosPago.nota),
    creadoEn,
  };
}

function insertarPago(datosPago) {
  const pago = armarPago(datosPago);
  exigir(!buscar('pagos', pago.id), `Ya existe un pago con el id ${pago.id}.`);
  estadoActual.pagos.push(pago);
  if (pago.medio === 'efectivo' || pago.medio === 'virtual') {
    estadoActual.movimientos.push(nuevoMovimiento({
      fecha: pago.fecha,
      caja: pago.medio,
      tipo: 'pago',
      monto: pago.monto,
      signo: 1,
      prestamoId: pago.prestamoId,
      pagoId: pago.id,
      nota: pago.nota,
      creadoEn: pago.creadoEn,
    }));
  }
  return pago;
}

function insertarPerdon(datosPerdon) {
  exigir(datosPerdon && typeof datosPerdon === 'object', 'Faltan los datos del perdón.');
  const prestamo = buscar('prestamos', limpiarTexto(datosPerdon.prestamoId));
  exigir(prestamo, 'El perdón debe pertenecer a un préstamo existente.');
  exigir(prestamo.modalidad === 'interes_mensual' || prestamo.modalidad === 'capital_primero', 'Solo se pueden perdonar intereses en préstamos con interés mensual.');
  exigirFecha(datosPerdon.fecha, 'del perdón');
  exigir(datosPerdon.fecha >= prestamo.fecha, `El perdón no puede ser anterior a la fecha del préstamo (${prestamo.fecha}).`);
  exigirMonto(datosPerdon.monto, 'monto perdonado');
  const creadoEn = datosPerdon.creadoEn ?? hoy();
  exigirFecha(creadoEn, 'de creación del perdón');
  const perdon = {
    id: limpiarTexto(datosPerdon.id) || generarId(),
    prestamoId: prestamo.id,
    clienteId: prestamo.clienteId,
    fecha: datosPerdon.fecha,
    tipo: 'perdon',
    monto: datosPerdon.monto,
    interes: datosPerdon.monto,
    capital: 0,
    medio: null, // un perdón no entra plata: no tiene medio
    descripcion: '',
    nota: limpiarTexto(datosPerdon.nota),
    creadoEn,
  };
  exigir(!buscar('pagos', perdon.id), `Ya existe un pago con el id ${perdon.id}.`);
  estadoActual.pagos.push(perdon);
  return perdon;
}

function quitarPago(id) {
  const pago = buscar('pagos', id);
  exigir(pago, 'No se encontró el pago que quieres eliminar.');
  estadoActual.pagos = estadoActual.pagos.filter((g) => g.id !== id);
  estadoActual.movimientos = estadoActual.movimientos.filter((m) => m.pagoId !== id);
  return pago;
}

// ---------------------------------------------------------------------------
// Movimientos manuales de caja
// ---------------------------------------------------------------------------

function insertarMovimientoManual(datosMovimiento) {
  exigir(datosMovimiento && typeof datosMovimiento === 'object', 'Faltan los datos del movimiento.');
  const tipo = datosMovimiento.tipo;
  exigir(TIPOS_MOVIMIENTO_MANUAL.includes(tipo), 'El tipo de movimiento debe ser aporte, retiro, traslado, ganancia a personal o saldo inicial.');
  const fecha = datosMovimiento.fecha ?? hoy();
  exigirFecha(fecha, 'del movimiento');
  exigirMonto(datosMovimiento.monto, 'monto del movimiento');
  const nota = limpiarTexto(datosMovimiento.nota);
  const creadoEn = datosMovimiento.creadoEn ?? hoy();
  exigirFecha(creadoEn, 'de creación del movimiento');

  if (tipo === 'traslado') {
    const de = datosMovimiento.de;
    const a = datosMovimiento.a;
    exigir(CAJAS.includes(de) && CAJAS.includes(a), 'Un traslado necesita la caja de origen ("de") y la de destino ("a"): efectivo o virtual.');
    exigir(de !== a, 'Un traslado debe ir de una caja a la otra.');
    const salida = nuevoMovimiento({ fecha, caja: de, tipo, monto: datosMovimiento.monto, signo: -1, nota, creadoEn });
    const entrada = nuevoMovimiento({ fecha, caja: a, tipo, monto: datosMovimiento.monto, signo: 1, nota, creadoEn, parId: salida.id });
    salida.parId = entrada.id;
    estadoActual.movimientos.push(salida, entrada);
    return [salida, entrada];
  }

  const caja = datosMovimiento.caja;
  exigir(CAJAS.includes(caja), 'La caja debe ser efectivo o virtual.');
  let origen = '';
  if (tipo === 'aporte') {
    origen = datosMovimiento.origen ?? 'propio';
    exigir(ORIGENES_APORTE.includes(origen), 'El origen del aporte debe ser arriendo, esposo, pension, propio u otro.');
  }
  // Un saldo inicial puede ser negativo (`negativo: true`): en la caja virtual compartida,
  // es plata de su pareja que ella ya debía al empezar a usar la app.
  let signo = (tipo === 'aporte' || tipo === 'saldo_inicial') ? 1 : -1;
  if (tipo === 'saldo_inicial' && datosMovimiento.negativo === true) signo = -1;
  const movimiento = nuevoMovimiento({ fecha, caja, tipo, monto: datosMovimiento.monto, signo, origen, nota, creadoEn });
  estadoActual.movimientos.push(movimiento);
  return movimiento;
}

function quitarMovimiento(id) {
  const movimiento = buscar('movimientos', id);
  exigir(movimiento, 'No se encontró el movimiento que quieres eliminar.');
  exigir(
    !movimiento.prestamoId && !movimiento.pagoId,
    'Este movimiento viene de un préstamo o de un pago. Se borra con ellos, no desde la caja.',
  );
  const ids = new Set([id]);
  if (movimiento.tipo === 'traslado') {
    // Las dos mitades se borran juntas. Si no trae parId, se busca la otra mitad por
    // fecha, monto, creación, signo y caja para que la caja no quede descuadrada.
    const pareja = contraparteDeTraslado(movimiento, estadoActual.movimientos);
    if (pareja) ids.add(pareja.id);
  } else if (movimiento.parId) {
    ids.add(movimiento.parId);
  }
  estadoActual.movimientos = estadoActual.movimientos.filter((m) => !ids.has(m.id));
  return movimiento;
}

// ---------------------------------------------------------------------------
// Importar, exportar y casos de prueba
// ---------------------------------------------------------------------------

function prepararEstadoImportado(objeto) {
  exigir(objeto && typeof objeto === 'object' && !Array.isArray(objeto), 'El archivo no tiene la forma de una copia de Mis Préstamos.');
  exigir(
    COLECCIONES.some((c) => Array.isArray(objeto[c])),
    'El archivo no contiene clientes, préstamos, pagos ni movimientos. ¿Es una copia de Mis Préstamos?',
  );
  const migrado = migrar(objeto);
  const completo = completarEstado(migrado);
  validarEstado(completo);
  return completo;
}

// Carga los casos de prueba de casos.js. Acepta:
//  - un objeto con forma de estado: { clientes, prestamos, pagos, movimientos?, config? }
//  - una lista de casos, cada uno con { cliente | clientes, prestamos: [ { ...prestamo, pagos: [...] } ], pagos?, movimientos? }
// Los ids que traigan los casos se respetan para que las pantallas puedan buscarlos.
function cargarListaDeCasos(lista) {
  exigir(lista && typeof lista === 'object', 'No hay casos de prueba para cargar.');
  estadoActual = estadoVacio();
  idsBase = null;
  const casos = Array.isArray(lista) ? lista : [lista];
  const pendientesPago = [];

  for (const caso of casos) {
    if (!caso || typeof caso !== 'object') continue;
    if (caso.config && typeof caso.config === 'object' && caso.config.nombreNegocio) {
      estadoActual.config.nombreNegocio = limpiarTexto(caso.config.nombreNegocio) || estadoActual.config.nombreNegocio;
    }
    const clientes = [];
    if (caso.cliente) clientes.push(caso.cliente);
    if (Array.isArray(caso.clientes)) clientes.push(...caso.clientes);
    const clientesCreados = clientes.map((c) => insertarCliente(c));
    const clientePorDefecto = clientesCreados.length === 1 ? clientesCreados[0] : null;

    for (const p of Array.isArray(caso.prestamos) ? caso.prestamos : []) {
      const { pagos, ...datosPrestamo } = p;
      if (!datosPrestamo.clienteId && clientePorDefecto) datosPrestamo.clienteId = clientePorDefecto.id;
      const prestamo = insertarPrestamo(datosPrestamo);
      for (const g of Array.isArray(pagos) ? pagos : []) {
        pendientesPago.push({ ...g, prestamoId: g.prestamoId || prestamo.id });
      }
    }
    for (const g of Array.isArray(caso.pagos) ? caso.pagos : []) pendientesPago.push(g);
    for (const m of Array.isArray(caso.movimientos) ? caso.movimientos : []) insertarMovimientoManual(m);
  }

  // Los pagos van de último para que todos los préstamos ya existan.
  for (const g of pendientesPago) {
    if (g.tipo === 'perdon') insertarPerdon(g);
    else insertarPago(g);
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const datos = {
  // Lee el estado guardado. Si no hay nada o está dañado, arranca con estado vacío:
  // la app nunca se queda en blanco por un problema de almacenamiento. Un estado que
  // no se pudo usar se conserva aparte (ver `almacenamiento.copiaNoUsable`) para que
  // el siguiente guardado no lo pise.
  async cargar() {
    const almacen = obtenerAlmacenamiento();
    let texto = null;
    try {
      texto = await almacen.leer();
    } catch (error) {
      console.error('No se pudo leer el estado guardado:', error);
    }
    errorCarga = null;
    textoNoUsable = null;
    if (typeof almacen.leerNoUsable === 'function') {
      try { textoNoUsable = await almacen.leerNoUsable(); } catch { textoNoUsable = null; }
    }
    if (texto) {
      try {
        const objeto = JSON.parse(texto);
        const migrado = migrar(objeto);
        const completo = completarEstado(migrado);
        validarEstado(completo);
        estadoActual = completo;
        idsBase = idsDe(estadoActual);
        if (!Number.isInteger(objeto.version) || objeto.version < VERSION_ACTUAL) {
          await guardar(); // deja guardada la versión migrada
        }
      } catch (error) {
        console.error('El estado guardado no se pudo usar; se arranca vacío. La copia queda conservada en Ajustes.', error);
        estadoActual = estadoVacio();
        idsBase = null;
        await conservarNoUsable(texto, error);
      }
    } else {
      estadoActual = estadoVacio();
      idsBase = idsDe(estadoActual);
    }
    return estadoActual;
  },

  // Objeto en memoria. Solo lectura por convención: para cambiarlo se usan las operaciones.
  get estado() {
    return estadoActual;
  },

  // Nombre de la capa de almacenamiento activa, el último error al guardar (si lo hubo),
  // la copia conservada de un estado que no se pudo usar (texto o null) y el error de
  // carga que la explica.
  get almacenamiento() {
    return {
      nombre: obtenerAlmacenamiento().nombre,
      ultimoError: ultimoErrorGuardado,
      copiaNoUsable: textoNoUsable,
      errorCarga,
    };
  },

  // Descarta la copia conservada de un estado que no se pudo usar (después de que la
  // usuaria la descargó o decidió no necesitarla).
  async descartarCopiaNoUsable() {
    textoNoUsable = null;
    errorCarga = null;
    const almacen = obtenerAlmacenamiento();
    if (typeof almacen.borrarNoUsable === 'function') await almacen.borrarNoUsable();
  },

  // Promesa que se resuelve cuando terminan los guardados en cola.
  esperarGuardado() {
    return colaGuardado;
  },

  // fn() se llama después de cada guardado. Devuelve una función para darse de baja.
  suscribir(fn) {
    exigir(typeof fn === 'function', 'suscribir necesita una función.');
    suscriptores.add(fn);
    return () => suscriptores.delete(fn);
  },

  // filtro: función (x) => boolean, u objeto con campos que deben coincidir.
  listar(coleccion, filtro) {
    exigirColeccion(coleccion);
    const lista = estadoActual[coleccion];
    if (typeof filtro === 'function') return lista.filter(filtro);
    if (filtro && typeof filtro === 'object') {
      const claves = Object.keys(filtro);
      return lista.filter((x) => claves.every((k) => x[k] === filtro[k]));
    }
    return lista.slice();
  },

  obtener(coleccion, id) {
    exigirColeccion(coleccion);
    return buscar(coleccion, id);
  },

  async agregarCliente(c) {
    const cliente = insertarCliente(c);
    await guardar();
    return cliente;
  },

  async actualizarCliente(c) {
    const cliente = cambiarCliente(c);
    await guardar();
    return cliente;
  },

  // Solo si no tiene préstamos.
  async eliminarCliente(id) {
    const cliente = quitarCliente(id);
    await guardar();
    return cliente;
  },

  // Valida y crea los movimientos de caja según las fuentes (sección 6).
  async crearPrestamo(p) {
    const prestamo = insertarPrestamo(p);
    await guardar();
    return prestamo;
  },

  // Nota, garantía, estado manual, plazo, acuerdo. Capital, fecha y modalidad solo si
  // todavía no tiene pagos (y entonces se rehacen sus movimientos de caja).
  async actualizarPrestamo(p) {
    const prestamo = cambiarPrestamo(p);
    await guardar();
    return prestamo;
  },

  // Junta dos fichas de la misma persona: todo lo de `origenId` pasa a `destinoId` y la ficha repetida se borra (3.49.0).
  async unirClientes(origenId, destinoId) {
    exigir(origenId && destinoId && origenId !== destinoId, 'Elige dos clientes distintos.');
    const origen = buscar('clientes', origenId);
    const destino = buscar('clientes', destinoId);
    exigir(origen && destino, 'No encontré uno de los dos clientes.');
    for (const p of estadoActual.prestamos) if (p.clienteId === origenId) p.clienteId = destinoId;
    for (const g of estadoActual.pagos) if (g.clienteId === origenId) g.clienteId = destinoId;
    const fran = estadoActual.fran;
    const delOrigen = (a) => a.clienteId === origenId || (!a.clienteId && a.persona && limpiarTexto(a.persona).toLowerCase() === origen.nombre.toLowerCase());
    fran.asientos = fran.asientos.map((a) => (delOrigen(a) ? { ...a, clienteId: destinoId, persona: destino.nombre } : a));
    fran.agenda = fran.agenda.map((x) => (x.clienteId === origenId ? { ...x, clienteId: destinoId } : x));
    // Lo que la ficha repetida sabía y la otra no, se conserva.
    const i = estadoActual.clientes.findIndex((c) => c.id === destinoId);
    const junto = { ...destino };
    for (const campo of ['cedula', 'telefono', 'direccion', 'grupo']) if (!junto[campo] && origen[campo]) junto[campo] = origen[campo];
    const otros = [destino.alias, origen.nombre !== destino.nombre ? origen.nombre : '', origen.alias].map((x) => limpiarTexto(x)).filter(Boolean);
    junto.alias = [...new Set(otros)].join(', ');
    junto.nota = [destino.nota, origen.nota].map((x) => limpiarTexto(x)).filter(Boolean).join(' · ');
    estadoActual.clientes[i] = junto;
    estadoActual.clientes = estadoActual.clientes.filter((c) => c.id !== origenId);
    await guardar();
    return junto;
  },

  // Corrige un pago ya registrado: fecha, valor y cuánto fue a capital y a intereses. La caja se rehace sola.
  async corregirPago(id, cambios) {
    const anterior = buscar('pagos', id);
    exigir(anterior, 'No encontré ese pago.');
    exigir(anterior.tipo !== 'perdon', 'Un perdón no se corrige: bórrelo y hágalo de nuevo.');
    const respaldo = JSON.stringify({ pagos: estadoActual.pagos, movimientos: estadoActual.movimientos });
    try {
      quitarPago(id);
      const capital = cambios.capital ?? anterior.capital;
      const interes = cambios.interes ?? anterior.interes;
      insertarPago({
        id, prestamoId: anterior.prestamoId, fecha: cambios.fecha || anterior.fecha, monto: capital + interes, interes, capital,
        medio: cambios.medio || anterior.medio, descripcion: anterior.descripcion, nota: cambios.nota ?? anterior.nota, creadoEn: anterior.creadoEn,
      });
    } catch (error) {
      const antes = JSON.parse(respaldo);
      estadoActual.pagos = antes.pagos;
      estadoActual.movimientos = antes.movimientos;
      throw error;
    }
    await guardar();
    return buscar('pagos', id);
  },

  // Borra el préstamo con sus pagos y sus movimientos de caja (3.45.0).
  async eliminarPrestamo(id) {
    const prestamo = buscar('prestamos', id);
    exigir(prestamo, 'No se encontró el préstamo que quieres eliminar.');
    const pagos = new Set(estadoActual.pagos.filter((g) => g.prestamoId === id).map((g) => g.id));
    estadoActual.pagos = estadoActual.pagos.filter((g) => g.prestamoId !== id);
    estadoActual.movimientos = estadoActual.movimientos.filter((m) => m.prestamoId !== id && !(m.pagoId && pagos.has(m.pagoId)));
    estadoActual.prestamos = estadoActual.prestamos.filter((x) => x.id !== id);
    await guardar();
    return prestamo;
  },

  // Valida el reparto interés + capital = monto. Crea movimiento de caja si el medio es
  // efectivo o virtual; en especie no mueve caja.
  async registrarPago(pago) {
    const creado = insertarPago(pago);
    await guardar();
    return creado;
  },

  // Rebaja de intereses: no entra plata, no mueve caja.
  async registrarPerdon({ prestamoId, fecha, monto, nota, id, creadoEn } = {}) {
    const perdon = insertarPerdon({ prestamoId, fecha, monto, nota, id, creadoEn });
    await guardar();
    return perdon;
  },

  // Borra el pago (o perdón) y su movimiento de caja.
  async eliminarPago(id) {
    const pago = quitarPago(id);
    await guardar();
    return pago;
  },

  // aporte, retiro, ganancia_a_personal, saldo_inicial: { fecha, tipo, caja, monto, origen?, nota }.
  // traslado: { fecha, tipo: 'traslado', de, a, monto, nota } → devuelve [salida, entrada].
  async movimientoCaja(m) {
    const creado = insertarMovimientoManual(m);
    await guardar();
    return creado;
  },

  // Un movimiento de un libro de Fran: { libro, fecha, tipo, categoria, descripcion, valor, cuenta, destino }.
  async agregarAsiento(a) {
    exigirFecha(a.fecha, 'del movimiento');
    exigir(a.fecha <= hoy(), 'La fecha no puede ser de un día que todavía no llega. Revise el día, el mes y el año.');
    exigirMonto(a.valor, 'valor del movimiento');
    const asiento = {
      id: generarId(), libro: a.libro, fecha: a.fecha, tipo: a.tipo,
      categoria: limpiarTexto(a.categoria) || 'Otros', descripcion: limpiarTexto(a.descripcion),
      valor: a.valor, cuenta: limpiarTexto(a.cuenta), destino: limpiarTexto(a.destino),
    };
    if (a.conFoto === true) asiento.conFoto = true;
    if (a.persona) asiento.persona = limpiarTexto(a.persona);
    // De qué cliente y de qué préstamo es el cobro: así no depende de que el nombre esté escrito igual (3.47.0).
    if (a.clienteId && buscar('clientes', a.clienteId)) asiento.clienteId = a.clienteId;
    if (a.prestamoId && buscar('prestamos', a.prestamoId)) asiento.prestamoId = a.prestamoId;
    if (a.sueltoId) asiento.sueltoId = limpiarTexto(a.sueltoId);
    // Arriendos: a qué propiedad fue el gasto (la categoría dice de qué fue: obra, materiales…).
    if (a.propiedad) asiento.propiedad = limpiarTexto(a.propiedad);
    // Plata de un negocio compartido: se ve en su libro, pero no entra a sus cuentas ni a Finanzas.
    if (a.soloLibro === true) asiento.soloLibro = true;
    if (a.textoFecha) asiento.textoFecha = limpiarTexto(a.textoFecha);
    asiento.creadoEn = new Date().toISOString();
    estadoActual.fran.asientos.push(asiento);
    await guardar();
    return asiento;
  },

  // Lo que ella dictó por el chat. Cada operación lleva un id fijo: nunca se anota dos veces.
  async aplicarDictado(operaciones) {
    let anotadas = 0;
    let yaEstaban = 0;
    const faltan = [];
    for (const o of operaciones) {
      if (o.op === 'asiento') {
        if (estadoActual.fran.asientos.some((a) => a.id === o.id || (a.fecha === o.fecha && a.valor === o.valor && a.tipo === o.tipo && a.libro === o.libro))) { yaEstaban++; continue; }
        exigirFecha(o.fecha, 'del movimiento');
        exigirMonto(o.valor, 'valor del movimiento');
        estadoActual.fran.asientos.push({ id: o.id, libro: o.libro, fecha: o.fecha, tipo: o.tipo, categoria: o.categoria, descripcion: limpiarTexto(o.descripcion), valor: o.valor, cuenta: limpiarTexto(o.cuenta), destino: '', creadoEn: o.creadoEn });
      } else if (o.op === 'prestamo') {
        if (buscar('prestamos', o.id) || estadoActual.prestamos.some((p) => p.clienteId === o.clienteId && p.fecha === o.fecha && p.capital === o.capital)) { yaEstaban++; continue; }
        if (!buscar('clientes', o.clienteId)) { faltan.push(o.id); continue; }
        insertarPrestamo(o);
      } else if (o.op === 'pago' || o.op === 'perdon') {
        const prestamo = estadoActual.prestamos.find((p) => p.id === o.prestamoId || (p.clienteId === o.clienteId && p.modalidad === o.modalidad));
        if (!prestamo) { faltan.push(o.id); continue; }
        const esPerdon = o.op === 'perdon';
        if (buscar('pagos', o.id) || estadoActual.pagos.some((g) => g.prestamoId === prestamo.id && g.fecha === o.fecha && g.monto === o.monto && (g.tipo === 'perdon') === esPerdon)) { yaEstaban++; continue; }
        if (o.op === 'pago') insertarPago({ id: o.id, prestamoId: prestamo.id, fecha: o.fecha, monto: o.monto, interes: 0, capital: o.monto, medio: o.medio, nota: o.nota });
        else insertarPerdon({ id: o.id, prestamoId: prestamo.id, fecha: o.fecha, monto: o.monto, nota: o.nota });
      } else continue;
      anotadas++;
    }
    if (anotadas) await guardar();
    return { anotadas, yaEstaban, faltan };
  },

  // Mi cuenta virtual: lo que entró o salió que no está anotado en otro libro.
  async agregarVirtual(m) {
    exigirFecha(m.fecha, 'del movimiento');
    exigirMonto(m.valor, 'valor del movimiento');
    exigir(m.tipo === 'entra' || m.tipo === 'sale', 'Elige si entró o salió.');
    const fila = { id: generarId(), fecha: m.fecha, tipo: m.tipo, concepto: limpiarTexto(m.concepto), valor: m.valor };
    estadoActual.fran.virtualMov.push(fila);
    await guardar();
    return fila;
  },

  async eliminarVirtual(id) {
    estadoActual.fran.virtualMov = estadoActual.fran.virtualMov.filter((m) => m.id !== id);
    await guardar();
  },

  // Nota, forma de pago y préstamo de un cobro. A un pago solo se le cambia la nota: su forma de pago mueve la caja.
  async detallarCobro(id, cambios) {
    const pago = buscar('pagos', id);
    if (pago) {
      pago.nota = limpiarTexto(cambios.nota);
    } else {
      const i = estadoActual.fran.asientos.findIndex((a) => a.id === id);
      exigir(i >= 0, 'No encontré ese movimiento.');
      const anterior = estadoActual.fran.asientos[i];
      const nuevo = {
        ...anterior, ...(anterior.importado ? { huella: anterior.huella || huellaAsiento(anterior) } : {}),
        nota: limpiarTexto(cambios.nota), medio: limpiarTexto(cambios.medio), prestamoId: limpiarTexto(cambios.prestamoId),
      };
      if (cambios.clienteId && cambios.clienteId !== anterior.clienteId) {
        const cliente = buscar('clientes', cambios.clienteId);
        exigir(cliente, 'No encontré ese cliente.');
        nuevo.clienteId = cliente.id;
        nuevo.persona = cliente.nombre;
        if (nuevo.prestamoId && !estadoActual.prestamos.some((p) => p.id === nuevo.prestamoId && p.clienteId === cliente.id)) nuevo.prestamoId = '';
      }
      if (cambios.fecha && cambios.fecha !== anterior.fecha) {
        exigirFecha(cambios.fecha, 'del cobro');
        exigir(cambios.fecha <= hoy(), 'La fecha no puede ser de un día que todavía no llega.');
        nuevo.fecha = cambios.fecha;
        delete nuevo.textoFecha;
      }
      if (cambios.valor !== undefined && cambios.valor !== anterior.valor) {
        exigirMonto(cambios.valor, 'valor del cobro');
        if (anterior.sueltoId) estadoActual.fran.interesesSueltos = estadoActual.fran.interesesSueltos.map((x) => (x.id === anterior.sueltoId ? { ...x, pagado: Math.max(0, (x.pagado || 0) - anterior.valor + cambios.valor) } : x));
        nuevo.valor = cambios.valor;
      }
      estadoActual.fran.asientos[i] = nuevo;
    }
    await guardar();
  },

  async actualizarAsiento(id, cambios) {
    const i = estadoActual.fran.asientos.findIndex((a) => a.id === id);
    exigir(i >= 0, 'No encontré ese movimiento.');
    exigirFecha(cambios.fecha, 'del movimiento');
    exigirMonto(cambios.valor, 'valor del movimiento');
    const anterior = estadoActual.fran.asientos[i];
    estadoActual.fran.asientos[i] = {
      ...anterior, ...(anterior.importado ? { huella: anterior.huella || huellaAsiento(anterior) } : {}), fecha: cambios.fecha, valor: cambios.valor,
      categoria: limpiarTexto(cambios.categoria) || 'Otros', descripcion: limpiarTexto(cambios.descripcion),
    };
    await guardar();
  },

  // Movimientos que se repiten solos. El id del asiento lleva la fecha: dos aparatos no lo duplican.
  async agregarRecurrente(r) {
    exigirFecha(r.proxima, 'de inicio');
    exigirMonto(r.valor, 'valor');
    estadoActual.fran.recurrentes.push({
      id: generarId(), libro: r.libro, tipo: r.tipo, categoria: limpiarTexto(r.categoria) || 'Otros',
      descripcion: limpiarTexto(r.descripcion), valor: r.valor, cuenta: limpiarTexto(r.cuenta),
      frecuencia: r.frecuencia, proxima: r.proxima, dia: Number(r.proxima.slice(8)),
    });
    await guardar();
  },

  async eliminarRecurrente(id) {
    estadoActual.fran.recurrentes = estadoActual.fran.recurrentes.filter((r) => r.id !== id);
    await guardar();
  },

  async aplicarRecurrentes(hoy) {
    let anotados = 0;
    let cambio = false;
    for (const r of estadoActual.fran.recurrentes) {
      for (let vueltas = 0; r.proxima <= hoy && vueltas < 400; vueltas++) {
        const id = `rec-${r.id}-${r.proxima}`;
        if (!estadoActual.fran.asientos.some((a) => a.id === id)) {
          estadoActual.fran.asientos.push({ id, libro: r.libro, fecha: r.proxima, tipo: r.tipo, categoria: r.categoria, descripcion: r.descripcion, valor: r.valor, cuenta: r.cuenta || '', destino: '' });
          anotados++;
        }
        r.proxima = siguienteRecurrente(r.proxima, r.frecuencia, r.dia);
        cambio = true;
      }
    }
    if (cambio) await guardar();
    return anotados;
  },

  async eliminarAsiento(id) {
    const borrado = estadoActual.fran.asientos.find((a) => a.id === id);
    if (borrado && borrado.importado) estadoActual.fran.historicosBorrados.push(borrado.huella || huellaAsiento(borrado));
    if (borrado && borrado.sueltoId) {
      // Era un abono de alguien que debe solo intereses: al borrarlo, esa plata vuelve a deberse.
      estadoActual.fran.interesesSueltos = estadoActual.fran.interesesSueltos.map((x) => (x.id === borrado.sueltoId ? { ...x, pagado: Math.max(0, (x.pagado || 0) - borrado.valor) } : x));
    }
    estadoActual.fran.asientos = estadoActual.fran.asientos.filter((a) => a.id !== id);
    await guardar();
  },

  // Cambia los históricos importados sin tocar lo que ella anotó en la app.
  // Lo marcado "importado" se reemplaza; lo demás se conserva. La agenda se junta por id.
  async actualizarHistoricos(texto) {
    const objeto = typeof texto === 'string' ? JSON.parse(texto) : texto;
    const antesDeHistoricos = JSON.stringify(estadoActual);
    const nuevo = completarFran(objeto.fran);
    exigir(nuevo.asientos.length > 0, 'El archivo no trae movimientos de históricos.');
    const propios = estadoActual.fran.asientos.filter((a) => !a.importado);
    const agenda = [...estadoActual.fran.agenda];
    const ids = new Set(agenda.map((x) => x.id));
    for (const x of nuevo.agenda) {
      if (!ids.has(x.id)) { agenda.push(x); continue; }
      const ya = agenda.find((y) => y.id === x.id);
      if (x.clienteId && !ya.clienteId) ya.clienteId = x.clienteId;
      if (x.nota && !ya.nota) ya.nota = x.nota;
    }
    // Lo que ella borró o corrigió de los históricos sigue así aunque se vuelvan a cargar.
    const corregidos = estadoActual.fran.asientos.filter((a) => a.importado && a.huella);
    const yaCorregidos = [...estadoActual.fran.historicosBorrados, ...corregidos.map((a) => a.huella)];
    const importados = nuevo.asientos.filter((a) => {
      if (!a.importado) return false;
      const i = yaCorregidos.indexOf(huellaAsiento(a));
      if (i < 0) return true;
      yaCorregidos.splice(i, 1);
      return false;
    });
    estadoActual.fran = { ...estadoActual.fran, asientos: [...importados, ...corregidos, ...propios], agenda, propiedades: nuevo.propiedades, pension: { ...estadoActual.fran.pension, origen: nuevo.pension.origen || estadoActual.fran.pension.origen }, virtualPorDefinir: nuevo.virtualPorDefinir, virtualHistorial: nuevo.virtualHistorial, virtualCuentas: estadoActual.fran.virtualCuentas || nuevo.virtualCuentas };
    // Préstamos que el plan corrige (marcados "actualizar") y pagos del plan: no tocan la caja.
    for (const p of Array.isArray(objeto.prestamos) ? objeto.prestamos : []) {
      if (!p.actualizar) continue;
      const i = estadoActual.prestamos.findIndex((x) => x.id === p.id);
      const { actualizar, ...cambios } = p;
      if (i < 0) {
        if (String(p.id).startsWith('acuerdo-')) estadoActual.prestamos.push(cambios);
        continue;
      }
      const { porConfirmar, ...anterior } = estadoActual.prestamos[i];
      estadoActual.prestamos[i] = { ...anterior, ...cambios };
    }
    // Los préstamos que quedaron dentro de un acuerdo. Si ya tienen un pago anotado, no se tocan.
    const quitar = new Set(Array.isArray(objeto.prestamosQuitar) ? objeto.prestamosQuitar : []);
    estadoActual.prestamos = estadoActual.prestamos.filter((x) => !quitar.has(x.id) || estadoActual.pagos.some((g) => g.prestamoId === x.id) || estadoActual.movimientos.some((m) => m.prestamoId === x.id));
    for (const g of Array.isArray(objeto.pagos) ? objeto.pagos : []) {
      if (!String(g.id).startsWith('plan-') || estadoActual.pagos.some((x) => x.id === g.id)) continue;
      if (estadoActual.prestamos.some((x) => x.id === g.prestamoId)) estadoActual.pagos.push(g);
    }
    // Saldos iniciales de la copia ("ini-..."): se agregan o se corrigen; lo demás de la caja no se toca.
    for (const m of Array.isArray(objeto.movimientos) ? objeto.movimientos : []) {
      if (!String(m.id).startsWith('ini-')) continue;
      const fila = { id: m.id, fecha: m.fecha, caja: m.caja, tipo: m.tipo, monto: m.monto, signo: m.signo === -1 ? -1 : 1, origen: '', prestamoId: null, pagoId: null, parId: null, nota: limpiarTexto(m.nota), creadoEn: m.creadoEn };
      const i = estadoActual.movimientos.findIndex((x) => x.id === m.id);
      if (i >= 0) estadoActual.movimientos[i] = fila; else estadoActual.movimientos.push(fila);
    }
    try {
      validarEstado(completarEstado(JSON.parse(JSON.stringify(estadoActual))));
    } catch (error) {
      estadoActual = JSON.parse(antesDeHistoricos);
      idsBase = idsDe(estadoActual);
      throw new Error(`Ese archivo dejaría los datos dañados, así que no se aplicó. ${error && error.message ? error.message : ''}`.trim());
    }
    await guardar();
    return { historicos: nuevo.asientos.length, propios: propios.length, agenda: agenda.length };
  },

  // Cambia partes de la pensión, tasa o presupuesto.
  async actualizarFran(cambios) {
    estadoActual.fran = completarFran({ ...estadoActual.fran, ...cambios });
    await guardar();
  },

  // Solo manuales. Los que vienen de préstamo o pago se borran con ellos.
  async eliminarMovimiento(id) {
    const movimiento = quitarMovimiento(id);
    await guardar();
    return movimiento;
  },

  // Texto JSON bonito con el estado entero.
  exportarJSON() {
    return JSON.stringify(estadoActual, null, 2);
  },

  // Valida la versión, migra si hace falta y reemplaza todo.
  // Con { registrarBorrados: true } lo que estaba y ya no viene queda anotado como borrado.
  async importarJSON(texto, opciones = {}) {
    exigir(typeof texto === 'string' && texto.trim() !== '', 'El archivo está vacío.');
    let objeto;
    try {
      objeto = JSON.parse(texto);
    } catch {
      throw new Error('El archivo no es un JSON válido.');
    }
    const anteriores = estadoActual.borrados || {};
    estadoActual = prepararEstadoImportado(objeto);
    if (opciones.registrarBorrados) estadoActual.borrados = { ...anteriores, ...estadoActual.borrados };
    else idsBase = null;
    await guardar();
    return estadoActual;
  },

  // Borra el estado y también la copia conservada de un estado que no se pudo usar.
  async borrarTodo() {
    estadoActual = estadoVacio();
    idsBase = null;
    try {
      const almacen = obtenerAlmacenamiento();
      if (typeof almacen.borrar === 'function') await almacen.borrar();
      if (typeof almacen.borrarNoUsable === 'function') await almacen.borrarNoUsable();
    } catch (error) {
      console.warn('No se pudo limpiar el almacenamiento; se guarda el estado vacío.', error);
    }
    textoNoUsable = null;
    errorCarga = null;
    await guardar();
    return estadoActual;
  },

  // Reemplaza todo con los casos de prueba de casos.js (ver cargarListaDeCasos).
  async cargarCasos(lista) {
    const respaldo = estadoActual;
    try {
      cargarListaDeCasos(lista);
    } catch (error) {
      estadoActual = respaldo; // si un caso está mal, no se pierde lo que había
      idsBase = null;
      throw error;
    }
    await guardar();
    return estadoActual;
  },
};

export default datos;
