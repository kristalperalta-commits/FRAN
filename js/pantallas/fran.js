/*
  fran.js: los libros de Fran.
  - Pantalla principal: "Mi plata propia hoy" y una tarjeta por libro.
  - Cada libro: Inicio, Gráficos (dona y categorías), detalle de categoría e Informes.
  - Botón +: opciones propias de cada libro.
  Los préstamos siguen usando sus pantallas (clientes, caja, agenda) dentro del libro azul.
*/

import { render as renderTablero, mostrarSelectorCliente } from './inicio.js';

export const LIBROS = {
  personal: { nombre: 'Finanzas personales', corto: 'Finanzas', color: '#22C55E' },
  prestamos: { nombre: 'Préstamos', corto: 'Préstamos', color: '#3B82F6' },
  pension: { nombre: 'Pensión', corto: 'Pensión', color: '#A855F7' },
  productos: { nombre: 'Productos', corto: 'Productos', color: '#F97316' },
  arriendos: { nombre: 'Arriendos', corto: 'Arriendos', color: '#EAB308' },
  redes: { nombre: 'Redes y trabajos', corto: 'Redes y trabajos', color: '#EC4899' },
  terceros: { nombre: 'Plata de terceros', corto: 'Plata de terceros', color: '#64748B' },
};

const OPCIONES_MAS = {
  personal: [['Gasto', 'gasto'], ['Ingreso', 'ingreso'], ['Transferencia', 'transferencia']],
  arriendos: [['Ingreso', 'ingreso'], ['Gasto de la propiedad', 'gasto']],
  redes: [['Ingreso', 'ingreso'], ['Gasto', 'gasto']],
  productos: [['Inversión', 'inversion'], ['Venta', 'ingreso'], ['Gasto', 'gasto']],
  terceros: [['Recibí', 'ingreso'], ['Devolví', 'gasto'], ['Usé (préstamo interno)', 'uso']],
};

const CUENTAS = ['Efectivo', 'Nequi propio', 'Nequi papá', 'Uno propio', 'Uno Garu', 'Bancolombia', 'Tarjeta comida', 'Tarjeta gasolina', 'Tarjeta Gold'];
const COLORES_DONA = ['#F5D76E', '#7CC4E4', '#EC8FA3', '#7FCDBB', '#A5D88F', '#B79CED', '#F4A261', '#94A3B8'];

// Lo que se ve mientras la app está abierta.
const vista = { mes: null, tipo: 'gasto', orden: 'cantidad', anio: null };

export const titulo = (params) => (params && LIBROS[params.libro] ? LIBROS[params.libro].nombre : '');

// ---------- Cálculos ----------

function asientos(ctx) {
  return (ctx.datos.estado.fran && ctx.datos.estado.fran.asientos) || [];
}

/** El libro verde ve además los ingresos de los negocios; cada libro ve solo lo suyo. */
function delLibro(lista, libro) {
  if (libro === 'personal') return lista.filter((a) => a.libro === 'personal' || (a.tipo === 'ingreso' && !['terceros', 'pension'].includes(a.libro)));
  return lista.filter((a) => a.libro === libro);
}

const sumar = (lista) => lista.reduce((s, a) => s + a.valor, 0);
const delMes = (lista, mes) => lista.filter((a) => a.fecha.slice(0, 7) === mes);
const deTipo = (lista, tipo) => lista.filter((a) => a.tipo === tipo);

function mesVisible(ctx, lista) {
  if (vista.mes) return vista.mes;
  const actual = ctx.hoy().slice(0, 7);
  if (lista.some((a) => a.fecha.slice(0, 7) === actual) || lista.length === 0) return actual;
  return lista.reduce((m, a) => (a.fecha.slice(0, 7) > m && a.fecha.slice(0, 7) <= actual ? a.fecha.slice(0, 7) : m), '0000-00');
}

function moverMes(mes, n, ctx) {
  return ctx.fechas.mesDe(ctx.fechas.sumarMeses(`${mes}-01`, n));
}

function totalPension(fran) {
  const p = fran.pension;
  return p.cuentas.reduce((s, c) => s + Math.round(c.usd * p.tasa), 0) + p.otros.reduce((s, o) => s + o.cop, 0);
}

export function miPlata(ctx) {
  const { motor, datos } = ctx;
  const estado = datos.estado;
  let efectivo = motor.saldoCaja(estado.movimientos, 'efectivo');
  let virtual = motor.saldoCaja(estado.movimientos, 'virtual');
  let tarjetas = (estado.fran.tarjetas || []).reduce((s, t) => s + (t.deuda || 0), 0);
  const mover = (cuenta, valor) => {
    if (!cuenta) return;
    if (cuenta === 'Efectivo') efectivo += valor;
    else if (cuenta.startsWith('Tarjeta')) tarjetas -= valor;
    else virtual += valor;
  };
  for (const a of asientos(ctx)) {
    if (a.tipo === 'transferencia') { mover(a.cuenta, -a.valor); mover(a.destino, a.valor); }
    else if (a.tipo === 'ingreso') mover(a.cuenta, a.valor);
    else mover(a.cuenta, -a.valor);
  }
  return { efectivo, virtual, tarjetas, total: efectivo + virtual - tarjetas };
}

function clientesPorEstado(ctx) {
  const { datos, motor } = ctx;
  const estado = datos.estado;
  const conteo = { al_dia: 0, por_confirmar: 0, atrasado: 0, congelado: 0, legal: 0, perdido: 0 };
  for (const c of estado.clientes) {
    if (c.tipo === 'familia') continue;
    const propios = estado.prestamos.filter((p) => p.clienteId === c.id);
    if (!propios.length) continue;
    const pagos = estado.pagos.filter((g) => g.clienteId === c.id);
    const r = motor.resumenCliente(c, propios, pagos, ctx.hoy());
    const e = r.estado === 'vencido' ? 'atrasado' : r.estado;
    if (e in conteo) conteo[e] += 1;
  }
  return conteo;
}

// ---------- Pantalla principal ----------

function tarjetaLibro(id, valor, detalle, ctx, extra = '') {
  const { ui, dinero } = ctx;
  const l = LIBROS[id];
  return `<a href="#/libro/${id}" class="fran-libro ${extra}" style="--libro:${l.color}">
    <span class="fran-libro__nombre">${ui.esc(l.corto)}</span>
    <span class="fran-libro__valor numero">${typeof valor === 'number' ? dinero.formatear(valor) : ui.esc(valor)}</span>
    <span class="fran-libro__detalle">${ui.esc(detalle)}</span>
  </a>`;
}

function renderPrincipal(contenedor, ctx) {
  const { ui, dinero, datos, motor } = ctx;
  const estado = datos.estado;
  const fran = estado.fran;
  const lista = asientos(ctx);
  const mes = ctx.hoy().slice(0, 7);
  const plata = miPlata(ctx);
  const saldoMes = (libro) => {
    const m = delMes(delLibro(lista, libro), mes);
    return sumar(deTipo(m, 'ingreso')) - sumar(deTipo(m, 'gasto'));
  };
  const resumen = motor.resumenNegocio(estado, ctx.hoy());
  const c = clientesPorEstado(ctx);
  const usd = fran.pension.cuentas.reduce((s, x) => s + x.usd, 0);
  const prod = delLibro(lista, 'productos');
  const invertido = sumar(prod.filter((a) => a.tipo === 'gasto'));
  const terceros = fran.terceros.reduce((s, t) => s + t.valor, 0);
  const sinDatos = !estado.clientes.length && !lista.length;

  contenedor.append(ui.el(`<div class="fran-principal">
    <div class="fran-cabeza"><h1>Fran</h1><a href="#/ajustes" class="fran-yo" aria-label="Yo y ajustes">Yo</a></div>
    <div class="fran-plata">
      <p class="fran-plata__titulo">Mi plata propia hoy</p>
      <p class="fran-plata__valor numero${plata.total < 0 ? ' monto--sale' : ''}">${dinero.formatear(plata.total)}</p>
      <p class="fran-plata__detalle">Efectivo ${dinero.formatear(plata.efectivo)} · Virtual ${fran.virtualPorDefinir ? 'por confirmar' : dinero.formatear(plata.virtual)} · Tarjetas −${dinero.formatear(plata.tarjetas)}</p>
      ${fran.virtualPorDefinir ? '<p class="fran-plata__detalle">Este total todavía no cuenta lo virtual.</p>' : ''}
    </div>
    ${sinDatos ? `<div class="fran-aviso"><p class="negrita">Todavía no están tus datos en este teléfono.</p><p>En Yo entra a la nube con tu correo; si ya los cargaste en otro aparato, aparecen solos. Si es la primera vez, importa el archivo mi-copia-fran.json.</p><a href="#/ajustes" class="boton boton--primario">Ir a Yo</a></div>` : ''}
    <div class="fran-libros">
      ${tarjetaLibro('personal', saldoMes('personal'), 'Saldo del mes', ctx, 'fran-libro--ancho')}
      ${tarjetaLibro('prestamos', resumen.capitalEnCalle, `Por confirmar ${c.por_confirmar} · Al día ${c.al_dia} · Atrasados ${c.atrasado} · Congelados ${c.congelado} · Legal ${c.legal}`, ctx, 'fran-libro--ancho')}
      ${tarjetaLibro('pension', totalPension(fran), `${dinero.formatear(usd)} USD + efectivo + carro`, ctx)}
      ${tarjetaLibro('productos', invertido, 'Invertido', ctx)}
      ${tarjetaLibro('arriendos', sumar(deTipo(delMes(delLibro(lista, 'arriendos'), mes), 'ingreso')), 'Ingresos del mes', ctx)}
      ${tarjetaLibro('redes', sumar(deTipo(delMes(delLibro(lista, 'redes'), mes), 'ingreso')), 'Ingresos del mes', ctx)}
      ${tarjetaLibro('terceros', terceros, 'Nunca suma a tu plata', ctx, 'fran-libro--ancho')}
    </div>
  </div>`));
}

// ---------- Piezas comunes ----------

function cabezaLibro(id, ctx, atras = '#/inicio', texto = null) {
  const { ui } = ctx;
  const l = LIBROS[id];
  return `<header class="fran-franja" style="--libro:${l.color}">
    <a href="${ui.esc(atras)}" class="fran-franja__atras" aria-label="Volver">‹</a>
    <h1>${ui.esc(texto || l.nombre)}</h1>
  </header>`;
}

function selectorMes(mes, ctx) {
  const { ui, fechas } = ctx;
  return `<div class="fran-mes">
    <button type="button" data-mes="-1" aria-label="Mes anterior">‹</button>
    <strong>${ui.esc(fechas.formatearMes(mes))}</strong>
    <button type="button" data-mes="1" aria-label="Mes siguiente">›</button>
  </div>`;
}

function conectarMes(raiz, mes, ctx, redibujar) {
  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => {
    vista.mes = moverMes(mes, Number(b.dataset.mes), ctx);
    redibujar();
  }));
}

function listaPorDia(lista, ctx) {
  const { ui, dinero, fechas } = ctx;
  const orden = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const dias = new Map();
  for (const a of orden) { if (!dias.has(a.fecha)) dias.set(a.fecha, []); dias.get(a.fecha).push(a); }
  let html = '';
  for (const [dia, filas] of dias) {
    const g = sumar(deTipo(filas, 'gasto'));
    const i = sumar(deTipo(filas, 'ingreso'));
    html += `<div class="fran-dia"><span>${ui.esc(fechas.formatear(dia))}</span><span class="suave">${g ? `G: ${dinero.formatear(g)} ` : ''}${i ? `I: ${dinero.formatear(i)}` : ''}</span></div>`;
    for (const a of filas) {
      const signo = a.tipo === 'ingreso' ? '+' : (a.tipo === 'gasto' ? '−' : '');
      html += `<div class="fran-mov">
        <span class="fran-mov__icono">${ui.esc((a.categoria || '?').charAt(0).toUpperCase())}</span>
        <span class="fran-mov__texto"><strong>${ui.esc(a.categoria)}</strong><small>${ui.esc(a.descripcion || '')}</small></span>
        <span class="numero ${a.tipo === 'ingreso' ? 'monto--entra' : ''}">${signo}${dinero.formatear(a.valor)}</span>
      </div>`;
    }
  }
  return html || ui.vacio('No hay movimientos en este mes.');
}

function tresCifras(a, b, c, ctx) {
  const { ui } = ctx;
  return `<div class="fran-cifras">${[a, b, c].map(([t, v]) => `<div><small>${ui.esc(t)}</small><strong class="numero">${ui.esc(v)}</strong></div>`).join('')}</div>`;
}

// ---------- Inicio de cada libro ----------

function renderLibro(contenedor, id, ctx) {
  const redibujar = () => { contenedor.innerHTML = ''; renderLibro(contenedor, id, ctx); };
  if (id === 'prestamos') return renderPrestamos(contenedor, ctx, redibujar);
  if (id === 'pension') return renderPension(contenedor, ctx);
  if (id === 'terceros') return renderTerceros(contenedor, ctx);
  const { ui, dinero } = ctx;
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const m = delMes(lista, mes);
  const g = sumar(deTipo(m, 'gasto'));
  const i = sumar(deTipo(m, 'ingreso'));
  const nombres = id === 'productos' ? ['Metí', 'Vendí', 'Ganancia'] : ['Gastos', 'Ingresos', 'Saldo'];
  const raiz = ui.el(`<div>
    ${cabezaLibro(id, ctx)}
    ${selectorMes(mes, ctx)}
    ${tresCifras([nombres[0], dinero.formatear(g)], [nombres[1], dinero.formatear(i)], [nombres[2], dinero.formatear(i - g)], ctx)}
    <div class="fran-lista">${listaPorDia(m, ctx)}</div>
  </div>`);
  contenedor.append(raiz);
  conectarMes(raiz, mes, ctx, redibujar);
}

function renderPrestamos(contenedor, ctx, redibujar) {
  const { ui, dinero, datos, motor } = ctx;
  const estado = datos.estado;
  const lista = delLibro(asientos(ctx), 'prestamos');
  const mes = mesVisible(ctx, lista);
  const enMes = (f) => f.slice(0, 7) === mes;
  const presto = estado.prestamos.filter((p) => enMes(p.fecha)).reduce((s, p) => s + p.capital, 0);
  const pagos = estado.pagos.filter((g) => g.tipo !== 'perdon' && enMes(g.fecha));
  const capital = pagos.reduce((s, g) => s + g.capital, 0);
  const intereses = pagos.reduce((s, g) => s + g.interes, 0) + sumar(deTipo(delMes(lista, mes), 'ingreso'));
  const r = motor.resumenNegocio(estado, ctx.hoy());
  const c = clientesPorEstado(ctx);
  const raiz = ui.el(`<div>
    ${cabezaLibro('prestamos', ctx)}
    ${selectorMes(mes, ctx)}
    ${tresCifras(['Presté', dinero.formatear(presto)], ['Cobré capital', estado.pagos.length ? dinero.formatear(capital) : 'Sin datos'], ['Intereses', dinero.formatear(intereses)], ctx)}
    <div class="tarjetas-dos margen-abajo">
      <div class="tarjeta"><p class="tarjeta__titulo">${estado.prestamos.some((x) => x.porConfirmar) ? 'Capital anotado' : 'Cartera'}</p><p class="tarjeta__valor numero">${dinero.formatear(r.capitalEnCalle + r.interesesPendientes)}</p></div>
      <div class="tarjeta"><p class="tarjeta__titulo">Ganancia del mes</p><p class="tarjeta__valor numero">${dinero.formatear(intereses)}</p></div>
    </div>
    <div class="fran-estados">
      <span>Por confirmar <b>${c.por_confirmar}</b></span><span>Al día <b>${c.al_dia}</b></span><span>Atrasados <b>${c.atrasado}</b></span><span>Congelados <b>${c.congelado}</b></span><span>Legal <b>${c.legal}</b></span><span>Se voló <b>${c.perdido}</b></span>
    </div>
    <div class="fran-accesos">
      <a href="#/clientes" class="boton boton--secundario">Clientes</a>
      <a href="#/agenda" class="boton boton--secundario">Agenda</a>
      <a href="#/caja" class="boton boton--secundario">Caja</a>
      <a href="#/libro/prestamos/personas" class="boton boton--secundario">Quién me pagó</a>
    </div>
    <div class="fran-lista">${listaPorDia(delMes(lista, mes), ctx)}</div>
  </div>`);
  contenedor.append(raiz);
  conectarMes(raiz, mes, ctx, redibujar);
}

function renderPersonas(contenedor, ctx) {
  const { ui, dinero } = ctx;
  const lista = deTipo(delLibro(asientos(ctx), 'prestamos'), 'ingreso').filter((a) => a.persona);
  const porPersona = new Map();
  for (const a of lista) porPersona.set(a.persona, (porPersona.get(a.persona) || 0) + a.valor);
  const filas = [...porPersona].sort((a, b) => b[1] - a[1]);
  const maximo = filas.length ? filas[0][1] : 1;
  contenedor.append(ui.el(`<div>
    ${cabezaLibro('prestamos', ctx, '#/libro/prestamos', 'Quién me pagó')}
    <p class="suave fran-nota">Intereses que anotaste en Mis Gastos, con el nombre como lo escribiste. Solo meses con detalle. Sin saber si fue efectivo o virtual.</p>
    <div class="fran-lista">${filas.map(([nombre, total]) => `<a href="#/libro/prestamos/persona/${encodeURIComponent(nombre)}" class="fran-barra-fila">
      <span class="fran-barra-fila__fila"><strong>${ui.esc(nombre)}</strong><span class="numero">${dinero.formatear(total)}</span></span>
      <span class="fran-barra" style="width:${Math.max(2, (total / maximo) * 100)}%;--libro:${LIBROS.prestamos.color}"></span>
    </a>`).join('') || ui.vacio('Todavía no hay pagos por persona.')}</div>
  </div>`));
}

function filasDetalle(lista, total, id, ctx) {
  const { ui, dinero, fechas } = ctx;
  const ordenada = [...lista].sort((a, b) => (vista.orden === 'cantidad' ? b.valor - a.valor : b.fecha.localeCompare(a.fecha)));
  const maximo = ordenada.reduce((m, a) => Math.max(m, a.valor), 1);
  return ordenada.map((a) => `<div class="fran-barra-fila">
    <span class="fran-barra-fila__fila"><strong>${ui.esc(a.descripcion || a.categoria)}</strong><span class="numero">${dinero.formatear(a.valor)}</span></span>
    <span class="fran-barra-fila__fila"><span class="fran-barra" style="width:${Math.max(1.5, (a.valor / maximo) * 72)}%;--libro:${LIBROS[id].color}"></span><small>${(total ? (a.valor / total) * 100 : 0).toFixed(2).replace('.', ',')}%</small></span>
    <span class="fran-barra-fila__fila"><small class="suave">${ui.esc(fechas.formatear(a.fecha))}</small>${a.importado ? '' : `<button type="button" class="boton boton--pequeno" data-borrar="${ui.esc(a.id)}">Borrar</button>`}</span>
  </div>`).join('');
}

function renderDetalle(contenedor, id, tituloDetalle, lista, atras, ctx) {
  const { ui, dinero, datos } = ctx;
  const total = sumar(lista);
  const dibujar = () => {
    contenedor.innerHTML = '';
    const raiz = ui.el(`<div>
      ${cabezaLibro(id, ctx, atras, tituloDetalle)}
      <p class="fran-total"><strong>Total: ${dinero.formatear(total)}</strong><br>Movimientos: ${lista.length}</p>
      <div class="fran-orden">
        <button type="button" data-orden="cantidad" class="${vista.orden === 'cantidad' ? 'activo' : ''}">Ordenar por cantidad</button>
        <button type="button" data-orden="fecha" class="${vista.orden === 'fecha' ? 'activo' : ''}">Ordenar por fecha</button>
      </div>
      <div class="fran-lista">${filasDetalle(lista, total, id, ctx) || ui.vacio('Sin movimientos.')}</div>
    </div>`);
    raiz.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', () => { vista.orden = b.dataset.orden; dibujar(); }));
    raiz.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
      if (await ui.confirmar('¿Borrar este movimiento?', { aceptar: 'Sí, borrar', peligro: true })) await datos.eliminarAsiento(b.dataset.borrar);
    }));
    contenedor.append(raiz);
  };
  dibujar();
}

// ---------- Gráficos ----------

function dona(grupos, total, ctx) {
  const { dinero } = ctx;
  const r = 42;
  const circ = 2 * Math.PI * r;
  let giro = 0;
  const arcos = grupos.map((g, i) => {
    const largo = total ? (g[1] / total) * circ : 0;
    const arco = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${COLORES_DONA[i % COLORES_DONA.length]}" stroke-width="15" stroke-dasharray="${Math.max(largo - 1, 0)} ${circ}" stroke-dashoffset="${-giro}" transform="rotate(-90 60 60)"/>`;
    giro += largo;
    return arco;
  }).join('');
  const texto = total >= 1000000 ? `${(total / 1000000).toFixed(2).replace('.', ',')} M` : dinero.formatear(total);
  return `<svg viewBox="0 0 120 120" class="fran-dona" role="img" aria-label="Reparto por categoría">${arcos}<text x="60" y="64" text-anchor="middle" class="fran-dona__texto">${texto}</text></svg>`;
}

function renderGraficos(contenedor, id, ctx) {
  const { ui, dinero } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderGraficos(contenedor, id, ctx); };
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const m = deTipo(delMes(lista, mes), vista.tipo);
  const total = sumar(m);
  const porCat = new Map();
  for (const a of m) porCat.set(a.categoria, (porCat.get(a.categoria) || 0) + a.valor);
  const filas = [...porCat].sort((a, b) => b[1] - a[1]);
  const grupos = filas.slice(0, 4);
  if (filas.length > 4) grupos.push(['Otro', filas.slice(4).reduce((s, f) => s + f[1], 0)]);
  const pct = (v) => (total ? (v / total) * 100 : 0).toFixed(2).replace('.', ',');
  const raiz = ui.el(`<div>
    ${cabezaLibro(id, ctx, `#/libro/${id}`, 'Gráficos')}
    <div class="fran-orden">
      <button type="button" data-tipo="gasto" class="${vista.tipo === 'gasto' ? 'activo' : ''}">Gastos</button>
      <button type="button" data-tipo="ingreso" class="${vista.tipo === 'ingreso' ? 'activo' : ''}">Ingresos</button>
    </div>
    ${selectorMes(mes, ctx)}
    ${total ? `<div class="fran-grafico">${dona(grupos, total, ctx)}
      <ul class="fran-leyenda">${grupos.map((g, i) => `<li><i style="background:${COLORES_DONA[i % COLORES_DONA.length]}"></i><span>${ui.esc(g[0])}</span><b>${pct(g[1])}%</b></li>`).join('')}</ul></div>` : ui.vacio('No hay movimientos en este mes.')}
    <div class="fran-lista">${filas.map(([cat, v]) => `<a href="#/libro/${id}/categoria/${vista.tipo}/${encodeURIComponent(cat)}" class="fran-barra-fila">
      <span class="fran-barra-fila__fila"><strong>${ui.esc(cat)}</strong><span class="numero">${dinero.formatear(v)}</span></span>
      <span class="fran-barra-fila__fila"><span class="fran-barra" style="width:${Math.max(1.5, (v / filas[0][1]) * 72)}%;--libro:${LIBROS[id].color}"></span><small>${pct(v)}%</small></span>
    </a>`).join('')}</div>
  </div>`);
  raiz.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { vista.tipo = b.dataset.tipo; redibujar(); }));
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

// ---------- Informes ----------

function calendario(id, mes, ctx) {
  const { ui, dinero, fechas, datos } = ctx;
  const anio = Number(mes.slice(0, 4));
  const num = Number(mes.slice(5, 7));
  const dias = fechas.diasDelMes(anio, num);
  const presupuesto = Math.round(datos.estado.fran.presupuestoMensual / dias);
  const gastos = deTipo(delMes(delLibro(asientos(ctx), id), mes), 'gasto').filter((a) => !a.sinDetalle);
  const porDia = new Map();
  for (const a of gastos) porDia.set(Number(a.fecha.slice(8)), (porDia.get(Number(a.fecha.slice(8))) || 0) + a.valor);
  const inicio = new Date(anio, num - 1, 1).getDay();
  let celdas = '<span></span>'.repeat(inicio);
  for (let d = 1; d <= dias; d++) {
    const v = porDia.get(d);
    const clase = v === undefined ? '' : (v > presupuesto ? 'rojo' : 'verde');
    celdas += `<span class="${clase}">${d}</span>`;
  }
  return `<div class="tarjeta"><p class="tarjeta__titulo">Calendario</p>
    <div class="fran-cal">${['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((x) => `<b>${x}</b>`).join('')}${celdas}</div>
    <p class="tarjeta__detalle">Rojo: por encima del presupuesto. Verde: dentro. Presupuesto diario: ${ui.esc(dinero.formatear(presupuesto))}</p>
  </div>`;
}

function renderInformes(contenedor, id, ctx) {
  const { ui, dinero, fechas } = ctx;
  const redibujar = () => { contenedor.innerHTML = ''; renderInformes(contenedor, id, ctx); };
  const lista = delLibro(asientos(ctx), id);
  const mes = mesVisible(ctx, lista);
  const anios = [...new Set(lista.map((a) => a.fecha.slice(0, 4)))].sort().reverse();
  const anio = vista.anio && anios.includes(vista.anio) ? vista.anio : (anios[0] || ctx.hoy().slice(0, 4));
  let tg = 0; let ti = 0;
  const filas = [];
  for (let n = 1; n <= 12; n++) {
    const clave = `${anio}-${String(n).padStart(2, '0')}`;
    const m = delMes(lista, clave);
    const g = sumar(deTipo(m, 'gasto')); const i = sumar(deTipo(m, 'ingreso'));
    tg += g; ti += i;
    if (g || i) filas.push(`<tr><th>${ui.esc(fechas.nombreMes(n, true))}</th><td class="numero">${dinero.formatear(g)}</td><td class="numero">${dinero.formatear(i)}</td><td class="numero">${dinero.formatear(i - g)}</td></tr>`);
  }
  const raiz = ui.el(`<div>
    ${cabezaLibro(id, ctx, `#/libro/${id}`, 'Informes')}
    <div class="fran-anios">${anios.map((a) => `<button type="button" data-anio="${a}" class="${a === anio ? 'activo' : ''}">${a}</button>`).join('')}</div>
    <div class="tarjeta"><p class="tarjeta__titulo">Tabla anual ${ui.esc(anio)}</p>
      <table class="fran-tabla"><thead><tr><th>Mes</th><th>Gastos</th><th>Ingresos</th><th>Saldo</th></tr></thead>
      <tbody>${filas.join('')}</tbody>
      <tfoot><tr><th>Total</th><td class="numero">${dinero.formatear(tg)}</td><td class="numero">${dinero.formatear(ti)}</td><td class="numero">${dinero.formatear(ti - tg)}</td></tr></tfoot></table>
    </div>
    ${id === 'personal' ? `${selectorMes(mes, ctx)}${calendario(id, mes, ctx)}` : ''}
  </div>`);
  raiz.querySelectorAll('[data-anio]').forEach((b) => b.addEventListener('click', () => { vista.anio = b.dataset.anio; redibujar(); }));
  conectarMes(raiz, mes, ctx, redibujar);
  contenedor.append(raiz);
}

// ---------- Pensión y terceros ----------

function renderPension(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const p = fran.pension;
  const deuda = fran.deudasInternas.reduce((s, d) => s + d.valor, 0);
  const raiz = ui.el(`<div>
    ${cabezaLibro('pension', ctx)}
    <div class="fran-plata" style="--libro:${LIBROS.pension.color}">
      <p class="fran-plata__titulo">Total pensión</p>
      <p class="fran-plata__valor numero">${dinero.formatear(totalPension(fran))}</p>
    </div>
    <form class="fran-tasa" id="fran-tasa"><label for="tasa">Tasa del día COP/USD</label><input id="tasa" name="tasa" inputmode="numeric" value="${ui.esc(p.tasa)}"><button class="boton boton--pequeno boton--secundario">Guardar</button></form>
    <div class="fran-lista">
      ${p.cuentas.map((c) => `<div class="fran-mov"><span class="fran-mov__texto"><strong>${ui.esc(c.nombre)}</strong><small class="numero">${dinero.formatear(Math.round(c.usd * p.tasa))}</small></span><span class="numero">${dinero.formatear(c.usd)} USD</span></div>`).join('')}
      ${p.otros.map((o) => `<div class="fran-mov"><span class="fran-mov__texto"><strong>${ui.esc(o.nombre)}</strong><small>${ui.esc(o.nota || '')}</small></span><span class="numero">${dinero.formatear(o.cop)}</span></div>`).join('')}
    </div>
    ${deuda ? `<div class="tarjeta"><p class="tarjeta__titulo">Me debe el negocio</p><p class="tarjeta__valor numero">${dinero.formatear(deuda)}</p></div>` : ''}
    ${!p.cuentas.length ? ui.vacio('Importa tu copia para ver las cuentas.') : ''}
  </div>`);
  raiz.querySelector('#fran-tasa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tasa = Number(String(e.target.tasa.value).replace(/\D/g, ''));
    if (!(tasa > 0)) { ui.toast('Escribe una tasa válida.'); return; }
    await datos.actualizarFran({ pension: { ...p, tasa } });
    ui.toast('Tasa guardada.');
  });
  contenedor.append(raiz);
}

function renderTerceros(contenedor, ctx) {
  const { ui, dinero, datos } = ctx;
  const fran = datos.estado.fran;
  const lista = delLibro(asientos(ctx), 'terceros');
  contenedor.append(ui.el(`<div>
    ${cabezaLibro('terceros', ctx)}
    <p class="suave fran-nota">Plata que guardas para otros. Nunca suma a tu plata propia.</p>
    <div class="fran-lista">${fran.terceros.map((t) => `<div class="fran-mov"><span class="fran-mov__texto"><strong>${ui.esc(t.nombre)}</strong><small>${ui.esc(t.nota || '')}</small></span><span class="numero">${dinero.formatear(t.valor)}</span></div>`).join('') || ui.vacio('Sin plata de terceros.')}</div>
    <div class="fran-lista">${listaPorDia(lista, ctx)}</div>
  </div>`));
}

// ---------- Botón + y formulario ----------

export function abrirMas(id, ctx) {
  const { ui } = ctx;
  let opciones;
  if (id === 'prestamos') {
    opciones = [['Nuevo préstamo', '#/prestamos/elegir/prestamo'], ['Abono a capital', '#/prestamos/elegir/pago'], ['Pago de intereses', '#/prestamos/elegir/pago'], ['Acuerdo de pago', '#/clientes']];
  } else if (id === 'pension') {
    opciones = [['Ingreso', '#/libro/pension/mover/ingreso'], ['Retiro', '#/libro/pension/mover/retiro'], ['Mover entre cuentas', '#/libro/pension/mover/mover']];
  } else {
    opciones = (OPCIONES_MAS[id] || OPCIONES_MAS.personal).map(([t, tipo]) => [t, `#/libro/${id}/nuevo/${tipo}`]);
  }
  const hoja = ui.el(`<div class="fran-hoja" role="dialog" aria-label="Agregar"><div class="fran-hoja__caja" style="--libro:${LIBROS[id].color}">
    <p class="negrita">${ui.esc(LIBROS[id].nombre)}</p>
    ${opciones.map(([t, r]) => `<a href="${ui.esc(r)}" class="fran-hoja__opcion">${ui.esc(t)}</a>`).join('')}
    <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
  </div></div>`);
  document.body.append(hoja);
  hoja.addEventListener('click', (e) => {
    if (e.target === hoja || e.target.closest('[data-cerrar]') || e.target.closest('a')) hoja.remove();
  });
}

function chips(nombre, valores, inicial, ui) {
  return `<div class="fran-chips" data-chips="${ui.esc(nombre)}">${valores.map((v) => `<button type="button" class="${v === inicial ? 'activo' : ''}" data-valor="${ui.esc(v)}">${ui.esc(v)}</button>`).join('')}<input type="hidden" name="${ui.esc(nombre)}" value="${ui.esc(inicial)}"></div>`;
}

function renderNuevo(contenedor, id, tipoForm, ctx) {
  const { ui, datos, fechas } = ctx;
  const esTransfer = tipoForm === 'transferencia';
  const tipo = ['inversion', 'uso'].includes(tipoForm) ? 'gasto' : tipoForm;
  const titulos = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', inversion: 'Inversión', uso: 'Usé' };
  const usadas = {};
  for (const a of delLibro(asientos(ctx), id)) if (a.tipo === tipo) usadas[a.categoria] = (usadas[a.categoria] || 0) + 1;
  const categorias = Object.keys(usadas).sort((a, b) => usadas[b] - usadas[a]).slice(0, 12);
  if (tipoForm === 'inversion') categorias.unshift('Inversión');
  if (tipoForm === 'uso') categorias.unshift('Préstamo interno');
  const raiz = ui.el(`<div>
    ${cabezaLibro(id, ctx, `#/libro/${id}`, titulos[tipoForm] || 'Agregar')}
    <form class="formulario" novalidate>
      ${ui.campoDinero({ etiqueta: 'Valor', nombre: 'valor', requerido: true, ayuda: 'Puedes escribir 60k o 1.5M.' })}
      ${esTransfer ? '' : `<div class="campo"><span class="campo__etiqueta">Categoría</span>${chips('categoria', categorias.length ? categorias : ['Otros'], categorias[0] || 'Otros', ui)}</div>
      ${ui.campo({ etiqueta: 'O una categoría nueva', nombre: 'nueva', placeholder: 'Opcional' })}
      ${ui.campo({ etiqueta: '¿Para qué?', nombre: 'descripcion', placeholder: 'Puedes dictar con el micrófono del teclado' })}`}
      <div class="campo"><span class="campo__etiqueta">${esTransfer ? 'Sale de' : (tipo === 'ingreso' ? 'Entra por' : 'Pagado con')}</span>${chips('cuenta', CUENTAS, 'Efectivo', ui)}</div>
      ${esTransfer ? `<div class="campo"><span class="campo__etiqueta">Entra a</span>${chips('destino', CUENTAS, 'Nequi propio', ui)}</div>` : ''}
      ${ui.campoFecha({ etiqueta: 'Fecha', nombre: 'fecha', valor: ctx.hoy(), requerido: true })}
      <div class="botones"><a href="#/libro/${id}" class="boton boton--secundario">Cancelar</a><button class="boton boton--primario">Guardar</button></div>
    </form></div>`);
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-valor]');
    if (!b) return;
    const caja = b.closest('[data-chips]');
    caja.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
    caja.querySelector('input').value = b.dataset.valor;
  });
  raiz.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = ui.leerFormulario(e.target);
    if (!Number.isInteger(v.valor) || v.valor <= 0) { ui.toast('Escribe un valor mayor que cero.'); return; }
    if (!fechas.esFechaValida(v.fecha)) { ui.toast('Escribe una fecha válida.'); return; }
    if (esTransfer && v.cuenta === v.destino) { ui.toast('Elige dos cuentas distintas.'); return; }
    try {
      await datos.agregarAsiento({ libro: id, fecha: v.fecha, tipo, categoria: esTransfer ? 'Transferencia' : (v.nueva || v.categoria), descripcion: v.descripcion, valor: v.valor, cuenta: id === 'terceros' ? '' : v.cuenta, destino: v.destino });
      ui.toast('Guardado.');
      ctx.navegar(`/libro/${id}`);
    } catch (error) { ui.toast(error.message); }
  });
  contenedor.append(raiz);
}

function renderMoverPension(contenedor, accion, ctx) {
  const { ui, datos } = ctx;
  const p = datos.estado.fran.pension;
  const nombres = p.cuentas.map((c) => c.nombre);
  const titulos = { ingreso: 'Ingreso', retiro: 'Retiro', mover: 'Mover entre cuentas' };
  const raiz = ui.el(`<div>
    ${cabezaLibro('pension', ctx, '#/libro/pension', titulos[accion])}
    ${nombres.length ? `<form class="formulario" novalidate>
      ${ui.campo({ etiqueta: 'Valor en USD', nombre: 'usd', requerido: true, atributos: { inputmode: 'decimal' } })}
      <div class="campo"><span class="campo__etiqueta">${accion === 'ingreso' ? 'Dónde queda guardada' : 'De dónde sale'}</span>${chips('cuenta', nombres, nombres[0], ui)}</div>
      ${accion === 'mover' ? `<div class="campo"><span class="campo__etiqueta">A dónde va</span>${chips('destino', nombres, nombres[1] || nombres[0], ui)}</div>` : ''}
      ${ui.campo({ etiqueta: 'Por qué', nombre: 'nota' })}
      <div class="botones"><a href="#/libro/pension" class="boton boton--secundario">Cancelar</a><button class="boton boton--primario">Guardar</button></div>
    </form>` : ui.vacio('Importa tu copia para ver las cuentas.')}</div>`);
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-valor]');
    if (!b) return;
    const caja = b.closest('[data-chips]');
    caja.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
    caja.querySelector('input').value = b.dataset.valor;
  });
  const form = raiz.querySelector('form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = ui.leerFormulario(form);
    const usd = Number(String(v.usd).replace(',', '.'));
    if (!(usd > 0)) { ui.toast('Escribe un valor mayor que cero.'); return; }
    if (accion === 'mover' && v.cuenta === v.destino) { ui.toast('Elige dos cuentas distintas.'); return; }
    const cuentas = p.cuentas.map((c) => {
      let n = c.usd;
      if (c.nombre === v.cuenta) n += accion === 'ingreso' ? usd : -usd;
      if (accion === 'mover' && c.nombre === v.destino) n += usd;
      return { ...c, usd: Math.round(n * 100) / 100 };
    });
    await datos.actualizarFran({ pension: { ...p, cuentas } });
    ui.toast('Guardado.');
    ctx.navegar('/libro/pension');
  });
  contenedor.append(raiz);
}

// ---------- Entrada ----------

export async function render(contenedor, params, ctx) {
  contenedor.innerHTML = '';
  const id = params.libro;
  switch (params.vista) {
    case 'principal': return renderPrincipal(contenedor, ctx);
    case 'libro': return renderLibro(contenedor, id, ctx);
    case 'graficos': return renderGraficos(contenedor, id, ctx);
    case 'informes': return renderInformes(contenedor, id, ctx);
    case 'nuevo': return renderNuevo(contenedor, id, params.tipo, ctx);
    case 'moverPension': return renderMoverPension(contenedor, params.accion, ctx);
    case 'personas': return renderPersonas(contenedor, ctx);
    case 'persona': {
      const lista = deTipo(delLibro(asientos(ctx), 'prestamos'), 'ingreso').filter((a) => a.persona === params.nombre);
      return renderDetalle(contenedor, 'prestamos', params.nombre, lista, '#/libro/prestamos/personas', ctx);
    }
    case 'categoria': {
      const mes = mesVisible(ctx, delLibro(asientos(ctx), id));
      const lista = deTipo(delMes(delLibro(asientos(ctx), id), mes), params.tipo).filter((a) => a.categoria === params.categoria);
      return renderDetalle(contenedor, id, params.categoria, lista, `#/libro/${id}/graficos`, ctx);
    }
    case 'resumen': return renderTablero(contenedor, params, ctx);
    case 'elegir': {
      contenedor.append(ctx.ui.el(cabezaLibro('prestamos', ctx, '#/libro/prestamos', 'Elige el cliente')));
      const lugar = ctx.ui.el('<div></div>');
      contenedor.append(lugar);
      return mostrarSelectorCliente(lugar, params.accion, ctx);
    }
    default: throw new Error('Vista desconocida.');
  }
}
