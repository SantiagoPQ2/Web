import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

type Estado = "pendiente" | "aprobado" | "rechazado";

interface CompraItem {
  id: string;
  que_es: string;
  tipo_gasto: string;
  urgencia: string;
  detalle_adicional: string | null;
  monto_total_estimado: string;

  vendedor_nombre: string | null;
  vendedor_username: string | null;

  estado: Estado;
  supervisor_nombre: string | null;
  created_at: string;

  adjuntos_urls?: string[] | null;
  adjuntos_nombres?: string[] | null;

  // compat viejo
  foto_url?: string | null;

  respuesta?: string | null;
}

const ESTADO_LABELS: Record<Estado, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const ESTADO_BADGE: Record<Estado, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
};

const BOTON_ACTIVO: Record<Estado, string> = {
  pendiente: "bg-yellow-400 text-white ring-2 ring-yellow-500",
  aprobado: "bg-green-600 text-white ring-2 ring-green-700",
  rechazado: "bg-red-600 text-white ring-2 ring-red-700",
};

const BOTON_INACTIVO: Record<Estado, string> = {
  pendiente: "bg-gray-100 text-yellow-700 hover:bg-yellow-50",
  aprobado: "bg-gray-100 text-green-700 hover:bg-green-50",
  rechazado: "bg-gray-100 text-red-700 hover:bg-red-50",
};

const RevisarCompras: React.FC = () => {
  const { user } = useAuth();

  const [items, setItems] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Rango de fechas
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 8;

  // Modal adjuntos
  const [adjuntosVista, setAdjuntosVista] = useState<{
    urls: string[];
    nombres: string[];
  } | null>(null);

  // Respuesta (draft por fila)
  const [respuestasDraft, setRespuestasDraft] = useState<Record<string, string>>({});
  const [guardandoRespuestaId, setGuardandoRespuestaId] = useState<string | null>(null);

  // Estado cambiando (para deshabilitar botones mientras se guarda)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);

  const esAdmin = user?.role === "admin";

  const cargar = async () => {
    if (!user?.username) return;

    let query = supabase.from("pedidos_compra").select("*");

    if (!esAdmin) {
      query = query.eq("vendedor_username", user.username);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const rows = (data || []) as CompraItem[];

    // Normalizar: si viene aprobado boolean (datos viejos), mapearlo a estado
    const normalized = rows.map((r) => {
      if (!r.estado) {
        const estadoCompat: Estado =
          (r as any).aprobado === true ? "aprobado" : "pendiente";
        return { ...r, estado: estadoCompat };
      }
      return r;
    });

    setItems(normalized);

    const initDrafts: Record<string, string> = {};
    for (const r of normalized) initDrafts[r.id] = r.respuesta ?? "";
    setRespuestasDraft(initDrafts);
  };

  const formatearFechaVista = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR");

  const formatearFechaIso = (iso: string) =>
    new Date(iso).toISOString().slice(0, 10);

  const cumpleRango = (fecha: string) => {
    if (!fechaDesde || !fechaHasta) return true;
    const f = formatearFechaIso(fecha);
    return f >= fechaDesde && f <= fechaHasta;
  };

  const filtrados = useMemo(
    () => items.filter((i) => cumpleRango(i.created_at)),
    [items, fechaDesde, fechaHasta]
  );

  const totalPaginas = Math.ceil(filtrados.length / REGISTROS_POR_PAGINA);
  const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
  const vistaPagina = filtrados.slice(inicio, inicio + REGISTROS_POR_PAGINA);

  const siguientePagina = () => {
    if (paginaActual < totalPaginas) setPaginaActual(paginaActual + 1);
  };

  const anteriorPagina = () => {
    if (paginaActual > 1) setPaginaActual(paginaActual - 1);
  };

  // Cambiar estado (pendiente / aprobado / rechazado)
  const cambiarEstado = async (item: CompraItem, nuevoEstado: Estado) => {
    if (!esAdmin) {
      alert("Solo admin puede cambiar el estado.");
      return;
    }
    if (item.estado === nuevoEstado) return; // ya está, no hacer nada

    setCambiandoEstadoId(item.id);
    setLoading(true);

    const { error } = await supabase
      .from("pedidos_compra")
      .update({
        estado: nuevoEstado,
        // Mantenemos compatibilidad con columna aprobado si existe
        aprobado: nuevoEstado === "aprobado",
        supervisor_nombre:
          nuevoEstado !== "pendiente" ? user?.name ?? user?.username : null,
      })
      .eq("id", item.id);

    setLoading(false);
    setCambiandoEstadoId(null);

    if (error) {
      console.error(error);
      alert("Error actualizando el estado.");
      return;
    }

    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? {
              ...r,
              estado: nuevoEstado,
              supervisor_nombre:
                nuevoEstado !== "pendiente"
                  ? user?.name ?? user?.username
                  : null,
            }
          : r
      )
    );
  };

  // Guardar Respuesta — solo admin
  const guardarRespuesta = async (item: CompraItem) => {
    if (!esAdmin) {
      alert("Solo admin puede editar la respuesta.");
      return;
    }

    const texto = (respuestasDraft[item.id] ?? "").trim();

    setGuardandoRespuestaId(item.id);

    const { error } = await supabase
      .from("pedidos_compra")
      .update({ respuesta: texto.length ? texto : null })
      .eq("id", item.id);

    setGuardandoRespuestaId(null);

    if (error) {
      console.error(error);
      alert("Error guardando la respuesta");
      return;
    }

    setItems((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, respuesta: texto } : r))
    );
  };

  const abrirAdjuntos = (item: CompraItem) => {
    const urls: string[] = [];
    const nombres: string[] = [];

    const arrUrls = (item.adjuntos_urls ?? []) as string[];
    const arrNames = (item.adjuntos_nombres ?? []) as string[];

    for (let i = 0; i < arrUrls.length; i++) {
      urls.push(arrUrls[i]);
      nombres.push(arrNames[i] ?? `Adjunto ${i + 1}`);
    }

    // compat viejo
    if (urls.length === 0 && item.foto_url) {
      urls.push(item.foto_url);
      nombres.push("Foto");
    }

    setAdjuntosVista({ urls, nombres });
  };

  const esPdf = (url: string) =>
    url.toLowerCase().includes(".pdf") ||
    url.toLowerCase().includes("application/pdf");

  const exportarExcel = () => {
    if (!fechaDesde || !fechaHasta) {
      alert("Debe elegir un rango de fechas para exportar.");
      return;
    }

    const dataExport = filtrados.map((i) => ({
      Fecha: formatearFechaVista(i.created_at),
      "¿Qué es?": i.que_es,
      "Tipo de gasto": i.tipo_gasto,
      Urgencia: i.urgencia,
      Detalle: i.detalle_adicional ?? "",
      Monto: i.monto_total_estimado,
      Personal: i.vendedor_nombre ?? "",
      "Personal username": i.vendedor_username ?? "",
      Estado: ESTADO_LABELS[i.estado] ?? i.estado,
      CEO: i.supervisor_nombre ?? "",
      Respuesta: i.respuesta ?? "",
      Adjuntos: (i.adjuntos_urls ?? []).join(" | ") || (i.foto_url ?? ""),
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");

    XLSX.writeFile(wb, `compras_${fechaDesde}_a_${fechaHasta}.xlsx`);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, user?.role]);

  const ESTADOS: Estado[] = ["pendiente", "aprobado", "rechazado"];

  return (
    <div className="max-w-7xl w-[98vw] mx-auto mt-4 p-4 sm:p-6 bg-white shadow rounded">
      {/* MODAL ADJUNTOS */}
      {adjuntosVista && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow max-w-3xl w-[95vw] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold">Adjuntos (Fotos / PDFs)</h3>
              <button
                onClick={() => setAdjuntosVista(null)}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Cerrar
              </button>
            </div>

            {adjuntosVista.urls.length === 0 ? (
              <p className="text-sm text-gray-500">No hay adjuntos.</p>
            ) : (
              <div className="space-y-4">
                {adjuntosVista.urls.map((url, idx) => {
                  const nombre = adjuntosVista.nombres[idx] ?? `Adjunto ${idx + 1}`;
                  const pdf = esPdf(url);

                  return (
                    <div key={`${url}-${idx}`} className="border rounded p-3">
                      <div className="text-sm font-medium mb-2">{nombre}</div>

                      {pdf ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block px-3 py-1 bg-blue-600 text-white rounded"
                        >
                          Abrir PDF
                        </a>
                      ) : (
                        <img
                          src={url}
                          alt={nombre}
                          className="max-h-[70vh] mx-auto rounded"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILTROS + EXPORTAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">Desde:</span>
          <input
            type="date"
            className="p-2 border rounded"
            value={fechaDesde}
            onChange={(e) => {
              setFechaDesde(e.target.value);
              setPaginaActual(1);
            }}
          />

          <span className="font-medium">Hasta:</span>
          <input
            type="date"
            className="p-2 border rounded"
            value={fechaHasta}
            onChange={(e) => {
              setFechaHasta(e.target.value);
              setPaginaActual(1);
            }}
          />
        </div>

        <button
          onClick={exportarExcel}
          className="self-start sm:self-auto px-4 py-2 bg-emerald-600 text-white rounded"
        >
          Exportar XLSX
        </button>
      </div>

      {/* TABLA */}
      <div className="border rounded overflow-hidden">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "7%" }} />   {/* Fecha */}
            <col style={{ width: "12%" }} />  {/* ¿Qué es? */}
            <col style={{ width: "8%" }} />   {/* Tipo */}
            <col style={{ width: "7%" }} />   {/* Urgencia */}
            <col style={{ width: "18%" }} />  {/* Detalle */}
            <col style={{ width: "6%" }} />   {/* Monto */}
            <col style={{ width: "7%" }} />   {/* Personal */}
            <col style={{ width: "7%" }} />   {/* Estado */}
            <col style={{ width: "6%" }} />   {/* CEO */}
            <col style={{ width: "13%" }} />  {/* Respuesta */}
            <col style={{ width: "11%" }} />  {/* Acción */}
            <col style={{ width: "8%" }} />   {/* Adjuntos */}
          </colgroup>

          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">¿Qué es?</th>
              <th className="p-2 border">Tipo de gasto</th>
              <th className="p-2 border">Urgencia</th>
              <th className="p-2 border">Detalle</th>
              <th className="p-2 border">Monto</th>
              <th className="p-2 border">Personal</th>
              <th className="p-2 border text-center">Estado</th>
              <th className="p-2 border">CEO</th>
              <th className="p-2 border">Respuesta</th>
              <th className="p-2 border text-center">Acción</th>
              <th className="p-2 border text-center">Adjuntos</th>
            </tr>
          </thead>

          <tbody>
            {vistaPagina.map((item) => {
              const tieneAdjuntos =
                (item.adjuntos_urls && item.adjuntos_urls.length > 0) ||
                !!item.foto_url;

              const draft = respuestasDraft[item.id] ?? (item.respuesta ?? "");
              const estadoActual: Estado = item.estado ?? "pendiente";
              const cambiando = cambiandoEstadoId === item.id;

              return (
                <tr key={item.id} className="align-top">
                  <td className="p-2 border whitespace-normal break-words">
                    {formatearFechaVista(item.created_at)}
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.que_es}
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.tipo_gasto}
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.urgencia}
                  </td>

                  <td className="p-2 border">
                    <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words">
                      {item.detalle_adicional ?? "-"}
                    </div>
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.monto_total_estimado}
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.vendedor_nombre ?? "-"}
                  </td>

                  {/* ESTADO — badge */}
                  <td className="p-2 border text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[estadoActual]}`}
                    >
                      {ESTADO_LABELS[estadoActual]}
                    </span>
                  </td>

                  <td className="p-2 border whitespace-normal break-words">
                    {item.supervisor_nombre ?? "-"}
                  </td>

                  <td className="p-2 border">
                    {esAdmin ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full p-2 border rounded text-sm"
                          rows={4}
                          value={draft}
                          onChange={(e) =>
                            setRespuestasDraft((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Escribir respuesta..."
                        />

                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => guardarRespuesta(item)}
                            disabled={guardandoRespuestaId === item.id}
                            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                          >
                            {guardandoRespuestaId === item.id
                              ? "Guardando..."
                              : "Guardar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-700">
                        {item.respuesta?.trim() ? item.respuesta : "-"}
                      </div>
                    )}
                  </td>

                  {/* ACCIÓN — 3 botones */}
                  <td className="p-2 border text-center">
                    {esAdmin ? (
                      <div className="flex flex-col gap-1">
                        {ESTADOS.map((e) => (
                          <button
                            key={e}
                            disabled={cambiando}
                            onClick={() => cambiarEstado(item, e)}
                            className={`w-full text-xs px-2 py-1.5 rounded border transition-all ${
                              estadoActual === e
                                ? BOTON_ACTIVO[e]
                                : BOTON_INACTIVO[e]
                            } disabled:opacity-50`}
                          >
                            {cambiando && estadoActual !== e
                              ? "..."
                              : ESTADO_LABELS[e]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  <td className="p-2 border text-center">
                    {tieneAdjuntos ? (
                      <button
                        onClick={() => abrirAdjuntos(item)}
                        className="w-full whitespace-nowrap text-xs px-2 py-2 bg-blue-600 text-white rounded"
                      >
                        Ver
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}

            {vistaPagina.length === 0 && (
              <tr>
                <td colSpan={12} className="p-4 text-center text-gray-500">
                  No hay registros dentro del rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <button
            onClick={anteriorPagina}
            disabled={paginaActual === 1}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
          >
            ◀
          </button>

          <span>
            {paginaActual} / {totalPaginas}
          </span>

          <button
            onClick={siguientePagina}
            disabled={paginaActual === totalPaginas}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
};

export default RevisarCompras;
