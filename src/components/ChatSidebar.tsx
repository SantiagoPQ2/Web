import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Usuario {
  username: string;
  name: string | null;
  role: string;
  ultimo_mensaje?: string;
  actualizado?: string;
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
    if (user) cargarUsuarios();

    // 👇 Escucha realtime: si hay nuevos mensajes, se actualiza la lista
    const canal = supabase
      .channel("mensajes_sidebar")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        () => cargarUsuarios()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [user]);

  const cargarUsuarios = async () => {
    if (!user) return;

    // 🔹 Traer todos los usuarios según el rol del actual
    let query = supabase.from("usuarios_app").select("username, name, role");

    if (user.role === "vendedor") query = query.in("role", ["supervisor", "admin"]);
    else if (user.role === "supervisor") query = query.in("role", ["vendedor", "admin"]);
    else query = query.neq("username", user.username);

    const { data: usuariosData, error } = await query;
    if (error || !usuariosData) return;

    // 🔹 Buscar último mensaje entre usuario actual y cada otro
    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("remitente_username, destinatario_username, contenido, created_at")
      .order("created_at", { ascending: false });

    const lista = usuariosData.map((u) => {
      const ultimo = mensajes?.find(
        (m) =>
          (m.remitente_username === u.username && m.destinatario_username === user.username) ||
          (m.destinatario_username === u.username && m.remitente_username === user.username)
      );

      return {
        ...u,
        ultimo_mensaje: ultimo ? ultimo.contenido : "",
        actualizado: ultimo ? ultimo.created_at : "",
      };
    });

    // 🔹 Ordenar: primero los más recientes, luego alfabéticamente
    lista.sort((a, b) => {
      if (a.actualizado && b.actualizado) return a.actualizado < b.actualizado ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "");
    });

    setUsuarios(lista);
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
        {usuarios.length === 0 ? (
          <div className="text-gray-400 text-sm text-center mt-8">
            No hay usuarios disponibles
          </div>
        ) : (
          usuarios.map((u) => (
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
              <p className="font-medium text-sm text-gray-800 truncate">
                {u.username} - {u.name || "Sin nombre"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {u.ultimo_mensaje || "Sin mensajes"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
