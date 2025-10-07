import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string;
  created_at: string;
}

interface ChatRoomProps {
  destino: string; // username del otro usuario
}

const ChatRoom: React.FC<ChatRoomProps> = ({ destino }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  const remitente = user?.username || "";

  useEffect(() => {
    if (!remitente || !destino) return;

    // Cargar mensajes previos
    cargarMensajes();

    // Suscripción realtime
    const canal = supabase
      .channel("mensajes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const msg = payload.new as Mensaje;
          if (
            (msg.remitente_username === remitente &&
              msg.destinatario_username === destino) ||
            (msg.remitente_username === destino &&
              msg.destinatario_username === remitente)
          ) {
            setMensajes((prev) => [...prev, msg]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [remitente, destino]);

  const cargarMensajes = async () => {
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .or(
        `and(remitente_username.eq.${remitente},destinatario_username.eq.${destino}),and(remitente_username.eq.${destino},destinatario_username.eq.${remitente})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    if (!error && data) {
      setMensajes(data);
      scrollToBottom();
    }
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !remitente) return;

    const { error } = await supabase.from("mensajes").insert({
      remitente_username: remitente,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim(),
    });

    if (!error) {
      setNuevoMensaje("");
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh] bg-white border rounded-lg shadow">
      {/* Cabecera */}
      <div className="p-3 border-b bg-gray-50 text-sm font-medium text-gray-700">
        Chat con <b>{destino}</b>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded-lg max-w-[70%] break-words ${
              m.remitente_username === remitente
                ? "ml-auto bg-red-500 text-white"
                : "mr-auto bg-gray-200 text-gray-800"
            }`}
          >
            {m.contenido}
          </div>
        ))}
        <div ref={mensajesEndRef} />
      </div>

      {/* Input */}
      <div className="flex border-t p-2">
        <input
          type="text"
          className="flex-1 border rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-red-500"
          placeholder="Escribe un mensaje..."
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
        />
        <button
          onClick={enviarMensaje}
          className="ml-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
