import { useState } from "react"
import { supabase } from "../config/supabase"

export default function GpsLogger() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pointName, setPointName] = useState("")
  const [log, setLog] = useState<{ name: string; lat: number; lng: number }[]>([])

  const savePoint = () => {
    if (!navigator.geolocation) {
      alert("❌ Tu navegador no soporta geolocalización")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })

        if (pointName.trim() === "") {
          alert("⚠️ Primero ingresa un nombre para el punto")
          return
        }

        const newPoint = { name: pointName, lat: latitude, lng: longitude }
        setLog([...log, newPoint])
        setPointName("")

        // Guardar en Supabase
        const { error } = await supabase
          .from("coordenadas")
          .insert([{ nombre: newPoint.name, lat: newPoint.lat, lng: newPoint.lng }])

        if (error) console.error("❌ Error guardando coordenada:", error.message)
        else console.log("✅ Coordenada guardada en Supabase:", newPoint)
      },
      (err) => {
        console.error(err)
        alert("❌ Error obteniendo ubicación: " + err.message)
      }
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded space-y-4">
      <h2 className="text-xl font-bold">📍 GPS Logger</h2>

      <input
        type="text"
        placeholder="Nombre del punto"
        value={pointName}
        onChange={(e) => setPointName(e.target.value)}
        className="border p-2 w-full rounded"
      />

      <button
        onClick={savePoint}
        className="bg-red-700 text-white px-4 py-2 rounded w-full"
      >
        Guardar punto actual
      </button>

      {coords && (
        <p className="text-gray-700">
          Última posición: <br />
          <b>X:</b> {coords.lat} <br />
          <b>Y:</b> {coords.lng}
        </p>
      )}

      {log.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Puntos guardados:</h3>
          <ul className="list-disc pl-5">
            {log.map((p, i) => (
              <li key={i}>
                <b>{p.name}</b> → ({p.lat.toFixed(6)}, {p.lng.toFixed(6)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
