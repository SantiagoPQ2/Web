import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Paperclip, Camera, ArrowLeft, X } from "lucide-react";

type Mensaje = {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string | null;
  imagen_url: string | null;
  created_at: string;
  leido?: boolean | null;
};

interface Props {
  destino: string;
  volverSidebar: () => void;
}

const ChatRoom: React.FC<Props> = ({ destino, volverSidebar }) => {
  const { user } = useAuth();
  const yo = user?.username ?? "";
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // para no repetir en pantalla
  const ids = useMemo(() => new Set(mensajes.map((m) => m.id)), [mensajes]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  // ---------------- CARGA INICIAL + REALTIME ----------------
  useEffect(() => {
    if (!yo || !destino) return;

    const cargar = async () => {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .or(
          `and(remitente_username.eq.${yo},destinatario_username.eq.${destino}),and(remitente_username.eq.${destino},destinatario_username.eq.${yo})`
        )
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMensajes(data);
        // marcar como leídos los que recibí de este contacto
        const paraLeer = data
          .filter(
            (m) =>
              m.destinatario_username === yo &&
              m.remitente_username === destino &&
              m.leido === false
          )
          .map((m) => m.id);
        if (paraLeer.length) {
          await supabase.from("mensajes").update({ leido: true }).in("id", paraLeer);
        }
      }
    };
    cargar();

    // canal realtime
    const canal = supabase
      .channel(`chat_${yo}_${destino}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const nuevo = payload.new as Mensaje;

          const pertenece =
            (nuevo.remitente_username === yo &&
              nuevo.destinatario_username === destino) ||
            (nuevo.remitente_username === destino &&
              nuevo.destinatario_username === yo);

          if (pertenece) {
            // de-duplicate por id
            setMensajes((prev) => (prev.find((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [yo, destino]);

  // ---------------- MANEJO DE ARCHIVOS ----------------
  const onPickFile = (f: File | null) => {
    setArchivo(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  // ---------------- ENVIAR ----------------
  const enviar = async () => {
    if (!yo || !destino) return;
    if (!texto.trim() && !archivo) return;
    setEnviando(true);

    let imagen_url: string | null = null;

    try {
      // 1) si hay archivo, subir a Storage
      if (archivo) {
        const path = `${yo}/${Date.now()}_${archivo.name}`.replace(/\s+/g, "_");
        const up = await supabase.storage
          .from("chat_uploads")
          .upload(path, archivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: archivo.type || "image/png",
          });

        if (up.error) throw up.error;

        const pub = supabase.storage.from("chat_uploads").getPublicUrl(up.data.path);
        imagen_url = pub.data.publicUrl;
      }

      // 2) insertar mensaje
      const { data, error } = await supabase
        .from("mensajes")
        .insert([
          {
            remitente_username: yo,
            destinatario_username: destino,
            contenido: texto.trim() ? texto.trim() : null,
            imagen_url,
          },
        ])
        .select("id");

      if (error) throw error;

      // NO hago push local aquí para evitar duplicado:
      // lo pintará el evento realtime. Aun así,
      // si por algo no llegó, fuerzo un refetch corto:
      setTimeout(async () => {
        if (data && data[0]) {
          const id = (data[0] as { id: number }).id;
          if (!ids.has(id)) {
            const { data: one } = await supabase
              .from("mensajes")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            if (one) {
              setMensajes((prev) => [...prev, one]);
            }
          }
        }
      }, 800);
    } catch (e) {
      console.error("Error enviando mensaje:", e);
      alert("No se pudo enviar el mensaje/imagen. Reintentá.");
    } finally {
      setEnviando(false);
      setTexto("");
      onPickFile(null);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviar();
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
        <button
          onClick={volverSidebar}
          className="md:hidden text-gray-600 hover:text-red-500"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-semibold text-gray-700 text-sm">Chat con {destino}</h2>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-4">No hay mensajes aún.</p>
        ) : (
          mensajes.map((m) => {
            const soyYo = m.remitente_username === yo;
            return (
              <div key={m.id} className={`mb-2 flex ${soyYo ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-2xl px-3 py-2 max-w-[75%] shadow-sm ${
                    soyYo ? "bg-red-500 text-white" : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {m.imagen_url && (
                    <img
                      src={m.imagen_url}
                      alt="adjunto"
                      className="rounded-lg mb-2 max-w-[260px] cursor-pointer"
                      onClick={() => window.open(m.imagen_url!, "_blank")}
                    />
                  )}
                  {m.contenido && <p className="whitespace-pre-wrap break-words">{m.contenido}</p>}
                  <p className={`mt-1 text-[10px] text-right ${soyYo ? "opacity-80" : "opacity-60"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de input (sticky dentro del contenedor, no del body) */}
      <div className="shrink-0 border-t bg-white">
        {/* preview del archivo */}
        {preview && (
          <div className="flex items-center gap-3 px-3 py-2 border-b">
            <img src={preview} alt="prev" className="h-12 w-12 object-cover rounded" />
            <button
              onClick={() => onPickFile(null)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 hover:text-red-600"
            >
              <X size={14} /> Quitar
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-2 px-2 py-2">
          {/* adjuntar archivo */}
          <label className="p-2 text-gray-500 hover:text-red-500 cursor-pointer" title="Adjuntar">
            <Paperclip size={18} />
            <input
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.heic"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {/* cámara (mobile) */}
          <label className="p-2 text-gray-500 hover:text-red-500 cursor-pointer md:hidden" title="Cámara">
            <Camera size={18} />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje…"
            className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
          />

          <button
            type="submit"
            disabled={enviando || (!texto.trim() && !archivo)}
            className={`rounded-full px-4 py-2 text-sm text-white transition ${
              enviando || (!texto.trim() && !archivo)
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;

