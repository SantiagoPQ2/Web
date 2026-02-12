import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";

type Props = {
  rolesToEnforce: string[];      // ej: ["vendedor"] o ["test","vendedor"]
  videoId: string;              // ej: "capsula_intro_v1"
  videoSrc: string;             // URL pública supabase storage
  oncePerDay?: boolean;         // true
  children: React.ReactNode;
};

function getLocalYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MandatoryVideoGate: React.FC<Props> = ({
  rolesToEnforce,
  videoId,
  videoSrc,
  oncePerDay = true,
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [mustWatch, setMustWatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyToUnlock, setReadyToUnlock] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastAllowedTimeRef = useRef(0);

  // Traemos user desde tu storage (como venís haciendo en la app)
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const role = currentUser?.role;
  const userId = currentUser?.id;

  const shouldEnforce =
    !!role && rolesToEnforce.includes(role) && !!userId && !!videoSrc;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError(null);

      if (!shouldEnforce) {
        setMustWatch(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (!oncePerDay) {
          if (!cancelled) {
            setMustWatch(true);
            setLoading(false);
          }
          return;
        }

        const today = getLocalYYYYMMDD();

        const { data, error: selErr } = await supabase
          .from("video_watch_daily")
          .select("id")
          .eq("user_id", userId)
          .eq("video_id", videoId)
          .eq("watched_on", today)
          .limit(1);

        if (selErr) throw selErr;

        const alreadyWatchedToday = (data?.length ?? 0) > 0;

        if (!cancelled) {
          setMustWatch(!alreadyWatchedToday);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Error verificando el video obligatorio.");
          // Si falla el check, por seguridad pedimos verlo igual
          setMustWatch(true);
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [shouldEnforce, oncePerDay, userId, videoId]);

  const markCompleted = async () => {
    try {
      if (!userId) return;

      const today = getLocalYYYYMMDD();

      // Insert con unique index => si ya existe no hace falta duplicar
      const { error: insErr } = await supabase
        .from("video_watch_daily")
        .insert([
          {
            user_id: userId,
            video_id: videoId,
            watched_on: today,
            completed: true,
          },
        ]);

      // Si es conflicto por unique (ya estaba), lo ignoramos
      const msg = insErr?.message?.toLowerCase?.() || "";
      const isUniqueConflict =
        msg.includes("duplicate key") || msg.includes("unique");

      if (insErr && !isUniqueConflict) throw insErr;

      setReadyToUnlock(true);
      setMustWatch(false);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el completion del video.");
    }
  };

  // Anti-adelantar (best effort)
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > lastAllowedTimeRef.current) {
      lastAllowedTimeRef.current = v.currentTime;
    }
  };

  const onSeeking = () => {
    const v = videoRef.current;
    if (!v) return;

    // permite retroceder, bloquea adelantar “brusco”
    const attempted = v.currentTime;
    const last = lastAllowedTimeRef.current;

    if (attempted > last + 0.4) {
      v.currentTime = last;
    }
  };

  const onEnded = async () => {
    await markCompleted();
  };

  // Si no aplica, render normal
  if (!shouldEnforce) return <>{children}</>;

  // Mientras verifica si ya lo vio hoy
  if (loading) return <>{children}</>;

  // Si no hace falta gate
  if (!mustWatch && readyToUnlock) return <>{children}</>;
  if (!mustWatch) return <>{children}</>;

  // Gate overlay
  return (
    <div className="relative">
      {/* bloqueamos UI debajo */}
      <div className="pointer-events-none select-none opacity-40">{children}</div>

      <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Video obligatorio
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Tenés que verlo completo para poder usar la app.
            </p>
            {error ? (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            ) : null}
          </div>

          <div className="p-5">
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full rounded-lg bg-black"
              controls
              // ocultamos acelerar + descargar (no es infalible)
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              playsInline
              onTimeUpdate={onTimeUpdate}
              onSeeking={onSeeking}
              onEnded={onEnded}
              onLoadedMetadata={() => {
                lastAllowedTimeRef.current = 0;
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              *Nota: se dificulta el adelanto, pero no existe bloqueo 100% sin
              DRM/streaming controlado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MandatoryVideoGate;
