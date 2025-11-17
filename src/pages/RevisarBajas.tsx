import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

export default function RevisarBajas() {
  const [registros, setRegistros] = useState([]);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loadData = async () => {
    const { data, error } = await supabase
      .from("bajas_cambio_ruta")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRegistros(data);
  };

  const handleAprobacion = async (id, aprobado) => {
    if (user.rol !== "supervisor") return alert("Solo los supervisores pueden aprobar registros");
    const { error } = await supabase
      .from("bajas_cambio_ruta")
      .update({ aprobado, supervisor_nombre: user.name })
      .eq("id", id);
    if (!error) loadData();
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Revisión de Bajas / Cambios de Ruta</h2>
      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Razón Social</th>
              <th className="p-2 border">Motivo</th>
              <th className="p-2 border">Detalle</th>
              <th className="p-2 border">Vendedor</th>
              <th className="p-2 border">Aprobado</th>
              <th className="p-2 border">Supervisor</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td className="p-2 border">{r.cliente}</td>
                <td className="p-2 border">{r.razon_social}</td>
                <td className="p-2 border">{r.motivo}</td>
                <td className="p-2 border">{r.detalle}</td>
                <td className="p-2 border">{r.vendedor_nombre}</td>
                <td className="p-2 border text-center">
                  {user.rol === "supervisor" ? (
                    <input
                      type="checkbox"
                      checked={r.aprobado}
                      onChange={(e) => handleAprobacion(r.id, e.target.checked)}
                    />
                  ) : (
                    <span>{r.aprobado ? "✅" : "❌"}</span>
                  )}
                </td>
                <td className="p-2 border">{r.supervisor_nombre || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
