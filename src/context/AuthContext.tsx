import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../config/supabase";

type User =
  | {
      id: string;
      username?: string;
      name?: string;
      phone?: string;
      role: string;
      cliente_codigo?: string;
      razon_social?: string;
    }
  | null;

type AuthContextType = {
  user: User;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = async (username: string, password: string) => {
    // ========================================================
    // 1) LOGIN USUARIOS INTERNOS (admin, supervisor, vendedor)
    // ========================================================
    const { data: interno } = await supabase
      .from("usuarios_app")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (interno) {
      const u: User = {
        id: interno.id,
        username: interno.username,
        name: interno.name,
        phone: interno.phone,
        role: interno.role,
      };

      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
      return true;
    }

    // ========================================================
    // 2) LOGIN CLIENTES (usuario = cliente_codigo)
    // ========================================================
    const { data: cliente } = await supabase
      .from("clientes_app")
      .select("*")
      .eq("cliente_codigo", username) // ← username = codigo de cliente
      .eq("password", password)
      .single();

    if (cliente) {
      const u: User = {
        id: cliente.id,
        role: "cliente",
        cliente_codigo: cliente.cliente_codigo,
        razon_social: cliente.razon_social,
        phone: cliente.phone,
      };

      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
      return true;
    }

    // ========================================================
    // 3) LOGIN FALLIDO
    // ========================================================
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
