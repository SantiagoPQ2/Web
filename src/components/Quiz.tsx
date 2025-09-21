import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Pregunta {
  id: string;
  texto: string;
  opciones: string[];
  correctas: string[];
}

const Quiz: React.FC = () => {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [evaluado, setEvaluado] = useState(false);
  const [resultados, setResultados] = useState<Record<string, boolean>>({});
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const loadPreguntas = async () => {
      setLoading(true);

      const hoy = new Date()
        .toLocaleDateString("es-ES", { weekday: "short" })
        .toUpperCase()
        .slice(0, 3);

      // ✅ Traigo top 5 del día
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

      const clientesHoy = top5.map((c) => String(c.cliente));

      // ✅ Traigo clientes para distractores
      const { data: otrosClientes } = await supabase
        .from("top_5")
        .select("cliente")
        .limit(100);

      // ✅ Me aseguro que sean distintos
      const incorrectos = otrosClientes
        ?.map((c) => String(c.cliente))
        .filter((c) => !clientesHoy.includes(c))
        .sort(() => Math.random() - 0.5)
        .slice(0, 5) || [];

      const opcionesClientes = [...clientesHoy, ...incorrectos].sort(
        () => Math.random() - 0.5
      );

      // ✅ Pregunta principal
      const preguntasGen: Pregunta[] = [
        {
          id: "q1",
          texto: "¿Qué clientes debes visitar hoy?",
          opciones: opcionesClientes,
          correctas: clientesHoy,
        },
      ];

      // ✅ Agrego 2 preguntas más de categoría
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
    const nuevosResultados: Record<string, boolean> = {};

    for (const p of preguntas) {
      const seleccionadas = selected[p.id] || [];
      const correctas = p.correctas;

      const esCorrecta =
        seleccionadas.length === correctas.length &&
        seleccionadas.every((s) => correctas.includes(s));

      nuevosResultados[p.id] = esCorrecta;

      await supabase.from("quiz_respuestas").insert([
        {
          vendedor_username: currentUser.username,
          pregunta: p.texto,
          respondida: true,
          correcta: esCorrecta,
        },
      ]);
    }

    setResultados(nuevosResultados);
    setEvaluado(true);
  };

  if (loading) return <p>Cargando preguntas...</p>;

  const total = preguntas.length;
  const correctas = Object.values(resultados).filter((r) => r).length;

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
                        : esCorrecta
                        ? "bg-green-50 border-green-200"
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
          {evaluado && (
            <p className="mt-2 text-sm">
              {resultados[p.id] ? "✅ Correcto" : "❌ Incorrecto"}
            </p>
          )}
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

      {evaluado && (
        <div className="bg-gray-100 p-4 rounded-lg text-center font-semibold">
          Resultado: {correctas} de {total} correctas
        </div>
      )}
    </div>
  );
};

export default Quiz;
