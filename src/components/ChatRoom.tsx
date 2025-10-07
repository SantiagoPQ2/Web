import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string;
  imagen_url?: string;
  created_at: string;
}

interface ChatRoomProps {
  destino: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ destino }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const remitente = user?.username || "";

  useEffect(() => {
    if (!remitente || !destino) return;
    cargarMensajes();

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
    const { data } = await supabase
      .from("mensajes")
      .select("*")
      .or(
        `and(remitente_username.eq.${remitente},destinatario_username.eq.${destino}),and(remitente_username.eq.${destino},destinatario_username.eq.${remitente})`
      )
      .order("created_at", { ascending: true })
      .limit(500);
    setMensajes(data || []);
    scrollToBottom();
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() && !imagen) return;

    let imagen_url = null;
    if (imagen) {
      const nombreArchivo = `${remitente}_${Date.now()}.${imagen.name.split(".").pop()}`;
      const { data, error } = await supabase.storage
        .from("chat_uploads")
        .upload(nombreArchivo, imagen);
      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(nombreArchivo);
        imagen_url = urlData.publicUrl;
      }
      setImagen(null);
    }

    const { error } = await supabase.from("mensajes").insert({
      remitente_username: remitente,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim(),
      imagen_url,
    });

    if (!error) {
      setNuevoMensaje("");
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] p-2 rounded-2xl ${
              m.remitente_username === remitente
                ? "ml-auto bg-red-500 text-white"
                : "mr-auto bg-gray-200 text-gray-800"
            }`}
          >
            {m.imagen_url && (
              <img
                src={m.imagen_url}
                alt="imagen enviada"
                className="rounded-lg mb-1 max-h-56"
              />
            )}
            <p>{m.contenido}</p>
            <p className="text-[10px] text-gray-300 mt-1 text-right">
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))}
        <div ref={mensajesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center border-t p-2 gap-2">
        <label className="cursor-pointer bg-gray-100 px-3 py-2 rounded-lg border hover:bg-gray-200">
          📎
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImagen(e.target.files?.[0] || null)}
          />
        </label>
        <input
          type="text"
          className="flex-1 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-red-500 outline-none"
          placeholder="Escribí un mensaje..."
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
        />
        <button
          onClick={enviarMensaje}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
