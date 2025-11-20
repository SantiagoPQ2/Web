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
  estado: string | null;
  foto_url: string | null;
}

const RevisarBajas: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BajaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [fotoVista, setFotoVista] = useState<string | null>(null);

  const cargar = async () => {
    const { data } = await supabase
      .from("bajas_cambio_ruta")
      .select("*")
      .order("created_at", { ascending: false });

    setItems((data || []) as BajaItem[]);
  };

  const formatearFechaVista = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR");

  const formatearFechaIso = (iso: string) =>
    new Date(iso).toISOString().slice(0, 10);

  const siguienteEstado = (estado: string | null) => {
    if (!estado || estado === "pendiente") return "correcto";
    if (estado === "correcto") return "rechazado";
    return "pendiente";
  };

  const filtrados = filtroFecha
    ? items.filter((i) => formatearFechaIso(i.created_at) === filtroFecha)
    : items;

  const toggleEstado = async (item: BajaItem) => {
    if (!user || user.role !== "admin") {
      alert("Solo admin puede cambiar el estado.");
      return;
    }

    const nuevo = siguienteEstado(item.estado);

    setLoading(true);

    await supabase
      .from("bajas_cambio_ruta")
      .update({ estado: nuevo })
      .eq("id", item.id);

    setLoading(false);

    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, estado: nuevo } : x))
    );
  };

  const toggleAprobado = async (item: BajaItem) => {
    if (!user || (user.role !== "supervisor" && user.role !== "admin")) {
      alert("Solo supervisores o admin pueden aprobar.");
      return;
    }

    const nuevoValor = !item.aprobado;

    setLoading(true);

    await supabase
      .from("bajas_cambio_ruta")
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
      Estado: i.estado ?? "pendiente",
      Supervisor: i.supervisor_nombre ?? "",
      Foto: i.foto_url ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bajas");

    XLSX.writeFile(
      wb,
      `bajas_cambio_ruta${filtroFecha ? "_" + filtroFecha : ""}.xlsx`
    );
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-4 p-4 bg-white shadow rounded">

      {/* MODAL FOTO */}
      {fotoVista && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow max-w-lg max-h-[90vh]">
            <img src={fotoVista} className="max-h-[80vh] mx-auto" />
            <button
              onClick={() => setFotoVista(null)}
              className="mt-4 w-full bg-red-600 text-white p-2 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          Revisión de Bajas / Cambios de Ruta
        </h2>

        <button
          onClick={exportarExcel}
          className="px-4 py-2 bg-emerald-600 text-white rounded"
        >
          Exportar XLSX
        </button>
      </div>

      {/* FILTRO */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-medium">Filtrar por fecha:</span>
        <input
          type="date"
          className="p-2 border rounded"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
        />

        {filtroFecha && (
          <button
            onClick={() => setFiltroFecha("")}
            className="text-blue-600 underline text-sm"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Razón Social</th>
              <th className="p-2 border">Motivo</th>
              <th className="p-2 border">Detalle</th>
              <th className="p-2 border">Vendedor</th>
              <th className="p-2 border">Aprobado</th>
              <th className="p-2 border">Supervisor</th>

              {/* → LAS DOS ÚLTIMAS COLUMNAS ← */}
              <th className="p-2 border text-center">Estado</th>
              <th className="p-2 border text-center">Foto</th>

              <th className="p-2 border text-center">Acción</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map((item) => (
              <tr key={item.id}>
                <td className="p-2 border">{formatearFechaVista(item.created_at)}</td>
                <td className="p-2 border">{item.cliente}</td>
                <td className="p-2 border">{item.razon_social}</td>
                <td className="p-2 border">{item.motivo}</td>
                <td className="p-2 border">{item.detalle}</td>
                <td className="p-2 border">{item.vendedor_nombre}</td>

                <td className="p-2 border text-center">
                  {item.aprobado ? (
                    <span className="text-green-600 font-bold">✔</span>
                  ) : (
                    <span className="text-red-600 font-bold">✘</span>
                  )}
                </td>

                <td className="p-2 border">{item.supervisor_nombre ?? "-"}</td>

                {/* ESTADO (últimas columnas) */}
                <td className="p-2 border text-center">
                  {user?.role === "admin" ? (
                    <button
                      onClick={() => toggleEstado(item)}
                      className={`px-3 py-1 rounded text-white ${
                        item.estado === "correcto"
                          ? "bg-green-600"
                          : item.estado === "rechazado"
                          ? "bg-red-900"
                          : "bg-gray-500"
                      }`}
                    >
                      {item.estado}
                    </button>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded text-white ${
                        item.estado === "correcto"
                          ? "bg-green-600"
                          : item.estado === "rechazado"
                          ? "bg-red-900"
                          : "bg-gray-500"
                      }`}
                    >
                      {item.estado}
                    </span>
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

                {/* ACCIÓN */}
                <td className="p-2 border text-center">
                  {(user?.role === "supervisor" || user?.role === "admin") && (
                    <button
                      disabled={loading}
                      onClick={() => toggleAprobado(item)}
                      className={`px-3 py-1 rounded text-white ${
                        item.aprobado ? "bg-gray-600" : "bg-green-600"
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
                <td colSpan={11} className="p-4 text-center text-gray-500">
                  No hay registros.
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
