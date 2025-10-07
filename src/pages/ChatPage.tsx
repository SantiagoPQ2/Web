import React, { useEffect, useState } from "react"
import ChatRoom from "../components/ChatRoom"
import { supabase } from "../config/supabase"
import { useAuth } from "../context/AuthContext"

interface Usuario {
  username: string
  role: string
}

const ChatPage: React.FC = () => {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [destino, setDestino] = useState<string>("")

  useEffect(() => {
    const fetchUsuarios = async () => {
      if (!user) return

      let query = supabase.from("usuarios_app").select("username, role")

      // 🔹 Filtramos según el rol
      if (user.role === "vendedor") {
        // Solo mostrar supervisores o admin
        query = query.in("role", ["supervisor", "admin"])
      } else if (user.role === "supervisor") {
        // Mostrar vendedores
        query = query.eq("role", "vendedor")
      } else if (user.role === "logistica") {
        // Mostrar admin o supervisores
        query = query.in("role", ["admin", "supervisor"])
      }

      const { data, error } = await query
      if (!error && data) setUsuarios(data)
    }

    fetchUsuarios()
  }, [user])

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        Chat Interno - Comunicación VaFood
      </h2>

      {/* Selector de destinatario */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Seleccioná con quién querés hablar:
        </label>
        <select
          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-red-500 outline-none"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
        >
          <option value="">-- Elegí un usuario --</option>
          {usuarios.map((u) => (
            <option key={u.username} value={u.username}>
              {u.username} ({u.role})
            </option>
          ))}
        </select>
      </div>

      {/* Sala de chat */}
      {destino ? (
        <ChatRoom destino={destino} />
      ) : (
        <div className="text-gray-500 text-sm mt-4">
          Seleccioná un usuario para iniciar la conversación.
        </div>
      )}
    </div>
  )
}

export default ChatPage
