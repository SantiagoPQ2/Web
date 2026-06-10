import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "../config/supabase"

type User = {
  id: string
  username: string
  name?: string
  phone?: string
  role?: string
  FFVV?: string
  ffvv?: string
  supervisor?: string
  avatar_url?: string | null
} | null

type AuthContextType = {
  user: User
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateAvatar: (url: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) setUser(JSON.parse(stored))
  }, [])

  const login = async (username: string, password: string) => {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single()

    if (error || !data) return false

    const u = {
      id: data.id,
      username: data.username,
      name: data.name,
      phone: data.phone,
      role: data.role,
      FFVV: data.FFVV,
      ffvv: data.ffvv,
      supervisor: data.supervisor,
      avatar_url: data.avatar_url ?? null,
    }

    setUser(u)
    localStorage.setItem("user", JSON.stringify(u))
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
  }

  const updateAvatar = (url: string | null) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, avatar_url: url }
      localStorage.setItem("user", JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
