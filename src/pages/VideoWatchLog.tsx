import React, { useEffect, useMemo, useRef, useState } from "react";
import { Film, Play, ExternalLink } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type VideoItem = {
  id: string;
  title: string;
  description?: string;
  src: string;
  tags?: string[];
  path: string; // path dentro del bucket
};

const BUCKET = "documentos_pdf";
const FOLDER = ""; // si los subís dentro de una carpeta, poné por ej: "2025" (sin slash final)

function niceTitleFromFilename(name: string) {
  // "Capsula Introduccion.mp4" -> "Capsula Introduccion"
  const noExt = name.replace(/\.[^/.]+$/, "");
  return noExt.replace(/%20/g, " ").trim();
}

function makeIdFromPath(path: string) {
  // id estable: path normalizado
  return path.replace(/\//g, "_").toLowerCase();
}

function tagsFromName(name: string): string[] {
  const n = name.toLowerCase();
  const tags: string[] = [];
  if (n.includes("introduccion") || n.includes("intro")) tags.push("introducción");
  if (n.includes("capsula")) tags.push("cápsula");
  // si querés marcar obligatorio siempre:
  tags.push("obligatorio");
  return tags;
}

function descriptionFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("introduccion") || n.includes("intro")) {
    return "Video de inducción / introducción a la app.";
  }
  if (n.includes("capsula 1") || n.includes("capsula%201")) {
    return "Cápsula 1 de capacitación.";
  }
  return "Video de capacitación.";
}

const VideoWatchLog: React.FC = () => {
  const { user } = useAuth();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ✅ traer lista de videos desde Storage
  useEffect(() => {
    let alive = true;

    async function loadVideos() {
      setLoading(true);
      setErrorMsg(null);

      // list() SOLO lista una carpeta. Si querés "2025", poné FOLDER="2025"
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(FOLDER, {
          limit: 100,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

      if (!alive) return;

      if (error) {
        console.error("storage list error:", error);
        setErrorMsg(
          "No pude listar los videos del Storage. Si el bucket es público pero LIST no está permitido, puedo dejarlo hardcodeado."
        );
        setVideos([]);
        setLoading(false);
        return;
      }

      // filtrar mp4 (y evitar carpetas)
      const mp4s = (data ?? [])
        .filter((f) => !f.id && !f.metadata) // a veces folders vienen sin metadata
        .concat((data ?? []).filter((f) => (f.metadata as any)?.mimetype)) // por si viene distinto
        .filter((f: any) => (f.name ?? "").toLowerCase().endsWith(".mp4"));

      // alternativa robusta: solo por extensión
      const onlyMp4 = (data ?? []).filter((f) =>
        (f.name ?? "").toLowerCase().endsWith(".mp4")
      );

      const finalList = (onlyMp4.length ? onlyMp4 : mp4s).map((f: any) => {
        const name = f.name as string;
        const path = FOLDER ? `${FOLDER}/${name}` : name;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        return {
          id: makeIdFromPath(path),
          title: niceTitleFromFilename(name),
          description: descriptionFromName(name),
          src: pub.publicUrl,
          tags: tagsFromName(name),
          path,
        } as VideoItem;
      });

      setVideos(finalList);

      // seleccionar primero por defecto
      if (finalList.length && !selectedId) {
        setSelectedId(finalList[0].id);
      }

      setLoading(false);
    }

    loadVideos();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => videos.find((v) => v.id === selectedId) ?? null,
    [videos, selectedId]
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

    const payload = {
      username: user.username,
      role: user.role,
      video_id: video.id,
      video_title: video.title,
      video_url: video.src,
      source: "library",
      completed: true,
      watched_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("video_watch_log").insert([payload]);
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

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-1">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold">Videos</h3>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <div className="p-4 text-sm text-gray-500">Cargando videos…</div>
                ) : videos.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No hay videos cargados (o no se pudo listar el bucket).
                  </div>
                ) : (
                  videos.map((v) => {
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
