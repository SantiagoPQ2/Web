import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useMemo,
} from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Paperclip, Camera, ArrowLeft, X, Mic } from "lucide-react";

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
  const [composerHeight, setComposerHeight] = useState(88);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      setAudioBlob(null);

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

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: roomBg }}
    >
      {/* Header estilo WhatsApp */}
      <div className="shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur px-3 py-3 shadow-sm">
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

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 md:px-4 md:py-4"
        style={{
          paddingBottom: `${composerHeight + 16}px`,
          overscrollBehavior: "contain",
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
                    className={`max-w-[82%] md:max-w-[68%] rounded-2xl px-3 py-2.5 shadow-sm break-words ${
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

                    {m.audio_url && (
                      <audio
                        controls
                        className="w-full mt-2 rounded-lg"
                        src={m.audio_url}
                        onLoadedMetadata={() => scrollToBottom(true)}
                      />
                    )}

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

      {/* Composer */}
      <div
        ref={composerRef}
        className="shrink-0 border-t border-gray-200 bg-white px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
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

        {audioBlob && !grabando && (
          <div className="mb-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Audio grabado listo para enviar
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

          <button
            onClick={toggleGrabacion}
            className={`p-2 rounded-full shrink-0 ${
              grabando
                ? "text-red-600 animate-pulse"
                : "text-gray-500 hover:text-red-500"
            }`}
            title={grabando ? "Detener grabación" : "Grabar audio"}
          >
            <Mic size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Escribí un mensaje..."
            value={nuevoMensaje}
            onChange={(e) => setNuevoMensaje(e.target.value)}
            onFocus={() => setTimeout(() => scrollToBottom(false), 120)}
            onKeyDown={(e) => e.key === "Enter" && !subiendo && enviarMensaje()}
          />

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
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
