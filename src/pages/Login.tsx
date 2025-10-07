import { useState } from "react"
import { supabase } from "../config/supabase"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [mail, setMail] = useState("")
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"login" | "recover" | "success">("login")

  // 🔹 Iniciar sesión normal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await login(username, password)
    if (!ok) setError("❌ Usuario o contraseña incorrectos")
    else window.location.href = "/" // redirige al home
  }

  // 🔹 Recuperar contraseña (simulado por ahora)
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mail) {
      setError("⚠️ Ingresá tu correo para recuperar la contraseña")
      return
    }

    const { data, error } = await supabase
      .from("usuarios_app")
      .select("username, mail")
      .eq("mail", mail)
      .single()

    if (error || !data) {
      setError("❌ No se encontró una cuenta con ese correo")
    } else {
      // acá podrías integrar Supabase Auth o SendGrid
      setMode("success")
      setError("")
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-200 to-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-xl w-96 border-t-8 border-[#8B0000] transition-all hover:scale-[1.01] duration-300">
        <div className="text-center mb-6">
          <img
            src="/image.png"
            alt="VaFood Logo"
            className="mx-auto h-16 w-16 rounded-full shadow-lg"
          />
          <h2 className="text-2xl font-bold text-[#8B0000] mt-3">
            {mode === "login"
              ? "Iniciar Sesión"
              : mode === "recover"
              ? "Recuperar Contraseña"
              : "Correo Enviado"}
          </h2>
          <p className="text-gray-600 text-sm">
            {mode === "success"
              ? "Revisá tu bandeja de entrada"
              : "Sistema de consulta de clientes"}
          </p>
        </div>

        {/* 🔸 LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[#8B0000] outline-none"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[#8B0000] outline-none"
            />

            <button
              type="submit"
              className="w-full bg-[#8B0000] text-white py-2 rounded-lg font-semibold hover:bg-red-900 transition"
            >
              Entrar
            </button>

            <p className="text-center text-sm text-gray-700 mt-3">
              ¿Olvidaste tu contraseña?{" "}
              <button
                type="button"
                className="text-[#8B0000] font-semibold hover:underline"
                onClick={() => {
                  setMode("recover")
                  setError("")
                }}
              >
                Recuperar
              </button>
            </p>
          </form>
        )}

        {/* 🔸 RECUPERAR CONTRASEÑA */}
        {mode === "recover" && (
          <form onSubmit={handleRecover} className="space-y-4">
            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <input
              type="email"
              placeholder="Correo electrónico"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[#8B0000] outline-none"
            />

            <button
              type="submit"
              className="w-full bg-[#8B0000] text-white py-2 rounded-lg font-semibold hover:bg-red-900 transition"
            >
              Enviar correo de recuperación
            </button>

            <p className="text-center text-sm text-gray-700 mt-3">
              ¿Recordaste tu contraseña?{" "}
              <button
                type="button"
                className="text-[#8B0000] font-semibold hover:underline"
                onClick={() => setMode("login")}
              >
                Volver a iniciar sesión
              </button>
            </p>
          </form>
        )}

        {/* 🔸 CONFIRMACIÓN DE ENVÍO */}
        {mode === "success" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-20 w-20 text-[#8B0000]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m0 8V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-[#8B0000]">
              ¡Correo de recuperación enviado!
            </h2>
            <p className="text-gray-600 text-sm">
              Te enviamos un correo con las instrucciones para restablecer tu
              contraseña. Revisa tu bandeja de entrada o la carpeta de spam.
            </p>

            <button
              onClick={() => {
                setMode("login")
                setMail("")
              }}
              className="w-full bg-[#8B0000] text-white py-2 rounded-lg font-semibold hover:bg-red-900 transition mt-4"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

