import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface CompraItem {
  id: string;
  que_es: string;
  tipo_gasto: string;
  urgencia: string;
  detalle_adicional: string | null;
  monto_total_estimado: string;
  vendedor_nombre: string | null;
  vendedor_username: string | null;
  aprobado: boolean;
  supervisor_nombre: string | null;
  created_at: string;
  foto_url: string | null;
}

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

  // Vista de foto
  const [fotoVista, setFotoVista] = useState<string | null>(null);

  const cargar = async () => {
    const { data, error } = await supabase
      .from("pedidos_compra")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setItems((data || []) as CompraItem[]);
  };

  const formatearFechaVista = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR");

  const formatearFechaIso = (iso: string) =>
    new Date(iso).toISOString().slice(0, 10);

  // Rango desde/hasta
  const cumpleRango = (fecha: string) => {
    if (!fechaDesde || !fechaHasta) return true;
    const f = formatearFechaIso(fecha);
    return f >= fechaDesde && f <= fechaHasta;
  };

  const filtrados = items.filter((i) => cumpleRango(i.created_at));

  // Paginación
  const totalPaginas = Math.ceil(filtrados.length / REGISTROS_POR_PAGINA);
  const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
  const vistaPagina = filtrados.slice(inicio, inicio + REGISTROS_POR_PAGINA);

  const siguientePagina = () => {
    if (paginaActual < totalPaginas) setPaginaActual(paginaActual + 1);
  };

  const anteriorPagina = () => {
    if (paginaActual > 1) setPaginaActual(paginaActual - 1);
  };

  // ✅ Aprobar/Desaprobar SOLO admin
  const toggleAprobado = async (item: CompraItem) => {
    if (!user || user.role !== "admin") {
      alert("Solo admin puede aprobar/desaprobar.");
      return;
    }

    const nuevoValor = !item.aprobado;

    setLoading(true);

    await supabase
      .from("pedidos_compra")
      .update({
        aprobado: nuevoValor,
        supervisor_nombre: nuevoValor ? user.name ?? user.username : null,
      })
      .eq("id", item.id);

    setLoading(false);

    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? {
              ...r,
              aprobado: nuevoValor,
              supervisor_nombre: nuevoValor
                ? user.name ?? user.username
                : null,
            }
          : r
      )
    );
  };

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
      "Detalle adicional": i.detalle_adicional ?? "",
      "Monto estimado": i.monto_total_estimado,
      Personal: i.vendedor_nombre ?? "",
      "Personal username": i.vendedor_username ?? "",
      Aprobado: i.aprobado ? "Sí" : "No",
      CEO: i.supervisor_nombre ?? "",
      Foto: i.foto_url ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");

    XLSX.writeFile(wb, `compras_${fechaDesde}_a_${fechaHasta}.xlsx`);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-4 p-4 sm:p-6 bg-white shadow rounded">
      {/* MODAL DE FOTO */}
      {fotoVista && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow max-w-xl max-h-[90vh]">
            <img src={fotoVista} className="max-h-[80vh] mx-auto rounded" />
            <button
              onClick={() => setFotoVista(null)}
              className="mt-4 w-full bg-red-600 text-white p-2 rounded"
            >
              Cerrar
            </button>
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
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">¿Qué es?</th>
              <th className="p-2 border">Tipo de gasto</th>
              <th className="p-2 border">Urgencia</th>
              <th className="p-2 border">Detalle</th>
              <th className="p-2 border">Monto</th>
              <th className="p-2 border">Personal</th>
              <th className="p-2 border text-center">Aprobado</th>
              <th className="p-2 border">CEO</th>
              <th className="p-2 border text-center">Acción</th>
              <th className="p-2 border text-center">Foto</th>
            </tr>
          </thead>

          <tbody>
            {vistaPagina.map((item) => (
              <tr key={item.id}>
                <td className="p-2 border">
                  {formatearFechaVista(item.created_at)}
                </td>

                <td className="p-2 border">{item.que_es}</td>
                <td className="p-2 border">{item.tipo_gasto}</td>
                <td className="p-2 border">{item.urgencia}</td>
                <td className="p-2 border">{item.detalle_adicional ?? "-"}</td>
                <td className="p-2 border">{item.monto_total_estimado}</td>
                <td className="p-2 border">{item.vendedor_nombre ?? "-"}</td>

                <td className="p-2 border text-center">
                  {item.aprobado ? (
                    <span className="text-green-600 font-bold">✔</span>
                  ) : (
                    <span className="text-red-600 font-bold">✘</span>
                  )}
                </td>

                <td className="p-2 border">{item.supervisor_nombre ?? "-"}</td>

                {/* ACCIÓN: SOLO ADMIN */}
                <td className="p-2 border text-center">
                  {user?.role === "admin" ? (
                    <button
                      disabled={loading}
                      onClick={() => toggleAprobado(item)}
                      className={`px-3 py-1 rounded text-white ${
                        item.aprobado ? "bg-gray-600" : "bg-green-600"
                      }`}
                    >
                      {item.aprobado ? "Desaprobar" : "Aprobar"}
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* FOTO */}
                <td className="p-2 border text-center">
                  {item.foto_url ? (
                    <button
                      onClick={() => setFotoVista(item.foto_url!)}
                      className="px-3 py-1 bg-blue-600 text-white rounded"
                    >
                      Ver Foto
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}

            {vistaPagina.length === 0 && (
              <tr>
                <td colSpan={11} className="p-4 text-center text-gray-500">
                  No hay registros dentro del rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN SOLO FLECHAS */}
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
