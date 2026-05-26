import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../config/supabase";
import {
  TrendingUp,
  Clock,
  ShoppingBag,
  Users,
  ChevronDown,
  ChevronUp,
  Package,
  Store,
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioApp {
  id: string;
  username: string;
  name: string;
  FFVV: string;
  supervisor: string;
  role: string;
}

interface ChessVenta {
  id: number;
  numero: string;
  fecha_comprobante: string;
  cliente: string;
  categoria: string;
  marca: string;
  bultos_total: number;
  subtotal_final: number;
  id_vendedor: number | string;
}

interface Snapshot {
  id: number;
  username: string;
  pdv_planificados: number;
  pdv_visitados: number;
  pdv_menos_5_min: number;
  horas_trabajadas: number;
  puntos_gps: number;
  primera_marca: string;
  ultima_marca: string;
  created_at: string;
  fecha: string;
}

interface VendedorStats {
  username: string;
  name: string;
  ffvv: string;
  supervisor: string;
  // del snapshot más reciente (para la fila resumen)
  ultimaFecha: string | null;
  horasTrabajadas: number;
  pdvPlanificados: number;
  pdvVisitados: number;
  promHoras: number;
  promPdvVisitados: number;
  diasConActividad: number;
}

interface ResumenFecha {
  fecha: string;
  // ventas
  totalVentas: number;
  cantidadFacturas: number;
  cantidadClientes: number;
  bultos: number;
  marcas: string[];
  categorias: Record<string, number>;
  // actividad
  horasTrabajadas: number | null;
  pdvPlanificados: number | null;
  pdvVisitados: number | null;
  pdvMenos5Min: number | null;
  puntoGps: number | null;
  primeraEntrada: string | null;
  ultimaSalida: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const formatHoras = (h: number) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
};

const formatHora = (iso: string | null) => {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch { return "--"; }
};

const formatFecha = (s: string | null) => {
  if (!s) return "--";
  try { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; }
  catch { return s; }
};

const diaSemana = (s: string) => {
  try {
    const [y, m, d] = s.split("-").map(Number);
    return ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(y, m - 1, d).getDay()];
  } catch { return ""; }
};

const getFfvvStyle = (ffvv: string) => {
  const map: Record<string, string> = {
    vafood: "bg-red-100 text-red-700",
    eusckor: "bg-blue-100 text-blue-700",
    interior: "bg-amber-100 text-amber-700",
  };
  return map[ffvv?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
};

type SortKey = "name" | "horasTrabajadas" | "pdvVisitados" | "ffvv";

// ─── Función: construir resumen por fecha ─────────────────────────────────────
// Recibe ventas ya filtradas (solo del vendedor) y todos los snapshots

function buildResumenFechas(
  ventas: ChessVenta[],
  snapshots: Snapshot[],
  username: string
): ResumenFecha[] {
  const map: Record<string, ResumenFecha> = {};

  const asegurar = (fecha: string) => {
    if (!map[fecha]) map[fecha] = {
      fecha,
      totalVentas: 0, cantidadFacturas: 0, cantidadClientes: 0,
      bultos: 0, marcas: [], categorias: {},
      horasTrabajadas: null, pdvPlanificados: null, pdvVisitados: null,
      pdvMenos5Min: null, puntoGps: null, primeraEntrada: null, ultimaSalida: null,
    };
  };

  const facturas: Record<string, Set<string>> = {};
  const clientes: Record<string, Set<string>> = {};
  const marcas: Record<string, Set<string>> = {};

  for (const v of ventas) {
    const fecha = v.fecha_comprobante?.slice(0, 10);
    if (!fecha) continue;
    asegurar(fecha);

    if (!facturas[fecha]) { facturas[fecha] = new Set(); clientes[fecha] = new Set(); marcas[fecha] = new Set(); }
    facturas[fecha].add(v.numero);
    clientes[fecha].add(String(v.cliente));
    marcas[fecha].add(v.marca);

    map[fecha].totalVentas += Number(v.subtotal_final) || 0;
    map[fecha].bultos += Number(v.bultos_total) || 0;
    if (v.categoria) {
      map[fecha].categorias[v.categoria] = (map[fecha].categorias[v.categoria] || 0) + (Number(v.subtotal_final) || 0);
    }
  }

  for (const fecha of Object.keys(facturas)) {
    map[fecha].cantidadFacturas = facturas[fecha].size;
    map[fecha].cantidadClientes = clientes[fecha].size;
    map[fecha].marcas = Array.from(marcas[fecha]);
  }

  // Snapshots filtrados por username, ordenados desc por created_at (ya vienen así)
  const snapsVendedor = snapshots.filter((s) => String(s.username) === String(username));
  const fechasVistas = new Set<string>();

  for (const snap of snapsVendedor) {
    const fecha = new Date(snap.created_at)
      .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    if (fechasVistas.has(fecha)) continue; // solo el más reciente del día
    fechasVistas.add(fecha);
    asegurar(fecha);
    map[fecha].horasTrabajadas = Number(snap.horas_trabajadas) || 0;
    map[fecha].pdvPlanificados = Number(snap.pdv_planificados) || 0;
    map[fecha].pdvVisitados = Number(snap.pdv_visitados) || 0;
    map[fecha].pdvMenos5Min = Number(snap.pdv_menos_5_min) || 0;
    map[fecha].puntoGps = Number(snap.puntos_gps) || 0;
    map[fecha].primeraEntrada = snap.primera_marca || null;
    map[fecha].ultimaSalida = snap.ultima_marca || null;
  }

  return Object.values(map).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ─── Componente: detalle por fecha (lazy) ────────────────────────────────────

const DetalleFechas: React.FC<{
  username: string;
  snapshots: Snapshot[];
}> = ({ username, snapshots }) => {
  const [ventas, setVentas] = useState<ChessVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(0);
  const POR_PAGINA = 5;

  // Carga lazy: solo cuando se monta (= cuando el vendedor se expande)
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        // Paginación manual para saltear el límite de 1000 de Supabase
        let todas: ChessVenta[] = [];
        let desde = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error: e } = await supabase
            .from("chess_ventas")
            .select("id, numero, fecha_comprobante, cliente, categoria, marca, bultos_total, subtotal_final, id_vendedor")
            .eq("id_vendedor", username)
            .order("fecha_comprobante", { ascending: false })
            .range(desde, desde + CHUNK - 1);

          if (e) throw new Error(e.message);
          if (!data || data.length === 0) break;
          todas = todas.concat(data as ChessVenta[]);
          if (data.length < CHUNK) break;
          desde += CHUNK;
        }
        if (!cancelado) setVentas(todas);
      } catch (err: any) {
        if (!cancelado) setError(err.message || "Error cargando ventas");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => { cancelado = true; };
  }, [username]);

  const fechas = useMemo(
    () => buildResumenFechas(ventas, snapshots, username),
    [ventas, snapshots, username]
  );

  const totalPaginas = Math.ceil(fechas.length / POR_PAGINA);
  const paginadas = fechas.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando ventas...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-2">Error: {error}</p>;
  }

  if (fechas.length === 0) {
    return <p className="text-sm text-gray-400 py-2">Sin registros de ventas ni actividad</p>;
  }

  return (
    <div className="space-y-2">
      {paginadas.map((dia) => {
        const efPdv =
          dia.pdvPlanificados !== null && dia.pdvPlanificados > 0
            ? Math.round(((dia.pdvVisitados ?? 0) / dia.pdvPlanificados) * 100)
            : null;

        const topCats = Object.entries(dia.categorias).sort(([, a], [, b]) => b - a).slice(0, 3);
        const tieneVentas = dia.totalVentas > 0;
        const tieneActividad = dia.horasTrabajadas !== null;

        return (
          <div key={dia.fecha} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Header de la fecha */}
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800">
              <div className="text-center shrink-0 w-10">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{diaSemana(dia.fecha)}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {dia.fecha.slice(8)}/{dia.fecha.slice(5, 7)}
                </p>
              </div>

              <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                {tieneVentas ? (
                  <>
                    <span className="text-emerald-600 font-bold">{formatMoney(dia.totalVentas)}</span>
                    <span className="text-gray-500">{dia.cantidadFacturas} fact · {dia.cantidadClientes} cl</span>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Sin ventas</span>
                )}

                {tieneActividad && (
                  <>
                    <span className="text-blue-600 font-medium">{formatHoras(dia.horasTrabajadas!)}</span>
                    {dia.pdvVisitados !== null && (
                      <span className={`font-medium ${efPdv !== null && efPdv >= 80 ? "text-emerald-600" : efPdv !== null && efPdv >= 50 ? "text-amber-500" : "text-red-500"}`}>
                        {dia.pdvVisitados}/{dia.pdvPlanificados} PDV
                        {efPdv !== null && <span className="text-gray-400 font-normal ml-0.5">({efPdv}%)</span>}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Detalle del día */}
            <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {tieneVentas && (
                <div className="space-y-1">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Ventas
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-gray-400">Facturas</span>   <span className="font-medium text-right">{dia.cantidadFacturas}</span>
                    <span className="text-gray-400">Clientes</span>   <span className="font-medium text-right">{dia.cantidadClientes}</span>
                    <span className="text-gray-400">Bultos</span>     <span className="font-medium text-right">{dia.bultos}</span>
                    <span className="text-gray-400">Marcas</span>     <span className="font-medium text-right">{dia.marcas.length}</span>
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
              )}

              {tieneActividad && (
                <div className="space-y-1">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Actividad
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-gray-400">Entrada</span>    <span className="font-medium text-right">{formatHora(dia.primeraEntrada)}</span>
                    <span className="text-gray-400">Salida</span>     <span className="font-medium text-right">{formatHora(dia.ultimaSalida)}</span>
                    <span className="text-gray-400">Horas</span>      <span className="font-medium text-right text-blue-600">{formatHoras(dia.horasTrabajadas!)}</span>
                    <span className="text-gray-400">PDV plan.</span>  <span className="font-medium text-right">{dia.pdvPlanificados}</span>
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

// ─── Componente principal ─────────────────────────────────────────────────────

const VendedoresResumen: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroFFVV, setFiltroFFVV] = useState<string>("todos");
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("horasTrabajadas");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  // ── Carga inicial: solo usuarios y snapshots ──────────────────────────────────
  // Las ventas se cargan on-demand en DetalleFechas al expandir cada vendedor

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          { data: usuariosData, error: e1 },
          { data: snapsData, error: e3 },
        ] = await Promise.all([
          supabase
            .from("usuarios_app")
            .select("id, username, name, FFVV, supervisor, role")
            .eq("role", "vendedor"),
          supabase
            .from("admin_equipo_snapshots")
            .select("id, username, pdv_planificados, pdv_visitados, pdv_menos_5_min, horas_trabajadas, puntos_gps, primera_marca, ultima_marca, created_at, fecha")
            .eq("role", "vendedor")
            .order("created_at", { ascending: false }),
        ]);

        if (e1) throw new Error(`Usuarios: ${e1.message}`);
        if (e3) throw new Error(`Snapshots: ${e3.message}`);

        setUsuarios((usuariosData as UsuarioApp[]) || []);
        setSnapshots((snapsData as Snapshot[]) || []);
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  // ── Stats globales: solo desde snapshots (sin ventas) ─────────────────────────

  const statsMap = useMemo<Record<string, VendedorStats>>(() => {
    const map: Record<string, VendedorStats> = {};

    for (const u of usuarios) {
      map[u.username] = {
        username: u.username,
        name: u.name || u.username,
        ffvv: u.FFVV || "",
        supervisor: u.supervisor || "",
        ultimaFecha: null,
        horasTrabajadas: 0,
        pdvPlanificados: 0,
        pdvVisitados: 0,
        promHoras: 0,
        promPdvVisitados: 0,
        diasConActividad: 0,
      };
    }

    const snapsXVendedor: Record<string, Snapshot[]> = {};
    for (const snap of snapshots) {
      const uid = String(snap.username);
      if (!snapsXVendedor[uid]) snapsXVendedor[uid] = [];
      snapsXVendedor[uid].push(snap);
    }

    for (const [uid, snaps] of Object.entries(snapsXVendedor)) {
      if (!map[uid]) continue;
      const s = map[uid];
      const ultimo = snaps[0]; // ya vienen desc por created_at
      s.ultimaFecha = ultimo.fecha;
      s.horasTrabajadas = Number(ultimo.horas_trabajadas) || 0;
      s.pdvPlanificados = Number(ultimo.pdv_planificados) || 0;
      s.pdvVisitados = Number(ultimo.pdv_visitados) || 0;
      const activos = snaps.filter((sn) => Number(sn.horas_trabajadas) > 0);
      s.diasConActividad = activos.length;
      s.promHoras = activos.length > 0 ? activos.reduce((a, sn) => a + Number(sn.horas_trabajadas), 0) / activos.length : 0;
      s.promPdvVisitados = activos.length > 0 ? activos.reduce((a, sn) => a + Number(sn.pdv_visitados), 0) / activos.length : 0;
    }

    return map;
  }, [usuarios, snapshots]);

  // ── Filtros + orden ───────────────────────────────────────────────────────────

  const listaFiltrada = useMemo(() => {
    const todos = Object.values(statsMap);
    const filtrados = todos.filter((v) => {
      const mb = busqueda === "" || v.name.toLowerCase().includes(busqueda.toLowerCase()) || v.username.includes(busqueda);
      const mf = filtroFFVV === "todos" || v.ffvv.toLowerCase() === filtroFFVV.toLowerCase();
      const ms = filtroSupervisor === "todos" || v.supervisor === filtroSupervisor;
      return mb && mf && ms;
    });
    filtrados.sort((a, b) => {
      let c = 0;
      if (sortKey === "name") c = a.name.localeCompare(b.name);
      else if (sortKey === "horasTrabajadas") c = a.horasTrabajadas - b.horasTrabajadas;
      else if (sortKey === "pdvVisitados") c = a.pdvVisitados - b.pdvVisitados;
      else if (sortKey === "ffvv") c = a.ffvv.localeCompare(b.ffvv);
      return sortDesc ? -c : c;
    });
    return filtrados;
  }, [statsMap, busqueda, filtroFFVV, filtroSupervisor, sortKey, sortDesc]);

  const ffvvOpciones = useMemo(() => Array.from(new Set(Object.values(statsMap).map((v) => v.ffvv).filter(Boolean))).sort(), [statsMap]);
  const supervisorOpciones = useMemo(() => Array.from(new Set(Object.values(statsMap).map((v) => v.supervisor).filter(Boolean))).sort(), [statsMap]);

  const totales = useMemo(() => {
    const con = listaFiltrada.filter((v) => v.horasTrabajadas > 0);
    return {
      vendedores: listaFiltrada.length,
      diasConActividad: listaFiltrada.reduce((a, v) => a + v.diasConActividad, 0),
      horasPromedio: con.length > 0 ? con.reduce((a, v) => a + v.horasTrabajadas, 0) / con.length : 0,
      pdvVisitados: listaFiltrada.reduce((a, v) => a + v.pdvVisitados, 0),
      pdvPlanificados: listaFiltrada.reduce((a, v) => a + v.pdvPlanificados, 0),
    };
  }, [listaFiltrada]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Cargando equipo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <p className="font-semibold">Error al cargar datos</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const efTotal = totales.pdvPlanificados > 0
    ? Math.round((totales.pdvVisitados / totales.pdvPlanificados) * 100) : null;

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resumen de Vendedores</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Actividad del equipo · al expandir se cargan las ventas por fecha
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Vendedores",      value: totales.vendedores,                       icon: Users,      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/30" },
          { label: "Días activos",    value: totales.diasConActividad,                 icon: Calendar,   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/30" },
          { label: "Prom. horas",     value: formatHoras(totales.horasPromedio),       icon: Clock,      color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/30" },
          { label: "PDV visitados",   value: totales.pdvVisitados,                     icon: Store,      color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
          { label: "Eficiencia PDV",  value: efTotal !== null ? `${efTotal}%` : "--",  icon: ShoppingBag,color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/30" },
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
          {ffvvOpciones.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtroSupervisor} onChange={(e) => setFiltroSupervisor(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none">
          <option value="todos">Todos los supervisores</option>
          {supervisorOpciones.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <ArrowUpDown className="w-3.5 h-3.5" />
          {([["horasTrabajadas","Horas"], ["pdvVisitados","PDV"], ["name","Nombre"], ["ffvv","FFVV"]] as [SortKey,string][]).map(([key, label]) => (
            <button key={key} onClick={() => toggleSort(key)}
              className={`px-2 py-0.5 rounded-md border text-xs font-medium transition ${sortKey === key ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"}`}>
              {label}{sortKey === key && (sortDesc ? " ↓" : " ↑")}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {listaFiltrada.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto w-10 h-10 mb-2 opacity-30" />
            <p>Sin vendedores que coincidan</p>
          </div>
        )}

        {listaFiltrada.map((v) => {
          const isExpanded = expandido === v.username;
          const efPdv = v.pdvPlanificados > 0 ? Math.round((v.pdvVisitados / v.pdvPlanificados) * 100) : null;

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
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getFfvvStyle(v.ffvv)}`}>{v.ffvv || "—"}</span>
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
                        <span>PDV</span>
                        <span>{v.pdvVisitados}/{v.pdvPlanificados}</span>
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
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-3">
                    <Calendar className="w-3.5 h-3.5" /> Detalle por fecha
                  </p>
                  <DetalleFechas username={v.username} snapshots={snapshots} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-gray-400 pb-4">
        {listaFiltrada.length} vendedores · ventas cargadas al expandir · sin límite de filas
      </div>
    </div>
  );
};

export default VendedoresResumen;
