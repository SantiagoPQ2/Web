import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Paperclip, Send, ArrowLeft } from "lucide-react";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string | null;
  imagen_url: string | null;
  created_at: string;
}

interface Props {
  destino: string;
  volverSidebar: () => void;
}

const ChatRoom: React.FC<Props> = ({ destino, volverSidebar }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 📥 Carga inicial + realtime listener
  useEffect(() => {
    if (!destino || !user) return;
    cargarMensajes();

    const canal = supabase
      .channel(`chat_${user.username}_${destino}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          const pertenece =
            (nuevo.remitente_username === user.username &&
              nuevo.destinatario_username === destino) ||
            (nuevo.remitente_username === destino &&
              nuevo.destinatario_username === user.username);

          if (pertenece) {
            setMensajes((prev) => [...prev, nuevo]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [destino, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  // 📦 Cargar historial del chat
  const cargarMensajes = async () => {
    if (!user || !destino) return;

    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .or(
        `and(remitente_username.eq.${user.username},destinatario_username.eq.${destino}),and(remitente_username.eq.${destino},destinatario_username.eq.${user.username})`
      )
      .order("created_at", { ascending: true });

    if (!error && data) setMensajes(data);
  };

  // 📨 Enviar mensaje o imagen
  const enviarMensaje = async () => {
    if (!user || (!nuevoMensaje.trim() && !imagen)) return;

    setSubiendo(true);
    let imagen_url = null;

    // 🔹 Subida de imagen a Supabase Storage
    if (imagen) {
      const nombreArchivo = `${user.username}-${Date.now()}-${imagen.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat_uploads")
        .upload(nombreArchivo, imagen, {
          cacheControl: "3600",
          upsert: false,
          contentType: imagen.type || "image/png",
        });

      if (uploadError) {
        console.error("Error al subir imagen:", uploadError);
        setSubiendo(false);
        return;
      }

      if (uploadData) {
        const { data: publicUrl } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(uploadData.path);
        imagen_url = publicUrl.publicUrl;
      }
    }

    // 🔹 Insertar mensaje
    const nuevo: Omit<Mensaje, "id" | "created_at"> = {
      remitente_username: user.username,
      destinatario_username: destino,
      contenido: nuevoMensaje.trim() || null,
      imagen_url,
    };

    const { data, error } = await supabase
      .from("mensajes")
      .insert([nuevo])
      .select("*");

    setSubiendo(false);

    if (error) {
      console.error("Error insertando mensaje:", error);
      return;
    }

    // Mostrar inmediatamente
    if (data && data.length > 0) {
      setMensajes((prev) => [...prev, data[0]]);
    }

    setNuevoMensaje("");
    setImagen(null);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-blue-50">
      {!destino ? (
        <div className="m-auto text-gray-400 text-sm">
          Seleccioná un contacto para comenzar a chatear 💬
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center p-3 border-b bg-white shadow-sm">
            <button
              onClick={volverSidebar}
              className="md:hidden text-gray-500 hover:text-red-500 mr-3"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-semibold text-gray-700 text-sm">
              Chat con {destino}
            </h2>
          </div>

          {/* Chat */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {mensajes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-4">
                No hay mensajes aún.
              </p>
            ) : (
              mensajes.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.remitente_username === user.username
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 max-w-[75%] rounded-2xl shadow-sm ${
                      m.remitente_username === user.username
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {m.imagen_url && (
                      <img
                        src={m.imagen_url}
                        alt="imagen"
                        className="rounded-lg mb-2 max-w-[220px] cursor-pointer"
                        onClick={() => window.open(m.imagen_url, "_blank")}
                      />
                    )}
                    {m.contenido && <p>{m.contenido}</p>}
                    <p className="text-[10px] text-right opacity-70 mt-1">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex items-center border-t bg-white p-2">
            <label className="p-2 text-gray-500 hover:text-red-500 cursor-pointer">
              <Paperclip size={18} />
              <input
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.heic"
                onChange={(e) => setImagen(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <input
              type="text"
              className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Escribí un mensaje..."
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
            />
            <button
              disabled={subiendo}
              onClick={enviarMensaje}
              className={`ml-2 rounded-full px-4 py-2 text-sm text-white ${
                subiendo
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {subiendo ? "Subiendo..." : "Enviar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRoom;

