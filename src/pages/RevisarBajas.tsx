import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface BajaItem {
  id: string;
  cliente: string;
  razon_social: string;
  motivo: string;
  detalle: string;
  vendedor_username: string;
  aprobado: boolean;
  aprobado_por: string | null;
  aprobado_fecha: string | null;
  created_at: string;
}

const RevisarBajas: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<BajaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [filtroFecha, setFiltroFecha] = useState<string>("");

  const cargar = async () => {
    const { data } = await supabase
      .from("bajas_cambio_ruta")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setItems(data as BajaItem[]);
  };

  const aprobar = async (id: string) => {
    if (!user) return;
    if (user.role !== "supervisor" && user.role !== "admin") {
      alert("No autorizado.");
      return;
    }

    setLoading(true);

    await supabase
      .from("bajas_cambio_ruta")
      .update({
        aprobado: true,
        aprobado_por: user.username,
        aprobado_fecha: new Date().toISOString(),
      })
      .eq("id", id);

    setLoading(false);
    cargar();
  };

  const formatearFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR");
  };

  const filtrados = filtroFecha
    ? items.filter((i) => formatearFecha(i.created_at) === filtroFecha)
    : items;

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-8 p-6 bg-white dark:bg-gray-900 shadow rounded">
      <h2 className="text-2xl font-semibold mb-4">Revisión de Bajas / Cambios de Ruta</h2>

      {/* FILTRO POR FECHA */}
      <div className="mb-4">
        <label className="text-sm font-medium">Filtrar por fecha:</label>
        <input
          type="date"
          className="ml-2 p-2 border rounded dark:bg-gray-800"
          onChange={(e) => setFiltroFecha(e.target.value)}
        />
      </div>

      {/* TABLA */}
      <table className="w-full border-collapse">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="p-2 border">Fecha</th>
            <th className="p-2 border">Cliente</th>
            <th className="p-2 border">Razón Social</th>
            <th className="p-2 border">Motivo</th>
            <th className="p-2 border">Detalle</th>
            <th className="p-2 border">Vendedor</th>
            <th className="p-2 border">Aprobado</th>
            <th className="p-2 border">Supervisor</th>
            <th className="p-2 border">Acción</th>
          </tr>
        </thead>

        <tbody>
          {filtrados.map((item) => (
            <tr key={item.id} className="text-center">
              <td className="p-2 border">{formatearFecha(item.created_at)}</td>
              <td className="p-2 border">{item.cliente}</td>
              <td className="p-2 border">{item.razon_social}</td>
              <td className="p-2 border">{item.motivo}</td>
              <td className="p-2 border">{item.detalle}</td>
              <td className="p-2 border">{item.vendedor_username}</td>

              {/* APROBADO ICONO */}
              <td className="p-2 border">
                {item.aprobado ? (
                  <span className="text-green-600 font-bold text-lg">✔</span>
                ) : (
                  <span className="text-red-600 font-bold text-lg">✘</span>
                )}
              </td>

              {/* SUPERVISOR */}
              <td className="p-2 border">
                {item.aprobado ? item.aprobado_por : "-"}
              </td>

              {/* BOTÓN APROBAR */}
              <td className="p-2 border">
                {!item.aprobado &&
                  (user?.role === "supervisor" || user?.role === "admin") && (
                    <button
                      disabled={loading}
                      onClick={() => aprobar(item.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      Aprobar
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RevisarBajas;
