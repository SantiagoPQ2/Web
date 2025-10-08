import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Paperclip, Camera, ArrowLeft, X } from "lucide-react";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string | null;
  imagen_url: string | null;
  created_at: string;
  leido?: boolean | null;
}

interface Props {
  destino: string;
  volverSidebar: () => void;
}

const MAX_MB = 15; // límite de archivo

const ChatRoom: React.FC<Props> = ({ destino, volverSidebar }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carga inicial + Realtime
  useEffect(() => {
    if (!user || !destino) return;

    const cargar = async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .or(
          `and(remitente_username.eq.${user.username},destinatario_username.eq.${destino}),and(remitente_username.eq.${destino},destinatario_username.eq.${user.username})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error cargando historial:", error);
        return;
      }
      setMensajes(data || []);

      // marcar como leídos los que vengan del otro
      const ids = (data || [])
        .filter(
          (m) =>
            m.leido === false &&
            m.remitente_username === destino &&
            m.destinatario_username === user.username
        )
        .map((m) => m.id);
      if (ids.length) {
        await supabase.from("mensajes").update({ leido: true }).in("id", ids);
      }
    };

    cargar();

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

          if (!pertenece) return;

          // evitar duplicados si el mismo mensaje ya está en estado
          setMensajes((prev) =>
            prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [user, destino]);

  // autoscroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  const quitarAdjunto = () => setArchivo(null);

  const onPickFile = (f?: File | null) => {
    if (!f) {
      setArchivo(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`El archivo supera ${MAX_MB} MB.`);
      return;
    }
    setArchivo(f);
  };

  const enviarMensaje = async () => {
    if (!user || (!nuevoMensaje.trim() && !archivo)) return;

    try {
      setSubiendo(true);

      let imagen_url: string | null = null;

      if (archivo) {
        // Ruta ordenada por chat: /userA__userB/epoch-nombre.ext
        const pair =
          user.username < destino
            ? `${user.username}__${destino}`
            : `${destino}__${user.username}`;
        const nombre = `${Date.now()}-${archivo.name}`;
        const path = `${pair}/${nombre}`;

        const { data: up, error: errUp } = await supabase.storage
          .from("chat_uploads")
          .upload(path, archivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: archivo.type || "application/octet-stream",
          });

        if (errUp) {
          console.error("Upload error:", errUp);
          alert("No se pudo enviar el mensaje/imagen. Reintentá.");
          setSubiendo(false);
          return;
        }

        const { data: pub } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(up!.path);
        imagen_url = pub.publicUrl;
      }

      const contenido = nuevoMensaje.trim() || null;

      const { data: inserted, error } = await supabase
        .from("mensajes")
        .insert([
          {
            remitente_username: user.username,
            destinatario_username: destino,
            contenido,
            imagen_url,
          },
        ])
        .select("*"); // para obtener el id y evitar dependencia del realtime

      if (error) {
        console.error("Insert error:", error);
        alert("No se pudo enviar el mensaje/imagen. Reintentá.");
        setSubiendo(false);
        return;
      }

      // Dedup: si Realtime lo trae, este set no duplica porque arriba chequeamos por id
      if (inserted && inserted.length) {
        setMensajes((prev) =>
          prev.some((m) => m.id === inserted[0].id) ? prev : [...prev, inserted[0] as Mensaje]
        );
      }

      setNuevoMensaje("");
      setArchivo(null);
    } finally {
      setSubiendo(false);
      // Reordenar (si tenés sidebar con última actividad)
      document.dispatchEvent(new CustomEvent("chat:message-sent", { detail: { to: destino } }));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
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
              aria-label="Volver"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-semibold text-gray-700 text-sm">Chat con {destino}</h2>
          </div>

          {/* Mensajes (scrollea esta, no toda la página) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
            {mensajes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-4">No hay mensajes aún.</p>
            ) : (
              mensajes.map((m) => {
                const soyYo = m.remitente_username === (user?.username ?? "");
                return (
                  <div key={m.id} className={`flex ${soyYo ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`p-3 max-w-[80%] md:max-w-[65%] rounded-2xl shadow-sm break-words ${
                        soyYo ? "bg-red-500 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {m.imagen_url && (
                        <img
                          src={m.imagen_url}
                          alt="adjunto"
                          className="rounded-lg mb-2 max-w-[260px] md:max-w-[360px] cursor-pointer"
                          onClick={() => window.open(m.imagen_url!, "_blank")}
                        />
                      )}
                      {m.contenido && <p>{m.contenido}</p>}
                      <p className="text-[10px] opacity-70 mt-1 text-right">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer (fijo abajo) */}
          <div className="border-t bg-white p-2 md:p-3">
            {/* Previsualización adjunto */}
            {archivo && (
              <div className="mb-2 flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                <span className="truncate">{archivo.name}</span>
                <button
                  onClick={quitarAdjunto}
                  className="ml-3 inline-flex items-center text-gray-500 hover:text-red-600"
                >
                  <X size={16} className="mr-1" />
                  Quitar
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Adjuntar desde galería/archivos */}
              <label className="p-2 text-gray-500 hover:text-red-500 cursor-pointer" title="Adjuntar archivo">
                <Paperclip size={18} />
                <input
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.heic"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>

              {/* Sacar foto (móvil: abre cámara) */}
              <label className="p-2 text-gray-500 hover:text-red-500 cursor-pointer" title="Sacar foto">
                <Camera size={18} />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>

              <input
                type="text"
                className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Escribí un mensaje…"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !subiendo && enviarMensaje()}
              />

              <button
                disabled={subiendo}
                onClick={enviarMensaje}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm text-white ${
                  subiendo ? "bg-gray-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {subiendo ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRoom;

