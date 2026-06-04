import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

type Estado = "pendiente" | "aprobada" | "rechazada";

type Row = {
  id: number;
  created_at: string;
  cliente: string;
  articulo: string;
  bultos: number;
  porcentaje_bonificacion: number;
  monto_adicional: number;
  motivo: string;
  fecha_entrega: string;
  estado: Estado;
  created_by?: string;
  aprobado_by?: string | null;
  aprobado_at?: string | null;
};

type UserMini = {
  id: string;
  name: string | null;
  username: string | null;
};

const PAGE_SIZE = 10;
const EXPORT_BATCH_SIZE = 1000;

const ESTADOS: Estado[] = ["pendiente", "aprobada", "rechazada"];

const ESTADO_LABELS: Record<Estado, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const ESTADO_BADGE: Record<Estado, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
};

const BOTON_ACTIVO: Record<Estado, string> = {
  pendiente: "bg-yellow-400 text-white ring-2 ring-yellow-500",
  aprobada: "bg-green-600 text-white ring-2 ring-green-700",
  rechazada: "bg-red-600 text-white ring-2 ring-red-700",
};

const BOTON_INACTIVO: Record<Estado, string> = {
  pendiente: "bg-gray-100 text-yellow-700 hover:bg-yellow-50",
  aprobada: "bg-gray-100 text-green-700 hover:bg-green-50",
  rechazada: "bg-gray-100 text-red-700 hover:bg-red-50",
};

function toIsoStart(desde: string) {
  return new Date(desde + "T00:00:00").toISOString();
}

function toIsoEnd(hasta: string) {
  return new Date(hasta + "T23:59:59").toISOString();
}

function formatDateTime(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function formatDateOnly(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString();
  } catch {
    return d;
  }
}

type ColFilters = {
  fecha: string;
  fecha_entrega: string;
  cargado_por: string;
  cliente: string;
  articulo: string;
  bultos: string;
  porcentaje: string;
  monto: string;
  motivo: string;
  estado: string;
};

const EMPTY_FILTERS: ColFilters = {
  fecha: "",
  fecha_entrega: "",
  cargado_por: "",
  cliente: "",
  articulo: "",
  bultos: "",
  porcentaje: "",
  monto: "",
  motivo: "",
  estado: "",
};

const RevisarBonificaciones: React.FC = () => {
  const { user } = useAuth();

  const role = user?.role;
  const canView = useMemo(
    () => !!user && (role === "admin" || role === "supervisor"),
    [user, role]
  );
  const canApprove = useMemo(() => role === "supervisor", [role]);

  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [userMap, setUserMap] = useState<Record<string, UserMini>>({});

  const [colFilters, setColFilters] = useState<ColFilters>({ ...EMPTY_FILTERS });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setColFilter = (key: keyof ColFilters, value: string) =>
    setColFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setColFilters({ ...EMPTY_FILTERS });

  const ensureUsersLoaded = async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return;

    const missing = unique.filter((id) => !userMap[id]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("usuarios_app")
      .select("id, name, username")
      .in("id", missing);

    if (error) {
      console.error("usuarios_app lookup error:", error);
      return;
    }

    const add: Record<string, UserMini> = {};
    (data ?? []).forEach((u: any) => {
      add[u.id] = { id: u.id, name: u.name ?? null, username: u.username ?? null };
    });

    setUserMap((prev) => ({ ...prev, ...add }));
  };

  const getUserLabel = (id?: string | null) => {
    if (!id) return "-";
    const u = userMap[id];
    if (!u) return id;
    return u.name || u.username || id;
  };

  const fetchData = async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("bonificaciones")
        .select(
          "id, created_at, cliente, articulo, bultos, porcentaje_bonificacion, monto_adicional, motivo, fecha_entrega, estado, created_by, aprobado_by, aprobado_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (desde) q = q.gte("created_at", toIsoStart(desde));
      if (hasta) q = q.lte("created_at", toIsoEnd(hasta));

      const { data, error, count } = await q;
      if (error) throw error;

      const newRows = (data ?? []) as Row[];
      setRows(newRows);
      setTotal(count ?? 0);

      const ids = newRows
        .flatMap((r) => [r.created_by, r.aprobado_by ?? undefined])
        .filter(Boolean) as string[];

      await ensureUsersLoaded(ids);
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page]);

  // Filtrado client-side
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const f = colFilters;

      if (f.fecha) {
        const fechaFila = new Date(r.created_at).toLocaleDateString();
        if (!fechaFila.toLowerCase().includes(f.fecha.toLowerCase())) return false;
      }
      if (f.fecha_entrega) {
        const fe = r.fecha_entrega ? formatDateOnly(r.fecha_entrega) : "-";
        if (!fe.toLowerCase().includes(f.fecha_entrega.toLowerCase())) return false;
      }
      if (f.cargado_por) {
        const label = getUserLabel(r.created_by).toLowerCase();
        if (!label.includes(f.cargado_por.toLowerCase())) return false;
      }
      if (f.cliente) {
        if (!r.cliente.toLowerCase().includes(f.cliente.toLowerCase())) return false;
      }
      if (f.articulo) {
        if (!r.articulo.toLowerCase().includes(f.articulo.toLowerCase())) return false;
      }
      if (f.bultos) {
        if (!String(r.bultos).includes(f.bultos)) return false;
      }
      if (f.porcentaje) {
        if (!String(r.porcentaje_bonificacion).includes(f.porcentaje)) return false;
      }
      if (f.monto) {
        if (!String(r.monto_adicional).includes(f.monto)) return false;
      }
      if (f.motivo) {
        if (!r.motivo.toLowerCase().includes(f.motivo.toLowerCase())) return false;
      }
      if (f.estado) {
        const label = ESTADO_LABELS[r.estado]?.toLowerCase() ?? r.estado.toLowerCase();
        if (!label.includes(f.estado.toLowerCase())) return false;
      }

      return true;
    });
  }, [rows, colFilters, userMap]);

  const hayFiltrosActivos = useMemo(
    () => Object.values(colFilters).some((v) => v !== ""),
    [colFilters]
  );

  const cambiarEstado = async (row: Row, nuevoEstado: Estado) => {
    if (!canApprove) return;
    if (row.estado === nuevoEstado) return;

    if (!user?.id) {
      alert("No se encontró user.id. Revisá tu AuthContext/login.");
      return;
    }

    setActionId(row.id);

    try {
      const esPendiente = nuevoEstado === "pendiente";

      const payload: Record<string, any> = {
        estado: nuevoEstado,
        aprobado_by: esPendiente ? null : user.id,
        aprobado_at: esPendiente ? null : new Date().toISOString(),
      };

      const { error } = await supabase
        .from("bonificaciones")
        .update(payload)
        .eq("id", row.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                estado: nuevoEstado,
                aprobado_by: esPendiente ? null : user.id,
                aprobado_at: esPendiente ? null : new Date().toISOString(),
              }
            : r
        )
      );

      if (!esPendiente) await ensureUsersLoaded([user.id]);
    } catch (e: any) {
      alert(e?.message ?? "Error al cambiar estado");
    } finally {
      setActionId(null);
    }
  };

  const exportXlsx = async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const all: Row[] = [];
      let offset = 0;

      while (true) {
        let q = supabase
          .from("bonificaciones")
          .select(
            "id, created_at, cliente, articulo, bultos, porcentaje_bonificacion, monto_adicional, motivo, fecha_entrega, estado, created_by, aprobado_by, aprobado_at"
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + EXPORT_BATCH_SIZE - 1);

        if (desde) q = q.gte("created_at", toIsoStart(desde));
        if (hasta) q = q.lte("created_at", toIsoEnd(hasta));

        const { data, error } = await q;
        if (error) throw error;

        const chunk = (data ?? []) as Row[];
        all.push(...chunk);

        if (chunk.length < EXPORT_BATCH_SIZE) break;
        offset += EXPORT_BATCH_SIZE;
      }

      const ids = all
        .flatMap((r) => [r.created_by, r.aprobado_by ?? undefined])
        .filter(Boolean) as string[];

      await ensureUsersLoaded(ids);

      const excelRows = all.map((r) => ({
        Fecha: formatDateTime(r.created_at),
        "Fecha entrega": r.fecha_entrega ? formatDateOnly(r.fecha_entrega) : "-",
        "Cargado por": getUserLabel(r.created_by),
        Cliente: r.cliente,
        Artículo: r.articulo,
        Bultos: r.bultos,
        "% Bonif": Number(r.porcentaje_bonificacion),
        "Monto adicional": Number(r.monto_adicional),
        Motivo: r.motivo,
        Estado: ESTADO_LABELS[r.estado] ?? r.estado,
        "Aprobado por": r.aprobado_by ? getUserLabel(r.aprobado_by) : "-",
        "Aprobado at": r.aprobado_at ? formatDateTime(r.aprobado_at) : "-",
        "ID Bonificación": r.id,
      }));

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bonificaciones");

      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      XLSX.writeFile(wb, `bonificaciones_${stamp}.xlsx`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Error exportando XLSX");
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-700">No autorizado.</p>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revisar Bonificaciones</h1>
            <p className="text-gray-600">Listado desde Supabase</p>
          </div>

          <button
            onClick={exportXlsx}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Exportar XLSX
          </button>
        </div>

        {/* RANGO DE FECHAS */}
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => { setPage(1); setDesde(e.target.value); }}
              className="px-3 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => { setPage(1); setHasta(e.target.value); }}
              className="px-3 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>

          <button
            onClick={() => { setPage(1); fetchData(); }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-60"
          >
            Aplicar
          </button>

          {hayFiltrosActivos && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-sm"
            >
              Limpiar filtros ✕
            </button>
          )}
        </div>

        {/* TABLA */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">

              {/* FILA FILTROS POR COLUMNA */}
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.fecha}
                    onChange={(e) => setColFilter("fecha", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.fecha_entrega}
                    onChange={(e) => setColFilter("fecha_entrega", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.cargado_por}
                    onChange={(e) => setColFilter("cargado_por", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.cliente}
                    onChange={(e) => setColFilter("cliente", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.articulo}
                    onChange={(e) => setColFilter("articulo", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.bultos}
                    onChange={(e) => setColFilter("bultos", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.porcentaje}
                    onChange={(e) => setColFilter("porcentaje", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.monto}
                    onChange={(e) => setColFilter("monto", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input
                    className={inputCls}
                    placeholder="Filtrar..."
                    value={colFilters.motivo}
                    onChange={(e) => setColFilter("motivo", e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <select
                    className={inputCls}
                    value={colFilters.estado}
                    onChange={(e) => setColFilter("estado", e.target.value)}
                  >
                    <option value="">Todos</option>
                    {ESTADOS.map((e) => (
                      <option key={e} value={ESTADO_LABELS[e]}>
                        {ESTADO_LABELS[e]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="p-2" />
              </tr>

              {/* FILA HEADERS */}
              <tr>
                <th className="text-left p-3">Fecha</th>
                <th className="text-left p-3">Fecha entrega</th>
                <th className="text-left p-3">Cargado por</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Artículo</th>
                <th className="text-left p-3">Bultos</th>
                <th className="text-left p-3">%Bonif</th>
                <th className="text-left p-3">Monto Adic.</th>
                <th className="text-left p-3">Motivo</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Acción</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => {
                const estadoActual: Estado = r.estado ?? "pendiente";
                const cambiando = actionId === r.id;

                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{r.fecha_entrega ? formatDateOnly(r.fecha_entrega) : "-"}</td>
                    <td className="p-3">{getUserLabel(r.created_by)}</td>
                    <td className="p-3">{r.cliente}</td>
                    <td className="p-3">{r.articulo}</td>
                    <td className="p-3">{r.bultos}</td>
                    <td className="p-3">{Number(r.porcentaje_bonificacion).toFixed(2)}%</td>
                    <td className="p-3">${Number(r.monto_adicional).toFixed(2)}</td>
                    <td className="p-3">{r.motivo}</td>

                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ESTADO_BADGE[estadoActual]}`}>
                        {ESTADO_LABELS[estadoActual]}
                      </span>
                    </td>

                    <td className="p-3">
                      {canApprove ? (
                        <div className="flex flex-col gap-1 min-w-[110px]">
                          {ESTADOS.map((e) => (
                            <button
                              key={e}
                              disabled={cambiando || loading}
                              onClick={() => cambiarEstado(r, e)}
                              className={`w-full text-xs px-2 py-1.5 rounded border transition-all ${
                                estadoActual === e ? BOTON_ACTIVO[e] : BOTON_INACTIVO[e]
                              } disabled:opacity-50`}
                            >
                              {ESTADO_LABELS[e]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-600" colSpan={11}>
                    Sin resultados{hayFiltrosActivos ? " para los filtros aplicados" : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Página {page} / {totalPages} — Total: {total}
            {hayFiltrosActivos && ` (${filteredRows.length} filtrados en esta página)`}
          </div>
          <div className="flex gap-2">
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded border"
            >
              ◀
            </button>
            <button
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 rounded border"
            >
              ▶
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RevisarBonificaciones;
