import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Top5Row {
  cliente: string;
  vendedor_username: string;
  dia: string;
  diferencia: number;
  categoria: string;
}

const TuDia: React.FC = () => {
  const [registros, setRegistros] = useState<Top5Row[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Detectar día actual en formato "DOM, LUN, MAR..."
  const today = new Date()
    .toLocaleDateString("es-AR", { weekday: "short" })
    .toUpperCase()
    .slice(0, 3);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const user = JSON.parse(localStorage.getItem("user") || "{}");

      if (!user || !user.username) {
        setRegistros([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("top_5")
        .select("*")
        .eq("vendedor_username", user.username.toString())
        .eq("dia", today);

      if (error) {
        console.error("❌ Error cargando Top 5:", error.message);
        setRegistros([]);
      } else {
        setRegistros(data || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [today]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Tu Top 5 del día ({today})
      </h2>

      {loading ? (
        <p className="text-gray-600">⏳ Cargando...</p>
      ) : registros.length === 0 ? (
        <p className="text-gray-600">
          Hoy no tenés clientes asignados en Top 5
        </p>
      ) : (
        <ul className="space-y-4">
          {registros.map((r, idx) => (
            <li
              key={idx}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <p className="text-gray-800">
                <span className="font-semibold">Cliente:</span> {r.cliente}
              </p>
              <p className="text-gray-800">
                <span className="font-semibold">Diferencia:</span>{" "}
                {r.diferencia.toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-gray-800">
                <span className="font-semibold">Categoría a atacar:</span>{" "}
                {r.categoria}
              </p>
              <p className="mt-2 text-red-700 font-medium">
                👉 Tenés que visitar al cliente {r.cliente}, la diferencia para
                recuperar es de {r.diferencia.toFixed(2)} y la categoría a
                atacar es {r.categoria}.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TuDia;
