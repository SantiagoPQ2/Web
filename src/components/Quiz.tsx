import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Pregunta {
  id: string;
  texto: string;
  opciones: string[];
  correcta: string;
}

const Quiz: React.FC = () => {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const loadPreguntas = async () => {
      setLoading(true);

      const hoy = new Date().toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().slice(0, 3);

      // Traigo top 5 del día
      const { data: top5 } = await supabase
        .from("top_5")
        .select("cliente, categoria")
        .eq("vendedor_username", currentUser.username)
        .eq("dia", hoy);

      if (!top5 || top5.length === 0) {
        setPreguntas([]);
        setLoading(false);
        return;
      }

      // Pregunta principal
      const clientesHoy = top5.map(c => String(c.cliente));
      const { data: otrosClientes } = await supabase
        .from("top_5")
        .select("cliente")
        .neq("vendedor_username", currentUser.username)
        .limit(50);

      const opcionesClientes = [
        ...clientesHoy,
        ...(otrosClientes?.map(c => String(c.cliente)).slice(0, 5) || [])
      ].sort(() => Math.random() - 0.5);

      const preguntasGen: Pregunta[] = [
        {
          id: "q1",
          texto: "¿Qué clientes debes visitar hoy?",
          opciones: opcionesClientes,
          correcta: clientesHoy.join(",")
        }
      ];

      // Dos preguntas extra sobre categorías
      const elegidos = top5.sort(() => Math.random() - 0.5).slice(0, 2);

      for (let i = 0; i < elegidos.length; i++) {
        const cliente = elegidos[i];
        const categorias = ["QUESOS Y FIAMBRES", "HAMBURGUESAS", "REBOZADOS", "SALCHICHAS", cliente.categoria];
        const opciones = [...new Set(categorias)].sort(() => Math.random() - 0.5);

        preguntasGen.push({
          id: `cat-${cliente.cliente}`,
          texto: `¿Qué categoría debes ofrecerle al cliente ${cliente.cliente}?`,
          opciones,
          correcta: cliente.categoria
        });
      }

      setPreguntas(preguntasGen);
      setLoading(false);
    };

    loadPreguntas();
  }, []);

  const handleRespuesta = async (pregunta: Pregunta, opcion: string) => {
    const esCorrecta =
      pregunta.id === "q1"
        ? pregunta.correcta.split(",").includes(opcion)
        : opcion === pregunta.correcta;

    setRespuestas({ ...respuestas, [pregunta.id]: opcion });

    await supabase.from("quiz_respuestas").insert([
      {
        vendedor_username: currentUser.username,
        pregunta: pregunta.texto,
        respondida: true,
        correcta: esCorrecta
      }
    ]);
  };

  if (loading) return <p>Cargando preguntas...</p>;

  return (
    <div className="space-y-6">
      {preguntas.map((p) => (
        <div key={p.id} className="bg-white shadow p-4 rounded-lg">
          <h3 className="font-semibold mb-2">{p.texto}</h3>
          <div className="space-y-2">
            {p.opciones.map((op) => (
              <button
                key={op}
                className={`w-full p-2 rounded border ${
                  respuestas[p.id] === op
                    ? op === p.correcta
                      ? "bg-green-200 border-green-500"
                      : "bg-red-200 border-red-500"
                    : "bg-gray-50"
                }`}
                disabled={!!respuestas[p.id]}
                onClick={() => handleRespuesta(p, op)}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Quiz;
