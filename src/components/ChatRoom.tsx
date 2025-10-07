import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string;
  imagen_url?: string | null;
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
  const [subiendo, setSubiendo] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const remitente = user?.username || "";

  // 🔹 Cargar y suscribirse en tiempo real
  useEffect(() => {
    if (!remitente || !destino) return;
    cargarMensajes();

    const canal = supabase
      .channel("chat-room")
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
            setMensajes((prev) => {
              // evitar duplicados
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [remitente, destino]);

  // 🔹 Cargar mensajes
  const cargarMensajes = async () => {
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .or(
        `and(remitente_username.eq.${remitente},destinatario_username.eq.${destino}),
         and(remitente_username.eq.${destino},destinatario_username.eq.${remitente})`
      )
      .order("created_at", { ascending: true })
      .limit(500);

    if (!error && data) {
      setMensajes(data);
      scrollToBottom();
    }
  };

  // 🔹 Enviar mensaje
  const enviarMensaje = async () => {
    if ((!nuevoMensaje.trim() && !imagen) || !remitente) return;

    let imagen_url = null;

    // 👇 Subida de imagen si existe
    if (imagen) {
      setSubiendo(true);
      const nombreArchivo = `${remitente}_${Date.now()}.${imagen.name.split(".").pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat_uploads")
        .upload(nombreArchivo, imagen);

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(nombreArchivo);
        imagen_url = urlData.publicUrl;
      }
      setSubiendo(false);
      setImagen(null);
    }

    // 👇 Mostrar mensaje instantáneamente
    const temporal: Mensaje = {
      id: Date.now(),
      remitente_username: remitente,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim(),
      imagen_url,
      created_at: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, temporal]);
    scrollToBottom();

    // 👇 Guardar en Supabase
    await supabase.from("mensajes").insert({
      remitente_username: remitente,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim(),
      imagen_url,
    });

    setNuevoMensaje("");
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow relative">
      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensajes.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-10">
            No hay mensajes aún.
          </p>
        )}
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] p-2 rounded-2xl shadow-sm ${
              m.remitente_username === remitente
                ? "ml-auto bg-red-500 text-white"
                : "mr-auto bg-gray-200 text-gray-800"
            }`}
          >
            {m.imagen_url && (
              <img
                src={m.imagen_url}
                alt="imagen"
                className="rounded-lg mb-1 max-h-64 object-contain"
              />
            )}
            {m.contenido && <p className="whitespace-pre-wrap">{m.contenido}</p>}
            <p
              className={`text-[10px] mt-1 ${
                m.remitente_username === remitente
                  ? "text-gray-200 text-right"
                  : "text-gray-500 text-left"
              }`}
            >
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
      <div className="flex items-center border-t p-2 gap-2 bg-white sticky bottom-0">
        {/* Imagen */}
        <label className="cursor-pointer bg-gray-100 px-3 py-2 rounded-lg border hover:bg-gray-200 text-gray-600 text-sm">
          📎
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImagen(e.target.files?.[0] || null)}
          />
        </label>

        {/* Previsualización */}
        {imagen && (
          <div className="text-xs text-gray-500 italic truncate max-w-[120px]">
            {imagen.name}
          </div>
        )}

        {/* Input texto */}
        <input
          type="text"
          className="flex-1 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-red-500 outline-none"
          placeholder="Escribí un mensaje..."
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
          disabled={subiendo}
        />

        {/* Botón enviar */}
        <button
          onClick={enviarMensaje}
          disabled={subiendo}
          className={`px-4 py-2 rounded-lg text-white ${
            subiendo ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {subiendo ? "Subiendo..." : "Enviar"}
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
