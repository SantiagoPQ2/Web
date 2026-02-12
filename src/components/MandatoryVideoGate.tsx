import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;
  rolesToEnforce: string[]; // ej: ["test"] o ["test","vendedor"]
  videoId: string;          // ej: "capsula_intro_v1"
  videoSrc: string;         // URL pública del mp4
  oncePerDay?: boolean;     // default true
  // si querés loguear en DB, nombre de tabla (si no existe o no querés usar DB, dejalo null)
  logTable?: string | null; // ej: "video_watch_daily"
};

function getLocalDayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

const MandatoryVideoGate: React.FC<Props> = ({
  children,
  rolesToEnforce,
  videoId,
  videoSrc,
  oncePerDay = true,
  logTable = "video_watch_daily",
}) => {
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const dayKey = useMemo(() => getLocalDayKey(), []);
  const mustEnforce = useMemo(() => {
    if (!user) return false;
    return rolesToEnforce.includes(user.role);
  }, [user, rolesToEnforce]);

  // ✅ tu “user_id real” viene de tu tabla auxiliar
  const userId = user?.id ?? null; // OJO: este es el id de usuarios_app
  const username = user?.username ?? "";
  const role = user?.role ?? "";

  const storageKey = useMemo(() => {
    const uid = userId ? String(userId) : "unknown";
    return `mandatory_video_done:${uid}:${role}:${videoId}:${dayKey}`;
  }, [userId, role, videoId, dayKey]);

  const markDoneLocally = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  };

  const isDoneLocally = () => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  };

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
    if (!mustEnforce) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    // ✅ la regla de “una vez por día” la resolvemos 100% del lado del cliente
    // (porque tu auth no es supabase auth)
    if (oncePerDay && isDoneLocally()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    // si no hay userId no podemos validar nada
    if (!userId) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    // Si querés, acá podrías también chequear DB, pero SOLO si la tabla no tiene RLS
    // o tiene una policy que permita insertar/leer sin auth.
    // Para no romper, lo dejamos optativo:
    if (!logTable) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    try {
      // si existe un registro "completed" hoy, lo dejamos pasar
      const q = supabase
        .from(logTable)
        .select("id, completed, watched_on, video_id")
        .eq("user_id", String(userId))
        .eq("video_id", videoId);

      const { data, error } = oncePerDay
        ? await q.eq("watched_on", dayKey).maybeSingle()
        : await q.order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (error) {
        // si falla por RLS u otra cosa, seguimos usando solo localStorage (bloquea hasta ver)
        setErrorMsg(null);
        setAllowed(false);
      } else if (data?.completed) {
        if (oncePerDay) markDoneLocally();
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch {
      setAllowed(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    setChecking(true);
    setErrorMsg(null);
    checkAlreadyDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustEnforce, userId, videoId]);

  const saveCompletion = async () => {
    // ✅ siempre marcamos local primero (esto garantiza once-per-day aunque se deslogueen)
    if (oncePerDay) markDoneLocally();

    if (!logTable || !userId) {
      setAllowed(true);
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        user_id: String(userId),     // id de usuarios_app, no auth.uid
        username,
        role,
        video_id: videoId,
        watched_on: dayKey,
        completed: true,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(logTable).insert([payload]);

      // Si falla (RLS, etc) no frenamos el uso: ya está marcado localmente
      if (error) {
        setErrorMsg(null);
      }

      setAllowed(true);
    } catch {
      setAllowed(true);
    } finally {
      setSaving(false);
    }
  };

  const onEnded = async () => {
    await saveCompletion();
  };

  if (!mustEnforce) return <>{children}</>;
  if (checking) return <>{children}</>;
  if (allowed) return <>{children}</>;

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

          {/* Si querés mostrar error, lo dejamos apagado para no confundir */}
          {/* {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>} */}
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
