import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Top5Row {
  cliente: string;
  vendedor_username: string;
  dia: string;
  diferencia: number;
  categoria: string;
}

interface DesarrolloRow {
  id: string; // este ID se vincula con usuarios_app.username
  categoria: string;
  a_evaluar: string;
  objetivo: number;
  avance: number;
  diferencia: number;
}

const TuDia: React.FC = () => {
  const [registros, setRegistros] = useState<Top5Row[]>([]);
  const [desarrollos, setDesarrollos] = useState<DesarrolloRow[]>([]);
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
        setDesarrollos([]);
        setLoading(false);
        return;
      }

      // 1. Top 5 del día
      const { data: top5, error: top5Error } = await supabase
        .from("top_5")
        .select("*")
        .eq("vendedor_username", user.username.toString())
        .eq("dia", today);

      if (top5Error) {
        console.error("❌ Error cargando Top 5:", top5Error.message);
        setRegistros([]);
      } else {
        setRegistros(top5 || []);
      }

      // 2. Desarrollos y Llaves del mes
      const { data: devs, error: devError } = await supabase
        .from("desarrollos")
        .select("categoria, a_evaluar, objetivo, avance, diferencia")
        .eq("id", user.username.toString());

      if (devError) {
        console.error("❌ Error cargando Desarrollos:", devError.message);
        setDesarrollos([]);
      } else {
        setDesarrollos(devs || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [today]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Tu Día ({today})
      </h2>

      {loading ? (
        <p className="text-gray-600">⏳ Cargando...</p>
      ) : (
        <>
          {/* TOP 5 */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-2">
              🔝 Tu Top 5 de clientes
            </h3>
            {registros.length === 0 ? (
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
                      <span className="font-semibold">Cliente:</span>{" "}
                      {r.cliente}
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
                      <span className="font-semibold">
                        Categoría a atacar:
                      </span>{" "}
                      {r.categoria}
                    </p>
                    <p className="mt-2 text-red-700 font-medium">
                      👉 Tenés que visitar al cliente {r.cliente}, la diferencia
                      para recuperar es de {r.diferencia.toFixed(2)} y la
                      categoría a atacar es {r.categoria}.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* DESARROLLOS */}
          <div>
            <h3 className="text-md font-semibold text-gray-800 mb-2">
              📊 Llaves & Desarrollos
            </h3>
            {desarrollos.length === 0 ? (
              <p className="text-gray-600">
                No tenés llaves ni desarrollos cargados para este mes
              </p>
            ) : (
              <ul className="space-y-4">
                {desarrollos.map((d, idx) => (
                  <li
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <p className="text-gray-800">
                      <span className="font-semibold">
                        {d.a_evaluar.toUpperCase()}:
                      </span>{" "}
                      {d.categoria}
                    </p>
                    <p className="text-gray-800">
                      <span className="font-semibold">Objetivo:</span>{" "}
                      {d.objetivo}
                    </p>
                    <p className="text-gray-800">
                      <span className="font-semibold">Avance:</span>{" "}
                      {d.avance}
                    </p>

                    <p className="mt-2 text-red-700 font-medium">
                      {d.a_evaluar.toLowerCase() === "llave"
                        ? `👉 La LLAVE del mes que es ${d.categoria} te faltan ${d.diferencia} bultos`
                        : `👉 Tu DESARROLLO del mes que es ${d.categoria} te faltan ${d.diferencia} clientes`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TuDia;
