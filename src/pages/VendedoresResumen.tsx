import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, Clock, ShoppingBag, Users, ChevronDown, ChevronUp,
  Store, Search, Filter, Calendar, ArrowUpDown, ChevronLeft,
  ChevronRight, Loader2, Trophy, Star, BarChart2, AlertTriangle,
  Database, TrendingDown, Zap,
} from "lucide-react";

// ─── Tipos base ───────────────────────────────────────────────────────────────

interface UsuarioApp {
  id: string; username: string; name: string;
  FFVV: string; ffvv?: string; supervisor: string; role: string;
}

interface ChessVenta {
  id: number; numero: string; fecha_comprobante: string;
  descripcion_comprobante: string;
  cliente: string; categoria: string; division: string;
  marca: string; unidad_de_negocio: string; codigo_articulo: string;
  bultos_total: number; subtotal_final: number;
  id_vendedor: number | string;
}

// Todos los comprobantes se incluyen — devoluciones y notas de crédito
// tienen subtotal_final negativo y restan automáticamente al sumar
const esVentaValida = (_v: ChessVenta) => true;

interface Snapshot {
  id: number; username: string;
  pdv_planificados: number; pdv_visitados: number; pdv_menos_5_min: number;
  horas_trabajadas: number; puntos_gps: number;
  primera_marca: string; ultima_marca: string;
  created_at: string; fecha: string;
  snapshot_taken_at: string;
}

interface VendedorStats {
  username: string; name: string;
  ffvv: string; ffvvRaw: string; supervisor: string;
  ultimaFecha: string | null;
  horasTrabajadas: number; pdvPlanificados: number; pdvVisitados: number;
  promHoras: number; promPdvVisitados: number; diasConActividad: number;
}

// ─── Tipos de config desde Supabase ──────────────────────────────────────────

interface VariableConfig {
  username: string; nombre_mostrar: string; ffvv: string; periodo: string;
  escala_pozo_id: string; base_cartera_sana: number;
  sku1_obj: number; sku2_obj: number; sku3_obj: number; sku4_obj: number; sku5_obj: number;
  sku1_min_compra: number; sku2_min_compra: number; sku3_min_compra: number;
  sku4_min_compra: number; sku5_min_compra: number;
  min_horas_dia: number; max_pct_menos5min: number;
  min_clientes_cob: number; venta_min_cliente: number;
}

interface TramoPozo { escala_id: string; desde_monto: number; pct_pozo: number; }

interface SkuDefinicion {
  ffvv_grupo: string; sku_num: number; nombre_grupo: string;
  campo_filtro: string; valor_filtro: string;
  condicion_min_compra: string; obj_clientes_unicos: number;
}

// ─── Lógica de períodos desacoplados ─────────────────────────────────────────
//
// El sistema de entrega tiene 2 días hábiles de delay:
//   - Disciplina/actividad: snapshots desde el 3er día hábil del mes anterior
//     hasta el 2do día hábil del mes siguiente (inclusive)
//   - Ventas: del 1 al último día del mes calendario
//
// Concretamente para junio 2026:
//   - Snapshots: 28/5 → 26/6 (lunes a viernes, sin feriados)
//   - Ventas: 01/6 → 30/6
//
// Para el selector de mes usamos el mes de las VENTAS como referencia.

interface Periodo {
  label: string;           // "Junio 2026"
  mesVentas: string;       // "2026-06"
  ultimoDiaVentas: string; // "2026-06-30" — último día real del mes
  snapDesde: string;       // "2026-05-28"
  snapHasta: string;       // "2026-06-26"
  diasHabiles: number;
}

function esHabil(fecha: Date): boolean {
  const dow = fecha.getDay(); // 0=Dom, 6=Sab
  return dow !== 0 && dow !== 6;
}

function addDiasHabiles(fecha: Date, n: number): Date {
  let d = new Date(fecha);
  let restantes = Math.abs(n);
  const dir = n >= 0 ? 1 : -1;
  while (restantes > 0) {
    d.setDate(d.getDate() + dir);
    if (esHabil(d)) restantes--;
  }
  return d;
}

function contarDiasHabiles(desde: string, hasta: string): number {
  const d = new Date(desde + "T12:00:00");
  const h = new Date(hasta + "T12:00:00");
  let count = 0;
  let cur = new Date(d);
  while (cur <= h) {
    if (esHabil(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function primerDiaHabilDelMes(anio: number, mes: number): Date {
  let d = new Date(anio, mes - 1, 1);
  while (!esHabil(d)) d.setDate(d.getDate() + 1);
  return d;
}

function ultimoDiaHabilDelMes(anio: number, mes: number): Date {
  let d = new Date(anio, mes, 0); // último día del mes
  while (!esHabil(d)) d.setDate(d.getDate() - 1);
  return d;
}

function toYMD(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 10);
}

function buildPeriodo(anio: number, mes: number): Periodo {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Ventas: 1ro al último del mes
  const mesVentas = `${anio}-${String(mes).padStart(2, "0")}`;
  const primerVenta = `${mesVentas}-01`;
  const ultimoVenta = toYMD(new Date(anio, mes, 0));

  // Snapshots: empiezan 2 días hábiles ANTES del primer día hábil del mes de ventas
  // (porque la venta del 28/5 se factura el 1/6)
  const primerHabilMes = primerDiaHabilDelMes(anio, mes);
  const snapDesde      = toYMD(addDiasHabiles(primerHabilMes, -2));

  // Snapshots terminan 2 días hábiles ANTES del primer día hábil del mes siguiente
  const primerHabilSig = primerDiaHabilDelMes(anio, mes === 12 ? 1 : mes + 1, );
  const snapHasta      = toYMD(addDiasHabiles(primerHabilSig, -2));

  // Días hábiles del mes (para proyección)
  const diasHabiles = contarDiasHabiles(
    toYMD(primerHabilMes),
    toYMD(ultimoDiaHabilDelMes(anio, mes))
  );

    const ultimoDiaVentas = toYMD(new Date(anio, mes, 0));
  return { label: `${meses[mes-1]} ${anio}`, mesVentas, ultimoDiaVentas, snapDesde, snapHasta, diasHabiles };
}

// Genera últimos N meses + mes actual
function generarPeriodos(n: number = 4): Periodo[] {
  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;
  const resultado: Periodo[] = [];
  for (let i = 0; i < n; i++) {
    let m = mes - i;
    let a = anio;
    if (m <= 0) { m += 12; a -= 1; }
    resultado.push(buildPeriodo(a, m));
  }
  return resultado.reverse(); // más antiguo primero
}

// ─── Cache global ─────────────────────────────────────────────────────────────

let _tramosCache: TramoPozo[]   | null = null;
let _skuDefCache: SkuDefinicion[]| null = null;

async function cargarTablasMaestra(): Promise<{ tramos: TramoPozo[]; skuDef: SkuDefinicion[] }> {
  if (_tramosCache && _skuDefCache) return { tramos: _tramosCache, skuDef: _skuDefCache };
  const [{ data: tramos }, { data: skuDef }] = await Promise.all([
    supabase.from("variable_tramos_pozo").select("escala_id, desde_monto, pct_pozo").order("escala_id").order("desde_monto"),
    supabase.from("variable_sku_definicion").select("*").order("ffvv_grupo").order("sku_num"),
  ]);
  _tramosCache = (tramos || []) as TramoPozo[];
  _skuDefCache = (skuDef  || []) as SkuDefinicion[];
  return { tramos: _tramosCache, skuDef: _skuDefCache };
}

// ─── SKU match desde definición Supabase ─────────────────────────────────────

interface SkuGrupo {
  nombre: string; descripcion: string;
  objClientes: number; minCompra: number;
  match: (v: ChessVenta) => boolean;
}

function buildSkuMatch(def: SkuDefinicion): (v: ChessVenta) => boolean {
  const campo = def.campo_filtro.trim();
  const valor = def.valor_filtro.trim();
  const nombre = def.nombre_grupo?.trim().toUpperCase() ?? "";

  // ── Jamón Sadia: (marca SADIA AND cod 597030/559467) OR cod 1153 independiente
  if (nombre === "JAMON SADIA" || campo === "jamon_sadia_especial") {
    const todos = valor.split(";").map((s) => s.trim());
    return (v) => {
      const cod   = String(v.codigo_articulo).trim();
      const marca = v.marca?.trim().toUpperCase() ?? "";
      return (marca === "SADIA" && ["597030","559467"].includes(cod)) || cod === "1153";
    };
  }

  // ── Lucchetti Fideos: marca=LUCCHETTI AND division=FIDEOS
  if (nombre === "LUCCHETTI FIDEOS" || campo === "lucchetti_fideos_especial") {
    return (v) =>
      v.marca?.trim().toUpperCase() === "LUCCHETTI" &&
      v.division?.trim().toUpperCase() === valor.toUpperCase();
  }

  // ── Danica: unidad_de_negocio IN [MAYONESAS Y ADEREZOS, MARGARINAS]
  if (nombre === "DANICA") {
    return (v) => ["MAYONESAS Y ADEREZOS","MARGARINAS"].includes(v.unidad_de_negocio?.trim().toUpperCase() ?? "");
  }

  // ── Lógica genérica para el resto ──────────────────────────────────────────
  if (campo.includes("AND") && campo.includes("division")) {
    const marcaMatch = campo.match(/marca=(\S+)/)?.[1]?.toUpperCase() ?? "";
    return (v) => v.marca?.trim().toUpperCase() === marcaMatch && v.division?.trim().toUpperCase() === valor.toUpperCase();
  }
  if (campo === "unidad_de_negocio") {
    const vals = valor.split(";").map((s) => s.trim().toUpperCase());
    return (v) => vals.includes(v.unidad_de_negocio?.trim().toUpperCase());
  }
  if (campo === "division") {
    const vals = valor.split(";").map((s) => s.trim().toUpperCase());
    return (v) => vals.includes(v.division?.trim().toUpperCase());
  }
  if (campo === "marca") return (v) => v.marca?.trim().toUpperCase() === valor.toUpperCase();
  if (campo === "codigo_articulo") {
    const vals = valor.split(";").map((s) => s.trim());
    return (v) => vals.includes(String(v.codigo_articulo).trim());
  }
  return () => false;
}

function getSkuGruposFromDef(ffvv: string, skuDef: SkuDefinicion[], config: VariableConfig): SkuGrupo[] {
  const defs = skuDef.filter((d) => d.ffvv_grupo.toLowerCase() === ffvv.toLowerCase()).sort((a, b) => a.sku_num - b.sku_num);
  const mins = [config.sku1_min_compra, config.sku2_min_compra, config.sku3_min_compra, config.sku4_min_compra, config.sku5_min_compra];
  const objs = [config.sku1_obj, config.sku2_obj, config.sku3_obj, config.sku4_obj, config.sku5_obj];
  return defs.map((def, i) => ({
    nombre: def.nombre_grupo, descripcion: def.condicion_min_compra,
    objClientes: objs[i] ?? def.obj_clientes_unicos, minCompra: mins[i] ?? 1,
    match: buildSkuMatch(def),
  }));
}

// ─── Pozo con tramos ──────────────────────────────────────────────────────────

function calcularPozoConTramos(venta: number, escalaId: string, tramos: TramoPozo[]): number {
  const tramosEscala = tramos.filter((t) => t.escala_id === escalaId).sort((a, b) => b.desde_monto - a.desde_monto);
  const tramo = tramosEscala.find((t) => venta >= Number(t.desde_monto));
  return tramo ? venta * Number(tramo.pct_pozo) : 0;
}

// ─── Multiplicadores (fijos del PDF) ─────────────────────────────────────────

const multDisciplina = (p: number) => p >= 90 ? 1.05 : p >= 80 ? 0.82 : p >= 65 ? 0.58 : p >= 50 ? 0.25 : 0;
const multCobertura  = (p: number) => p >= 90 ? 1.05 : p >= 80 ? 0.93 : p >= 65 ? 0.74 : p >= 50 ? 0.50 : 0.25;
const multSkus       = (n: number) => ({ 0: 0.50, 1: 0.70, 2: 1.05, 3: 1.15, 4: 1.33, 5: 1.50 }[Math.min(n, 5)] ?? 0.50);
const multCartera    = (p: number) => p >= 110 ? 1.15 : p >= 105 ? 1.10 : p >= 100 ? 1.05 : p >= 90 ? 0.95 : 0.60;

// ─── Helpers de formato ───────────────────────────────────────────────────────

const formatMoney = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const formatHoras = (h: number) => `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60).toString().padStart(2, "0")}m`;
const formatHora  = (iso: string | null) => {
  if (!iso) return "--";
  try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }); }
  catch { return "--"; }
};
const formatFecha = (s: string | null) => {
  if (!s) return "--";
  try { const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; } catch { return s; }
};
const diaSemana = (s: string) => {
  try { const [y,m,d] = s.split("-").map(Number); return ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(y,m-1,d).getDay()]; }
  catch { return ""; }
};
const normalizarFFVV = (f: string) => f?.trim().toLowerCase() ?? "";
const isVafood = (f: string) => normalizarFFVV(f) === "vafood";
const isEusckorInterior = (f: string) => ["eusckor","interior"].includes(normalizarFFVV(f));
const getFfvvStyle = (f: string) => {
  const n = normalizarFFVV(f);
  if (n === "vafood")   return "bg-red-100 text-red-700";
  if (n === "eusckor")  return "bg-blue-100 text-blue-700";
  if (n === "interior") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
};
const premioColor = (p: number) => p <= 0 ? "text-gray-400" : p < 500_000 ? "text-amber-600" : p < 1_200_000 ? "text-emerald-600" : "text-violet-600";
const cellOk  = "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
const cellBad = "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
const cellNA  = "text-gray-300 dark:text-gray-600";

type SortKey = "name" | "horasTrabajadas" | "pdvVisitados" | "ffvv";

// ─── Tipos para tabla diaria ──────────────────────────────────────────────────

interface DiaTabla {
  fecha: string;           // fecha del snapshot (día de trabajo real, ej: 28/05)
  fechaVenta: string;      // fecha de las ventas asociadas (+2 hábiles, ej: 01/06)
  nroDia: number;          // número correlativo: Día 1 = primer snap del período
  horasTrabajadas: number; pdvMenos5Min: number; pdvVisitados: number;
  tieneSnap: boolean; primeraEntrada: string | null; ultimaSalida: string | null;
  tieneVenta: boolean; clientesMas25k: number; cccUnicos: number;
  skuClientes: number[];
}

// ─── buildDiasTabla ───────────────────────────────────────────────────────────
//
// LÓGICA DE CRUCE (delay de entrega 2 días hábiles):
//   Snapshot fecha X  →  Ventas fecha X + 2 días hábiles
//   Ejemplo: snap 28/5 → ventas 1/6
//            snap 29/5 → ventas 2/6
//            snap 2/6  → ventas 4/6
//
// Cada fila de la tabla = UN DÍA DE TRABAJO:
//   Disciplina  (Hs, <5min, +40min) → del snapshot
//   Cobertura, SKUs, CCC            → de las ventas del día correspondiente
//
// La numeración Día 1, Día 2... arranca desde el primer snapshot del período.

function addDiasHabilesStr(fechaStr: string, n: number): string {
  // Suma n días hábiles a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD
  const d = new Date(fechaStr + "T12:00:00");
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function buildDiasTabla(
  ventas: ChessVenta[],
  snapshots: Snapshot[],
  username: string,
  grupos: SkuGrupo[],
  ventaMinCliente: number
): DiaTabla[] {

  // 1. Snapshots del vendedor por fecha — SOLO los de las 20:30 UTC (snapshot de cierre del día)
  //    Si un día solo tiene snapshot de las 15:30 (intraday), no cuenta: el día no cerró aún.
  const snapsPorFecha: Record<string, Snapshot> = {};
  for (const snap of snapshots.filter((s) => String(s.username) === String(username))) {
    const fecha = snap.fecha
      ? String(snap.fecha).slice(0, 10)
      : new Date(snap.created_at).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

    // Verificar que sea el snapshot de cierre: entre 20:25 y 20:35 UTC
    const takenAt   = snap.snapshot_taken_at || snap.created_at || "";
    const d = new Date(takenAt);
    const horaUTC   = d.getUTCHours();
    const minutoUTC = d.getUTCMinutes();
    const totalMin  = horaUTC * 60 + minutoUTC;
    const esCierre  = totalMin >= 20 * 60 + 25 && totalMin <= 20 * 60 + 35; // 20:25–20:35 UTC

    if (esCierre) {
      snapsPorFecha[fecha] = snap;
    }
  }

  // 2. Ventas por fecha_comprobante
  // Solo ventas válidas (excluir devoluciones y notas de crédito)
  const ventasValidas = ventas.filter(esVentaValida);

  const ventasPorFecha: Record<string, ChessVenta[]> = {};
  for (const v of ventasValidas) {
    const fecha = v.fecha_comprobante?.slice(0, 10);
    if (!fecha) continue;
    if (!ventasPorFecha[fecha]) ventasPorFecha[fecha] = [];
    ventasPorFecha[fecha].push(v);
  }

  // 3. Construir lista de días de trabajo desde los snapshots (fuente principal del eje temporal)
  //    Para cada día de snapshot, buscamos las ventas del día +2 hábiles
  const fechasSnap = Object.keys(snapsPorFecha).sort();

  // 4. CCC acumulado — lo calculamos sobre la fecha de VENTA (no de snap) en orden cronológico
  //    para que el acumulado sea correcto dentro del mes
  const fechasVenta = Object.keys(ventasPorFecha).sort();
  const clientesVistosPorMes: Record<string, Set<string>> = {};
  const cccPorFechaVenta: Record<string, { clientesMas25k: number; cccUnicos: number }> = {};

  for (const fv of fechasVenta) {
    const mes = fv.slice(0, 7);
    if (!clientesVistosPorMes[mes]) clientesVistosPorMes[mes] = new Set();
    const yaVistos  = clientesVistosPorMes[mes];
    const ventasDia = ventasPorFecha[fv] ?? [];
    const porCliente: Record<string, number> = {};
    for (const v of ventasDia) {
      const cli = String(v.cliente);
      porCliente[cli] = (porCliente[cli] || 0) + (Number(v.subtotal_final) || 0);
    }
    const clientesMas25k = Object.values(porCliente).filter((m) => m > ventaMinCliente).length;
    const clientesHoy    = Object.keys(porCliente);
    const cccUnicos      = clientesHoy.filter((cli) => !yaVistos.has(cli)).length;
    for (const cli of clientesHoy) yaVistos.add(cli);
    cccPorFechaVenta[fv] = { clientesMas25k, cccUnicos };
  }

  // 5. SKUs por día — clientes únicos NUEVOS que llegan al mínimo de compra.
  //    Antes se mostraban clientes únicos del día; si un mismo cliente compraba el mismo SKU
  //    en más de un día, se repetía visualmente y la suma diaria no coincidía con el total.
  //    Ahora cada cliente se acredita una sola vez: el día en que alcanza el mínimo del SKU.
  const skuClientesPorFechaVenta: Record<string, number[]> = {};
  const skuAcumPorCliente = grupos.map(() => ({} as Record<string, number>));
  const skuClientesYaContados = grupos.map(() => new Set<string>());

  for (const fechaSnap of fechasSnap) {
    const fechaVenta = addDiasHabilesStr(fechaSnap, 2);
    const ventasDia  = ventasPorFecha[fechaVenta] ?? [];
    skuClientesPorFechaVenta[fechaVenta] = grupos.map(() => 0);

    grupos.forEach((grupo, gi) => {
      const compraDiaPorCliente: Record<string, number> = {};

      ventasDia.filter(grupo.match).forEach((v) => {
        const cli = String(v.cliente);
        compraDiaPorCliente[cli] = (compraDiaPorCliente[cli] || 0) + (Number(v.bultos_total) || 1);
      });

      Object.entries(compraDiaPorCliente).forEach(([cli, compraDia]) => {
        skuAcumPorCliente[gi][cli] = (skuAcumPorCliente[gi][cli] || 0) + compraDia;

        if (!skuClientesYaContados[gi].has(cli) && skuAcumPorCliente[gi][cli] >= grupo.minCompra) {
          skuClientesYaContados[gi].add(cli);
          skuClientesPorFechaVenta[fechaVenta][gi] += 1;
        }
      });
    });
  }

  // 6. Construir fila por cada día de snap, cruzando con ventas del día +2 hábiles
  const filas = fechasSnap.map((fechaSnap, idx) => {
    const snap         = snapsPorFecha[fechaSnap];
    const fechaVenta   = addDiasHabilesStr(fechaSnap, 2);
    const ventasDia    = ventasPorFecha[fechaVenta] ?? [];
    const res          = cccPorFechaVenta[fechaVenta] ?? { clientesMas25k: 0, cccUnicos: 0 };
    const skuClientes  = skuClientesPorFechaVenta[fechaVenta] ?? grupos.map(() => 0);
    const nroDia = idx + 1; // ASC → Día 1 es el más antiguo
    return {
      fecha: fechaSnap,        // fecha del snap = día de trabajo real
      fechaVenta,              // fecha de las ventas asociadas (para display)
      nroDia,
      horasTrabajadas: Number(snap.horas_trabajadas) || 0,
      pdvMenos5Min:    Number(snap.pdv_menos_5_min)  || 0,
      pdvVisitados:    Number(snap.pdv_visitados)    || 0,
      tieneSnap:       true,
      primeraEntrada:  snap.primera_marca || null,
      ultimaSalida:    snap.ultima_marca  || null,
      tieneVenta:      ventasDia.length > 0,
      clientesMas25k:  res.clientesMas25k,
      cccUnicos:       res.cccUnicos,
      skuClientes,
    };
  });

  // Mostrar más reciente primero (DESC)
  return filas.reverse();
}

// ─── Proyección fin de mes ────────────────────────────────────────────────────
//
// Disciplina y cobertura: su denominador ES su numerador hasta el día de hoy.
//   Si sigue igual: proyección = (ok_actuales / dias_totales) * 100
//
// SKUs y CCC: proyección = valor_actual * dias_totales / dias_transcurridos
//
// "Días transcurridos" = días con venta ya registrados en el período.
// "Días totales" = días hábiles del mes (de la config del período).

interface Proyeccion {
  disciplinaProyPct: number;    // % disciplina proyectado a fin de mes
  coberturaProyPct:  number;    // % cobertura proyectado
  skuClientesProy:   number[];  // clientes únicos SKU proyectados
  cccUnicosProyTotal:number;    // CCC únicos proyectados totales del mes
}

function calcularProyeccion(
  dias: DiaTabla[],
  diasHabilesTotales: number,
  skuClientesPeriodo: number[],
  cccUnicosTotal: number,
  config: VariableConfig
): Proyeccion {
  const diasSnap = dias.length; // días de trabajo (snaps)

  if (diasSnap === 0) {
    return {
      disciplinaProyPct: 0, coberturaProyPct: 0,
      skuClientesProy: skuClientesPeriodo.map(() => 0),
      cccUnicosProyTotal: 0,
    };
  }

  const diasOk  = dias.filter((d) => {
    if (!d.tieneSnap || d.horasTrabajadas < config.min_horas_dia) return false;
    const pct5 = d.pdvVisitados > 0 ? (d.pdvMenos5Min / d.pdvVisitados) * 100 : 100;
    return pct5 <= config.max_pct_menos5min;
  }).length;

  // Disciplina: sobre días de snap (tiene snaps propios)
  // Cobertura: sobre días CON VENTA (son independientes)
  const diasConVenta   = dias.filter((d) => d.tieneVenta).length;
  const cobOk          = dias.filter((d) => d.tieneVenta && d.clientesMas25k >= config.min_clientes_cob).length;

  // Disciplina proyectada: ritmo actual extrapolado a días hábiles totales
  const disciplinaOkProy  = Math.round((diasOk / diasSnap) * diasHabilesTotales);
  const disciplinaProyPct = (disciplinaOkProy / diasHabilesTotales) * 100;

  // Cobertura proyectada: ritmo actual sobre días con venta, extrapolado
  const coberturaOkProy  = diasConVenta > 0 ? Math.round((cobOk / diasConVenta) * diasHabilesTotales) : 0;
  const coberturaProyPct = (coberturaOkProy / diasHabilesTotales) * 100;

  // SKUs y CCC: extrapolación por días con venta
  const factorVenta        = diasConVenta > 0 ? diasHabilesTotales / diasConVenta : 1;
  const skuClientesProy    = skuClientesPeriodo.map((c) => Math.round(c * factorVenta));
  const cccUnicosProyTotal = Math.round(cccUnicosTotal * factorVenta);

  return { disciplinaProyPct, coberturaProyPct, skuClientesProy, cccUnicosProyTotal };
}

// ─── PanelPremio ──────────────────────────────────────────────────────────────

const PanelPremio: React.FC<{
  ventas: ChessVenta[];
  snapshots: Snapshot[];
  username: string;
  config: VariableConfig;
  grupos: SkuGrupo[];
  tramos: TramoPozo[];
  periodo: Periodo;
}> = ({ ventas, snapshots, username, config, grupos, tramos, periodo }) => {

  const dias = useMemo(
    () => buildDiasTabla(ventas, snapshots, username, grupos, config.venta_min_cliente),
    [ventas, snapshots, username, grupos, config.venta_min_cliente]
  );

  // Filtrar devoluciones y notas de crédito antes de cualquier cálculo
  const ventasValidas = ventas.filter(esVentaValida);
  const ventaTotal = ventasValidas.reduce((a, v) => a + (Number(v.subtotal_final) || 0), 0);
  const pozo       = calcularPozoConTramos(ventaTotal, config.escala_pozo_id, tramos);

  const diasBase = dias.length;

  // Disciplina real
  const diasOk = dias.filter((d) => {
    if (!d.tieneSnap || d.horasTrabajadas < config.min_horas_dia) return false;
    return (d.pdvVisitados > 0 ? (d.pdvMenos5Min / d.pdvVisitados) * 100 : 100) <= config.max_pct_menos5min;
  }).length;
  const pctDisciplina = diasBase > 0 ? (diasOk / diasBase) * 100 : 0;
  const mDisc = multDisciplina(pctDisciplina);

  // Cobertura real — solo sobre días CON VENTA (días sin venta no cuentan ni a favor ni en contra)
  const diasConVentaReal = dias.filter((d) => d.tieneVenta).length;
  const diasCobOk        = dias.filter((d) => d.tieneVenta && d.clientesMas25k >= config.min_clientes_cob).length;
  const pctCobertura     = diasConVentaReal > 0 ? (diasCobOk / diasConVentaReal) * 100 : 0;
  const mCob             = multCobertura(pctCobertura);

  // SKUs acumulados (con compra mínima)
  const skuClientesPeriodo = useMemo(() => grupos.map((grupo) => {
    const porCliente: Record<string, number> = {};
    ventasValidas.filter(grupo.match).forEach((v) => {
      const cli = String(v.cliente);
      porCliente[cli] = (porCliente[cli] || 0) + (Number(v.bultos_total) || 1);
    });
    return Object.values(porCliente).filter((c) => c >= grupo.minCompra).length;
  }), [ventasValidas, grupos]);

  const skusLogrados   = skuClientesPeriodo.filter((c, i) => c >= grupos[i]?.objClientes).length;
  const mSkus          = multSkus(skusLogrados);
  const clientesUnicos = new Set(ventasValidas.map((v) => String(v.cliente))).size;
  const cccUnicosTotal = dias.reduce((a, d) => a + d.cccUnicos, 0);

  const pctCartera     = config.base_cartera_sana > 0 ? (clientesUnicos / config.base_cartera_sana) * 100 : null;
  const mCartera       = pctCartera !== null ? multCartera(pctCartera) : null;
  const premioReal     = pozo * mDisc * mCob * mSkus;

  // Proyección
  const proy = useMemo(() => calcularProyeccion(
    dias, periodo.diasHabiles, skuClientesPeriodo, cccUnicosTotal, config
  ), [dias, periodo.diasHabiles, skuClientesPeriodo, cccUnicosTotal, config]);

  const skusLogradosProy   = proy.skuClientesProy.filter((c, i) => c >= grupos[i]?.objClientes).length;
  const mDiscProy          = multDisciplina(proy.disciplinaProyPct);
  const mCobProy           = multCobertura(proy.coberturaProyPct);
  const mSkusProy          = multSkus(skusLogradosProy);

  // Venta proyectada: extrapolación lineal por días con venta
  const diasConVentaActual = dias.filter((d) => d.tieneVenta).length;
  const ventaProyectada    = diasConVentaActual > 0
    ? ventaTotal * periodo.diasHabiles / diasConVentaActual
    : ventaTotal;
  const pozoProyectado     = calcularPozoConTramos(ventaProyectada, config.escala_pozo_id, tramos);

  // Cartera proyectada: clientes únicos proyectados vs base del mes anterior
  // proy.cccUnicosProyTotal ya está extrapolado por días con venta
  // Pero necesitamos el total de clientes únicos proyectados (no solo los nuevos del período)
  // Los clientes únicos proyectados = clientesUnicos * factor de días con venta
  const clientesUnicosProyectados = diasConVentaActual > 0
    ? Math.round(clientesUnicos * periodo.diasHabiles / diasConVentaActual)
    : clientesUnicos;
  const pctCarteraProyectada = config.base_cartera_sana > 0
    ? (clientesUnicosProyectados / config.base_cartera_sana) * 100
    : null;
  const mCarteraProy = pctCarteraProyectada !== null ? multCartera(pctCarteraProyectada) : (mCartera ?? 1);

  // premioFinal usa cartera proyectada (no la parcial del mes en curso)
  const premioFinal = premioReal * mCarteraProy;

  const premioProy = pozoProyectado * mDiscProy * mCobProy * mSkusProy * mCarteraProy;

  // ── Supuesto mínimo ────────────────────────────────────────────────────────
  const tramosOrdenados    = tramos.filter((t) => t.escala_id === config.escala_pozo_id && t.desde_monto > 0).sort((a,b) => a.desde_monto - b.desde_monto);
  const ventaMinPozo       = tramosOrdenados[0]?.desde_monto ?? 0;
  const pozoMinimo         = calcularPozoConTramos(ventaMinPozo, config.escala_pozo_id, tramos);
  const premioSupuesto     = pozoMinimo * multDisciplina(100) * multCobertura(100) * multSkus(2) * multCartera(100);

  // ── Proy. 5 SKUs: si venta proyectada no llega al mínimo, usar el mínimo para el pozo
  const ventaProy5SKUs      = Math.max(ventaProyectada, ventaMinPozo);
  const pozoProy5SKUs       = calcularPozoConTramos(ventaProy5SKUs, config.escala_pozo_id, tramos);
  const premioProy5SKUs     = pozoProy5SKUs * mDiscProy * mCobProy * multSkus(5) * mCarteraProy;

  // ── Cuánto tiene que vender por día para llegar al mínimo ─────────────────
  // Regla de 3: ventaMinPozo es el objetivo, ventaTotal es lo acumulado
  // diasRestantes = diasHabiles - diasConVenta
  const diasRestantes        = Math.max(periodo.diasHabiles - diasConVentaActual, 0);
  const ventaFaltante        = Math.max(ventaMinPozo - ventaTotal, 0);
  const ventaPorDiaNecesaria = diasRestantes > 0 ? ventaFaltante / diasRestantes : 0;
  const ventaPromedioDiaActual = diasConVentaActual > 0 ? ventaTotal / diasConVentaActual : 0;
  const yaAlcanzoMinimo      = ventaTotal >= ventaMinPozo;

  const [mostrarTabla, setMostrarTabla] = useState(true);
  const [mostrarProy,  setMostrarProy]  = useState(true);

  const pisoEscala = tramos.filter((t) => t.escala_id === config.escala_pozo_id && t.desde_monto > 0).sort((a,b) => a.desde_monto - b.desde_monto)[0]?.desde_monto ?? 0;

  const MultBadge: React.FC<{ mult: number }> = ({ mult }) => (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${mult >= 1 ? "bg-emerald-100 text-emerald-700" : mult > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>×{mult}</span>
  );

  const PctBar: React.FC<{ real: number; proy: number; label: string; ok: number; total: number; totalMes: number }> = ({ real, proy, label, ok, total, totalMes }) => (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400">{ok}/{total} días transcurridos · {totalMes} hábiles en el mes</span>
      </div>
      <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${real >= 80 ? "bg-emerald-500" : real >= 65 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${Math.min(real, 100)}%` }} />
        {proy !== real && (
          <div className="absolute top-0 h-2 rounded-full bg-blue-400/40"
            style={{ left: `${Math.min(real, 100)}%`, width: `${Math.min(proy - real, 100 - real)}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px]">
        <span className={`font-semibold ${real >= 80 ? "text-emerald-600" : real >= 65 ? "text-amber-500" : "text-red-500"}`}>{real.toFixed(0)}% actual</span>
        <span className="text-blue-500 font-medium">{proy.toFixed(0)}% proy. fin de mes</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Badge config */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <Database className="w-3 h-3" />
        <span>{config.escala_pozo_id} · piso {formatMoney(pisoEscala)} · base cartera {config.base_cartera_sana} cl · {periodo.diasHabiles} días hábiles</span>
      </div>


      {/* ── TABLA COMPARATIVA: Real actual | Proyección actual | Supuesto mínimo | Proy. con 5 SKUs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* PREMIO FINAL arriba de todo */}
              <tr className="bg-gray-50 dark:bg-gray-700/30 font-bold border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-3.5 text-left text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700 text-[15px]">Premio final</th>
                <th className={`px-3 py-3.5 text-center text-[15px] ${premioColor(premioFinal)}`}>{formatMoney(premioFinal)}</th>
                <th className={`px-3 py-3.5 text-center text-[15px] bg-emerald-50/60 dark:bg-emerald-900/20 ${premioColor(premioProy)}`}>{formatMoney(premioProy)}</th>
                <th className={`px-3 py-3.5 text-center text-[15px] bg-blue-50/60 dark:bg-blue-900/20 ${premioColor(premioSupuesto)}`}>{formatMoney(premioSupuesto)}</th>
                <th className={`px-3 py-3.5 text-center text-[15px] bg-violet-50/60 dark:bg-violet-900/20 ${premioColor(premioProy5SKUs)}`}>
                  {formatMoney(premioProy5SKUs)}
                </th>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-44 border-r border-gray-200 dark:border-gray-700">
                  Indicador
                </th>
                {[
                  { label: "Real actual",       sub: `a hoy · venís vendiendo ${formatMoney(ventaPromedioDiaActual)}/día`, color: "text-gray-700 dark:text-gray-200",   bg: "" },
                  { label: "Proyección actual",
                    sub: yaAlcanzoMinimo
                      ? "✓ ya superó el mínimo"
                      : diasRestantes > 0
                        ? `necesita ${formatMoney(ventaPorDiaNecesaria)}/día para llegar`
                        : "sin días restantes",
                    color: "text-emerald-700", bg: "bg-emerald-50/40 dark:bg-emerald-900/10" },
                  { label: "Supuesto mínimo",   sub: `venta ${formatMoney(ventaMinPozo)}`, color: "text-blue-700",                     bg: "bg-blue-50/40 dark:bg-blue-900/10" },
                  { label: "Proy. 5 SKUs",      sub: "proyectado + 5/5 SKUs",              color: "text-violet-700",                   bg: "bg-violet-50/40 dark:bg-violet-900/10" },
                ].map((col) => (
                  <th key={col.label} className={`px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide border-r last:border-r-0 border-gray-200 dark:border-gray-700 ${col.bg}`}>
                    <span className={col.color}>{col.label}</span>
                    <span className="block text-gray-400 font-normal normal-case mt-0.5">{col.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Venta */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 text-gray-500 border-r border-gray-200 dark:border-gray-700 font-medium">Venta del período</td>
                <td className="px-3 py-2 text-center font-semibold text-gray-800 dark:text-gray-100">{formatMoney(ventaTotal)}</td>
                <td className="px-3 py-2 text-center font-semibold text-emerald-600 bg-emerald-50/40 dark:bg-emerald-900/10">{formatMoney(ventaProyectada)}</td>
                <td className="px-3 py-2 text-center font-semibold text-blue-600 bg-blue-50/40 dark:bg-blue-900/10">{formatMoney(ventaMinPozo)}</td>
                <td className="px-3 py-2 text-center bg-violet-50/40 dark:bg-violet-900/10">
                  <span className="font-semibold text-violet-600">{formatMoney(ventaProy5SKUs)}</span>
                  {ventaProyectada < ventaMinPozo && (
                    <span className="block text-[10px] text-amber-500 mt-0.5">↑ ajustado al mínimo</span>
                  )}
                </td>
              </tr>
              {/* Pozo */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 text-gray-500 border-r border-gray-200 dark:border-gray-700 font-medium">Pozo</td>
                <td className="px-3 py-2 text-center font-semibold text-gray-800 dark:text-gray-100">{formatMoney(pozo)}</td>
                <td className="px-3 py-2 text-center font-semibold text-emerald-600 bg-emerald-50/40 dark:bg-emerald-900/10">{formatMoney(pozoProyectado)}</td>
                <td className="px-3 py-2 text-center font-semibold text-blue-600 bg-blue-50/40 dark:bg-blue-900/10">{formatMoney(pozoMinimo)}</td>
                <td className="px-3 py-2 text-center font-semibold text-violet-600 bg-violet-50/40 dark:bg-violet-900/10">{formatMoney(pozoProy5SKUs)}</td>
              </tr>
              {/* Disciplina */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 font-medium">Disciplina</span>
                  <span className="block text-[10px] text-gray-400">≥{config.min_horas_dia}h · &lt;{config.max_pct_menos5min}% &lt;5min</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <MultBadge mult={mDisc} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{pctDisciplina.toFixed(0)}% ({diasOk}/{diasBase})</span>
                </td>
                <td className="px-3 py-2 text-center bg-emerald-50/40 dark:bg-emerald-900/10">
                  <MultBadge mult={mDiscProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{proy.disciplinaProyPct.toFixed(0)}%</span>
                </td>
                <td className="px-3 py-2 text-center bg-blue-50/40 dark:bg-blue-900/10">
                  <MultBadge mult={multDisciplina(100)} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">100%</span>
                </td>
                <td className="px-3 py-2 text-center bg-violet-50/40 dark:bg-violet-900/10">
                  <MultBadge mult={mDiscProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{proy.disciplinaProyPct.toFixed(0)}%</span>
                </td>
              </tr>
              {/* Cobertura */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 font-medium">Cobertura</span>
                  <span className="block text-[10px] text-gray-400">≥{config.min_clientes_cob} cl &gt;${(config.venta_min_cliente/1000).toFixed(0)}k</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <MultBadge mult={mCob} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{pctCobertura.toFixed(0)}% ({diasCobOk}/{diasConVentaReal})</span>
                </td>
                <td className="px-3 py-2 text-center bg-emerald-50/40 dark:bg-emerald-900/10">
                  <MultBadge mult={mCobProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{proy.coberturaProyPct.toFixed(0)}%</span>
                </td>
                <td className="px-3 py-2 text-center bg-blue-50/40 dark:bg-blue-900/10">
                  <MultBadge mult={multCobertura(100)} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">100%</span>
                </td>
                <td className="px-3 py-2 text-center bg-violet-50/40 dark:bg-violet-900/10">
                  <MultBadge mult={mCobProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{proy.coberturaProyPct.toFixed(0)}%</span>
                </td>
              </tr>
              {/* SKUs */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 font-medium">SKUs estratégicos</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <MultBadge mult={mSkus} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{skusLogrados}/{grupos.length}</span>
                </td>
                <td className="px-3 py-2 text-center bg-emerald-50/40 dark:bg-emerald-900/10">
                  <MultBadge mult={mSkusProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{skusLogradosProy}/{grupos.length}</span>
                </td>
                <td className="px-3 py-2 text-center bg-blue-50/40 dark:bg-blue-900/10">
                  <MultBadge mult={multSkus(2)} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">2/5</span>
                </td>
                <td className="px-3 py-2 text-center bg-violet-50/40 dark:bg-violet-900/10">
                  <MultBadge mult={multSkus(5)} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">5/5</span>
                </td>
              </tr>
              {/* Cartera */}
              <tr className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 font-medium">Cartera sana</span>
                  <span className="block text-[10px] text-gray-400">proyectada vs base {config.base_cartera_sana} cl</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <MultBadge mult={mCarteraProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{clientesUnicosProyectados}/{config.base_cartera_sana}</span>
                </td>
                <td className="px-3 py-2 text-center bg-emerald-50/40 dark:bg-emerald-900/10">
                  <MultBadge mult={mCarteraProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{pctCarteraProyectada !== null ? `${Math.round(pctCarteraProyectada)}%` : "—"}</span>
                </td>
                <td className="px-3 py-2 text-center bg-blue-50/40 dark:bg-blue-900/10">
                  <MultBadge mult={multCartera(100)} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">100%</span>
                </td>
                <td className="px-3 py-2 text-center bg-violet-50/40 dark:bg-violet-900/10">
                  <MultBadge mult={mCarteraProy} />
                  <span className="block text-[10px] text-gray-400 mt-0.5">{pctCarteraProyectada !== null ? `${Math.round(pctCarteraProyectada)}%` : "—"}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SKUs detalle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Star className="w-3.5 h-3.5" /> SKUs estratégicos
        </p>
        <div className="space-y-2">
          {grupos.map((grupo, i) => {
            const cu     = skuClientesPeriodo[i];
            const obj    = grupo.objClientes;
            const cuProy = proy.skuClientesProy[i] ?? 0;
            const logrado = cu >= obj;
            const proyLogrado = cuProy >= obj;
            return (
              <div key={i} className={`rounded-md p-2 border ${logrado ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : "bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600"}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-semibold ${logrado ? "text-emerald-700" : "text-gray-500"}`}>{i+1}. {grupo.nombre}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${logrado ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                      {logrado ? "✓" : "✗"} {cu}/{obj}
                    </span>
                    {!logrado && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${proyLogrado ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        proy: {cuProy}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 relative">
                  <div className={`h-1.5 rounded-full ${logrado ? "bg-emerald-500" : "bg-red-400"}`}
                    style={{ width: `${Math.min((cu / obj) * 100, 100)}%` }} />
                  {!logrado && cuProy > cu && (
                    <div className="absolute top-0 h-1.5 rounded-full bg-blue-400/50"
                      style={{ left: `${Math.min((cu/obj)*100,100)}%`, width: `${Math.min(((cuProy-cu)/obj)*100, 100-(cu/obj)*100)}%` }} />
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{grupo.descripcion}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Indicadores resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Días trabajados",   value: diasBase,                                                  color: "text-gray-700 dark:text-gray-200" },
          { label: "Disciplina OK",     value: `${diasOk} (${pctDisciplina.toFixed(0)}%)`,               color: pctDisciplina >= 80 ? "text-emerald-600" : pctDisciplina >= 65 ? "text-amber-500" : "text-red-500" },
          { label: "Cobertura OK",      value: `${diasCobOk}/${diasConVentaReal} (${pctCobertura.toFixed(0)}%)`, color: pctCobertura  >= 80 ? "text-emerald-600" : pctCobertura  >= 65 ? "text-amber-500" : "text-red-500" },
          { label: "Clientes únicos",   value: `${clientesUnicos}${config.base_cartera_sana > 0 ? ` / ${config.base_cartera_sana}` : ""}`, color: "text-blue-600" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla por día */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button type="button" onClick={() => setMostrarTabla(!mostrarTabla)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> App Diario en Día ({diasBase} días trabajados)
          </span>
          {mostrarTabla ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {mostrarTabla && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/60">
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-500 border-b border-r border-gray-200 dark:border-gray-600 w-16" rowSpan={2}>Día</th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-500 border-b border-r border-gray-200 dark:border-gray-600" colSpan={3}>Disciplina</th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-500 border-b border-r border-gray-200 dark:border-gray-600">Cobertura</th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-500 border-b border-r border-gray-200 dark:border-gray-600" colSpan={grupos.length}>
                    SKUs Estratégicos <span className="font-normal">(cl únicos)</span>
                  </th>
                  <th className="px-2 py-1 text-center font-semibold text-gray-500 border-b border-gray-200 dark:border-gray-600" rowSpan={2}>CCC<br />Nuevos</th>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-700/60 text-[10px]">
                  <th className="px-2 py-1 text-center text-gray-400 border-b border-gray-200 dark:border-gray-600 font-medium">Hs Trab.</th>
                  <th className="px-2 py-1 text-center text-gray-400 border-b border-gray-200 dark:border-gray-600 font-medium">&lt;5 min</th>
                  <th className="px-2 py-1 text-center text-gray-400 border-b border-r border-gray-200 dark:border-gray-600 font-medium">+40 min</th>
                  <th className="px-2 py-1 text-center text-gray-400 border-b border-r border-gray-200 dark:border-gray-600 font-medium">
                    Cl.&gt;${(config.venta_min_cliente/1000).toFixed(0)}k
                  </th>
                  {grupos.map((g, i) => (
                    <th key={i} className="px-2 py-1 text-center text-gray-400 border-b border-r border-gray-200 dark:border-gray-600 font-medium max-w-[80px]" title={g.nombre}>
                      {g.nombre.length > 11 ? g.nombre.slice(0, 10) + "…" : g.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dias.map((dia, idx) => {
                  const pct5   = dia.pdvVisitados > 0 ? (dia.pdvMenos5Min / dia.pdvVisitados) * 100 : 0;
                  const cobOk  = dia.clientesMas25k >= config.min_clientes_cob;
                  const rowBg  = idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-700/20";
                  return (
                    <tr key={dia.fecha} className={`${rowBg} border-b border-gray-100 dark:border-gray-700/50`}>
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-600 whitespace-nowrap min-w-[72px]">
                        <span className="font-bold text-gray-700 dark:text-gray-200 block">Día {dia.nroDia}</span>
                        <span className="text-[10px] text-gray-400">{dia.fecha.slice(8)}/{dia.fecha.slice(5,7)}</span>
                        <span className="text-[10px] text-blue-400 ml-1">→{dia.fechaVenta.slice(8)}/{dia.fechaVenta.slice(5,7)}</span>
                      </td>
                      <td className={`px-2 py-1.5 text-center ${dia.tieneSnap ? (dia.horasTrabajadas >= config.min_horas_dia ? cellOk : cellBad) : cellNA}`}>
                        {dia.tieneSnap ? formatHoras(dia.horasTrabajadas) : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${dia.tieneSnap ? (pct5 <= config.max_pct_menos5min ? cellOk : cellBad) : cellNA}`}>
                        {dia.tieneSnap ? `${pct5.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-600 ${cellNA}`}>—</td>
                      <td className={`px-2 py-1.5 text-center font-semibold border-r border-gray-200 dark:border-gray-600 ${!dia.tieneVenta ? cellNA : cobOk ? cellOk : dia.clientesMas25k >= config.min_clientes_cob * 0.6 ? "text-amber-500" : cellBad}`}>
                        {dia.tieneVenta ? dia.clientesMas25k : "—"}
                      </td>
                      {dia.skuClientes.map((cu, gi) => (
                        <td key={gi} className={`px-2 py-1.5 text-center font-semibold border-r border-gray-200 dark:border-gray-600 ${cu >= 10 ? cellOk : cu >= 5 ? "text-amber-500" : cu > 0 ? cellBad : cellNA}`}>
                          {cu > 0 ? cu : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-semibold text-blue-600 dark:text-blue-400">{dia.cccUnicos}</td>
                    </tr>
                  );
                })}
                {/* Totales */}
                <tr className="bg-gray-100 dark:bg-gray-700 font-semibold text-[11px] border-t-2 border-gray-300 dark:border-gray-500">
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-600 text-gray-600">Total</td>
                  <td className="px-2 py-2 text-center text-gray-500">—</td>
                  <td className="px-2 py-2 text-center text-gray-500">—</td>
                  <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-600 text-gray-500">—</td>
                  <td className={`px-2 py-2 text-center border-r border-gray-200 dark:border-gray-600 ${diasCobOk===diasConVentaReal ? "text-emerald-600" : "text-amber-500"}`}>
                    {diasCobOk}/{diasConVentaReal}
                  </td>
                  {skuClientesPeriodo.map((cu, gi) => (
                    <td key={gi} className={`px-2 py-2 text-center border-r border-gray-200 dark:border-gray-600 ${cu >= grupos[gi]?.objClientes ? "text-emerald-600" : cu >= (grupos[gi]?.objClientes ?? 100) * 0.6 ? "text-amber-500" : "text-red-500"}`}>
                      {cu}<span className="text-gray-400 font-normal">/{grupos[gi]?.objClientes ?? 100}</span>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-blue-600">{cccUnicosTotal}</td>
                </tr>
                {/* Fila proyección */}
                <tr className="bg-blue-50 dark:bg-blue-900/20 font-semibold text-[11px]">
                  <td className="px-2 py-2 border-r border-blue-200 dark:border-blue-800 text-blue-700">Proy.</td>
                  <td className="px-2 py-2 text-center text-blue-600">—</td>
                  <td className="px-2 py-2 text-center text-blue-600">—</td>
                  <td className="px-2 py-2 text-center border-r border-blue-200 dark:border-blue-800 text-blue-600">—</td>
                  <td className={`px-2 py-2 text-center border-r border-blue-200 dark:border-blue-800 ${proy.coberturaProyPct >= 80 ? "text-emerald-600" : proy.coberturaProyPct >= 65 ? "text-amber-500" : "text-red-500"}`}>
                    {proy.coberturaProyPct.toFixed(0)}%
                  </td>
                  {proy.skuClientesProy.map((cu, gi) => (
                    <td key={gi} className={`px-2 py-2 text-center border-r border-blue-200 dark:border-blue-800 ${cu >= (grupos[gi]?.objClientes ?? 100) ? "text-emerald-600" : "text-amber-500"}`}>
                      {cu}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-blue-600">{proy.cccUnicosProyTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DetalleFechas: lazy load + config + selector de período ──────────────────

const PERIODOS_DISPONIBLES = generarPeriodos(1);
const PERIODO_ACTUAL_IDX   = PERIODOS_DISPONIBLES.length - 1; // el más reciente

const DetalleFechas: React.FC<{ username: string; ffvv: string }> = ({ username, ffvv }) => {
  const periodoIdx = PERIODO_ACTUAL_IDX;
  const [ventas,          setVentas]          = useState<ChessVenta[]>([]);
  const [snapshotsPeriodo,setSnapshotsPeriodo]= useState<Snapshot[]>([]);
  const [config,          setConfig]          = useState<VariableConfig | null>(null);
  const [grupos,          setGrupos]          = useState<SkuGrupo[]>([]);
  const [tramos,          setTramos]          = useState<TramoPozo[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);


  const periodo = PERIODOS_DISPONIBLES[periodoIdx];

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setLoading(true); setError(null); setVentas([]); setSnapshotsPeriodo([]); setConfig(null); setGrupos([]);
      try {
        // 1. Ventas del mes (fecha_comprobante dentro del mes)
        let todas: ChessVenta[] = [];
        let desde = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error: e } = await supabase
            .from("chess_ventas")
            .select("id, numero, fecha_comprobante, descripcion_comprobante, cliente, categoria, division, marca, unidad_de_negocio, codigo_articulo, bultos_total, subtotal_final, id_vendedor")
            .eq("id_vendedor", username)
            .gte("fecha_comprobante", `${periodo.mesVentas}-01`)
            .lte("fecha_comprobante", periodo.ultimoDiaVentas)
            .order("fecha_comprobante", { ascending: false })
            .range(desde, desde + CHUNK - 1);
          if (e) throw new Error(e.message);
          if (!data || data.length === 0) break;
          todas = todas.concat(data as ChessVenta[]);
          if (data.length < CHUNK) break;
          desde += CHUNK;
        }

        // 2. Snapshots del período — un único snapshot por día por el unique index (fecha, username)
        let todasSnaps: Snapshot[] = [];
        let desdeSnap = 0;
        while (true) {
          const { data, error: e } = await supabase
            .from("admin_equipo_snapshots")
            .select("id, username, pdv_planificados, pdv_visitados, pdv_menos_5_min, horas_trabajadas, puntos_gps, primera_marca, ultima_marca, created_at, fecha, snapshot_taken_at")
            .eq("username", username)
            .gte("fecha", periodo.snapDesde)
            .lte("fecha", periodo.snapHasta)
            .order("fecha", { ascending: false })
            .range(desdeSnap, desdeSnap + CHUNK - 1);
          if (e) throw new Error(e.message);
          if (!data || data.length === 0) break;
          todasSnaps = todasSnaps.concat(data as Snapshot[]);
          if (data.length < CHUNK) break;
          desdeSnap += CHUNK;
        }

        // 3. Config + tablas maestras
        const [{ data: configData }, { tramos: tramosData, skuDef }] = await Promise.all([
          supabase.from("variable_config").select("*")
            .eq("username", username).eq("periodo", periodo.mesVentas).eq("activo", true).maybeSingle(),
          cargarTablasMaestra(),
        ]);

        if (!cancelado) {
          setVentas(todas);
          setSnapshotsPeriodo(todasSnaps);
          setTramos(tramosData);
          if (configData) {
            const cfg = configData as VariableConfig;
            setConfig(cfg);
            setGrupos(getSkuGruposFromDef(cfg.ffvv || ffvv, skuDef, cfg));
          } else {
            setConfig(null); setGrupos([]);
          }
        }
      } catch (err: any) {
        if (!cancelado) setError(err.message || "Error");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [username, ffvv, periodo.mesVentas]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
      <Loader2 className="w-4 h-4 animate-spin"/> Cargando {periodo.label}...
    </div>
  );
  if (error) return <p className="text-sm text-red-500 py-2">Error: {error}</p>;

  const showPremio = config !== null && grupos.length > 0;

  return (
    <div className="space-y-3">

      {/* Tablero: siempre visible, aviso si no hay config */}
      {!showPremio && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5"/>
          Sin config en Supabase para {periodo.label} — subí el CSV con periodo={periodo.mesVentas}
        </div>
      )}

      {showPremio && config && (
        <PanelPremio
          ventas={ventas} snapshots={snapshotsPeriodo}
          username={username} config={config} grupos={grupos}
          tramos={tramos} periodo={periodo}
        />
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const VendedoresResumen: React.FC = () => {
  const { user } = useAuth();
  const esVistaVendedor = user?.role === "vendedor";
  const esVistaSupervisor = user?.role === "supervisor";
  const ffvvUsuarioLogueado = normalizarFFVV(String(user?.FFVV ?? user?.ffvv ?? ""));

  const [usuarios,  setUsuarios]  = useState<UsuarioApp[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [busqueda,         setBusqueda]         = useState("");
  const [filtroFFVV,       setFiltroFFVV]       = useState<string>("todos");
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>("todos");
  const [sortKey,          setSortKey]          = useState<SortKey>("horasTrabajadas");
  const [sortDesc,         setSortDesc]         = useState(true);
  const [expandido,        setExpandido]        = useState<string | null>(null);

  useEffect(() => {
    if (esVistaVendedor) {
      setLoading(false);
      return;
    }

    const cargar = async () => {
      setLoading(true);
      setError(null);
      setUsuarios([]);
      setSnapshots([]);

      try {
        if (esVistaSupervisor && !ffvvUsuarioLogueado) {
          throw new Error("Tu usuario supervisor no tiene FFVV cargada en usuarios_app. Cargá la columna FFVV para poder filtrar sus vendedores.");
        }

        const { data: u, error: e1 } = await supabase
          .from("usuarios_app")
          .select("id, username, name, FFVV, ffvv, supervisor, role")
          .eq("role", "vendedor");

        if (e1) throw new Error(`Usuarios: ${e1.message}`);

        const vendedoresBase = ((u as UsuarioApp[]) || []).filter((v) => {
          if (!esVistaSupervisor) return true;
          const ffvvVendedor = normalizarFFVV(String(v.FFVV ?? v.ffvv ?? ""));
          return ffvvVendedor === ffvvUsuarioLogueado;
        });

        const usernamesPermitidos = vendedoresBase.map((v) => String(v.username)).filter(Boolean);

        let snapsFiltrados: Snapshot[] = [];
        if (usernamesPermitidos.length > 0) {
          const { data: s, error: e3 } = await supabase
            .from("admin_equipo_snapshots")
            .select("id, username, pdv_planificados, pdv_visitados, pdv_menos_5_min, horas_trabajadas, puntos_gps, primera_marca, ultima_marca, created_at, fecha, snapshot_taken_at")
            .in("username", usernamesPermitidos)
            .order("created_at", { ascending: false });

          if (e3) throw new Error(`Snapshots: ${e3.message}`);
          snapsFiltrados = (s as Snapshot[]) || [];
        }

        setUsuarios(vendedoresBase);
        setSnapshots(snapsFiltrados);
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [esVistaVendedor, esVistaSupervisor, ffvvUsuarioLogueado]);

  const statsMap = useMemo<Record<string, VendedorStats>>(() => {
    const map: Record<string, VendedorStats> = {};
    for (const u of usuarios) {
      const ffvvRaw = String(u.FFVV ?? u.ffvv ?? "").trim();
      map[u.username] = { username: u.username, name: u.name || u.username, ffvv: normalizarFFVV(ffvvRaw), ffvvRaw, supervisor: u.supervisor || "", ultimaFecha: null, horasTrabajadas: 0, pdvPlanificados: 0, pdvVisitados: 0, promHoras: 0, promPdvVisitados: 0, diasConActividad: 0 };
    }
    const snapsX: Record<string, Snapshot[]> = {};
    for (const snap of snapshots) {
      const uid = String(snap.username);
      if (!snapsX[uid]) snapsX[uid] = [];
      snapsX[uid].push(snap);
    }
    for (const [uid, snaps] of Object.entries(snapsX)) {
      if (!map[uid]) continue;
      const s = map[uid]; const ultimo = snaps[0];
      s.ultimaFecha=ultimo.fecha; s.horasTrabajadas=Number(ultimo.horas_trabajadas)||0;
      s.pdvPlanificados=Number(ultimo.pdv_planificados)||0; s.pdvVisitados=Number(ultimo.pdv_visitados)||0;
      const activos=snaps.filter((sn)=>Number(sn.horas_trabajadas)>0);
      s.diasConActividad=activos.length;
      s.promHoras=activos.length>0?activos.reduce((a,sn)=>a+Number(sn.horas_trabajadas),0)/activos.length:0;
      s.promPdvVisitados=activos.length>0?activos.reduce((a,sn)=>a+Number(sn.pdv_visitados),0)/activos.length:0;
    }
    return map;
  }, [usuarios, snapshots]);

  const listaFiltrada = useMemo(() => {
    const filtrados = Object.values(statsMap).filter((v) => {
      const mb = busqueda===""||v.name.toLowerCase().includes(busqueda.toLowerCase())||v.username.includes(busqueda);
      const mf = filtroFFVV==="todos"||v.ffvv===normalizarFFVV(filtroFFVV);
      const ms = filtroSupervisor==="todos"||v.supervisor===filtroSupervisor;
      return mb&&mf&&ms;
    });
    filtrados.sort((a,b) => {
      let c=0;
      if      (sortKey==="name")            c=a.name.localeCompare(b.name);
      else if (sortKey==="horasTrabajadas") c=a.horasTrabajadas-b.horasTrabajadas;
      else if (sortKey==="pdvVisitados")    c=a.pdvVisitados-b.pdvVisitados;
      else if (sortKey==="ffvv")            c=a.ffvv.localeCompare(b.ffvv);
      return sortDesc?-c:c;
    });
    return filtrados;
  }, [statsMap, busqueda, filtroFFVV, filtroSupervisor, sortKey, sortDesc]);

  const ffvvOpciones = useMemo(() => {
    const seen=new Set<string>(); const result:{raw:string;norm:string}[]=[];
    for (const v of Object.values(statsMap)) { if (v.ffvv&&!seen.has(v.ffvv)){seen.add(v.ffvv);result.push({raw:v.ffvvRaw,norm:v.ffvv});} }
    return result.sort((a,b)=>a.norm.localeCompare(b.norm));
  }, [statsMap]);

  const supervisorOpciones = useMemo(() => Array.from(new Set(Object.values(statsMap).map((v)=>v.supervisor).filter(Boolean))).sort(), [statsMap]);

  const totales = useMemo(() => {
    const con=listaFiltrada.filter((v)=>v.horasTrabajadas>0);
    return { vendedores:listaFiltrada.length, diasConActividad:listaFiltrada.reduce((a,v)=>a+v.diasConActividad,0), horasPromedio:con.length>0?con.reduce((a,v)=>a+v.horasTrabajadas,0)/con.length:0, pdvVisitados:listaFiltrada.reduce((a,v)=>a+v.pdvVisitados,0), pdvPlanificados:listaFiltrada.reduce((a,v)=>a+v.pdvPlanificados,0) };
  }, [listaFiltrada]);

  const toggleSort = (key: SortKey) => { if (sortKey===key) setSortDesc(!sortDesc); else {setSortKey(key);setSortDesc(true);} };

  const periodoCurrent = PERIODOS_DISPONIBLES[PERIODO_ACTUAL_IDX];

  if (esVistaVendedor) {
    if (!user?.username) {
      return (
        <div className="p-6 text-sm text-red-500">
          No se pudo identificar el usuario vendedor logueado.
        </div>
      );
    }

    const ffvvUsuario = String(user.FFVV ?? user.ffvv ?? "");
    const nombreUsuario = user.name || user.username;

    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {nombreUsuario?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mi premio</h2>
              <p className="text-xs text-gray-400">
                {nombreUsuario} · ID vendedor {user.username}
                {ffvvUsuario ? ` · ${ffvvUsuario}` : ""}
              </p>
            </div>
          </div>
        </div>

        <DetalleFechas username={user.username} ffvv={ffvvUsuario} />
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"/>
        <p className="text-gray-500 dark:text-gray-400">Cargando equipo...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6 text-center text-red-600">
      <p className="font-semibold">Error al cargar datos</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );

  const efTotal = totales.pdvPlanificados > 0 ? Math.round((totales.pdvVisitados/totales.pdvPlanificados)*100) : null;
  const tituloPagina = esVistaSupervisor ? "Premios de mi FFVV" : "Resumen de Vendedores";
  const subtituloScope = esVistaSupervisor && user
    ? `Supervisor ${user.name || user.username} · FFVV ${String(user.FFVV ?? user.ffvv ?? "—")}`
    : "";

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500"/> {tituloPagina}
        </h2>
        {subtituloScope && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtituloScope}</p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {periodoCurrent.label} · Ventas {formatFecha(periodoCurrent.mesVentas+"-01")}→{formatFecha(periodoCurrent.mesVentas+"-30")} · Actividad {formatFecha(periodoCurrent.snapDesde)}→{formatFecha(periodoCurrent.snapHasta)} · {periodoCurrent.diasHabiles} días hábiles
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {label:"Vendedores",    value:totales.vendedores,                       icon:Users,       color:"text-indigo-600",  bg:"bg-indigo-50 dark:bg-indigo-900/30"},
          {label:"Días activos",  value:totales.diasConActividad,                 icon:Calendar,    color:"text-blue-600",    bg:"bg-blue-50 dark:bg-blue-900/30"},
          {label:"Prom. horas",   value:formatHoras(totales.horasPromedio),       icon:Clock,       color:"text-red-600",     bg:"bg-red-50 dark:bg-red-900/30"},
          {label:"PDV visitados", value:totales.pdvVisitados,                     icon:Store,       color:"text-emerald-600", bg:"bg-emerald-50 dark:bg-emerald-900/30"},
          {label:"Eficiencia PDV",value:efTotal!==null?`${efTotal}%`:"--",        icon:ShoppingBag, color:"text-violet-600",  bg:"bg-violet-50 dark:bg-violet-900/30"},
        ].map((kpi)=>(
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-3 flex flex-col gap-1`}>
            <kpi.icon className={`${kpi.color} w-4 h-4`}/>
            <p className={`text-lg font-bold ${kpi.color} leading-tight`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input type="text" placeholder="Buscar vendedor..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 w-48"/>
        </div>
        <Filter className="w-4 h-4 text-gray-400"/>
        <select value={filtroFFVV} onChange={(e)=>setFiltroFFVV(e.target.value)} disabled={esVistaSupervisor}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed">
          <option value="todos">{esVistaSupervisor ? "Mi FFVV" : "Todas las FFVV"}</option>
          {ffvvOpciones.map((f)=><option key={f.norm} value={f.norm}>{f.raw}</option>)}
        </select>
        <select value={filtroSupervisor} onChange={(e)=>setFiltroSupervisor(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none">
          <option value="todos">Todos los supervisores</option>
          {supervisorOpciones.map((s)=><option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <ArrowUpDown className="w-3.5 h-3.5"/>
          {([["horasTrabajadas","Horas"],["pdvVisitados","PDV"],["name","Nombre"],["ffvv","FFVV"]] as [SortKey,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>toggleSort(key)}
              className={`px-2 py-0.5 rounded-md border text-xs font-medium transition ${sortKey===key?"bg-red-600 text-white border-red-600":"bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"}`}>
              {label}{sortKey===key&&(sortDesc?" ↓":" ↑")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {listaFiltrada.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto w-10 h-10 mb-2 opacity-30"/>
            <p>Sin vendedores que coincidan</p>
          </div>
        )}
        {listaFiltrada.map((v) => {
          const isExpanded   = expandido === v.username;
          const efPdv        = v.pdvPlanificados > 0 ? Math.round((v.pdvVisitados/v.pdvPlanificados)*100) : null;
          const tieneTablero = isVafood(v.ffvv)||isEusckorInterior(v.ffvv);
          return (
            <div key={v.username} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <button type="button" onClick={()=>setExpandido(isExpanded?null:v.username)} className="w-full text-left">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {v.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{v.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getFfvvStyle(v.ffvv)}`}>{v.ffvvRaw||"—"}</span>
                      {tieneTablero && <Trophy className="w-3.5 h-3.5 text-amber-400"/>}
                    </div>
                    <p className="text-xs text-gray-400">ID {v.username} · {v.supervisor||"Sin supervisor"}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-sm font-bold text-blue-600">{v.horasTrabajadas>0?formatHoras(v.horasTrabajadas):"—"}</p>
                      <p className="text-[10px] text-gray-400">{v.ultimaFecha?formatFecha(v.ultimaFecha):"Sin registro"}</p>
                    </div>
                    <div className="w-24 hidden lg:block">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5"><span>PDV</span><span>{v.pdvVisitados}/{v.pdvPlanificados}</span></div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${efPdv===null?"":efPdv>=80?"bg-emerald-500":efPdv>=50?"bg-amber-400":"bg-red-400"}`} style={{width:`${Math.min(efPdv??0,100)}%`}}/>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 hidden lg:block text-right">
                      <p className="font-medium text-gray-600 dark:text-gray-300">{v.diasConActividad} días</p>
                      <p>~{formatHoras(v.promHoras)}</p>
                    </div>
                  </div>
                  <div className="text-gray-400 shrink-0">{isExpanded?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</div>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <DetalleFechas username={v.username} ffvv={v.ffvv}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-gray-400 pb-4">
        {listaFiltrada.length} vendedores · períodos desacoplados (ventas vs actividad) · config desde Supabase
      </div>
    </div>
  );
};

export default VendedoresResumen;
