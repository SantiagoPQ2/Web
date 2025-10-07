import { useEffect, useState } from "react"
import { supabase } from "../config/supabase"
import { useAuth } from "../context/AuthContext"

export default function Settings() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState({ name: "", age: "", phone: "", mail: "" })
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // 🔹 Cargar perfil desde Supabase
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("name, age, phone, mail")
        .eq("id", user.id)
        .single()

      if (error) {
        console.error("❌ Error cargando perfil:", error.message)
        return
      }

      if (data) {
        setProfile({
          name: data.name || "",
          age: data.age?.toString() || "",
          phone: data.phone || "",
          mail: data.mail || "",
        })
      }
    }

    loadProfile()
  }, [user])

  // 🔹 Guardar perfil actualizado
  const saveProfile = async () => {
    if (!user) return

    const { error } = await supabase
      .from("usuarios_app")
      .update({
        name: profile.name,
        age: profile.age ? parseInt(profile.age) : null,
        phone: profile.phone,
        mail: profile.mail,
      })
      .eq("id", user.id)

    if (error) {
      alert("❌ Error al guardar perfil: " + error.message)
    } else {
      alert("✅ Perfil actualizado correctamente")
    }
  }

  // 🔹 Cambiar contraseña
  const changePassword = async () => {
    if (!user) return
    if (!newPassword || !confirmPassword) {
      alert("⚠️ Completa ambos campos de contraseña")
      return
    }
    if (newPassword !== confirmPassword) {
      alert("⚠️ Las contraseñas no coinciden")
      return
    }

    const { error } = await supabase
      .from("usuarios_app")
      .update({ password: newPassword })
      .eq("id", user.id)

    if (error) {
      alert("❌ Error al cambiar contraseña: " + error.message)
    } else {
      alert("✅ Contraseña actualizada correctamente")
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  // 🔹 Cerrar sesión
  const handleLogout = () => {
    logout()
    window.location.href = "/" // Redirige al login
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded shadow space-y-4 mt-6">
      <h2 className="text-xl font-bold">⚙️ Configuración de Usuario</h2>

      {/* Info básica */}
      <input
        placeholder="Nombre"
        value={profile.name}
        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        className="border p-2 w-full rounded"
      />
      <input
        placeholder="Edad"
        value={profile.age}
        onChange={(e) => setProfile({ ...profile, age: e.target.value })}
        className="border p-2 w-full rounded"
      />
      <input
        placeholder="Teléfono"
        value={profile.phone}
        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        className="border p-2 w-full rounded"
      />
      <input
        placeholder="Correo electrónico"
        type="email"
        value={profile.mail}
        onChange={(e) => setProfile({ ...profile, mail: e.target.value })}
        className="border p-2 w-full rounded"
      />

      <button
        onClick={saveProfile}
        className="bg-red-700 text-white px-4 py-2 rounded w-full"
      >
        Guardar perfil
      </button>

      <hr className="my-4" />

      {/* Cambio de contraseña */}
      <h3 className="text-lg font-semibold">🔑 Cambiar contraseña</h3>
      <input
        type="password"
        placeholder="Nueva contraseña"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="border p-2 w-full rounded"
      />
      <input
        type="password"
        placeholder="Confirmar nueva contraseña"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="border p-2 w-full rounded"
      />

      <button
        onClick={changePassword}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Cambiar contraseña
      </button>

      <button
        onClick={handleLogout}
        className="bg-gray-600 text-white px-4 py-2 rounded w-full mt-2"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
