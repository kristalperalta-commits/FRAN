// Casos de prueba con datos reales y sintéticos.
// Los usan las pruebas del motor (pruebas/motor.test.js) y la pantalla de Ajustes
// ("cargar casos de prueba"). Los identificadores son fijos y legibles para que las
// pruebas puedan referenciarlos. Todos los objetos cumplen el modelo de la sección 3
// de la especificación: todos los campos presentes, fuentes que suman el capital,
// monto de cada pago igual a interés más capital.

// ---------- Ayudas para construir objetos completos ----------

function cliente(datos) {
  return {
    id: datos.id,
    nombre: datos.nombre,
    alias: datos.alias ?? '',
    telefono: datos.telefono ?? '',
    direccion: datos.direccion ?? '',
    nota: datos.nota ?? '',
    grupo: datos.grupo ?? '',
    tipo: datos.tipo ?? 'cliente',
    creadoEn: datos.creadoEn,
  };
}

function prestamo(datos) {
  const medio = datos.medio ?? 'efectivo';
  return {
    id: datos.id,
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    capital: datos.capital,
    tasa: datos.tasa ?? 20,
    modalidad: datos.modalidad ?? 'interes_mensual',
    totalPactado: datos.totalPactado ?? null,
    plazoMeses: datos.plazoMeses ?? null,
    topeInteres: datos.topeInteres ?? null,
    medio,
    // Si no se indican fuentes, una sola fuente igual a la caja del medio.
    fuentes: datos.fuentes ?? [
      { origen: medio === 'virtual' ? 'caja_virtual' : 'caja_efectivo', monto: datos.capital, nota: '' },
    ],
    garantia: datos.garantia ?? '',
    estadoManual: datos.estadoManual ?? null,
    fechaEstado: datos.fechaEstado ?? null,
    nota: datos.nota ?? '',
    creadoEn: datos.creadoEn ?? datos.fecha,
  };
}

function pago(datos) {
  const interes = datos.interes ?? 0;
  const capital = datos.capital ?? 0;
  return {
    id: datos.id,
    prestamoId: datos.prestamoId,
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    tipo: datos.tipo ?? 'pago',
    monto: interes + capital,
    interes,
    capital,
    medio: datos.medio ?? 'efectivo',
    descripcion: datos.descripcion ?? '',
    nota: datos.nota ?? '',
    creadoEn: datos.creadoEn ?? datos.fecha,
  };
}

// ---------- 5.1 Ramiro Ejemplo ----------

const ramiro = {
  nombre: 'Ramiro Ejemplo',
  descripcion:
    'Dos préstamos de 1.000.000 al 20% (abril y junio de 2026). Solo pagó los intereses ' +
    'de mayo y junio del primero. A octubre de 2026 debe 3.600.000.',
  hoy: '2026-10-31',
  clientes: [
    cliente({
      id: 'cli-ramiro',
      nombre: 'Ramiro Ejemplo',
      telefono: '3001234567',
      nota: 'Estado de cuenta enviado el 1 de noviembre de 2026.',
      creadoEn: '2026-04-11',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-ramiro-a',
      clienteId: 'cli-ramiro',
      fecha: '2026-04-11',
      capital: 1000000,
      tasa: 20,
      medio: 'efectivo',
      garantia: 'papel firmado',
    }),
    prestamo({
      id: 'pre-ramiro-b',
      clienteId: 'cli-ramiro',
      fecha: '2026-06-03',
      capital: 1000000,
      tasa: 20,
      medio: 'virtual',
      nota: 'Aumento de capital; se lleva como préstamo aparte.',
    }),
  ],
  pagos: [
    pago({
      id: 'pag-ramiro-a-2026-05',
      prestamoId: 'pre-ramiro-a',
      clienteId: 'cli-ramiro',
      fecha: '2026-05-11',
      interes: 200000,
      medio: 'virtual',
    }),
    pago({
      id: 'pag-ramiro-a-2026-06',
      prestamoId: 'pre-ramiro-a',
      clienteId: 'cli-ramiro',
      fecha: '2026-06-11',
      interes: 200000,
      medio: 'virtual',
    }),
  ],
};

// ---------- 5.2 Ernesto Muestra ----------

function pagoErnesto(letra, fecha, interes) {
  const prestamoId = letra === 'a' ? 'pre-ernesto-a' : 'pre-ernesto-b';
  return pago({
    id: `pag-ernesto-${letra}-${fecha.slice(0, 7)}`,
    prestamoId,
    clienteId: 'cli-ernesto',
    fecha,
    interes,
    medio: 'efectivo',
  });
}

const ernesto = {
  nombre: 'Ernesto Muestra',
  descripcion:
    'Caso ajustado para reproducir su cuenta real. 500.000 el 10 de noviembre de 2025 y ' +
    '600.000 el 15 de enero de 2026 (en el Excel figura 2 de marzo de 2026, pero ella ' +
    'cobró 220.000 desde febrero; la fecha queda como duda). Perdón de 20.000 en febrero. ' +
    'A octubre de 2026 debe 820.000 de intereses de 2026 más 100.000 de diciembre de 2025 ' +
    'y 1.100.000 de capital.',
  hoy: '2026-10-31',
  clientes: [
    cliente({
      id: 'cli-ernesto',
      nombre: 'Ernesto Muestra',
      alias: 'Ernesto Empresa',
      telefono: '3109876543',
      nota: 'Papel firmado por los dos préstamos.',
      creadoEn: '2025-11-10',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-ernesto-a',
      clienteId: 'cli-ernesto',
      fecha: '2025-11-10',
      capital: 500000,
      tasa: 20,
      medio: 'efectivo',
      garantia: 'papel firmado',
      nota: 'Cobro los 10 de cada mes, 100.000.',
    }),
    prestamo({
      id: 'pre-ernesto-b',
      clienteId: 'cli-ernesto',
      fecha: '2026-01-15',
      capital: 600000,
      tasa: 20,
      medio: 'efectivo',
      fuentes: [
        { origen: 'caja_efectivo', monto: 400000, nota: '' },
        { origen: 'arriendo', monto: 200000, nota: 'Plata del arriendo de enero' },
      ],
      garantia: 'papel firmado',
      nota: 'Cobro los 15 de cada mes, 120.000. Duda: en el Excel la fecha es 2 de marzo de 2026.',
    }),
  ],
  pagos: [
    // enero: nada.
    // febrero: A 100.000; B 100.000 más perdón de 20.000.
    pagoErnesto('a', '2026-02-10', 100000),
    pagoErnesto('b', '2026-02-15', 100000),
    pago({
      id: 'per-ernesto-b-2026-02',
      prestamoId: 'pre-ernesto-b',
      clienteId: 'cli-ernesto',
      fecha: '2026-02-15',
      tipo: 'perdon',
      interes: 20000,
      medio: 'efectivo',
      nota: 'Le perdonó 20.000 de los intereses de febrero.',
    }),
    // marzo: A 100.000; B 120.000.
    pagoErnesto('a', '2026-03-10', 100000),
    pagoErnesto('b', '2026-03-15', 120000),
    // abril: nada.
    // mayo, junio, julio y septiembre: A 100.000; B 50.000.
    pagoErnesto('a', '2026-05-10', 100000),
    pagoErnesto('b', '2026-05-15', 50000),
    pagoErnesto('a', '2026-06-10', 100000),
    pagoErnesto('b', '2026-06-15', 50000),
    pagoErnesto('a', '2026-07-10', 100000),
    pagoErnesto('b', '2026-07-15', 50000),
    // agosto: A 100.000; B 120.000.
    pagoErnesto('a', '2026-08-10', 100000),
    pagoErnesto('b', '2026-08-15', 120000),
    // septiembre: A 100.000; B 50.000.
    pagoErnesto('a', '2026-09-10', 100000),
    pagoErnesto('b', '2026-09-15', 50000),
    // octubre: nada.
  ],
};

// ---------- 5.3 Marta, capital primero ----------

// Dieciséis pagos de 40.000, uno cada 26 del mes desde octubre de 2024 hasta enero de 2026.
const fechasPagosMarta = [
  '2024-10-26', '2024-11-26', '2024-12-26',
  '2025-01-26', '2025-02-26', '2025-03-26', '2025-04-26', '2025-05-26', '2025-06-26',
  '2025-07-26', '2025-08-26', '2025-09-26', '2025-10-26', '2025-11-26', '2025-12-26',
  '2026-01-26',
];

const marta = {
  nombre: 'Marta',
  descripcion:
    'Modalidad capital primero: prestó 606.000 el 26 de septiembre de 2024 y pactaron un ' +
    'total de 1.665.000. Paga cuotas de 40.000; todo va primero a recuperar el capital y ' +
    'después es ganancia. Lleva 16 pagos (640.000).',
  hoy: '2026-11-20',
  clientes: [
    cliente({
      id: 'cli-marta',
      nombre: 'Marta',
      telefono: '3205551234',
      creadoEn: '2024-09-26',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-marta',
      clienteId: 'cli-marta',
      fecha: '2024-09-26',
      capital: 606000,
      tasa: 0,
      modalidad: 'capital_primero',
      totalPactado: 1665000,
      medio: 'efectivo',
      nota: 'Cuotas de 40.000 hasta completar 1.665.000.',
    }),
  ],
  pagos: fechasPagosMarta.map((fecha, indice) =>
    pago({
      id: `pag-marta-${String(indice + 1).padStart(2, '0')}`,
      prestamoId: 'pre-marta',
      clienteId: 'cli-marta',
      fecha,
      // En capital primero el motor recalcula el reparto; aquí se anota todo como capital.
      capital: 40000,
      medio: 'efectivo',
    })
  ),
};

// ---------- Familia: la mamá, sin interés ----------

const mama = {
  nombre: 'Mamá (familia)',
  descripcion:
    'Préstamo a familia sin interés: 150.000. Pagó 52.000 en efectivo y 30.000 en ' +
    'especie (comida). Debe 68.000. No entra en cartera ni en capital en riesgo.',
  hoy: '2026-10-31',
  clientes: [
    cliente({
      id: 'cli-mama',
      nombre: 'Mamá',
      tipo: 'familia',
      grupo: 'Familia',
      nota: 'Sin interés.',
      creadoEn: '2026-08-01',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-mama',
      clienteId: 'cli-mama',
      fecha: '2026-08-01',
      capital: 150000,
      tasa: 0,
      modalidad: 'sin_interes',
      medio: 'efectivo',
      nota: 'Para el mercado.',
    }),
  ],
  pagos: [
    pago({
      id: 'pag-mama-1',
      prestamoId: 'pre-mama',
      clienteId: 'cli-mama',
      fecha: '2026-09-05',
      capital: 52000,
      medio: 'efectivo',
    }),
    pago({
      id: 'pag-mama-2',
      prestamoId: 'pre-mama',
      clienteId: 'cli-mama',
      fecha: '2026-10-03',
      capital: 30000,
      medio: 'especie',
      descripcion: 'Comida',
    }),
  ],
};

// ---------- Casos sintéticos (nombres inventados, marcados como prueba) ----------

// Tope de intereses: 500.000 al 20% con tope de 500.000. Doce meses después solo se
// causaron 500.000 (cinco periodos de 100.000) y no más.
const tope = {
  nombre: 'Julian (prueba de tope)',
  descripcion:
    'Sintético. 500.000 al 20% con tope de intereses de 500.000, prestado el 2 de ' +
    'noviembre de 2025. Al 2 de noviembre de 2026 los intereses causados son 500.000.',
  hoy: '2026-11-02',
  clientes: [
    cliente({
      id: 'cli-tope',
      nombre: 'Julian (prueba de tope)',
      creadoEn: '2025-11-02',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-tope',
      clienteId: 'cli-tope',
      fecha: '2025-11-02',
      capital: 500000,
      tasa: 20,
      topeInteres: 500000,
      medio: 'efectivo',
      nota: 'Pactaron que los intereses no pasan de 500.000.',
    }),
  ],
  pagos: [],
};

// Préstamo perdido: se voló en abril; no causa intereses después de esa fecha.
const perdido = {
  nombre: 'Cliente perdido (prueba)',
  descripcion:
    'Sintético. 1.000.000 al 20% del 10 de enero de 2026, marcado como perdido el 15 de ' +
    'abril de 2026. Solo se causan febrero, marzo y abril: 600.000.',
  hoy: '2026-10-31',
  clientes: [
    cliente({
      id: 'cli-perdido',
      nombre: 'Cliente perdido (prueba)',
      nota: 'Se voló.',
      creadoEn: '2026-01-10',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-perdido',
      clienteId: 'cli-perdido',
      fecha: '2026-01-10',
      capital: 1000000,
      tasa: 20,
      medio: 'efectivo',
      estadoManual: 'perdido',
      fechaEstado: '2026-04-15',
      nota: 'Dejó de contestar en abril.',
    }),
  ],
  pagos: [],
};

// Préstamo pagado: pagó los intereses de febrero y en marzo pagó intereses y todo el capital.
const pagado = {
  nombre: 'Cliente pagado (prueba)',
  descripcion:
    'Sintético. 1.000.000 al 20% del 10 de enero de 2026. Pagó 200.000 el 10 de febrero ' +
    'y 200.000 más 1.000.000 de capital el 10 de marzo. Queda pagado automáticamente.',
  hoy: '2026-10-31',
  clientes: [
    cliente({
      id: 'cli-pagado',
      nombre: 'Cliente pagado (prueba)',
      creadoEn: '2026-01-10',
    }),
  ],
  prestamos: [
    prestamo({
      id: 'pre-pagado',
      clienteId: 'cli-pagado',
      fecha: '2026-01-10',
      capital: 1000000,
      tasa: 20,
      medio: 'virtual',
    }),
  ],
  pagos: [
    pago({
      id: 'pag-pagado-1',
      prestamoId: 'pre-pagado',
      clienteId: 'cli-pagado',
      fecha: '2026-02-10',
      interes: 200000,
      medio: 'virtual',
    }),
    pago({
      id: 'pag-pagado-2',
      prestamoId: 'pre-pagado',
      clienteId: 'cli-pagado',
      fecha: '2026-03-10',
      interes: 200000,
      capital: 1000000,
      medio: 'virtual',
    }),
  ],
};

export const casos = [ramiro, ernesto, marta, mama, tope, perdido, pagado];
