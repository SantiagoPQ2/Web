import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import {
  TrendingUp,
  Clock,
  MapPin,
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
  descripcion_vendedor: string;
  cliente: string;
  razon_social: string;
  descripcion_canal_mkt: string;
  codigo_articulo: string;
  descripcion_articulo: string;
  unidad_de_negocio: string;
  categoria: string;
  marca: string;
  bultos_total: number;
  peso_total: number;
  bonificacion_pct: number;
  subtotal_bonificado: number;
  subtotal_final: number;
  id_vendedor: string;
}

interface Snapshot {
  id: number;
  snapshot_date: string;
  dia_codigo: string;
  username: string;
  nombre_mostrar: string;
  ffvv: string;
  role: string;
  pdv_planificados: number;
  pdv_visitados: number;
  pdv_menos_5_min: number;
  horas_trabajadas: number;
  puntos_gps: number;
  primera_marca: string;
  ultima_marca: string;
  fecha: string;
}

// ─── Stats por vendedor (computado) ──────────────────────────────────────────

interface VendedorStats {
  username: string;
  name: string;
  ffvv: string;
  supervisor: string;
  // Ventas
  totalVentas: number;
  cantidadFacturas: number;
  cantidadClientes: number;
  cantidadArticulos: number;
  bultosTotales: number;
  marcasDistintas: number;
  unidadesNegocio: string[];
  ventasPorCategoria: Record<string, number>;
  // Actividad (último snapshot disponible)
  ultimaFecha: string | null;
  horasTrabajadas: number;
  pdvPlanificados: number;
  pdvVisitados: number;
  pdvMenos5Min: number;
  puntoGps: number;
  primeraEntrada: string | null;
  ultimaSalida: string | null;
  // Promedios históricos (todos los snapshots)
  promHoras: number;
  promPdvVisitados: number;
  diasConActividad: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const formatHoras = (h: number) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
};

const formatHora = (iso: string | null) => {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return "--";
  }
};

const formatFecha = (s: string | null) => {
  if (!s) return "--";
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
};

const ffvvColor: Record<string, string> = {
  vafood: "bg-red-100 text-red-700",
  eusckor: "bg-blue-100 text-blue-700",
  interior: "bg-amber-100 text-amber-700",
};

const getFfvvStyle = (ffvv: string) =>
  ffvvColor[ffvv?.toLowerCase()] ?? "bg-gray-100 text-gray-600";

type SortKey = "name" | "totalVentas" | "horasTrabajadas" | "pdvVisitados" | "ffvv";

// ─── Componente principal ─────────────────────────────────────────────────────

const VendedoresResumen: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [ventas, setVentas] = useState<ChessVenta[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroFFVV, setFiltroFFVV] = useState<string>("todos");
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("totalVentas");
  const [sortDesc, setSortDesc] = useState(true);

  // Tarjeta expandida
  const [expandido, setExpandido] = useState<string | null>(null);

  // ── Carga de datos ───────────────────────────────────────────────────────────

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          { data: usuariosData, error: e1 },
          { data: ventasData, error: e2 },
          { data: snapsData, error: e3 },
        ] = await Promise.all([
          supabase
            .from("usuarios_app")
            .select("id, username, name, FFVV, supervisor, role")
            .eq("role", "vendedor"),
          supabase
            .from("chess_ventas")
            .select(
              "id, numero, fecha_comprobante, descripcion_vendedor, cliente, razon_social, descripcion_canal_mkt, codigo_articulo, descripcion_articulo, unidad_de_negocio, categoria, marca, bultos_total, peso_total, bonificacion_pct, subtotal_bonificado, subtotal_final, id_vendedor"
            ),
          supabase
            .from("admin_equipo_snapshots")
            .select("*")
            .eq("role", "vendedor")
            .order("fecha", { ascending: false }),
        ]);

        if (e1) throw new Error(`Error cargando usuarios: ${e1.message}`);
        if (e2) throw new Error(`Error cargando ventas: ${e2.message}`);
        if (e3) throw new Error(`Error cargando snapshots: ${e3.message}`);

        setUsuarios((usuariosData as UsuarioApp[]) || []);
        setVentas((ventasData as ChessVenta[]) || []);
        setSnapshots((snapsData as Snapshot[]) || []);
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  // ── Cómputo de stats por vendedor ────────────────────────────────────────────

  const statsMap = useMemo<Record<string, VendedorStats>>(() => {
    const map: Record<string, VendedorStats> = {};

    // Inicializar con usuarios
    for (const u of usuarios) {
      map[u.username] = {
        username: u.username,
        name: u.name || u.username,
        ffvv: u.FFVV || "",
        supervisor: u.supervisor || "",
        totalVentas: 0,
        cantidadFacturas: 0,
        cantidadClientes: 0,
        cantidadArticulos: 0,
        bultosTotales: 0,
        marcasDistintas: 0,
        unidadesNegocio: [],
        ventasPorCategoria: {},
        ultimaFecha: null,
        horasTrabajadas: 0,
        pdvPlanificados: 0,
        pdvVisitados: 0,
        pdvMenos5Min: 0,
        puntoGps: 0,
        primeraEntrada: null,
        ultimaSalida: null,
        promHoras: 0,
        promPdvVisitados: 0,
        diasConActividad: 0,
      };
    }

    // Agregar ventas
    const facturasPorVendedor: Record<string, Set<string>> = {};
    const clientesPorVendedor: Record<string, Set<string>> = {};
    const marcasPorVendedor: Record<string, Set<string>> = {};
    const unidadesPorVendedor: Record<string, Set<string>> = {};

    for (const v of ventas) {
      const uid = String(v.id_vendedor);
      if (!map[uid]) continue;

      const s = map[uid];
      if (!facturasPorVendedor[uid]) facturasPorVendedor[uid] = new Set();
      if (!clientesPorVendedor[uid]) clientesPorVendedor[uid] = new Set();
      if (!marcasPorVendedor[uid]) marcasPorVendedor[uid] = new Set();
      if (!unidadesPorVendedor[uid]) unidadesPorVendedor[uid] = new Set();

      facturasPorVendedor[uid].add(v.numero);
      clientesPorVendedor[uid].add(v.cliente);
      marcasPorVendedor[uid].add(v.marca);
      unidadesPorVendedor[uid].add(v.unidad_de_negocio);

      s.totalVentas += Number(v.subtotal_final) || 0;
      s.bultosTotales += Number(v.bultos_total) || 0;
      s.cantidadArticulos += 1;

      if (v.categoria) {
        s.ventasPorCategoria[v.categoria] =
          (s.ventasPorCategoria[v.categoria] || 0) + (Number(v.subtotal_final) || 0);
      }
    }

    for (const uid of Object.keys(map)) {
      map[uid].cantidadFacturas = facturasPorVendedor[uid]?.size ?? 0;
      map[uid].cantidadClientes = clientesPorVendedor[uid]?.size ?? 0;
      map[uid].marcasDistintas = marcasPorVendedor[uid]?.size ?? 0;
      map[uid].unidadesNegocio = Array.from(unidadesPorVendedor[uid] ?? []);
    }

    // Agregar snapshots
    // El snapshot más reciente de cada vendedor para datos del día
    const snapsXVendedor: Record<string, Snapshot[]> = {};
    for (const snap of snapshots) {
      const uid = String(snap.username);
      if (!snapsXVendedor[uid]) snapsXVendedor[uid] = [];
      snapsXVendedor[uid].push(snap);
    }

    for (const [uid, snaps] of Object.entries(snapsXVendedor)) {
      if (!map[uid]) continue;
      const sorted = [...snaps].sort((a, b) =>
        b.fecha.localeCompare(a.fecha)
      );
      const ultimo = sorted[0];
      const s = map[uid];

      s.ultimaFecha = ultimo.fecha;
      s.horasTrabajadas = Number(ultimo.horas_trabajadas) || 0;
      s.pdvPlanificados = Number(ultimo.pdv_planificados) || 0;
      s.pdvVisitados = Number(ultimo.pdv_visitados) || 0;
      s.pdvMenos5Min = Number(ultimo.pdv_menos_5_min) || 0;
      s.puntoGps = Number(ultimo.puntos_gps) || 0;
      s.primeraEntrada = ultimo.primera_marca || null;
      s.ultimaSalida = ultimo.ultima_marca || null;

      // Promedios históricos (días con actividad)
      const activos = snaps.filter((snap) => Number(snap.horas_trabajadas) > 0);
      s.diasConActividad = activos.length;
      s.promHoras =
        activos.length > 0
          ? activos.reduce((acc, snap) => acc + Number(snap.horas_trabajadas), 0) /
            activos.length
          : 0;
      s.promPdvVisitados =
        activos.length > 0
          ? activos.reduce((acc, snap) => acc + Number(snap.pdv_visitados), 0) /
            activos.length
          : 0;
    }

    return map;
  }, [usuarios, ventas, snapshots]);

  // ── Lista filtrada y ordenada ────────────────────────────────────────────────

  const listaFiltrada = useMemo(() => {
    const todos = Object.values(statsMap);

    const filtrados = todos.filter((v) => {
      const matchBusqueda =
        busqueda === "" ||
        v.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        v.username.toLowerCase().includes(busqueda.toLowerCase()) ||
        v.supervisor.toLowerCase().includes(busqueda.toLowerCase());

      const matchFFVV =
        filtroFFVV === "todos" ||
        v.ffvv.toLowerCase() === filtroFFVV.toLowerCase();

      const matchSupervisor =
        filtroSupervisor === "todos" || v.supervisor === filtroSupervisor;

      return matchBusqueda && matchFFVV && matchSupervisor;
    });

    filtrados.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "totalVentas") cmp = a.totalVentas - b.totalVentas;
      else if (sortKey === "horasTrabajadas")
        cmp = a.horasTrabajadas - b.horasTrabajadas;
      else if (sortKey === "pdvVisitados")
        cmp = a.pdvVisitados - b.pdvVisitados;
      else if (sortKey === "ffvv") cmp = a.ffvv.localeCompare(b.ffvv);
      return sortDesc ? -cmp : cmp;
    });

    return filtrados;
  }, [statsMap, busqueda, filtroFFVV, filtroSupervisor, sortKey, sortDesc]);

  // ── Listas para filtros ──────────────────────────────────────────────────────

  const ffvvOpciones = useMemo(() => {
    const set = new Set(Object.values(statsMap).map((v) => v.ffvv).filter(Boolean));
    return Array.from(set).sort();
  }, [statsMap]);

  const supervisorOpciones = useMemo(() => {
    const set = new Set(
      Object.values(statsMap).map((v) => v.supervisor).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [statsMap]);

  // ── Totales globales ─────────────────────────────────────────────────────────

  const totales = useMemo(() => {
    const lista = listaFiltrada;
    return {
      vendedores: lista.length,
      ventas: lista.reduce((a, v) => a + v.totalVentas, 0),
      facturas: lista.reduce((a, v) => a + v.cantidadFacturas, 0),
      clientes: lista.reduce((a, v) => a + v.cantidadClientes, 0),
      bultos: lista.reduce((a, v) => a + v.bultosTotales, 0),
      horasPromedio:
        lista.filter((v) => v.horasTrabajadas > 0).length > 0
          ? lista
              .filter((v) => v.horasTrabajadas > 0)
              .reduce((a, v) => a + v.horasTrabajadas, 0) /
            lista.filter((v) => v.horasTrabajadas > 0).length
          : 0,
    };
  }, [listaFiltrada]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // ── Renderizado ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Cargando datos...</p>
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

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Resumen de Vendedores
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Ventas y actividad del equipo en calle
        </p>
      </div>

      {/* ── KPIs globales ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Vendedores", value: totales.vendedores, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
          { label: "Total Ventas", value: formatMoney(totales.ventas), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
          { label: "Facturas", value: totales.facturas, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
          { label: "Clientes", value: totales.clientes, icon: Store, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/30" },
          { label: "Bultos", value: totales.bultos.toLocaleString("es-AR"), icon: Package, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
          { label: "Prom. Horas", value: formatHoras(totales.horasPromedio), icon: Clock, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`${kpi.bg} rounded-xl p-3 flex flex-col gap-1 border border-transparent`}
          >
            <kpi.icon className={`${kpi.color} w-4 h-4`} />
            <p className={`text-lg font-bold ${kpi.color} leading-tight`}>
              {kpi.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar vendedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 w-48"
          />
        </div>

        <div className="flex items-center gap-1 text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtroFFVV}
            onChange={(e) => setFiltroFFVV(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none"
          >
            <option value="todos">Todas las FFVV</option>
            {ffvvOpciones.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 text-sm">
          <select
            value={filtroSupervisor}
            onChange={(e) => setFiltroSupervisor(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm focus:outline-none"
          >
            <option value="todos">Todos los supervisores</option>
            {supervisorOpciones.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Ordenar por:</span>
          {(
            [
              ["totalVentas", "Ventas"],
              ["horasTrabajadas", "Horas"],
              ["pdvVisitados", "PDV"],
              ["name", "Nombre"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`px-2 py-0.5 rounded-md border text-xs font-medium transition ${
                sortKey === key
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400"
              }`}
            >
              {label}
              {sortKey === key && (sortDesc ? " ↓" : " ↑")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabla / Lista de vendedores ──────────────────────────────────────── */}
      <div className="space-y-2">
        {listaFiltrada.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto w-10 h-10 mb-2 opacity-30" />
            <p>Sin vendedores que coincidan con los filtros</p>
          </div>
        )}

        {listaFiltrada.map((v) => {
          const isExpanded = expandido === v.username;
          const eficienciaPdv =
            v.pdvPlanificados > 0
              ? Math.round((v.pdvVisitados / v.pdvPlanificados) * 100)
              : null;

          // Top 3 categorías por monto
          const topCats = Object.entries(v.ventasPorCategoria)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

          return (
            <div
              key={v.username}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* ── Fila principal ───────────────────────────────────────── */}
              <button
                type="button"
                onClick={() => setExpandido(isExpanded ? null : v.username)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {v.name?.[0]?.toUpperCase()}
                  </div>

                  {/* Nombre + FFVV */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {v.name}
                      </p>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getFfvvStyle(v.ffvv)}`}
                      >
                        {v.ffvv || "—"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      ID {v.username} · {v.supervisor || "Sin supervisor"}
                    </p>
                  </div>

                  {/* Stats rápidas */}
                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-sm font-bold text-emerald-600">
                        {v.totalVentas > 0 ? formatMoney(v.totalVentas) : "—"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {v.cantidadFacturas} fact · {v.cantidadClientes} cl
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        {v.horasTrabajadas > 0
                          ? formatHoras(v.horasTrabajadas)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {v.ultimaFecha
                          ? formatFecha(v.ultimaFecha)
                          : "Sin registro"}
                      </p>
                    </div>

                    {/* Barra de eficiencia PDV */}
                    <div className="w-24 hidden lg:block">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>PDV</span>
                        <span>
                          {v.pdvVisitados}/{v.pdvPlanificados}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            eficienciaPdv === null
                              ? "w-0"
                              : eficienciaPdv >= 80
                              ? "bg-emerald-500"
                              : eficienciaPdv >= 50
                              ? "bg-amber-400"
                              : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min(eficienciaPdv ?? 0, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="text-gray-400 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* ── Panel expandido ─────────────────────────────────────── */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Ventas detalle */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Ventas
                      </p>
                      {v.totalVentas === 0 ? (
                        <p className="text-sm text-gray-400">Sin ventas registradas</p>
                      ) : (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Total facturado</span>
                            <span className="font-bold text-emerald-600">
                              {formatMoney(v.totalVentas)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Facturas</span>
                            <span className="font-medium">{v.cantidadFacturas}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Clientes facturados</span>
                            <span className="font-medium">{v.cantidadClientes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bultos totales</span>
                            <span className="font-medium">
                              {v.bultosTotales.toLocaleString("es-AR")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Marcas distintas</span>
                            <span className="font-medium">{v.marcasDistintas}</span>
                          </div>
                          {topCats.length > 0 && (
                            <div className="pt-1">
                              <p className="text-xs text-gray-400 mb-1">Top categorías</p>
                              {topCats.map(([cat, monto]) => (
                                <div key={cat} className="flex justify-between text-xs">
                                  <span className="text-gray-500 truncate max-w-[140px]">
                                    {cat}
                                  </span>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {formatMoney(monto)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actividad del día */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Último día registrado
                        {v.ultimaFecha && (
                          <span className="ml-1 text-gray-400 font-normal normal-case">
                            ({formatFecha(v.ultimaFecha)})
                          </span>
                        )}
                      </p>
                      {!v.ultimaFecha ? (
                        <p className="text-sm text-gray-400">Sin datos de actividad</p>
                      ) : (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Horas trabajadas</span>
                            <span className="font-bold text-blue-600">
                              {formatHoras(v.horasTrabajadas)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Primera entrada</span>
                            <span className="font-medium">
                              {formatHora(v.primeraEntrada)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Última marca</span>
                            <span className="font-medium">
                              {formatHora(v.ultimaSalida)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">PDV planificados</span>
                            <span className="font-medium">{v.pdvPlanificados}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">PDV visitados</span>
                            <span
                              className={`font-bold ${
                                eficienciaPdv !== null && eficienciaPdv >= 80
                                  ? "text-emerald-600"
                                  : eficienciaPdv !== null && eficienciaPdv >= 50
                                  ? "text-amber-500"
                                  : "text-red-500"
                              }`}
                            >
                              {v.pdvVisitados}
                              {eficienciaPdv !== null && (
                                <span className="ml-1 text-xs font-normal text-gray-400">
                                  ({eficienciaPdv}%)
                                </span>
                              )}
                            </span>
                          </div>
                          {v.pdvMenos5Min > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">PDV {"<"} 5 min</span>
                              <span className="font-medium text-amber-500">
                                {v.pdvMenos5Min}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Puntos GPS</span>
                            <span className="font-medium">{v.puntoGps}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Promedios históricos */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Histórico
                      </p>
                      {v.diasConActividad === 0 ? (
                        <p className="text-sm text-gray-400">Sin historial</p>
                      ) : (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Días con actividad</span>
                            <span className="font-bold">{v.diasConActividad}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Prom. horas/día</span>
                            <span className="font-medium text-blue-600">
                              {formatHoras(v.promHoras)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Prom. PDV visitados</span>
                            <span className="font-medium">
                              {v.promPdvVisitados.toFixed(1)}
                            </span>
                          </div>
                          {/* Mini barra eficiencia PDV actual */}
                          {eficienciaPdv !== null && (
                            <div className="pt-2">
                              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                                <span>Eficiencia PDV (último día)</span>
                                <span
                                  className={
                                    eficienciaPdv >= 80
                                      ? "text-emerald-600 font-semibold"
                                      : eficienciaPdv >= 50
                                      ? "text-amber-500 font-semibold"
                                      : "text-red-500 font-semibold"
                                  }
                                >
                                  {eficienciaPdv}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    eficienciaPdv >= 80
                                      ? "bg-emerald-500"
                                      : eficienciaPdv >= 50
                                      ? "bg-amber-400"
                                      : "bg-red-400"
                                  }`}
                                  style={{
                                    width: `${Math.min(eficienciaPdv, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Unidades de negocio */}
                          {v.unidadesNegocio.length > 0 && (
                            <div className="pt-1">
                              <p className="text-xs text-gray-400 mb-1">
                                Unidades de negocio
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {v.unidadesNegocio.map((u) => (
                                  <span
                                    key={u}
                                    className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded"
                                  >
                                    {u}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer info ──────────────────────────────────────────────────────── */}
      <div className="text-center text-xs text-gray-400 pb-4">
        {listaFiltrada.length} vendedores · Datos de Supabase en tiempo real
      </div>
    </div>
  );
};

export default VendedoresResumen;
