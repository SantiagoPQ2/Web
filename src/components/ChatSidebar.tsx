import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Usuario {
  username: string;
  name: string | null;
  role: string;
  ultimoMensaje?: string;
  actualizado?: string;
}

interface Props {
  /** When a user is clicked, this function fires */
  onSelectUser: (username: string) => void;
  /** Currently selected username (can be null) */
  selectedUser: string | null;
}

const ChatSidebar: React.FC<Props> = ({ onSelectUser, selectedUser }) => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (user) cargarUsuarios();
    const canal = supabase
      .channel("mensajes_sidebar")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        () => cargarUsuarios(),
      )
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [user]);

  const cargarUsuarios = async () => {
    if (!user) return;
    const { data: usuariosData } = await supabase
      .from("usuarios_app")
      .select("username, name, role")
      .neq("username", user.username);
    if (!usuariosData) return;

    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("remitente_username, destinatario_username, contenido, created_at")
      .order("created_at", { ascending: false });

    const lista = usuariosData.map((u) => {
      const ultimo = mensajes?.find(
        (m) =>
          (m.remitente_username === u.username && m.destinatario_username === user.username) ||
          (m.destinatario_username === u.username && m.remitente_username === user.username),
      );
      return {
        ...u,
        ultimoMensaje: ultimo?.contenido || "",
        actualizado: ultimo?.created_at || "",
      };
    });
    lista.sort((a, b) => {
      if (a.actualizado && b.actualizado) {
        return a.actualizado < b.actualizado ? 1 : -1;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    setUsuarios(lista);
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.name || "").toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto">
      {/* search box */}
      <div className="p-2">
        <input
          className="w-full border rounded p-2 text-sm"
          placeholder="Buscar contacto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      {/* list */}
      {usuariosFiltrados.map((u) => (
        <div
          key={u.username}
          onClick={() => onSelectUser(u.username)}
          className={`p-3 border-b cursor-pointer ${
            selectedUser === u.username ? "bg-red-100" : "hover:bg-red-50"
          }`}
        >
          <p className="font-medium text-sm">
            {u.username} – {u.name || "Sin nombre"}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {u.ultimoMensaje || "Sin mensajes"}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ChatSidebar;

