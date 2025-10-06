import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Agenda {
  supervisor: string;
  empleado: string;
  dia: string;
  modo: string;
}

const SupervisorPage: React.FC = () => {
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);

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
        setAgenda([]);
      } else {
        setAgenda(data || []);
      }

      setLoading(false);
    };

    fetchAgenda();
  }, [today]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🧭 Agenda del Día ({today})
      </h2>

      {loading ? (
        <p className="text-gray-600">⏳ Cargando agenda...</p>
      ) : agenda.length === 0 ? (
        <p className="text-gray-600">No tenés actividades asignadas para hoy.</p>
      ) : (
        <table className="min-w-full border border-gray-200 rounded-lg text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Empleado</th>
              <th className="px-4 py-2 text-left">Día</th>
              <th className="px-4 py-2 text-left">Modo</th>
            </tr>
          </thead>
          <tbody>
            {agenda.map((item, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{item.empleado}</td>
                <td className="px-4 py-2">{item.dia}</td>
                <td className="px-4 py-2">{item.modo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SupervisorPage;
