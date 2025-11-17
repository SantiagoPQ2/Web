import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface BajaItem {
  id: string;
  cliente: string;
  razon_social: string;
  motivo: string;
  detalle: string;
  vendedor_nombre: string | null;
  aprobado: boolean;
  supervisor_nombre: string | null;
  created_at: string;
}

const RevisarBajas: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BajaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState<string>("");

  const cargar = async () => {
    const { data, error } = await supabase
      .from("bajas_cambio_ruta")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setItems((data || []) as BajaItem[]);
  };

  const formatearFechaVista = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR");
  };

  const formatearFechaIso = (iso: string) => {
    return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const filtrados = filtroFecha
    ? items.filter((i) => formatearFechaIso(i.created_at) === filtroFecha)
    : items;

  const toggleAprobado = async (item: BajaItem) => {
    if (!user) return;
    if (user.role !== "supervisor" && user.role !== "admin") {
      alert("Solo los supervisores o admin pueden aprobar.");
      return;
    }

    const nuevoValor = !item.aprobado;
    setLoading(true);

    const { error } = await supabase
      .from("bajas_cambio_ruta")
      .update({
        aprobado: nuevoValor,
        supervisor_nombre: nuevoValor ? user.name ?? user.username : null,
      })
      .eq("id", item.id);

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Error al actualizar la línea");
      return;
    }

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
    if (filtrados.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const dataExport = filtrados.map((i) => ({
      Fecha: formatearFechaVista(i.created_at),
      Cliente: i.cliente,
      "Razón Social": i.razon_social,
      Motivo: i.motivo,
      Detalle: i.detalle,
      Vendedor: i.vendedor_nombre ?? "",
      Aprobado: i.aprobado ? "Sí" : "No",
      Supervisor: i.supervisor_nombre ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bajas");

    const nombreArchivo = `bajas_cambio_ruta${
      filtroFecha ? "_" + filtroFecha : ""
    }.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-4 p-4 sm:p-6 bg-white dark:bg-gray-900 shadow rounded">
      {/* HEADER: responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold">
          Revisión de Bajas / Cambios de Ruta
        </h2>

        <button
          onClick={exportarExcel}
          className="self-start sm:self-auto px-4 py-2 text-sm font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Exportar XLSX
        </button>
      </div>

      {/* FILTRO POR FECHA */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Filtrar por fecha:</span>
        <input
          type="date"
          className="p-2 border rounded dark:bg-gray-800 text-sm"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
        />
        {filtroFecha && (
          <button
            className="text-xs text-blue-600 underline"
            onClick={() => setFiltroFecha("")}
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* TABLA RESPONSIVE (scroll horizontal en mobile) */}
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Fecha
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Cliente
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Razón Social
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Motivo
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Detalle
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Vendedor
              </th>
              <th className="p-2 sm:p-3 border text-center text-xs sm:text-sm">
                Aprobado
              </th>
              <th className="p-2 sm:p-3 border text-left text-xs sm:text-sm">
                Supervisor
              </th>
              <th className="p-2 sm:p-3 border text-center text-xs sm:text-sm">
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item) => (
              <tr key={item.id} className="text-xs sm:text-sm">
                <td className="p-2 sm:p-3 border">
                  {formatearFechaVista(item.created_at)}
                </td>
                <td className="p-2 sm:p-3 border">{item.cliente}</td>
                <td className="p-2 sm:p-3 border">{item.razon_social}</td>
                <td className="p-2 sm:p-3 border">{item.motivo}</td>
                <td className="p-2 sm:p-3 border">{item.detalle}</td>
                <td className="p-2 sm:p-3 border">{item.vendedor_nombre}</td>

                <td className="p-2 sm:p-3 border text-center">
                  {item.aprobado ? (
                    <span className="text-green-600 font-bold text-lg">✔</span>
                  ) : (
                    <span className="text-red-600 font-bold text-lg">✘</span>
                  )}
                </td>

                <td className="p-2 sm:p-3 border">
                  {item.supervisor_nombre ? item.supervisor_nombre : "-"}
                </td>

                <td className="p-2 sm:p-3 border text-center">
                  {(user?.role === "supervisor" || user?.role === "admin") && (
                    <button
                      disabled={loading}
                      onClick={() => toggleAprobado(item)}
                      className={`px-2 sm:px-3 py-1 rounded text-white text-xs ${
                        item.aprobado
                          ? "bg-gray-500 hover:bg-gray-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {item.aprobado ? "Desaprobar" : "Aprobar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-4 text-center text-gray-500 text-xs sm:text-sm"
                >
                  No hay registros para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RevisarBajas;
