import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

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
  estado: Estado;
  created_by?: string; // uuid (usuarios_app.id)
  aprobado_by?: string | null;
  aprobado_at?: string | null;
};

type UserMini = {
  id: string;
  name: string | null;
  username: string | null;
};

const PAGE_SIZE = 10;

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

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ✅ map para resolver created_by -> nombre
  const [userMap, setUserMap] = useState<Record<string, UserMini>>({});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchData = async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("bonificaciones")
        .select(
          "id, created_at, cliente, articulo, bultos, porcentaje_bonificacion, monto_adicional, motivo, estado, created_by, aprobado_by, aprobado_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (desde)
        q = q.gte("created_at", new Date(desde + "T00:00:00").toISOString());
      if (hasta)
        q = q.lte("created_at", new Date(hasta + "T23:59:59").toISOString());

      const { data, error, count } = await q;
      if (error) throw error;

      const newRows = (data ?? []) as Row[];
      setRows(newRows);
      setTotal(count ?? 0);

      // ✅ traer nombres de usuarios_app para los created_by presentes en esta página
      const creatorIds = Array.from(
        new Set(newRows.map((r) => r.created_by).filter(Boolean) as string[])
      );

      if (creatorIds.length > 0) {
        // Evitar re-consultar IDs que ya tenemos en el map
        const missing = creatorIds.filter((id) => !userMap[id]);

        if (missing.length > 0) {
          const { data: usersData, error: usersErr } = await supabase
            .from("usuarios_app")
            .select("id, name, username")
            .in("id", missing);

          if (usersErr) {
            console.error("usuarios_app lookup error:", usersErr);
          } else {
            const add: Record<string, UserMini> = {};
            (usersData ?? []).forEach((u: any) => {
              add[u.id] = {
                id: u.id,
                name: u.name ?? null,
                username: u.username ?? null,
              };
            });
            setUserMap((prev) => ({ ...prev, ...add }));
          }
        }
      }
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

  const aprobar = async (id: number) => {
    if (!canApprove) return;

    // ✅ tu sistema NO usa Supabase Auth real:
    // aprobado_by debe venir de usuarios_app.id (uuid).
    if (!user?.id) {
      alert("No se encontró user.id (usuarios_app.id). Revisá tu AuthContext/login.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("bonificaciones")
        .update({
          estado: "aprobada",
          aprobado_by: user.id,
          aprobado_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("estado", "pendiente");

      if (error) throw error;

      await fetchData();
    } catch (e: any) {
      alert(e?.message ?? "Error al aprobar");
    } finally {
      setLoading(false);
    }
  };

  const getCreatorLabel = (createdBy?: string) => {
    if (!createdBy) return "-";
    const u = userMap[createdBy];
    if (!u) return createdBy; // fallback: muestra uuid si aún no cargó
    return u.name || u.username || createdBy;
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Revisar Bonificaciones
            </h1>
            <p className="text-gray-600">Listado desde Supabase</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => {
                setPage(1);
                setDesde(e.target.value);
              }}
              className="px-3 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => {
                setPage(1);
                setHasta(e.target.value);
              }}
              className="px-3 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>

          <button
            onClick={() => {
              setPage(1);
              fetchData();
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
          >
            Aplicar
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Fecha</th>
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
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>

                  {/* ✅ NUEVO: nombre de usuarios_app */}
                  <td className="p-3">{getCreatorLabel(r.created_by)}</td>

                  <td className="p-3">{r.cliente}</td>
                  <td className="p-3">{r.articulo}</td>
                  <td className="p-3">{r.bultos}</td>
                  <td className="p-3">
                    {Number(r.porcentaje_bonificacion).toFixed(2)}%
                  </td>
                  <td className="p-3">
                    ${Number(r.monto_adicional).toFixed(2)}
                  </td>
                  <td className="p-3">{r.motivo}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.estado === "pendiente"
                          ? "bg-gray-200 text-gray-800"
                          : r.estado === "aprobada"
                          ? "bg-green-200 text-green-800"
                          : "bg-red-200 text-red-800"
                      }`}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="p-3">
                    {canApprove ? (
                      <button
                        disabled={loading || r.estado !== "pendiente"}
                        onClick={() => aprobar(r.id)}
                        className={`px-3 py-1 rounded text-white ${
                          r.estado !== "pendiente"
                            ? "bg-gray-400"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        Aprobar
                      </button>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-600" colSpan={10}>
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Página {page} / {totalPages} — Total: {total}
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
