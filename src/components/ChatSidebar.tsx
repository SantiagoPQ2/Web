import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Search } from "lucide-react";

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
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (user) cargarUsuarios();

    // 🔄 Actualización en tiempo real cuando se inserta un nuevo mensaje
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

    // 🔹 Todos los usuarios menos el propio
    const { data: usuariosData, error } = await supabase
      .from("usuarios_app")
      .select("username, name, role")
      .neq("username", user.username);

    if (error || !usuariosData) return;

    // 🔹 Buscar último mensaje entre el usuario actual y cada otro
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

    // 🔹 Ordenar: primero los chats con mensajes recientes, luego por nombre
    lista.sort((a, b) => {
      if (a.actualizado && b.actualizado) return a.actualizado < b.actualizado ? 1 : -1;
      if (a.actualizado) return -1;
      if (b.actualizado) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    setUsuarios(lista);
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.name || "").toLowerCase().includes(busqueda.toLowerCase())
  );

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

      {/* 🔍 Buscador */}
      <div className="relative p-2 border-b bg-gray-50">
        <Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar contacto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
        />
      </div>

      <div className={`${visible ? "block" : "hidden md:block"}`}>
        {usuariosFiltrados.length === 0 ? (
          <div className="text-gray-400 text-sm text-center mt-6">
            No se encontraron usuarios
          </div>
        ) : (
          usuariosFiltrados.map((u) => (
            <div
              key={u.username}
              onClick={() => {
                onSelect(u.username);
                setVisible(false);
              }}
              className={`p-3 cursor-pointer border-b hover:bg-red-50 transition ${
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
