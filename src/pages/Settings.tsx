import { useEffect, useState } from "react"
import { supabase } from "../config/supabase"
import { useAuth } from "../context/AuthContext"

export default function Settings() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState({ name: "", age: "", phone: "" })
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      const { data } = await supabase
        .from("usuarios_app")
        .select("name, age, phone")
        .eq("id", user.id)
        .single()

      if (data) {
        setProfile({
          name: data.name || "",
          age: data.age?.toString() || "",
          phone: data.phone || "",
        })
      }
    }
    loadProfile()
  }, [user])

  const saveProfile = async () => {
    if (!user) return
    const { error } = await supabase
      .from("usuarios_app")
      .update({
        name: profile.name,
        age: profile.age ? parseInt(profile.age) : null,
        phone: profile.phone,
      })
      .eq("id", user.id)

    if (error) {
      alert("❌ Error al guardar perfil: " + error.message)
    } else {
      alert("✅ Perfil actualizado")
    }
  }

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

  const handleLogout = () => {
    logout()
    window.location.href = "/" // redirige al login
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded shadow space-y-4 mt-6">
      <h2 className="text-xl font-bold">⚙️ Configuración de Usuario</h2>

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

      <button
        onClick={saveProfile}
        className="bg-red-700 text-white px-4 py-2 rounded w-full"
      >
        Guardar
      </button>

      <hr className="my-4" />

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
