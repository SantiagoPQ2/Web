import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Agenda {
  supervisor: string;
  empleado: string;
  dia: string;
  modo: string;
}

const SupervisorPage: React.FC = () => {
  const [salidas, setSalidas] = useState<Agenda[]>([]);
  const [vespertinas, setVespertinas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);

  // Día actual abreviado en español (LUN, MAR, MIE, etc.)
  const today = new Date()
    .toLocaleDateString("es-AR", { weekday: "short" })
    .toUpperCase()
    .slice(0, 3);

  useEffect(() => {
    const fetchAgenda = async () => {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user?.username) return;

      const { data, error } = await supabase
        .from("supervisor_agenda")
        .select("*")
        .eq("supervisor", user.username)
        .eq("dia", today);

      if (error) {
        console.error("❌ Error cargando agenda:", error.message);
        setSalidas([]);
        setVespertinas([]);
      } else {
        // Separar por tipo de actividad
        const salidasData = data?.filter((r) => r.modo.toLowerCase() === "salida") || [];
        const vespertinasData = data?.filter((r) => r.modo.toLowerCase() === "vespertina") || [];
        setSalidas(salidasData);
        setVespertinas(vespertinasData);
      }
      setLoading(false);
    };

    fetchAgenda();
  }, [today]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🧭 Agenda del día ({today})
      </h2>

      {loading ? (
        <p className="text-gray-600">⏳ Cargando agenda...</p>
      ) : (
        <>
          {/* 🚗 SALIDAS */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-2">🚗 Salidas programadas</h3>
            {salidas.length === 0 ? (
              <p className="text-gray-600">No tenés salidas asignadas para hoy.</p>
            ) : (
              <table className="min-w-full border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Empleado</th>
                    <th className="px-4 py-2 text-left">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {salidas.map((item, idx) => (
                    <tr key={idx} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{item.empleado}</td>
                      <td className="px-4 py-2">{item.modo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ☕ REUNIONES VESPERTINAS */}
          <div>
            <h3 className="text-md font-semibold text-gray-800 mb-2">☕ Reuniones vespertinas</h3>
            {vespertinas.length === 0 ? (
              <p className="text-gray-600">No tenés reuniones vespertinas para hoy.</p>
            ) : (
              <table className="min-w-full border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Empleado</th>
                    <th className="px-4 py-2 text-left">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {vespertinas.map((item, idx) => (
                    <tr key={idx} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{item.empleado}</td>
                      <td className="px-4 py-2">{item.modo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SupervisorPage;
