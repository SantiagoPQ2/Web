import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Pregunta {
  id: string;
  texto: string;
  opciones: string[];
  correctas: string[]; // ahora soporta múltiples correctas
}

const Quiz: React.FC = () => {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [evaluado, setEvaluado] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const loadPreguntas = async () => {
      setLoading(true);

      const hoy = new Date()
        .toLocaleDateString("es-ES", { weekday: "short" })
        .toUpperCase()
        .slice(0, 3);

      // 🔹 Traigo top 5 del día
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

      // 🔹 Pregunta principal con 5 correctos y 5 incorrectos
      const clientesHoy = top5.map((c) => String(c.cliente));

      const { data: otrosClientes } = await supabase
        .from("top_5")
        .select("cliente")
        .neq("vendedor_username", currentUser.username)
        .limit(50);

      const incorrectos = otrosClientes
        ?.map((c) => String(c.cliente))
        .filter((c) => !clientesHoy.includes(c))
        .slice(0, 5) || [];

      const opcionesClientes = [...clientesHoy, ...incorrectos].sort(
        () => Math.random() - 0.5
      );

      const preguntasGen: Pregunta[] = [
        {
          id: "q1",
          texto: "¿Qué clientes debes visitar hoy?",
          opciones: opcionesClientes,
          correctas: clientesHoy,
        },
      ];

      // 🔹 Dos preguntas extra sobre categorías
      const elegidos = top5.sort(() => Math.random() - 0.5).slice(0, 2);

      for (let i = 0; i < elegidos.length; i++) {
        const cliente = elegidos[i];
        const categorias = [
          "QUESOS Y FIAMBRES",
          "HAMBURGUESAS",
          "REBOZADOS",
          "SALCHICHAS",
          cliente.categoria,
        ];
        const opciones = [...new Set(categorias)].sort(
          () => Math.random() - 0.5
        );

        preguntasGen.push({
          id: `cat-${cliente.cliente}`,
          texto: `¿Qué categoría debes ofrecerle al cliente ${cliente.cliente}?`,
          opciones,
          correctas: [cliente.categoria],
        });
      }

      setPreguntas(preguntasGen);
      setLoading(false);
    };

    loadPreguntas();
  }, []);

  const toggleOpcion = (preguntaId: string, opcion: string) => {
    setSelected((prev) => {
      const current = prev[preguntaId] || [];
      if (current.includes(opcion)) {
        return { ...prev, [preguntaId]: current.filter((x) => x !== opcion) };
      } else {
        return { ...prev, [preguntaId]: [...current, opcion] };
      }
    });
  };

  const enviarRespuestas = async () => {
    setEvaluado(true);

    for (const p of preguntas) {
      const seleccionadas = selected[p.id] || [];
      const correctas = p.correctas;

      const esCorrecta =
        seleccionadas.length === correctas.length &&
        seleccionadas.every((s) => correctas.includes(s));

      await supabase.from("quiz_respuestas").insert([
        {
          vendedor_username: currentUser.username,
          pregunta: p.texto,
          respondida: true,
          correcta: esCorrecta,
        },
      ]);
    }
  };

  if (loading) return <p>Cargando preguntas...</p>;

  return (
    <div className="space-y-6">
      {preguntas.map((p) => (
        <div key={p.id} className="bg-white shadow p-4 rounded-lg">
          <h3 className="font-semibold mb-2">{p.texto}</h3>
          <div className="space-y-2">
            {p.opciones.map((op) => {
              const checked = selected[p.id]?.includes(op) || false;
              const esCorrecta = p.correctas.includes(op);

              return (
                <label
                  key={op}
                  className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${
                    evaluado
                      ? checked && esCorrecta
                        ? "bg-green-100 border-green-400"
                        : checked && !esCorrecta
                        ? "bg-red-100 border-red-400"
                        : "bg-gray-50"
                      : "bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={evaluado}
                    onChange={() => toggleOpcion(p.id, op)}
                    className="form-checkbox h-4 w-4 text-red-600"
                  />
                  <span>{op}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {!evaluado && (
        <button
          onClick={enviarRespuestas}
          className="w-full bg-red-600 text-white py-2 px-4 rounded mt-4"
        >
          Enviar respuestas
        </button>
      )}
    </div>
  );
};

export default Quiz;
