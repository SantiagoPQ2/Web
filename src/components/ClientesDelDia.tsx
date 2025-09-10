import React from "react"

const clientes = [
  { nombre: "Cliente 1", direccion: "Av. Siempre Viva 123", visita: "Mañana" },
  { nombre: "Cliente 2", direccion: "Calle Falsa 456", visita: "Tarde" }
]

export default function ClientesDelDia() {
  return (
    <div className="p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-2">Clientes del Día</h2>
      <ul className="space-y-2">
        {clientes.map((c, i) => (
          <li key={i} className="border-b pb-2">
            <p className="font-medium">{c.nombre}</p>
            <p className="text-sm text-gray-600">{c.direccion}</p>
            <p className="text-sm">Visita: {c.visita}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
