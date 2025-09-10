import React, { useState } from "react"

const preguntas = [
  { id: 1, texto: "¿Cuál es la promoción vigente de hoy?", opciones: ["A", "B", "C"], respuesta: "B" },
  { id: 2, texto: "¿Qué cliente tiene visita obligatoria?", opciones: ["Cliente X", "Cliente Y", "Cliente Z"], respuesta: "Cliente X" }
]

export default function Quiz() {
  const [respuestas, setRespuestas] = useState<{ [key: number]: string }>({})
  const [resultado, setResultado] = useState<string | null>(null)

  const handleChange = (id: number, opcion: string) => {
    setRespuestas((prev) => ({ ...prev, [id]: opcion }))
  }

  const handleSubmit = () => {
    let correctas = 0
    preguntas.forEach((p) => {
      if (respuestas[p.id] === p.respuesta) correctas++
    })
    setResultado(`Respondiste ${correctas} de ${preguntas.length} correctamente`)
  }

  return (
    <div className="p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-4">Quiz Rápido</h2>
      {preguntas.map((p) => (
        <div key={p.id} className="mb-4">
          <p className="font-medium">{p.texto}</p>
          <div className="flex gap-2">
            {p.opciones.map((o) => (
              <label key={o} className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`pregunta-${p.id}`}
                  value={o}
                  checked={respuestas[p.id] === o}
                  onChange={() => handleChange(p.id, o)}
                />
                {o}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button onClick={handleSubmit} className="bg-green-500 text-white px-4 py-2 rounded">
        Enviar
      </button>
      {resultado && <p className="mt-4 font-semibold">{resultado}</p>}
    </div>
  )
}
