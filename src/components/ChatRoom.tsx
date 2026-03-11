import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useMemo,
} from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import {
  Paperclip,
  Camera,
  ArrowLeft,
  X,
  Mic,
  Pause,
  Play,
  Square,
  Send,
} from "lucide-react";

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

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const AudioBubble: React.FC<{
  src: string;
  soyYo: boolean;
}> = ({ src, soyYo }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrent(0);
    };
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch (e) {
      console.error("No se pudo reproducir audio:", e);
    }
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="chat-audio-bubble mt-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        className={`chat-audio-play ${
          soyYo ? "chat-audio-play-me" : "chat-audio-play-other"
        }`}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-[1px]" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="chat-audio-wave">
          <div
            className={`chat-audio-progress ${
              soyYo ? "chat-audio-progress-me" : "chat-audio-progress-other"
            }`}
            style={{ width: `${progress}%` }}
          />
          <div className="chat-audio-bars" aria-hidden="true">
            {Array.from({ length: 32 }).map((_, i) => (
              <span
                key={i}
                style={{
                  height: `${10 + ((i * 7) % 18)}px`,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className={`mt-1 flex items-center justify-between text-[11px] ${
            soyYo ? "text-red-100" : "text-gray-500"
          }`}
        >
          <span>{formatDuration(isPlaying ? current : duration || current)}</span>
        </div>
      </div>
    </div>
  );
};

const ChatRoom: React.FC<Props> = ({ destino, volverSidebar }) => {
  const { user } = useAuth();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioPreviewDuration, setAudioPreviewDuration] = useState(0);

  const [subiendo, setSubiendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [composerHeight, setComposerHeight] = useState(88);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const roomBg = useMemo(
    () =>
      "linear-gradient(180deg, rgba(243,244,246,1) 0%, rgba(236,242,250,1) 100%)",
    []
  );

  const medirComposer = () => {
    if (composerRef.current) {
      setComposerHeight(composerRef.current.offsetHeight || 88);
    }
  };

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  };

  useLayoutEffect(() => {
    medirComposer();
    const t = setTimeout(() => scrollToBottom(false), 60);
    return () => clearTimeout(t);
  }, [destino]);

  useEffect(() => {
    medirComposer();
    scrollToBottom(true);
  }, [mensajes, archivo, audioBlob]);

  useEffect(() => {
    const onResize = () => {
      medirComposer();
      setTimeout(() => scrollToBottom(false), 80);
    };

    const onVisual = () => {
      medirComposer();
      setTimeout(() => scrollToBottom(false), 80);
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onVisual);
    window.visualViewport?.addEventListener("scroll", onVisual);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onVisual);
      window.visualViewport?.removeEventListener("scroll", onVisual);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    if (!user || !destino) return;

    let mounted = true;

    const marcarMensajesComoLeidos = async (rows: Mensaje[]) => {
      const ids = rows
        .filter(
          (m) =>
            m.leido === false &&
            m.remitente_username === destino &&
            m.destinatario_username === user.username
        )
        .map((m) => m.id);

      if (!ids.length) return;

      await supabase.from("mensajes").update({ leido: true }).in("id", ids);
    };

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

      const rows = (data || []) as Mensaje[];
      setMensajes(rows);
      await marcarMensajesComoLeidos(rows);

      setTimeout(() => scrollToBottom(false), 50);
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
        async (payload) => {
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

          if (
            nuevo.remitente_username === destino &&
            nuevo.destinatario_username === user.username &&
            nuevo.leido === false
          ) {
            await supabase
              .from("mensajes")
              .update({ leido: true })
              .eq("id", nuevo.id);
          }

          setTimeout(() => scrollToBottom(true), 60);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes" },
        (payload) => {
          const actualizado = payload.new as Mensaje;

          const pertenece =
            (actualizado.remitente_username === user.username &&
              actualizado.destinatario_username === destino) ||
            (actualizado.remitente_username === destino &&
              actualizado.destinatario_username === user.username);

          if (!pertenece) return;

          setMensajes((prev) =>
            prev.map((m) => (m.id === actualizado.id ? actualizado : m))
          );
        }
      )
      .subscribe();

    channelRef.current = ch;

    document.dispatchEvent(
      new CustomEvent("chat:open", { detail: { withUser: destino } })
    );

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, destino]);

  const onPickFile = (f?: File | null) => {
    if (!f) return setArchivo(null);

    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`El archivo supera ${MAX_MB} MB.`);
      return;
    }

    setArchivo(f);
  };

  const quitarAdjunto = () => setArchivo(null);

  const limpiarAudioPreview = () => {
    setAudioBlob(null);
    setAudioPreviewDuration(0);

    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
  };

  const stopMicStream = () => {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    }
  };

  const iniciarGrabacion = async () => {
    try {
      limpiarAudioPreview();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);

        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);

        const tempAudio = new Audio(url);
        tempAudio.onloadedmetadata = () => {
          setAudioPreviewDuration(tempAudio.duration || 0);
        };
      };

      setMicStream(stream);
      setMediaRecorder(recorder);
      setRecordSeconds(0);
      setGrabando(true);

      recorder.start();

      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
      }

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert("No se pudo acceder al micrófono.");
    }
  };

  const finalizarGrabacion = () => {
    mediaRecorder?.stop();
    setGrabando(false);
    stopMicStream();

    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const toggleGrabacion = async () => {
    if (grabando) {
      finalizarGrabacion();
      return;
    }

    await iniciarGrabacion();
  };

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
        alert("No se pudo enviar el mensaje.");
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
      limpiarAudioPreview();
      setRecordSeconds(0);

      setTimeout(() => {
        medirComposer();
        scrollToBottom(true);
        inputRef.current?.focus();
      }, 40);

      document.dispatchEvent(
        new CustomEvent("chat:message-sent", { detail: { to: destino } })
      );
    } finally {
      setSubiendo(false);
    }
  };

  const mostrarBotonEnviar = !!nuevoMensaje.trim() || !!archivo || !!audioBlob;

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: roomBg }}
    >
      <div className="chat-header shrink-0 border-b border-gray-200 bg-white/95 px-3 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={volverSidebar}
            className="md:hidden text-gray-500 hover:text-red-500 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold shrink-0">
            {(destino[0] || "?").toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-gray-800 text-sm truncate">
              {destino}
            </h2>
            <p className="text-[11px] text-gray-500 truncate">
              Chat interno VaFood
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="chat-scroll-area flex-1 min-h-0 overflow-y-auto px-3 py-3 md:px-4 md:py-4"
        style={{
          paddingBottom: `${composerHeight + 16}px`,
        }}
      >
        {mensajes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No hay mensajes aún
          </div>
        ) : (
          <div className="space-y-2">
            {mensajes.map((m) => {
              const soyYo = m.remitente_username === (user?.username ?? "");

              return (
                <div
                  key={m.id}
                  className={`flex ${soyYo ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`chat-bubble max-w-[82%] md:max-w-[68%] rounded-2xl px-3 py-2.5 shadow-sm break-words ${
                      soyYo
                        ? "bg-[#dc2626] text-white rounded-br-md"
                        : "bg-white text-gray-800 rounded-bl-md"
                    }`}
                  >
                    {m.imagen_url && (
                      <img
                        src={m.imagen_url}
                        alt="adjunto"
                        className="rounded-xl mb-2 max-w-[240px] md:max-w-[360px] cursor-pointer"
                        onClick={() => window.open(m.imagen_url!, "_blank")}
                        onLoad={() => scrollToBottom(true)}
                      />
                    )}

                    {m.audio_url && <AudioBubble src={m.audio_url} soyYo={soyYo} />}

                    {m.contenido && (
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {m.contenido}
                      </p>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1">
                      <p
                        className={`text-[10px] ${
                          soyYo ? "text-red-100" : "text-gray-400"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        ref={composerRef}
        className="chat-composer chat-keyboard-safe shrink-0 border-t border-gray-200 bg-white px-2 py-2 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      >
        {archivo && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="truncate text-gray-700">{archivo.name}</span>
            <button
              onClick={quitarAdjunto}
              className="ml-3 inline-flex items-center text-gray-500 hover:text-red-600"
            >
              <X size={16} className="mr-1" />
              Quitar
            </button>
          </div>
        )}

        {grabando && (
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-medium">Grabando audio</span>
              <span className="tabular-nums">{formatDuration(recordSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={finalizarGrabacion}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              <Square size={14} />
              Finalizar
            </button>
          </div>
        )}

        {!grabando && audioBlob && audioPreviewUrl && (
          <div className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">
                  Audio listo para enviar
                </p>
                <div className="mt-2">
                  <AudioBubble src={audioPreviewUrl} soyYo={false} />
                </div>
              </div>

              <button
                type="button"
                onClick={limpiarAudioPreview}
                className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-white hover:text-red-600"
                title="Descartar audio"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={enviarMensaje}
                disabled={subiendo}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white ${
                  subiendo
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                <Send size={16} />
                {subiendo ? "Enviando..." : "Enviar audio"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
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

          {!mostrarBotonEnviar && !grabando && !audioBlob && (
            <button
              onClick={toggleGrabacion}
              className="p-2 rounded-full shrink-0 text-gray-500 hover:text-red-500"
              title="Grabar audio"
            >
              <Mic size={18} />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            className="chat-input min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
            placeholder={grabando ? "Grabando audio..." : "Escribí un mensaje..."}
            value={nuevoMensaje}
            disabled={grabando}
            onChange={(e) => setNuevoMensaje(e.target.value)}
            onFocus={() => setTimeout(() => scrollToBottom(false), 120)}
            onKeyDown={(e) => e.key === "Enter" && !subiendo && enviarMensaje()}
          />

          {mostrarBotonEnviar && !grabando && (
            <button
              disabled={subiendo}
              onClick={enviarMensaje}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-white ${
                subiendo
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {subiendo ? "Enviando..." : "Enviar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
