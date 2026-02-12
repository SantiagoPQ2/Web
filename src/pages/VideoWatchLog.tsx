import React, { useMemo, useRef, useState } from "react";
import { Film, Play, ExternalLink } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type VideoItem = {
  id: string;
  title: string;
  description?: string;
  src: string;
  tags?: string[];
};

const VIDEOS: VideoItem[] = [
  {
    id: "capsula_intro_v1",
    title: "Cápsula de Introducción",
    description: "Video de inducción / introducción a la app.",
    src: "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%20Introduccion.mp4",
    tags: ["introducción", "obligatorio"],
  },
];

const VideoWatchLog: React.FC = () => {
  const { user } = useAuth();

  const [selectedId, setSelectedId] = useState<string>(VIDEOS[0]?.id ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const selected = useMemo(
    () => VIDEOS.find((v) => v.id === selectedId) ?? null,
    [selectedId]
  );

  const onPick = (id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      if (!videoRef.current) return;
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      } catch {
        // ignore
      }
    });
  };

  // ✅ Opcional: registrar en tabla cuando finaliza el video desde la videoteca
  const logWatch = async (video: VideoItem) => {
    if (!user?.username) return;

    // Ajustá nombres de tabla/columnas si tus columnas son distintas
    const payload = {
      username: user.username,
      role: user.role,
      video_id: video.id,
      video_title: video.title,
      video_url: video.src,
      source: "library", // para diferenciar de "gate" si querés
      completed: true,
      watched_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("video_watch_log").insert([payload]);

    // si tu tabla se llama distinto o no existe, acá te va a tirar error
    if (error) console.error("video_watch_log insert error:", error.message);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm p-6 transition-colors duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 dark:bg-red-900/40 rounded-full p-2">
            <Film className="h-6 w-6 text-red-700 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Biblioteca de Videos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Elegí un video de la lista para reproducirlo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-1">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold">Videos</h3>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {VIDEOS.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No hay videos cargados.
                  </div>
                ) : (
                  VIDEOS.map((v) => {
                    const active = v.id === selectedId;
                    return (
                      <button
                        key={v.id}
                        onClick={() => onPick(v.id)}
                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition ${
                          active ? "bg-red-50 dark:bg-red-900/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{v.title}</div>

                            {v.description && (
                              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                {v.description}
                              </div>
                            )}

                            {v.tags?.length ? (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {v.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div
                            className={`mt-0.5 shrink-0 inline-flex items-center gap-1 text-sm ${
                              active
                                ? "text-red-700 dark:text-red-300"
                                : "text-gray-500"
                            }`}
                          >
                            <Play className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Reproductor */}
          <div className="lg:col-span-2">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">
                    {selected?.title ?? "Seleccioná un video"}
                  </h3>
                  {selected?.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                      {selected.description}
                    </p>
                  ) : null}
                </div>

                {selected?.src ? (
                  <a
                    href={selected.src}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    title="Abrir en otra pestaña"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                ) : null}
              </div>

              <div className="p-4">
                {selected?.src ? (
                  <video
                    ref={videoRef}
                    src={selected.src}
                    controls
                    controlsList="nodownload noplaybackrate"
                    playsInline
                    className="w-full rounded-lg bg-black"
                    onEnded={() => {
                      // ✅ opcional: log cuando termina
                      logWatch(selected).catch(() => {});
                    }}
                  />
                ) : (
                  <div className="text-sm text-gray-500">
                    Elegí un video del panel izquierdo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoWatchLog;
