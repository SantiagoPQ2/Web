import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Usuario {
  username: string;
  nombre: string;
  role: string;
  ultimo_mensaje?: string;
}

interface Props {
  onSelect: (username: string) => void;
  destino: string;
  visible: boolean;
  setVisible: (v: boolean) => void;
}

const ChatSidebar: React.FC<Props> = ({ onSelect, destino, visible, setVisible }) => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    cargarUsuarios();
  }, [user]);

  const cargarUsuarios = async () => {
    if (!user) return;

    let query = supabase.from("usuarios_app").select("username, nombre, role");

    if (user.role === "vendedor") query = query.in("role", ["supervisor", "admin"]);
    else if (user.role === "supervisor") query = query.eq("role", "vendedor");
    else query = query.neq("username", user.username);

    const { data } = await query;
    if (!data) return;

    // Traemos último mensaje de cada conversación
    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("remitente_username, destinatario_username, contenido, created_at")
      .order("created_at", { ascending: false });

    const usuariosConMensaje = data.map((u) => {
      const ultimo = mensajes?.find(
        (m) =>
          (m.remitente_username === u.username && m.destinatario_username === user.username) ||
          (m.destinatario_username === u.username && m.remitente_username === user.username)
      );
      return {
        ...u,
        ultimo_mensaje: ultimo ? ultimo.contenido : "",
      };
    });

    setUsuarios(usuariosConMensaje);
  };

  return (
    <div
      className={`bg-white border-r overflow-y-auto transition-all duration-300 ${
        visible ? "w-64" : "w-0 md:w-64"
      }`}
    >
      <div className="p-3 font-semibold border-b bg-gray-50 text-gray-700 flex justify-between items-center">
        <span>Conversaciones</span>
        <button
          className="md:hidden text-sm text-gray-500 hover:text-red-500"
          onClick={() => setVisible(false)}
        >
          ✕
        </button>
      </div>
      <div className={`${visible ? "block" : "hidden md:block"}`}>
        {usuarios.map((u) => (
          <div
            key={u.username}
            onClick={() => {
              onSelect(u.username);
              setVisible(false);
            }}
            className={`p-3 cursor-pointer border-b hover:bg-red-50 ${
              destino === u.username ? "bg-red-100" : ""
            }`}
          >
            <p className="font-medium text-sm text-gray-800">
              {u.username} - {u.nombre}
            </p>
            <p className="text-xs text-gray-500 truncate">{u.ultimo_mensaje || "..."}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;
