import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../config/supabase";
import { Image } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string | null;
  imagen_url: string | null;
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

  // 🔁 Cargar mensajes + suscripción realtime
  useEffect(() => {
    if (!remitente || !destino) return;
    cargarMensajes();

    const canal = supabase
      .channel("mensajes_realtime")
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
        `and(remitente_username.eq.${remitente},destinatario_username.eq.${destino}),
         and(remitente_username.eq.${destino},destinatario_username.eq.${remitente})`
      )
      .order("created_at", { ascending: true });
    setMensajes(data || []);
    scrollToBottom();
  };

  const enviarMensaje = async () => {
    if (!remitente || (!nuevoMensaje.trim() && !imagen)) return;

    let imagenUrl = null;

    // 📸 Si hay imagen, subir al bucket "chat"
    if (imagen) {
      const nombreArchivo = `${Date.now()}_${imagen.name}`;
      const { data, error } = await supabase.storage
        .from("chat")
        .upload(nombreArchivo, imagen);
      if (!error && data) {
        const { data: publicURL } = supabase.storage
          .from("chat")
          .getPublicUrl(nombreArchivo);
        imagenUrl = publicURL?.publicUrl || null;
      }
      setImagen(null);
    }

    await supabase.from("mensajes").insert({
      remitente_username: remitente,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim() || null,
      imagen_url: imagenUrl,
    });

    setNuevoMensaje("");
  };

  const scrollToBottom = () =>
    setTimeout(() => mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.remitente_username === remitente ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl p-2 px-3 max-w-[70%] break-words ${
                m.remitente_username === remitente
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {m.contenido && <p>{m.contenido}</p>}
              {m.imagen_url && (
                <img
                  src={m.imagen_url}
                  alt="imagen"
                  className="rounded-lg mt-1 max-h-64 object-cover"
                />
              )}
            </div>
          </div>
        ))}
        <div ref={mensajesEndRef} />
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t p-2">
        <label className="p-2 cursor-pointer hover:bg-gray-100 rounded-full">
          <Image className="w-5 h-5 text-gray-600" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImagen(e.target.files?.[0] || null)}
          />
        </label>

        <input
          type="text"
          className="flex-1 border rounded-full p-2 px-4 text-sm outline-none focus:ring-1 focus:ring-red-500"
          placeholder="Escribí un mensaje..."
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
        />
        <button
          onClick={enviarMensaje}
          className="bg-red-600 text-white px-4 py-1.5 rounded-full hover:bg-red-700 transition"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
