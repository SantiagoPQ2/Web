import { useState } from "react"
import { supabase } from "../config/supabase"
import { useAuth } from "../context/AuthContext"

export default function GpsLogger() {
  const { user } = useAuth()
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pointName, setPointName] = useState("")
  const [log, setLog] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [loading, setLoading] = useState(false)

  const savePoint = async () => {
    if (loading) return
    setLoading(true)

    if (!navigator.geolocation) {
      alert("❌ Tu navegador no soporta geolocalización")
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })

        if (pointName.trim() === "") {
          alert("⚠️ Primero ingresa un nombre para el punto")
          setLoading(false)
          return
        }

        const newPoint = { name: pointName.trim(), lat: latitude, lng: longitude }
        setLog((prev) => [...prev, newPoint])
        setPointName("")

        try {
          const { error } = await supabase
            .from("coordenadas")
            .insert([{
              nombre: newPoint.name,
              lat: newPoint.lat,
              lng: newPoint.lng,
              created_by: user?.id
            }])

          if (error) {
            console.error("❌ Error guardando coordenada:", error.message)
            alert("❌ Error guardando coordenada: " + error.message)
          } else {
            console.log("✅ Coordenada guardada en Supabase:", newPoint, "por", user?.username)
          }
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        console.error(err)
        alert("❌ Error obteniendo ubicación: " + err.message)
        setLoading(false)
      }
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow rounded space-y-4 transition-colors duration-300">
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
        disabled={loading}
        className={`px-4 py-2 rounded w-full ${
          loading ? "bg-gray-400 cursor-not-allowed" : "bg-red-700 text-white"
        }`}
      >
        {loading ? "⏳ Guardando..." : "Guardar punto actual"}
      </button>

      {coords && (
        <p>
          Última posición: <br />
          <b>X:</b> {coords.lat} <br />
          <b>Y:</b> {coords.lng}
        </p>
      )}

      {log.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Puntos guardados (locales):</h3>
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
