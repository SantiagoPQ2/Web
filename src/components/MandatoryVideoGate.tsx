import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;

  // Roles que deben ver el video (ej: ["test"] o ["test","vendedor"])
  rolesToEnforce: string[];

  // Identificador del video (si mañana cambiás video, cambiás este ID)
  videoId: string;

  // URL pública del mp4
  videoSrc: string;

  // default true => 1 vez por día por usuario
  oncePerDay?: boolean;

  // Tabla donde se guarda el "visto hoy"
  // (según tu captura: public.video_watch_daily)
  dailyTable?: string;
};

// YYYY-MM-DD (local)
function getLocalDayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MandatoryVideoGate: React.FC<Props> = ({
  children,
  rolesToEnforce,
  videoId,
  videoSrc,
  oncePerDay = true,
  dailyTable = "video_watch_daily",
}) => {
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const mustEnforce = useMemo(() => {
    if (!user) return false;
    return rolesToEnforce.includes(user.role);
  }, [user, rolesToEnforce]);

  // IMPORTANTÍSIMO: tu user_id es el uuid de usuarios_app
  const userId = user?.id ?? null;

  // 🔒 Anti-seek (no es DRM, pero dificulta adelantar)
  const lastTimeRef = useRef(0);
  const allowSeekTolerance = 0.75;

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;

    if (t > lastTimeRef.current + allowSeekTolerance) {
      v.currentTime = lastTimeRef.current;
      return;
    }
    if (t > lastTimeRef.current) lastTimeRef.current = t;
  };

  const onSeeking = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > lastTimeRef.current + allowSeekTolerance) {
      v.currentTime = lastTimeRef.current;
    }
  };

  const checkAlreadyDone = async () => {
    // Si no aplica, no bloqueamos
    if (!mustEnforce) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    // Si no hay userId no podemos validar
    if (!userId) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    const dayKey = getLocalDayKey();

    try {
      // Si ya hay un registro "completed" hoy, dejamos pasar
      let q = supabase
        .from(dailyTable)
        .select("id, completed, watched_on, video_id")
        .eq("user_id", userId)
        .eq("video_id", videoId);

      if (oncePerDay) q = q.eq("watched_on", dayKey);

      const { data, error } = await q.maybeSingle();

      if (error) {
        // Si falla la query, bloqueamos (mejor bloquear que dejar pasar)
        setAllowed(false);
      } else {
        setAllowed(!!data?.completed);
      }
    } catch {
      setAllowed(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    setChecking(true);
    setAllowed(false);
    lastTimeRef.current = 0;
    checkAlreadyDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustEnforce, userId, videoId, oncePerDay]);

  const saveCompletion = async () => {
    if (!userId) {
      setAllowed(true);
      return;
    }

    const dayKey = getLocalDayKey();

    setSaving(true);
    try {
      // 🚨 Solo columnas que EXISTEN en tu tabla (según tu captura)
      const payload = {
        user_id: userId,       // uuid
        video_id: videoId,     // text
        watched_on: dayKey,    // date (YYYY-MM-DD)
        completed: true,       // bool
      };

      // Intento 1: upsert con onConflict (ideal si hay UNIQUE)
      // Si NO tenés un índice único, puede fallar => hacemos fallback a insert.
      const { error: upsertErr } = await supabase
        .from(dailyTable)
        .upsert([payload], { onConflict: "user_id,video_id,watched_on" });

      if (upsertErr) {
        // Fallback: insert simple (si ya existiera, podría fallar por duplicado si luego agregás unique)
        const { error: insErr } = await supabase.from(dailyTable).insert([payload]);
        if (insErr) {
          // Último fallback: si ya existía, hacemos update
          await supabase
            .from(dailyTable)
            .update({ completed: true })
            .eq("user_id", userId)
            .eq("video_id", videoId)
            .eq("watched_on", dayKey);
        }
      }

      setAllowed(true);
    } catch {
      // Aunque falle DB, no conviene dejarlo bloqueado indefinidamente
      setAllowed(true);
    } finally {
      setSaving(false);
    }
  };

  const onEnded = async () => {
    await saveCompletion();
  };

  // No aplica => render normal
  if (!mustEnforce) return <>{children}</>;

  // Mientras chequea, dejá usar la app (si querés bloquear también durante checking, lo cambio)
  if (checking) return <>{children}</>;

  // Si ya cumplió hoy => render normal
  if (allowed) return <>{children}</>;

  // Gate
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Video obligatorio
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Tenés que verlo completo para poder usar la app.
          </p>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              playsInline
              onTimeUpdate={onTimeUpdate}
              onSeeking={onSeeking}
              onEnded={onEnded}
              className="w-full h-auto max-h-[70vh]"
            />
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              disabled
              className="px-4 py-2 rounded-md bg-gray-200 text-gray-500 text-sm cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Bloqueado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MandatoryVideoGate;
