import { useState } from "react"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await login(username, password)
    if (!ok) setError("❌ Usuario o contraseña incorrectos")
    else window.location.href = "/" // redirige al home
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-80 space-y-4"
      >
        <h2 className="text-xl font-bold text-center">🔐 Iniciar Sesión</h2>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded w-full"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded w-full"
        />

        <button
          type="submit"
          className="bg-red-700 text-white px-4 py-2 rounded w-full"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}
