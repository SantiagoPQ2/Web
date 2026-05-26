import React, { useEffect, useState, useMemo } from "react";
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
  MapPin,
  ChevronLeft,
  ChevronRight,
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
  razon_social: string;
  codigo_articulo: string;
  descripcion_articulo: string;
  unidad_de_negocio: string;
  categoria: string;
  marca: string;
  bultos_total: number;
  subtotal_final: number;
  id_vendedor: string;
}

interface Snapshot {
  id: number;
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
  created_at: string;
  fecha: string;
}

// ─── Stats globales por vendedor ──────────────────────────────────────────────

interface VendedorStats {
  username: string;
  name: string;
  ffvv: string;
  supervisor: string;
  totalVentas: number;
  cantidadFacturas: number;
  cantidadClientes: number;
  bultosTotales: number;
  marcasDistintas: number;
  // Último snapshot
  ultimaFecha: string | null;
  horasTrabajadas: number;
  pdvPlanificados: number;
  pdvVisitados: number;
  promHoras: number;
  promPdvVisitados: number;
  diasConActividad: number;
}

// ─── Resumen por fecha (para el detalle expandido) ───────────────────────────

interface ResumenFecha {
  fecha: string; // YYYY-MM-DD
  // Ventas
  totalVentas: number;
  cantidadFacturas: number;
  cantidadClientes: number;
  bultos: number;
  marcas: string[];
  categorias: Record<string, number>;
  // Actividad
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

const diaSemana = (s: string) => {
  try {
    const [y, m, d] = s.split("-").map(Number);
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return dias[new Date(y, m - 1, d).getDay()];
  } catch {
    return "";
  }
};

const getFfvvStyle = (ffvv: string) => {
  const map: Record<string, string> = {
    vafood: "bg-red-100 text-red-700",
    eusckor: "bg-blue-100 text-blue-700",
    interior: "bg-amber-100 text-amber-700",
  };
  return map[ffvv?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
};

type SortKey = "name" | "totalVentas" | "horasTrabajadas" | "pdvVisitados" | "ffvv";

// ─── Componente: detalle por fecha ────────────────────────────────────────────

const DetalleFechas: React.FC<{
  username: string;
  ventas: ChessVenta[];
  snapshots: Snapshot[];
}> = ({ username, ventas, snapshots }) => {
  const [paginaActual, setPaginaActual] = useState(0);
  const POR_PAGINA = 5;

  // Construir mapa de fechas unificado
  const fechas = useMemo<ResumenFecha[]>(() => {
    const map: Record<string, ResumenFecha> = {};

    const asegurar = (fecha: string) => {
      if (!map[fecha]) {
        map[fecha] = {
          fecha,
          totalVentas: 0,
          cantidadFacturas: 0,
          cantidadClientes: 0,
          bultos: 0,
          marcas: [],
          categorias: {},
          horasTrabajadas: null,
          pdvPlanificados: null,
          pdvVisitados: null,
          pdvMenos5Min: null,
          puntoGps: null,
          primeraEntrada: null,
          ultimaSalida: null,
        };
      }
    };

    // Ventas: agrupar por fecha_comprobante
    const facturasPorFecha: Record<string, Set<string>> = {};
    const clientesPorFecha: Record<string, Set<string>> = {};
    const marcasPorFecha: Record<string, Set<string>> = {};

    for (const v of ventas) {
      if (String(v.id_vendedor) !== username) continue;
      const fecha = v.fecha_comprobante?.slice(0, 10);
      if (!fecha) continue;
      asegurar(fecha);

      if (!facturasPorFecha[fecha]) facturasPorFecha[fecha] = new Set();
      if (!clientesPorFecha[fecha]) clientesPorFecha[fecha] = new Set();
      if (!marcasPorFecha[fecha]) marcasPorFecha[fecha] = new Set();

      facturasPorFecha[fecha].add(v.numero);
      clientesPorFecha[fecha].add(v.cliente);
      marcasPorFecha[fecha].add(v.marca);

      map[fecha].totalVentas += Number(v.subtotal_final) || 0;
      map[fecha].bultos += Number(v.bultos_total) || 0;

      if (v.categoria) {
        map[fecha].categorias[v.categoria] =
          (map[fecha].categorias[v.categoria] || 0) + (Number(v.subtotal_final) || 0);
      }
    }

    for (const fecha of Object.keys(facturasPorFecha)) {
      map[fecha].cantidadFacturas = facturasPorFecha[fecha].size;
      map[fecha].cantidadClientes = clientesPorFecha[fecha].size;
      map[fecha].marcas = Array.from(marcasPorFecha[fecha]);
    }

    // Snapshots: usar created_at para extraer la fecha
    for (const snap of snapshots) {
      if (String(snap.username) !== username) continue;
      // Extraer fecha local Argentina del created_at
      const fecha = new Date(snap.created_at)
        .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      asegurar(fecha);

      // Si hay múltiples snapshots el mismo día tomamos el más reciente
      // (ya vienen ordenados desc por created_at desde la query principal)
      if (map[fecha].horasTrabajadas === null) {
        map[fecha].horasTrabajadas = Number(snap.horas_trabajadas) || 0;
        map[fecha].pdvPlanificados = Number(snap.pdv_planificados) || 0;
        map[fecha].pdvVisitados = Number(snap.pdv_visitados) || 0;
        map[fecha].pdvMenos5Min = Number(snap.pdv_menos_5_min) || 0;
        map[fecha].puntoGps = Number(snap.puntos_gps) || 0;
        map[fecha].primeraEntrada = snap.primera_marca || null;
        map[fecha].ultimaSalida = snap.ultima_marca || null;
      }
    }

    return Object.values(map).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [username, ventas, snapshots]);

  const totalPaginas = Math.ceil(fechas.length / POR_PAGINA);
  const paginadas = fechas.slice(
    paginaActual * POR_PAGINA,
    (paginaActual + 1) * POR_PAGINA
  );

  if (fechas.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">Sin registros de ventas ni actividad</p>
    );
  }

  return (
    <div className="space-y-2">
      {paginadas.map((dia) => {
        const efPdv =
          dia.pdvPlanificados !== null && dia.pdvPlanificados > 0
            ? Math.round(((dia.pdvVisitados ?? 0) / dia.pdvPlanificados) * 100)
            : null;

        const topCats = Object.entries(dia.categorias)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        const tieneVentas = dia.totalVentas > 0;
        const tieneActividad = dia.horasTrabajadas !== null;

        return (
          <div
            key={dia.fecha}
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header de la fecha */}
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800">
              <div className="text-center shrink-0 w-10">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                  {diaSemana(dia.fecha)}
                </p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {dia.fecha.slice(8)}/{dia.fecha.slice(5, 7)}
                </p>
              </div>

              <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                {tieneVentas ? (
                  <>
                    <span className="text-emerald-600 font-bold">
                      {formatMoney(dia.totalVentas)}
                    </span>
                    <span className="text-gray-500">
                      {dia.cantidadFacturas} fact · {dia.cantidadClientes} cl
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Sin ventas</span>
                )}

                {tieneActividad && (
                  <>
                    <span className="text-blue-600 font-medium">
                      {formatHoras(dia.horasTrabajadas!)}
                    </span>
                    {dia.pdvVisitados !== null && (
                      <span
                        className={`font-medium ${
                          efPdv !== null && efPdv >= 80
                            ? "text-emerald-600"
                            : efPdv !== null && efPdv >= 50
                            ? "text-amber-500"
                            : "text-red-500"
                        }`}
                      >
                        {dia.pdvVisitados}/{dia.pdvPlanificados} PDV
                        {efPdv !== null && (
                          <span className="text-gray-400 font-normal ml-0.5">
                            ({efPdv}%)
                          </span>
                        )}
                      </span>
                    )}
                  </>
                )}

                {!tieneActividad && !tieneVentas && (
                  <span className="text-gray-400 italic">Sin datos</span>
                )}
              </div>
            </div>

            {/* Detalle del día */}
            <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Ventas */}
              {tieneVentas && (
                <div className="space-y-1">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Ventas
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-gray-400">Facturas</span>
                    <span className="font-medium text-right">{dia.cantidadFacturas}</span>
                    <span className="text-gray-400">Clientes</span>
                    <span className="font-medium text-right">{dia.cantidadClientes}</span>
                    <span className="text-gray-400">Bultos</span>
                    <span className="font-medium text-right">{dia.bultos}</span>
                    <span className="text-gray-400">Marcas</span>
                    <span className="font-medium text-right">{dia.marcas.length}</span>
                  </div>
                  {topCats.length > 0 && (
                    <div className="pt-1 space-y-0.5">
                      <p className="text-[10px] text-gray-400">Top categorías</p>
                      {topCats.map(([cat, monto]) => (
                        <div key={cat} className="flex justify-between">
                          <span className="text-gray-500 truncate max-w-[130px]">{cat}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300 ml-2">
                            {formatMoney(monto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actividad */}
              {tieneActividad && (
                <div className="space-y-1">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Actividad
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-gray-400">Entrada</span>
                    <span className="font-medium text-right">
                      {formatHora(dia.primeraEntrada)}
                    </span>
                    <span className="text-gray-400">Salida</span>
                    <span className="font-medium text-right">
                      {formatHora(dia.ultimaSalida)}
                    </span>
                    <span className="text-gray-400">Horas</span>
                    <span className="font-medium text-right text-blue-600">
                      {formatHoras(dia.horasTrabajadas!)}
                    </span>
                    <span className="text-gray-400">PDV plan.</span>
                    <span className="font-medium text-right">{dia.pdvPlanificados}</span>
                    <span className="text-gray-400">PDV visit.</span>
                    <span
                      className={`font-bold text-right ${
                        efPdv !== null && efPdv >= 80
                          ? "text-emerald-600"
                          : efPdv !== null && efPdv >= 50
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                    >
                      {dia.pdvVisitados}
                      {efPdv !== null && (
                        <span className="text-gray-400 font-normal ml-1">({efPdv}%)</span>
                      )}
                    </span>
                    {(dia.pdvMenos5Min ?? 0) > 0 && (
                      <>
                        <span className="text-gray-400">PDV &lt;5min</span>
                        <span className="font-medium text-right text-amber-500">
                          {dia.pdvMenos5Min}
                        </span>
                      </>
                    )}
                    <span className="text-gray-400">GPS pts</span>
                    <span className="font-medium text-right">{dia.puntoGps}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
          <button
            onClick={() => setPaginaActual((p) => Math.max(0, p - 1))}
            disabled={paginaActual === 0}
            className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <span>
            Página {paginaActual + 1} de {totalPaginas} · {fechas.length} días
          </span>
          <button
            onClick={() => setPaginaActual((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaActual === totalPaginas - 1}
            className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
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
  const [ventas, setVentas] = useState<ChessVenta[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroFFVV, setFiltroFFVV] = useState<string>("todos");
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("totalVentas");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  // ── Carga ────────────────────────────────────────────────────────────────────

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
              "id, numero, fecha_comprobante, cliente, razon_social, codigo_articulo, descripcion_articulo, unidad_de_negocio, categoria, marca, bultos_total, subtotal_final, id_vendedor"
            ),
          supabase
            .from("admin_equipo_snapshots")
            .select("*")
            .eq("role", "vendedor")
            .order("created_at", { ascending: false }),
        ]);

        if (e1) throw new Error(`Usuarios: ${e1.message}`);
        if (e2) throw new Error(`Ventas: ${e2.message}`);
        if (e3) throw new Error(`Snapshots: ${e3.message}`);

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

  // ── Stats globales por vendedor ──────────────────────────────────────────────

  const statsMap = useMemo<Record<string, VendedorStats>>(() => {
    const map: Record<string, VendedorStats> = {};

    for (const u of usuarios) {
      map[u.username] = {
        username: u.username,
        name: u.name || u.username,
        ffvv: u.FFVV || "",
        supervisor: u.supervisor || "",
        totalVentas: 0,
        cantidadFacturas: 0,
        cantidadClientes: 0,
        bultosTotales: 0,
        marcasDistintas: 0,
        ultimaFecha: null,
        horasTrabajadas: 0,
        pdvPlanificados: 0,
        pdvVisitados: 0,
        promHoras: 0,
        promPdvVisitados: 0,
        diasConActividad: 0,
      };
    }

    // Ventas globales
    const facturas: Record<string, Set<string>> = {};
    const clientes: Record<string, Set<string>> = {};
    const marcas: Record<string, Set<string>> = {};

    for (const v of ventas) {
      const uid = String(v.id_vendedor);
      if (!map[uid]) continue;
      if (!facturas[uid]) { facturas[uid] = new Set(); clientes[uid] = new Set(); marcas[uid] = new Set(); }
      facturas[uid].add(v.numero);
      clientes[uid].add(v.cliente);
      marcas[uid].add(v.marca);
      map[uid].totalVentas += Number(v.subtotal_final) || 0;
      map[uid].bultosTotales += Number(v.bultos_total) || 0;
    }

    for (const uid of Object.keys(map)) {
      map[uid].cantidadFacturas = facturas[uid]?.size ?? 0;
      map[uid].cantidadClientes = clientes[uid]?.size ?? 0;
      map[uid].marcasDistintas = marcas[uid]?.size ?? 0;
    }

    // Snapshots globales
    const snapsXVendedor: Record<string, Snapshot[]> = {};
    for (const snap of snapshots) {
      const uid = String(snap.username);
      if (!snapsXVendedor[uid]) snapsXVendedor[uid] = [];
      snapsXVendedor[uid].push(snap);
    }

    for (const [uid, snaps] of Object.entries(snapsXVendedor)) {
      if (!map[uid]) continue;
      const sorted = [...snaps].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const ultimo = sorted[0];
      const s = map[uid];
      s.ultimaFecha = ultimo.fecha;
      s.horasTrabajadas = Number(ultimo.horas_trabajadas) || 0;
      s.pdvPlanificados = Number(ultimo.pdv_planificados) || 0;
      s.pdvVisitados = Number(ultimo.pdv_visitados) || 0;
      const activos = snaps.filter((sn) => Number(sn.horas_trabajadas) > 0);
      s.diasConActividad = activos.length;
      s.promHoras = activos.length > 0
        ? activos.reduce((acc, sn) => acc + Number(sn.horas_trabajadas), 0) / activos.length : 0;
      s.promPdvVisitados = activos.length > 0
        ? activos.reduce((acc, sn) => acc + Number(sn.pdv_visitados), 0) / activos.length : 0;
    }

    return map;
  }, [usuarios, ventas, snapshots]);

  // ── Filtros + orden ──────────────────────────────────────────────────────────

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
      else if (sortKey === "totalVentas") c = a.totalVentas - b.totalVentas;
      else if (sortKey === "horasTrabajadas") c = a.horasTrabajadas - b.horasTrabajadas;
      else if (sortKey === "pdvVisitados") c = a.pdvVisitados - b.pdvVisitados;
      else if (sortKey === "ffvv") c = a.ffvv.localeCompare(b.ffvv);
      return sortDesc ? -c : c;
    });
    return filtrados;
  }, [statsMap, busqueda, filtroFFVV, filtroSupervisor, sortKey, sortDesc]);

  const ffvvOpciones = useMemo(() => Array.from(new Set(Object.values(statsMap).map((v) => v.ffvv).filter(Boolean))).sort(), [statsMap]);
  const supervisorOpciones = useMemo(() => Array.from(new Set(Object.values(statsMap).map((v) => v.supervisor).filter(Boolean))).sort(), [statsMap]);

  const totales = useMemo(() => ({
    vendedores: listaFiltrada.length,
    ventas: listaFiltrada.reduce((a, v) => a + v.totalVentas, 0),
    facturas: listaFiltrada.reduce((a, v) => a + v.cantidadFacturas, 0),
    clientes: listaFiltrada.reduce((a, v) => a + v.cantidadClientes, 0),
    bultos: listaFiltrada.reduce((a, v) => a + v.bultosTotales, 0),
    horasPromedio: (() => {
      const con = listaFiltrada.filter((v) => v.horasTrabajadas > 0);
      return con.length > 0 ? con.reduce((a, v) => a + v.horasTrabajadas, 0) / con.length : 0;
    })(),
  }), [listaFiltrada]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

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

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resumen de Vendedores</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ventas y actividad del equipo · detalle por fecha al expandir</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Vendedores",    value: totales.vendedores,                          icon: Users,      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-900/30" },
          { label: "Total Ventas",  value: formatMoney(totales.ventas),                 icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
          { label: "Facturas",      value: totales.facturas,                            icon: ShoppingBag,color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/30" },
          { label: "Clientes",      value: totales.clientes,                            icon: Store,      color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/30" },
          { label: "Bultos",        value: totales.bultos.toLocaleString("es-AR"),      icon: Package,    color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-900/30" },
          { label: "Prom. Horas",   value: formatHoras(totales.horasPromedio),          icon: Clock,      color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/30" },
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
          <input
            type="text"
            placeholder="Buscar vendedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 w-48"
          />
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
          {([ ["totalVentas","Ventas"], ["horasTrabajadas","Horas"], ["pdvVisitados","PDV"], ["name","Nombre"] ] as [SortKey,string][]).map(([key, label]) => (
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
            <p>Sin vendedores que coincidan con los filtros</p>
          </div>
        )}

        {listaFiltrada.map((v) => {
          const isExpanded = expandido === v.username;
          const efPdv = v.pdvPlanificados > 0 ? Math.round((v.pdvVisitados / v.pdvPlanificados) * 100) : null;

          return (
            <div key={v.username} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">

              {/* Fila resumen */}
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
                      <p className="text-sm font-bold text-emerald-600">{v.totalVentas > 0 ? formatMoney(v.totalVentas) : "—"}</p>
                      <p className="text-[10px] text-gray-400">{v.cantidadFacturas} fact · {v.cantidadClientes} cl</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{v.horasTrabajadas > 0 ? formatHoras(v.horasTrabajadas) : "—"}</p>
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

              {/* Panel expandido: detalle por fecha */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-3">
                    <Calendar className="w-3.5 h-3.5" /> Detalle por fecha
                  </p>
                  <DetalleFechas
                    username={v.username}
                    ventas={ventas}
                    snapshots={snapshots}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-gray-400 pb-4">
        {listaFiltrada.length} vendedores · ventas por fecha_comprobante · actividad por created_at
      </div>
    </div>
  );
};

export default VendedoresResumen;
