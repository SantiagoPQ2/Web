import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;

  // Roles que deben ver el video (ej: ["test"])
  rolesToEnforce: string[];

  // Identificador del video (si mañana cambiás video, cambiás este ID)
  videoId: string;

  // URL pública del mp4
  videoSrc: string;

  // default true => 1 vez por día por usuario
  oncePerDay?: boolean;

  // Tabla donde se guarda el "visto hoy"
  dailyTable?: string; // default: "video_watch_daily"
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

  // ✅ ESTE id es el uuid de usuarios_app (tu login real)
  const userId = user?.id ?? null;

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
      let q = supabase
        .from(dailyTable)
        .select("id, completed, watched_on, video_id")
        .eq("user_id", userId)
        .eq("video_id", videoId);

      if (oncePerDay) q = q.eq("watched_on", dayKey);

      const { data, error } = await q.maybeSingle();

      if (error) {
        // Si falla la query, mejor bloquear que dejar pasar
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
      // ✅ SOLO columnas que existen en tu tabla (según tu captura)
      const payload = {
        user_id: userId, // uuid (usuarios_app.id)
        video_id: videoId, // text
        watched_on: dayKey, // date (YYYY-MM-DD)
        completed: true, // bool
      };

      // Con el UNIQUE index (user_id, video_id, watched_on) esto queda perfecto:
      const { error: upsertErr } = await supabase
        .from(dailyTable)
        .upsert([payload], { onConflict: "user_id,video_id,watched_on" });

      if (upsertErr) {
        // fallback simple
        await supabase.from(dailyTable).insert([payload]);
      }

      setAllowed(true);
    } catch {
      // si falla DB, no lo dejes bloqueado infinito
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

  // Mientras chequea, no bloqueamos la app (si querés bloquear también, lo cambio)
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
