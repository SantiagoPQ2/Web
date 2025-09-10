import React, { useState } from "react"
import TuDia from "../components/TuDia"
import Quiz from "../components/Quiz"
import ClientesDelDia from "../components/ClientesDelDia"

export default function Informacion() {
  const [selected, setSelected] = useState<"tudia" | "quiz" | "clientes">("tudia")

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Información</h1>
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setSelected("tudia")}
          className={`px-4 py-2 rounded ${selected === "tudia" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
        >
          Tu Día
        </button>
        <button
          onClick={() => setSelected("quiz")}
          className={`px-4 py-2 rounded ${selected === "quiz" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
        >
          Quiz
        </button>
        <button
          onClick={() => setSelected("clientes")}
          className={`px-4 py-2 rounded ${selected === "clientes" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
        >
          Clientes del Día
        </button>
      </div>

      {selected === "tudia" && <TuDia />}
      {selected === "quiz" && <Quiz />}
      {selected === "clientes" && <ClientesDelDia />}
    </div>
  )
}
