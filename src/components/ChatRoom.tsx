import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Paperclip, Camera, ArrowLeft, X } from "lucide-react";

interface Mensaje {
  id: number;
  remitente_username: string;
  destinatario_username: string;
  contenido: string | null;
  imagen_url: string | null;
  audio_url?: string | null;
  created_at: string;
  leido?: boolean | null;
}

interface Props {
  destino: string;
  volverSidebar: () => void;
}

const MAX_MB = 15;

const ChatRoom: React.FC<Props> = ({ destino, volverSidebar }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // --------- Scroll helpers ---------
  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
    );
  };

  useLayoutEffect(() => {
    const t = setTimeout(() => scrollToBottom(false), 50);
    return () => clearTimeout(t);
  }, [destino]);

  useEffect(() => {
    scrollToBottom(true);
  }, [mensajes]);

  useEffect(() => {
    const onResize = () => scrollToBottom(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // --------- Carga inicial + realtime ---------
  useEffect(() => {
    if (!user || !destino) return;

    let mounted = true;

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

      if (!mounted) return;
      setMensajes(data || []);

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

      setTimeout(() => scrollToBottom(false), 10);
    };

    cargar();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
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

          setMensajes((prev) =>
            prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]
          );
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, destino]);

  // --------- Adjuntos ---------
  const onPickFile = (f?: File | null) => {
    if (!f) return setArchivo(null);
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`El archivo supera ${MAX_MB} MB.`);
      return;
    }
    setArchivo(f);
  };
  const quitarAdjunto = () => setArchivo(null);

  // --------- Audio ---------
  const stopMicStream = () => {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    }
  };

  const toggleGrabacion = async () => {
    if (grabando) {
      mediaRecorder?.stop();
      setGrabando(false);
      stopMicStream();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
      };
      setMicStream(stream);
      recorder.start();
      setMediaRecorder(recorder);
      setGrabando(true);
    } catch {
      alert("No se pudo acceder al micrófono.");
    }
  };

  // --------- Enviar ---------
  const enviarMensaje = async () => {
    if (!user) return;
    const texto = nuevoMensaje.trim();
    if (!texto && !archivo && !audioBlob) return;

    try {
      setSubiendo(true);

      let imagen_url: string | null = null;
      let audio_url: string | null = null;

      const pair =
        user.username < destino
          ? `${user.username}__${destino}`
          : `${destino}__${user.username}`;

      if (archivo) {
        const safeName = archivo.name.replace(/[^\w.\-]/g, "_");
        const filePath = `${pair}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from("chat_uploads")
          .upload(filePath, archivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: archivo.type || "application/octet-stream",
          });
        if (error) {
          console.error("Upload image error:", error);
          alert("No se pudo enviar la imagen.");
          setSubiendo(false);
          return;
        }
        const { data: pub } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(filePath);
        imagen_url = pub.publicUrl;
      }

      if (audioBlob) {
        const audioPath = `${pair}/${Date.now()}.webm`;
        const { error } = await supabase.storage
          .from("chat_uploads")
          .upload(audioPath, audioBlob, {
            cacheControl: "3600",
            upsert: false,
            contentType: "audio/webm",
          });
        if (error) {
          console.error("Upload audio error:", error);
          alert("No se pudo enviar el audio.");
          setSubiendo(false);
          return;
        }
        const { data: pub } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(audioPath);
        audio_url = pub.publicUrl;
      }

      const contenido: string | null = texto || null;

      const { data, error } = await supabase
        .from("mensajes")
        .insert([
          {
            remitente_username: user.username,
            destinatario_username: destino,
            contenido,
            imagen_url,
            audio_url,
            leido: false,
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("Insert error:", error);
        alert("No se pudo enviar el mensaje/imagen/audio.");
        setSubiendo(false);
        return;
      }

      if (data) {
        setMensajes((prev) =>
          prev.some((m) => m.id === data.id) ? prev : [...prev, data as Mensaje]
        );
      }

      setNuevoMensaje("");
      setArchivo(null);
      setAudioBlob(null);
      setTimeout(() => scrollToBottom(true), 10);
    } finally {
      setSubiendo(false);
      document.dispatchEvent(
        new CustomEvent("chat:message-sent", { detail: { to: destino } })
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-gray-50 to-blue-50">
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
              className="md:hidden text-gray-500 hover:text-red-500 mr-3 shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-semibold text-gray-700 text-sm truncate">
              Chat con {destino}
            </h2>
          </div>

          {/* Mensajes (scroll area) */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 min-h-0"
          >
            {mensajes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-4">
                No hay mensajes aún.
              </p>
            ) : (
              mensajes.map((m) => {
                const soyYo = m.remitente_username === (user?.username ?? "");
                return (
                  <div
                    key={m.id}
                    className={`flex ${soyYo ? "justify-end" : "justify-start"}`}
                  >
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
                          onLoad={() => scrollToBottom(true)}
                        />
                      )}
                      {m.audio_url && (
                        <audio
                          controls
                          className="w-full mt-2 rounded-lg"
                          src={m.audio_url}
                          onLoadedMetadata={() => scrollToBottom(true)}
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

          {/* Barra inferior visible siempre */}
          <div className="border-t bg-white p-2 md:p-3 pb-[env(safe-area-inset-bottom)] shrink-0 z-10">
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

            <div className="flex items-center gap-2 w-full">
              <label
                className="p-2 text-gray-500 hover:text-red-500 cursor-pointer shrink-0"
                title="Adjuntar imagen"
              >
                <Paperclip size={18} />
                <input
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.heic"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>

              <label
                className="p-2 text-gray-500 hover:text-red-500 cursor-pointer shrink-0"
                title="Sacar foto"
              >
                <Camera size={18} />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                onClick={toggleGrabacion}
                className={`p-2 rounded-full shrink-0 ${
                  grabando ? "text-red-600 animate-pulse" : "text-gray-500 hover:text-red-500"
                }`}
                title={grabando ? "Detener grabación" : "Grabar audio"}
              >
                🎤
              </button>

              <input
                type="text"
                className="min-w-0 flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Escribí un mensaje…"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !subiendo && enviarMensaje()}
              />

              <button
                disabled={subiendo}
                onClick={enviarMensaje}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm text-white ${
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
