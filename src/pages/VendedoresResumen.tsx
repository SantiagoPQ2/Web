import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import {
  TrendingUp, Clock, ShoppingBag, Users, ChevronDown, ChevronUp,
  Store, Search, Filter, Calendar, ArrowUpDown, ChevronLeft,
  ChevronRight, Loader2, Trophy, Star, BarChart2, AlertTriangle,
  Database,
} from "lucide-react";

// ─── Tipos base ───────────────────────────────────────────────────────────────

interface UsuarioApp {
  id: string; username: string; name: string;
  FFVV: string; supervisor: string; role: string;
}

interface ChessVenta {
  id: number; numero: string; fecha_comprobante: string;
  cliente: string; categoria: string; division: string;
  marca: string; unidad_de_negocio: string; codigo_articulo: string;
  bultos_total: number; subtotal_final: number;
  id_vendedor: number | string;
}

interface Snapshot {
  id: number; username: string;
  pdv_planificados: number; pdv_visitados: number; pdv_menos_5_min: number;
  horas_trabajadas: number; puntos_gps: number;
  primera_marca: string; ultima_marca: string;
  created_at: string; fecha: string;
}

interface VendedorStats {
  username: string; name: string;
  ffvv: string; ffvvRaw: string; supervisor: string;
  ultimaFecha: string | null;
  horasTrabajadas: number; pdvPlanificados: number; pdvVisitados: number;
  promHoras: number; promPdvVisitados: number; diasConActividad: number;
}

// ─── Tipos de Supabase (las 3 tablas nuevas) ─────────────────────────────────

interface VariableConfig {
  username: string;
  nombre_mostrar: string;
  ffvv: string;
  periodo: string;
  escala_pozo_id: string;
  base_cartera_sana: number;
  sku1_obj: number; sku2_obj: number; sku3_obj: number; sku4_obj: number; sku5_obj: number;
  sku1_min_compra: number; sku2_min_compra: number; sku3_min_compra: number;
  sku4_min_compra: number; sku5_min_compra: number;
  min_horas_dia: number;
  max_pct_menos5min: number;
  min_clientes_cob: number;
  venta_min_cliente: number;
}

interface TramoPozo {
  escala_id: string;
  desde_monto: number;
  pct_pozo: number;
}

interface SkuDefinicion {
  ffvv_grupo: string;
  sku_num: number;
  nombre_grupo: string;
  campo_filtro: string;
  valor_filtro: string;
  condicion_min_compra: string;
  obj_clientes_unicos: number;
}

// ─── Cache global (se carga una sola vez para toda la sesión) ─────────────────

let _tramosCache: TramoPozo[] | null = null;
let _skuDefCache: SkuDefinicion[] | null = null;

async function cargarTablasMaestra(): Promise<{ tramos: TramoPozo[]; skuDef: SkuDefinicion[] }> {
  if (_tramosCache && _skuDefCache) return { tramos: _tramosCache, skuDef: _skuDefCache };

  const [{ data: tramos }, { data: skuDef }] = await Promise.all([
    supabase.from("variable_tramos_pozo").select("escala_id, desde_monto, pct_pozo").order("escala_id").order("desde_monto"),
    supabase.from("variable_sku_definicion").select("*").order("ffvv_grupo").order("sku_num"),
  ]);

  _tramosCache = (tramos || []) as TramoPozo[];
  _skuDefCache = (skuDef || []) as SkuDefinicion[];
  return { tramos: _tramosCache, skuDef: _skuDefCache };
}

// ─── SKU: construir función match desde la definición de Supabase ─────────────

interface SkuGrupo {
  nombre: string;
  descripcion: string;
  objClientes: number;
  minCompra: number;
  match: (v: ChessVenta) => boolean;
}

function buildSkuMatch(def: SkuDefinicion): (v: ChessVenta) => boolean {
  const campo = def.campo_filtro.trim();
  const valor = def.valor_filtro.trim();

  // marca=SADIA AND codigo_articulo IN
  if (campo.includes("AND") && campo.includes("codigo_articulo")) {
    const codigos = valor.split(";").map((s) => s.trim());
    return (v) =>
      v.marca?.trim().toUpperCase() === "SADIA" &&
      codigos.includes(String(v.codigo_articulo).trim());
  }
  // marca=LUCCHETTI AND division
  if (campo.includes("AND") && campo.includes("division")) {
    const marcaMatch = campo.match(/marca=(\S+)/)?.[1]?.toUpperCase() ?? "";
    return (v) =>
      v.marca?.trim().toUpperCase() === marcaMatch &&
      v.division?.trim().toUpperCase() === valor.toUpperCase();
  }
  // unidad_de_negocio (puede ser múltiple con ;)
  if (campo === "unidad_de_negocio") {
    const vals = valor.split(";").map((s) => s.trim().toUpperCase());
    return (v) => vals.includes(v.unidad_de_negocio?.trim().toUpperCase());
  }
  // marca
  if (campo === "marca") {
    return (v) => v.marca?.trim().toUpperCase() === valor.toUpperCase();
  }
  // codigo_articulo (puede ser múltiple con ;)
  if (campo === "codigo_articulo") {
    const vals = valor.split(";").map((s) => s.trim());
    return (v) => vals.includes(String(v.codigo_articulo).trim());
  }
  // fallback
  return () => false;
}

function getSkuGruposFromDef(
  ffvv: string,
  skuDef: SkuDefinicion[],
  config: VariableConfig
): SkuGrupo[] {
  const ffvvNorm = ffvv.charAt(0).toUpperCase() + ffvv.slice(1).toLowerCase();
  const defs = skuDef
    .filter((d) => d.ffvv_grupo.toLowerCase() === ffvv.toLowerCase())
    .sort((a, b) => a.sku_num - b.sku_num);

  const minCompras = [
    config.sku1_min_compra, config.sku2_min_compra, config.sku3_min_compra,
    config.sku4_min_compra, config.sku5_min_compra,
  ];
  const objClientes = [
    config.sku1_obj, config.sku2_obj, config.sku3_obj,
    config.sku4_obj, config.sku5_obj,
  ];

  return defs.map((def, i) => ({
    nombre:      def.nombre_grupo,
    descripcion: def.condicion_min_compra,
    objClientes: objClientes[i] ?? def.obj_clientes_unicos,
    minCompra:   minCompras[i] ?? 1,
    match:       buildSkuMatch(def),
  }));
}

// ─── Pozo con tramos de Supabase ──────────────────────────────────────────────

function calcularPozoConTramos(venta: number, escalaId: string, tramos: TramoPozo[]): number {
  const tramosEscala = tramos
    .filter((t) => t.escala_id === escalaId)
    .sort((a, b) => b.desde_monto - a.desde_monto);
  const tramo = tramosEscala.find((t) => venta >= Number(t.desde_monto));
  return tramo ? venta * Number(tramo.pct_pozo) : 0;
}

// ─── Multiplicadores (fijos del PDF) ─────────────────────────────────────────

const multDisciplina = (p: number) => p >= 90 ? 1.05 : p >= 80 ? 0.82 : p >= 65 ? 0.58 : p >= 50 ? 0.25 : 0;
const multCobertura  = (p: number) => p >= 90 ? 1.05 : p >= 80 ? 0.93 : p >= 65 ? 0.74 : p >= 50 ? 0.50 : 0.25;
const multSkus       = (n: number) => ({ 0: 0.50, 1: 0.90, 2: 1.075, 3: 1.18, 4: 1.33, 5: 1.50 }[Math.min(n, 5)] ?? 0.50);
const multCartera    = (p: number) => p >= 110 ? 1.15 : p >= 105 ? 1.10 : p >= 100 ? 1.05 : p >= 90 ? 0.95 : 0.60;

// ─── Helpers de formato ───────────────────────────────────────────────────────

const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const formatHoras = (h: number) =>
  `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60).toString().padStart(2, "0")}m`;

const formatHora = (iso: string | null) => {
  if (!iso) return "--";
  try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }); }
  catch { return "--"; }
};

const formatFecha = (s: string | null) => {
  if (!s) return "--";
  try { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; } catch { return s; }
};

const diaSemana = (s: string) => {
  try { const [y, m, d] = s.split("-").map(Number); return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(y, m - 1, d).getDay()]; }
  catch { return ""; }
};

const normalizarFFVV = (f: string) => f?.trim().toLowerCase() ?? "";
const isVafood = (f: string) => normalizarFFVV(f) === "vafood";
const isEusckorInterior = (f: string) => ["eusckor", "interior"].includes(normalizarFFVV(f));

const getFfvvStyle = (f: string) => {
  const n = normalizarFFVV(f);
  if (n === "vafood")   return "bg-red-100 text-red-700";
  if (n === "eusckor")  return "bg-blue-100 text-blue-700";
  if (n === "interior") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
};

const premioColor = (p: number) =>
  p <= 0 ? "text-gray-400" : p < 500_000 ? "text-amber-600" : p < 1_200_000 ? "text-emerald-600" : "text-violet-600";

const cellOk  = "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
const cellBad = "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
const cellNA  = "text-gray-300 dark:text-gray-600";

type SortKey = "name" | "horasTrabajadas" | "pdvVisitados" | "ffvv";

// ─── Tipo: día para la tabla diaria ──────────────────────────────────────────

interface DiaTabla {
  fecha: string;
  horasTrabajadas: number; pdvMenos5Min: number; pdvVisitados: number;
  pdvMas40Min: number | null; tieneSnap: boolean;
  primeraEntrada: string | null; ultimaSalida: string | null;
  tieneVenta: boolean; clientesMas25k: number; cccUnicos: number;
  skuClientes: number[];
}

// ─── buildDiasTabla ───────────────────────────────────────────────────────────

function buildDiasTabla(
  ventas: ChessVenta[],
  snapshots: Snapshot[],
  username: string,
  grupos: SkuGrupo[],
  ventaMinCliente: number
): DiaTabla[] {
  const snapsPorFecha: Record<string, Snapshot> = {};
  for (const snap of snapshots.filter((s) => String(s.username) === String(username))) {
    const fecha = new Date(snap.created_at)
      .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    if (!snapsPorFecha[fecha]) snapsPorFecha[fecha] = snap;
  }

  const ventasPorFecha: Record<string, ChessVenta[]> = {};
  for (const v of ventas) {
    const fecha = v.fecha_comprobante?.slice(0, 10);
    if (!fecha) continue;
    if (!ventasPorFecha[fecha]) ventasPorFecha[fecha] = [];
    ventasPorFecha[fecha].push(v);
  }

  const fechasOrdenadas = Array.from(new Set(Object.keys(ventasPorFecha))).sort();

  // CCC acumulado por mes
  const clientesVistosPorMes: Record<string, Set<string>> = {};
  const resultadoPorFecha: Record<string, { clientesMas25k: number; cccUnicos: number }> = {};

  for (const fecha of fechasOrdenadas) {
    const mes = fecha.slice(0, 7);
    if (!clientesVistosPorMes[mes]) clientesVistosPorMes[mes] = new Set();
    const yaVistos = clientesVistosPorMes[mes];
    const ventasDia = ventasPorFecha[fecha] ?? [];

    const porCliente: Record<string, number> = {};
    for (const v of ventasDia) {
      const cli = String(v.cliente);
      porCliente[cli] = (porCliente[cli] || 0) + (Number(v.subtotal_final) || 0);
    }

    const clientesMas25k = Object.values(porCliente).filter((m) => m > ventaMinCliente).length;
    const clientesHoy    = Object.keys(porCliente);
    const cccUnicos      = clientesHoy.filter((cli) => !yaVistos.has(cli)).length;
    for (const cli of clientesHoy) yaVistos.add(cli);

    resultadoPorFecha[fecha] = { clientesMas25k, cccUnicos };
  }

  const resultado: DiaTabla[] = [];
  for (const fecha of [...fechasOrdenadas].reverse()) {
    const ventasDia = ventasPorFecha[fecha] ?? [];
    const snap      = snapsPorFecha[fecha] ?? null;
    const { clientesMas25k, cccUnicos } = resultadoPorFecha[fecha];

    const skuClientes = grupos.map((grupo) => {
      const ventasGrupo = ventasDia.filter(grupo.match);
      return new Set(ventasGrupo.map((v) => String(v.cliente))).size;
    });

    resultado.push({
      fecha,
      horasTrabajadas: snap ? Number(snap.horas_trabajadas) || 0 : 0,
      pdvMenos5Min:    snap ? Number(snap.pdv_menos_5_min)  || 0 : 0,
      pdvVisitados:    snap ? Number(snap.pdv_visitados)    || 0 : 0,
      pdvMas40Min:     null,
      tieneSnap:       !!snap,
      primeraEntrada:  snap?.primera_marca || null,
      ultimaSalida:    snap?.ultima_marca  || null,
      tieneVenta:      ventasDia.length > 0,
      clientesMas25k,
      cccUnicos,
      skuClientes,
    });
  }
  return resultado;
}

// ─── PanelPremio ──────────────────────────────────────────────────────────────

const PanelPremio: React.FC<{
  ventas: ChessVenta[];
  snapshots: Snapshot[];
  username: string;
  config: VariableConfig;
  grupos: SkuGrupo[];
  tramos: TramoPozo[];
}> = ({ ventas, snapshots, username, config, grupos, tramos }) => {

  const dias = useMemo(
    () => buildDiasTabla(ventas, snapshots, username, grupos, config.venta_min_cliente),
    [ventas, snapshots, username, grupos, config.venta_min_cliente]
  );

  const ventaTotal = ventas.reduce((a, v) => a + (Number(v.subtotal_final) || 0), 0);
  const pozo       = calcularPozoConTramos(ventaTotal, config.escala_pozo_id, tramos);

  // Disciplina — usa min_horas_dia y max_pct_menos5min de la config
  const diasBase = dias.length;
  const diasDisciplinaOk = dias.filter((d) => {
    if (!d.tieneSnap || d.horasTrabajadas < config.min_horas_dia) return false;
    const pct5 = d.pdvVisitados > 0 ? (d.pdvMenos5Min / d.pdvVisitados) * 100 : 100;
    return pct5 <= config.max_pct_menos5min;
  }).length;
  const pctDisciplina = diasBase > 0 ? (diasDisciplinaOk / diasBase) * 100 : 0;
  const mDisc = multDisciplina(pctDisciplina);

  // Cobertura — usa min_clientes_cob de la config
  const diasCoberturaOk = dias.filter((d) => d.clientesMas25k >= config.min_clientes_cob).length;
  const pctCobertura    = diasBase > 0 ? (diasCoberturaOk / diasBase) * 100 : 0;
  const mCob = multCobertura(pctCobertura);

  // SKUs — usa obj_clientes de la config, con compra mínima
  const skuClientesPeriodo = useMemo(() => {
    return grupos.map((grupo) => {
      // Solo cuentan clientes que compraron >= minCompra unidades/bultos
      const porCliente: Record<string, number> = {};
      ventas.filter(grupo.match).forEach((v) => {
        const cli = String(v.cliente);
        porCliente[cli] = (porCliente[cli] || 0) + (Number(v.bultos_total) || 1);
      });
      return Object.values(porCliente).filter((cant) => cant >= grupo.minCompra).length;
    });
  }, [ventas, grupos]);

  const skusLogrados   = skuClientesPeriodo.filter((c, i) => c >= grupos[i]?.objClientes).length;
  const mSkus          = multSkus(skusLogrados);
  const clientesUnicos = new Set(ventas.map((v) => String(v.cliente))).size;
  const premioEstimado = pozo * mDisc * mCob * mSkus;

  // Cartera sana
  const pctCartera     = config.base_cartera_sana > 0
    ? (clientesUnicos / config.base_cartera_sana) * 100 : null;
  const mCartera       = pctCartera !== null ? multCartera(pctCartera) : null;
  const premioConCartera = mCartera !== null ? premioEstimado * mCartera : null;

  const [mostrarTabla, setMostrarTabla] = useState(false);

  const MultBadge: React.FC<{ mult: number }> = ({ mult }) => {
    const color = mult >= 1 ? "bg-emerald-100 text-emerald-700" : mult > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>×{mult}</span>;
  };

  // Encontrar el piso de la escala para mostrarlo
  const tramosEscala = tramos
    .filter((t) => t.escala_id === config.escala_pozo_id && t.desde_monto > 0)
    .sort((a, b) => a.desde_monto - b.desde_monto);
  const pisoEscala = tramosEscala[0]?.desde_monto ?? 0;

  return (
    <div className="space-y-4">

      {/* Config badge */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <Database className="w-3 h-3" />
        <span>
          Config: <span className="font-medium text-gray-600 dark:text-gray-300">{config.escala_pozo_id}</span>
          {" · "}piso {formatMoney(pisoEscala)}
          {" · "}cartera base {config.base_cartera_sana} cl
          {" · "}periodo {config.periodo}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Venta Total</p>
          <p className="text-base font-bold text-emerald-700 mt-0.5">{formatMoney(ventaTotal)}</p>
        </div>
        <div className={`${pozo > 0 ? "bg-violet-50 dark:bg-violet-900/20" : "bg-gray-100 dark:bg-gray-800"} rounded-lg p-3 text-center`}>
          <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide">Pozo Base</p>
          <p className={`text-base font-bold mt-0.5 ${pozo > 0 ? "text-violet-700" : "text-gray-400"}`}>{formatMoney(pozo)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">SKUs logrados</p>
          <p className="text-base font-bold text-blue-700 mt-0.5">{skusLogrados} / {grupos.length}</p>
        </div>
        <div className={`${(premioConCartera ?? premioEstimado) > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-gray-100 dark:bg-gray-800"} rounded-lg p-3 text-center`}>
          <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
            Premio {premioConCartera !== null ? "final" : "estimado*"}
          </p>
          <p className={`text-sm font-bold mt-0.5 ${premioColor(premioConCartera ?? premioEstimado)}`}>
            {formatMoney(premioConCartera ?? premioEstimado)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Cálculo paso a paso */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" /> Cálculo del premio
          </p>

          {/* Venta y pozo */}
          {[
            { label: "Venta del período", value: formatMoney(ventaTotal) },
            {
              label: `Pozo (${config.escala_pozo_id} · piso ${formatMoney(pisoEscala)})`,
              value: formatMoney(pozo),
              sub: pozo === 0 ? `(no alcanzó ${formatMoney(pisoEscala)})` : undefined,
              color: pozo > 0 ? "text-violet-600" : "text-gray-400",
            },
          ].map((r) => (
            <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{r.label}</span>
              <span className={`text-sm font-bold ${r.color ?? "text-gray-800 dark:text-gray-100"} shrink-0`}>
                {r.value}{r.sub && <span className="text-xs text-gray-400 ml-1">{r.sub}</span>}
              </span>
            </div>
          ))}

          {/* Multiplicadores */}
          {[
            {
              label: `Disciplina ${pctDisciplina.toFixed(0)}% (${diasDisciplinaOk}/${diasBase} días)`,
              sub: `≥${config.min_horas_dia}h · <${config.max_pct_menos5min}% <5min`,
              value: formatMoney(pozo * mDisc),
              mult: mDisc,
            },
            {
              label: `Cobertura ${pctCobertura.toFixed(0)}% (${diasCoberturaOk}/${diasBase} días)`,
              sub: `≥${config.min_clientes_cob} cl >$${config.venta_min_cliente.toLocaleString("es-AR")}`,
              value: formatMoney(pozo * mDisc * mCob),
              mult: mCob,
            },
            {
              label: `SKUs estratégicos (${skusLogrados}/${grupos.length})`,
              sub: "",
              value: formatMoney(premioEstimado),
              mult: mSkus,
            },
          ].map((r) => (
            <div key={r.label} className="flex justify-between items-start py-1.5 border-b border-gray-100 dark:border-gray-700">
              <div className="min-w-0 mr-2">
                <span className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                  {r.label} <MultBadge mult={r.mult} />
                </span>
                {r.sub && <span className="text-[10px] text-gray-400">{r.sub}</span>}
              </div>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100 shrink-0">{r.value}</span>
            </div>
          ))}

          {/* Cartera sana */}
          {pctCartera !== null ? (
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                Cartera sana {pctCartera.toFixed(0)}% ({clientesUnicos}/{config.base_cartera_sana} cl)
                {mCartera !== null && <MultBadge mult={mCartera} />}
              </span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {premioConCartera !== null ? formatMoney(premioConCartera) : "—"}
              </span>
            </div>
          ) : (
            <div className="mt-2 pt-1 border-t border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-between">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" /> Cartera sana (base no configurada)
              </span>
              <span className="text-xs text-gray-400">×?</span>
            </div>
          )}

          <div className="mt-2 flex justify-between">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              Premio {premioConCartera !== null ? "final" : "estimado*"}
            </span>
            <span className={`text-base font-bold ${premioColor(premioConCartera ?? premioEstimado)}`}>
              {formatMoney(premioConCartera ?? premioEstimado)}
            </span>
          </div>
          {premioConCartera === null && (
            <p className="text-[10px] text-gray-400 mt-1">* Sin cartera sana: base_cartera_sana = 0 en la config</p>
          )}
        </div>

        {/* SKUs detalle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Star className="w-3.5 h-3.5" /> SKUs estratégicos
          </p>
          <div className="space-y-2">
            {grupos.map((grupo, i) => {
              const cu      = skuClientesPeriodo[i];
              const obj     = grupo.objClientes;
              const logrado = cu >= obj;
              return (
                <div key={i} className={`rounded-md p-2 border ${logrado ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600"}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${logrado ? "text-emerald-700" : "text-gray-500"}`}>
                      {i + 1}. {grupo.nombre}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${logrado ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                      {logrado ? "✓ logrado" : "✗ pendiente"}
                    </span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">{grupo.descripcion}</span>
                    <span className={`text-xs font-bold ${cu >= obj ? "text-emerald-600" : cu >= obj * 0.6 ? "text-amber-500" : "text-red-500"}`}>
                      {cu}/{obj} cl
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${logrado ? "bg-emerald-500" : cu >= obj * 0.6 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min((cu / obj) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Indicadores resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Días trabajados",     value: diasBase,                                          color: "text-gray-700 dark:text-gray-200" },
          { label: "Días disciplina OK",  value: `${diasDisciplinaOk} (${pctDisciplina.toFixed(0)}%)`, color: pctDisciplina >= 80 ? "text-emerald-600" : pctDisciplina >= 65 ? "text-amber-500" : "text-red-500" },
          { label: "Días cobertura OK",   value: `${diasCoberturaOk} (${pctCobertura.toFixed(0)}%)`,   color: pctCobertura  >= 80 ? "text-emerald-600" : pctCobertura  >= 65 ? "text-amber-500" : "text-red-500" },
          { label: "Clientes únicos",     value: `${clientesUnicos}${config.base_cartera_sana > 0 ? ` / ${config.base_cartera_sana}` : ""}`, color: "text-blue-600" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla por día */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setMostrarTabla(!mostrarTabla)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
        >
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
                  <th className="px-2 py-1 text-center font-semibold text-gray-500 border-b border-r border-gray-200 dark:border-gray-600" colSpan={1}>Cobertura</th>
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
                    Cl. &gt;${(config.venta_min_cliente / 1000).toFixed(0)}k
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
                  const discOk = dia.tieneSnap && dia.horasTrabajadas >= config.min_horas_dia && pct5 <= config.max_pct_menos5min;
                  const cobOk  = dia.clientesMas25k >= config.min_clientes_cob;
                  const rowBg  = idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-700/20";

                  return (
                    <tr key={dia.fecha} className={`${rowBg} border-b border-gray-100 dark:border-gray-700/50`}>
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{dia.fecha.slice(8)}/{dia.fecha.slice(5, 7)}</span>
                        <span className="ml-1 text-gray-400">{diaSemana(dia.fecha)}</span>
                      </td>
                      <td className={`px-2 py-1.5 text-center ${dia.tieneSnap ? (dia.horasTrabajadas >= config.min_horas_dia ? cellOk : cellBad) : cellNA}`}>
                        {dia.tieneSnap ? formatHoras(dia.horasTrabajadas) : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center ${dia.tieneSnap ? (pct5 <= config.max_pct_menos5min ? cellOk : cellBad) : cellNA}`}>
                        {dia.tieneSnap ? `${pct5.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center border-r border-gray-200 dark:border-gray-600 ${cellNA}`}>—</td>
                      <td className={`px-2 py-1.5 text-center font-semibold border-r border-gray-200 dark:border-gray-600 ${cobOk ? cellOk : dia.clientesMas25k >= config.min_clientes_cob * 0.6 ? "text-amber-500" : cellBad}`}>
                        {dia.clientesMas25k}
                      </td>
                      {dia.skuClientes.map((cu, gi) => (
                        <td key={gi} className={`px-2 py-1.5 text-center font-semibold border-r border-gray-200 dark:border-gray-600 last:border-r-0 ${cu >= 10 ? cellOk : cu >= 5 ? "text-amber-500 dark:text-amber-400" : cu > 0 ? cellBad : cellNA}`}>
                          {cu > 0 ? cu : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-semibold text-blue-600 dark:text-blue-400">
                        {dia.cccUnicos}
                      </td>
                    </tr>
                  );
                })}

                {/* Fila totales */}
                <tr className="bg-gray-100 dark:bg-gray-700 font-semibold text-[11px] border-t-2 border-gray-300 dark:border-gray-500">
                  <td className="px-2 py-2 border-r border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">Total / Obj.</td>
                  <td className="px-2 py-2 text-center text-gray-500">—</td>
                  <td className="px-2 py-2 text-center text-gray-500">—</td>
                  <td className="px-2 py-2 text-center text-gray-500 border-r border-gray-200 dark:border-gray-600">—</td>
                  <td className={`px-2 py-2 text-center border-r border-gray-200 dark:border-gray-600 ${diasCoberturaOk === diasBase ? "text-emerald-600" : "text-amber-500"}`}>
                    {diasCoberturaOk}/{diasBase} días
                  </td>
                  {skuClientesPeriodo.map((cu, gi) => (
                    <td key={gi} className={`px-2 py-2 text-center border-r border-gray-200 dark:border-gray-600 ${cu >= grupos[gi]?.objClientes ? "text-emerald-600" : cu >= (grupos[gi]?.objClientes ?? 100) * 0.6 ? "text-amber-500" : "text-red-500"}`}>
                      {cu}<span className="text-gray-400 font-normal">/{grupos[gi]?.objClientes ?? 100}</span>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-blue-600">
                    {dias.reduce((a, d) => a + d.cccUnicos, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DetalleFechasList (tab fechas) ───────────────────────────────────────────

const DetalleFechasList: React.FC<{
  ventas: ChessVenta[];
  snapshots: Snapshot[];
  username: string;
}> = ({ ventas, snapshots, username }) => {
  const [paginaActual, setPaginaActual] = useState(0);
  const POR_PAGINA = 5;

  interface ResumenFecha {
    fecha: string; totalVentas: number; cantidadFacturas: number; cantidadClientes: number;
    bultos: number; marcas: string[]; categorias: Record<string, number>;
    horasTrabajadas: number | null; pdvPlanificados: number | null; pdvVisitados: number | null;
    pdvMenos5Min: number | null; puntoGps: number | null;
    primeraEntrada: string | null; ultimaSalida: string | null;
  }

  const fechas = useMemo(() => {
    const map: Record<string, ResumenFecha> = {};
    const asegurar = (f: string) => {
      if (!map[f]) map[f] = {
        fecha: f, totalVentas: 0, cantidadFacturas: 0, cantidadClientes: 0,
        bultos: 0, marcas: [], categorias: {},
        horasTrabajadas: null, pdvPlanificados: null, pdvVisitados: null,
        pdvMenos5Min: null, puntoGps: null, primeraEntrada: null, ultimaSalida: null,
      };
    };
    const facturas: Record<string, Set<string>> = {};
    const clientes: Record<string, Set<string>> = {};
    const marcasSet: Record<string, Set<string>> = {};

    for (const v of ventas) {
      const f = v.fecha_comprobante?.slice(0, 10);
      if (!f) continue;
      asegurar(f);
      if (!facturas[f]) { facturas[f] = new Set(); clientes[f] = new Set(); marcasSet[f] = new Set(); }
      facturas[f].add(v.numero);
      clientes[f].add(String(v.cliente));
      marcasSet[f].add(v.marca);
      map[f].totalVentas += Number(v.subtotal_final) || 0;
      map[f].bultos      += Number(v.bultos_total) || 0;
      if (v.categoria) map[f].categorias[v.categoria] = (map[f].categorias[v.categoria] || 0) + (Number(v.subtotal_final) || 0);
    }
    for (const f of Object.keys(facturas)) {
      map[f].cantidadFacturas = facturas[f].size;
      map[f].cantidadClientes = clientes[f].size;
      map[f].marcas           = Array.from(marcasSet[f]);
    }

    const vistas = new Set<string>();
    for (const snap of snapshots.filter((s) => String(s.username) === String(username))) {
      const f = new Date(snap.created_at).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      if (vistas.has(f)) continue;
      vistas.add(f);
      asegurar(f);
      map[f].horasTrabajadas = Number(snap.horas_trabajadas) || 0;
      map[f].pdvPlanificados = Number(snap.pdv_planificados) || 0;
      map[f].pdvVisitados    = Number(snap.pdv_visitados)    || 0;
      map[f].pdvMenos5Min    = Number(snap.pdv_menos_5_min)  || 0;
      map[f].puntoGps        = Number(snap.puntos_gps)       || 0;
      map[f].primeraEntrada  = snap.primera_marca || null;
      map[f].ultimaSalida    = snap.ultima_marca  || null;
    }
    return Object.values(map).filter((d) => d.totalVentas > 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventas, snapshots, username]);

  const totalPaginas = Math.ceil(fechas.length / POR_PAGINA);
  const paginadas    = fechas.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  if (fechas.length === 0) return <p className="text-sm text-gray-400 py-2">Sin registros de ventas</p>;

  return (
    <div className="space-y-2">
      {paginadas.map((dia) => {
        const efPdv   = dia.pdvPlanificados && dia.pdvPlanificados > 0 ? Math.round(((dia.pdvVisitados ?? 0) / dia.pdvPlanificados) * 100) : null;
        const topCats = Object.entries(dia.categorias).sort(([, a], [, b]) => b - a).slice(0, 3);
        const tieneAct = dia.horasTrabajadas !== null;

        return (
          <div key={dia.fecha} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800">
              <div className="text-center shrink-0 w-10">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{diaSemana(dia.fecha)}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{dia.fecha.slice(8)}/{dia.fecha.slice(5, 7)}</p>
              </div>
              <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                <span className="text-emerald-600 font-bold">{formatMoney(dia.totalVentas)}</span>
                <span className="text-gray-500">{dia.cantidadFacturas} fact · {dia.cantidadClientes} cl</span>
                {tieneAct && <span className="text-blue-600 font-medium">{formatHoras(dia.horasTrabajadas!)}</span>}
                {tieneAct && dia.pdvVisitados !== null && (
                  <span className={`font-medium ${efPdv !== null && efPdv >= 80 ? "text-emerald-600" : efPdv !== null && efPdv >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {dia.pdvVisitados}/{dia.pdvPlanificados} PDV{efPdv !== null && <span className="text-gray-400 font-normal ml-0.5">({efPdv}%)</span>}
                  </span>
                )}
              </div>
            </div>
            <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Ventas</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span className="text-gray-400">Facturas</span>  <span className="font-medium text-right">{dia.cantidadFacturas}</span>
                  <span className="text-gray-400">Clientes</span>  <span className="font-medium text-right">{dia.cantidadClientes}</span>
                  <span className="text-gray-400">Bultos</span>    <span className="font-medium text-right">{dia.bultos}</span>
                  <span className="text-gray-400">Marcas</span>    <span className="font-medium text-right">{dia.marcas.length}</span>
                </div>
                {topCats.length > 0 && (
                  <div className="pt-1 space-y-0.5">
                    <p className="text-[10px] text-gray-400">Top categorías</p>
                    {topCats.map(([cat, monto]) => (
                      <div key={cat} className="flex justify-between">
                        <span className="text-gray-500 truncate max-w-[130px]">{cat}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300 ml-2">{formatMoney(monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {tieneAct && (
                <div className="space-y-1">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1"><Clock className="w-3 h-3" /> Actividad</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-gray-400">Entrada</span>   <span className="font-medium text-right">{formatHora(dia.primeraEntrada)}</span>
                    <span className="text-gray-400">Salida</span>    <span className="font-medium text-right">{formatHora(dia.ultimaSalida)}</span>
                    <span className="text-gray-400">Horas</span>     <span className="font-medium text-right text-blue-600">{formatHoras(dia.horasTrabajadas!)}</span>
                    <span className="text-gray-400">PDV plan.</span> <span className="font-medium text-right">{dia.pdvPlanificados}</span>
                    <span className="text-gray-400">PDV visit.</span>
                    <span className={`font-bold text-right ${efPdv !== null && efPdv >= 80 ? "text-emerald-600" : efPdv !== null && efPdv >= 50 ? "text-amber-500" : "text-red-500"}`}>
                      {dia.pdvVisitados}{efPdv !== null && <span className="text-gray-400 font-normal ml-1">({efPdv}%)</span>}
                    </span>
                    {(dia.pdvMenos5Min ?? 0) > 0 && (
                      <><span className="text-gray-400">PDV &lt;5min</span><span className="font-medium text-right text-amber-500">{dia.pdvMenos5Min}</span></>
                    )}
                    <span className="text-gray-400">GPS pts</span>   <span className="font-medium text-right">{dia.puntoGps}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
          <button onClick={() => setPaginaActual((p) => Math.max(0, p - 1))} disabled={paginaActual === 0}
            className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <span>Página {paginaActual + 1} de {totalPaginas} · {fechas.length} días</span>
          <button onClick={() => setPaginaActual((p) => Math.min(totalPaginas - 1, p + 1))} disabled={paginaActual === totalPaginas - 1}
            className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── DetalleFechas: carga lazy + fetch config de Supabase ─────────────────────

const PERIODO_ACTUAL = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);

const DetalleFechas: React.FC<{ username: string; ffvv: string; snapshots: Snapshot[] }> = ({ username, ffvv, snapshots }) => {
  const [ventas,   setVentas]   = useState<ChessVenta[]>([]);
  const [config,   setConfig]   = useState<VariableConfig | null>(null);
  const [grupos,   setGrupos]   = useState<SkuGrupo[]>([]);
  const [tramos,   setTramos]   = useState<TramoPozo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [tab,      setTab]      = useState<"premio" | "fechas">("premio");

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setLoading(true); setError(null);
      try {
        // 1. Ventas (con paginación para saltear límite 1000)
        let todas: ChessVenta[] = [];
        let desde = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error: e } = await supabase
            .from("chess_ventas")
            .select("id, numero, fecha_comprobante, cliente, categoria, division, marca, unidad_de_negocio, codigo_articulo, bultos_total, subtotal_final, id_vendedor")
            .eq("id_vendedor", username)
            .order("fecha_comprobante", { ascending: false })
            .range(desde, desde + CHUNK - 1);
          if (e) throw new Error(e.message);
          if (!data || data.length === 0) break;
          todas = todas.concat(data as ChessVenta[]);
          if (data.length < CHUNK) break;
          desde += CHUNK;
        }

        // 2. Config del vendedor para el período actual + tablas maestras
        const [{ data: configData }, { tramos: tramosData, skuDef }] = await Promise.all([
          supabase
            .from("variable_config")
            .select("*")
            .eq("username", username)
            .eq("periodo", PERIODO_ACTUAL)
            .eq("activo", true)
            .maybeSingle(),
          cargarTablasMaestra(),
        ]);

        if (!cancelado) {
          setVentas(todas);
          setTramos(tramosData);

          if (configData) {
            const cfg = configData as VariableConfig;
            setConfig(cfg);
            setGrupos(getSkuGruposFromDef(cfg.ffvv || ffvv, skuDef, cfg));
          } else {
            // Sin config en Supabase: grupos por FFVV sin objetivos personalizados
            setConfig(null);
            setGrupos([]);
          }
        }
      } catch (err: any) {
        if (!cancelado) setError(err.message || "Error cargando datos");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [username, ffvv]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando ventas y configuración...
    </div>
  );
  if (error) return <p className="text-sm text-red-500 py-2">Error: {error}</p>;

  const showPremio = config !== null && grupos.length > 0;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {showPremio && (
          <>
            <button onClick={() => setTab("premio")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${tab === "premio" ? "bg-red-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"}`}>
              🏆 Tablero de Premio
            </button>
            <button onClick={() => setTab("fechas")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${tab === "fechas" ? "bg-red-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"}`}>
              📅 Detalle por Fecha
            </button>
          </>
        )}
        {!showPremio && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Sin config para el período {PERIODO_ACTUAL} — subí los CSVs a Supabase
          </div>
        )}
      </div>

      {tab === "premio" && showPremio && config && (
        <PanelPremio
          ventas={ventas}
          snapshots={snapshots}
          username={username}
          config={config}
          grupos={grupos}
          tramos={tramos}
        />
      )}
      {(tab === "fechas" || !showPremio) && (
        <DetalleFechasList ventas={ventas} snapshots={snapshots} username={username} />
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const VendedoresResumen: React.FC = () => {
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
    const cargar = async () => {
      setLoading(true); setError(null);
      try {
        const [{ data: u, error: e1 }, { data: s, error: e3 }] = await Promise.all([
          supabase.from("usuarios_app").select("id, username, name, FFVV, supervisor, role").eq("role", "vendedor"),
          supabase.from("admin_equipo_snapshots")
            .select("id, username, pdv_planificados, pdv_visitados, pdv_menos_5_min, horas_trabajadas, puntos_gps, primera_marca, ultima_marca, created_at, fecha")
            .eq("role", "vendedor").order("created_at", { ascending: false }),
        ]);
        if (e1) throw new Error(`Usuarios: ${e1.message}`);
        if (e3) throw new Error(`Snapshots: ${e3.message}`);
        setUsuarios((u as UsuarioApp[]) || []);
        setSnapshots((s as Snapshot[]) || []);
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const statsMap = useMemo<Record<string, VendedorStats>>(() => {
    const map: Record<string, VendedorStats> = {};
    for (const u of usuarios) {
      map[u.username] = {
        username: u.username, name: u.name || u.username,
        ffvv: normalizarFFVV(u.FFVV), ffvvRaw: u.FFVV?.trim() || "",
        supervisor: u.supervisor || "",
        ultimaFecha: null, horasTrabajadas: 0, pdvPlanificados: 0, pdvVisitados: 0,
        promHoras: 0, promPdvVisitados: 0, diasConActividad: 0,
      };
    }
    const snapsX: Record<string, Snapshot[]> = {};
    for (const snap of snapshots) {
      const uid = String(snap.username);
      if (!snapsX[uid]) snapsX[uid] = [];
      snapsX[uid].push(snap);
    }
    for (const [uid, snaps] of Object.entries(snapsX)) {
      if (!map[uid]) continue;
      const s = map[uid];
      const ultimo = snaps[0];
      s.ultimaFecha     = ultimo.fecha;
      s.horasTrabajadas = Number(ultimo.horas_trabajadas) || 0;
      s.pdvPlanificados = Number(ultimo.pdv_planificados) || 0;
      s.pdvVisitados    = Number(ultimo.pdv_visitados)    || 0;
      const activos       = snaps.filter((sn) => Number(sn.horas_trabajadas) > 0);
      s.diasConActividad  = activos.length;
      s.promHoras         = activos.length > 0 ? activos.reduce((a, sn) => a + Number(sn.horas_trabajadas), 0) / activos.length : 0;
      s.promPdvVisitados  = activos.length > 0 ? activos.reduce((a, sn) => a + Number(sn.pdv_visitados),    0) / activos.length : 0;
    }
    return map;
  }, [usuarios, snapshots]);

  const listaFiltrada = useMemo(() => {
    const todos = Object.values(statsMap);
    const filtrados = todos.filter((v) => {
      const mb = busqueda === "" || v.name.toLowerCase().includes(busqueda.toLowerCase()) || v.username.includes(busqueda);
      const mf = filtroFFVV === "todos" || v.ffvv === normalizarFFVV(filtroFFVV);
      const ms = filtroSupervisor === "todos" || v.supervisor === filtroSupervisor;
      return mb && mf && ms;
    });
    filtrados.sort((a, b) => {
      let c = 0;
      if      (sortKey === "name")             c = a.name.localeCompare(b.name);
      else if (sortKey === "horasTrabajadas")  c = a.horasTrabajadas - b.horasTrabajadas;
      else if (sortKey === "pdvVisitados")     c = a.pdvVisitados    - b.pdvVisitados;
      else if (sortKey === "ffvv")             c = a.ffvv.localeCompare(b.ffvv);
      return sortDesc ? -c : c;
    });
    return filtrados;
  }, [statsMap, busqueda, filtroFFVV, filtroSupervisor, sortKey, sortDesc]);

  const ffvvOpciones = useMemo(() => {
    const seen = new Set<string>(); const result: { raw: string; norm: string }[] = [];
    for (const v of Object.values(statsMap)) {
      if (v.ffvv && !seen.has(v.ffvv)) { seen.add(v.ffvv); result.push({ raw: v.ffvvRaw, norm: v.ffvv }); }
    }
    return result.sort((a, b) => a.norm.localeCompare(b.norm));
  }, [statsMap]);

  const supervisorOpciones = useMemo(() =>
    Array.from(new Set(Object.values(statsMap).map((v) => v.supervisor).filter(Boolean))).sort()
  , [statsMap]);

  const totales = useMemo(() => {
    const con = listaFiltrada.filter((v) => v.horasTrabajadas > 0);
    return {
      vendedores:      listaFiltrada.length,
      diasConActividad: listaFiltrada.reduce((a, v) => a + v.diasConActividad, 0),
      horasPromedio:   con.length > 0 ? con.reduce((a, v) => a + v.horasTrabajadas, 0) / con.length : 0,
      pdvVisitados:    listaFiltrada.reduce((a, v) => a + v.pdvVisitados,    0),
      pdvPlanificados: listaFiltrada.reduce((a, v) => a + v.pdvPlanificados, 0),
    };
  }, [listaFiltrada]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc); else { setSortKey(key); setSortDesc(true); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
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

  const efTotal = totales.pdvPlanificados > 0 ? Math.round((totales.pdvVisitados / totales.pdvPlanificados) * 100) : null;

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Resumen de Vendedores
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Actividad · Ventas · Tablero de premio variable · período {PERIODO_ACTUAL}
        </p>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Vendedores",     value: totales.vendedores,                        icon: Users,       color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/30"   },
          { label: "Días activos",   value: totales.diasConActividad,                  icon: Calendar,    color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/30"       },
          { label: "Prom. horas",    value: formatHoras(totales.horasPromedio),        icon: Clock,       color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/30"         },
          { label: "PDV visitados",  value: totales.pdvVisitados,                      icon: Store,       color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
          { label: "Eficiencia PDV", value: efTotal !== null ? `${efTotal}%` : "--",   icon: ShoppingBag, color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/30"   },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-3 flex flex-col gap-1`}>
            <kpi.icon className={`${kpi.color} w-4 h-4`} />
            <p className={`text-lg font-bold ${kpi.color} leading-tight`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar vendedor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 w-48" />
        </div>
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filtroFFVV} onChange={(e) => setFiltroFFVV(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none">
          <option value="todos">Todas las FFVV</option>
          {ffvvOpciones.map((f) => <option key={f.norm} value={f.norm}>{f.raw}</option>)}
        </select>
        <select value={filtroSupervisor} onChange={(e) => setFiltroSupervisor(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none">
          <option value="todos">Todos los supervisores</option>
          {supervisorOpciones.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <ArrowUpDown className="w-3.5 h-3.5" />
          {([["horasTrabajadas","Horas"],["pdvVisitados","PDV"],["name","Nombre"],["ffvv","FFVV"]] as [SortKey,string][]).map(([key,label]) => (
            <button key={key} onClick={() => toggleSort(key)}
              className={`px-2 py-0.5 rounded-md border text-xs font-medium transition ${sortKey === key ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"}`}>
              {label}{sortKey === key && (sortDesc ? " ↓" : " ↑")}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de vendedores */}
      <div className="space-y-2">
        {listaFiltrada.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto w-10 h-10 mb-2 opacity-30" />
            <p>Sin vendedores que coincidan</p>
          </div>
        )}
        {listaFiltrada.map((v) => {
          const isExpanded   = expandido === v.username;
          const efPdv        = v.pdvPlanificados > 0 ? Math.round((v.pdvVisitados / v.pdvPlanificados) * 100) : null;
          const tieneTablero = isVafood(v.ffvv) || isEusckorInterior(v.ffvv);

          return (
            <div key={v.username} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <button type="button" onClick={() => setExpandido(isExpanded ? null : v.username)} className="w-full text-left">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {v.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{v.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getFfvvStyle(v.ffvv)}`}>{v.ffvvRaw || "—"}</span>
                      {tieneTablero && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-xs text-gray-400">ID {v.username} · {v.supervisor || "Sin supervisor"}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-sm font-bold text-blue-600">{v.horasTrabajadas > 0 ? formatHoras(v.horasTrabajadas) : "—"}</p>
                      <p className="text-[10px] text-gray-400">{v.ultimaFecha ? formatFecha(v.ultimaFecha) : "Sin registro"}</p>
                    </div>
                    <div className="w-24 hidden lg:block">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>PDV</span><span>{v.pdvVisitados}/{v.pdvPlanificados}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${efPdv === null ? "" : efPdv >= 80 ? "bg-emerald-500" : efPdv >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min(efPdv ?? 0, 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 hidden lg:block text-right">
                      <p className="font-medium text-gray-600 dark:text-gray-300">{v.diasConActividad} días</p>
                      <p>~{formatHoras(v.promHoras)}</p>
                    </div>
                  </div>
                  <div className="text-gray-400 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <DetalleFechas username={v.username} ffvv={v.ffvv} snapshots={snapshots} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-gray-400 pb-4">
        {listaFiltrada.length} vendedores · config desde Supabase · período {PERIODO_ACTUAL}
      </div>
    </div>
  );
};

export default VendedoresResumen;
