import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;
  roleToEnforce: string; // "test" o "vendedor"
  videoId: string;       // ej: "capsula_intro_v1"
  videoSrc: string;      // URL pública del mp4
  oncePerDay?: boolean;  // default true
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
  roleToEnforce,
  videoId,
  videoSrc,
  oncePerDay = true,
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
    return user.role === roleToEnforce;
  }, [user, roleToEnforce]);

  // 🔑 IMPORTANTE: usamos el UID real de Supabase Auth (no el id de tu tabla users)
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) {
          setAuthUid(null);
          return;
        }
        setAuthUid(data.user?.id ?? null);
      } catch {
        if (!mounted) return;
        setAuthUid(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const storageKey = useMemo(() => {
    const uid = authUid || "unknown";
    return `mandatory_video_done:${uid}:${roleToEnforce}:${videoId}:${dayKey}`;
  }, [authUid, roleToEnforce, videoId, dayKey]);

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

  // 🔒 Anti-seek (no es DRM, pero dificulta bastante)
  const lastTimeRef = useRef(0);
  const allowSeekTolerance = 0.75;

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    const t = v.currentTime;

    // intento de adelanto grande
    if (t > lastTimeRef.current + allowSeekTolerance) {
      v.currentTime = lastTimeRef.current;
      return;
    }

    if (t > lastTimeRef.current) {
      lastTimeRef.current = t;
    }
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

    // Si es once-per-day y ya está marcado localmente, listo
    if (oncePerDay && isDoneLocally()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    // Si todavía no tenemos auth uid, no podemos chequear DB de forma confiable
    if (!authUid) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    setErrorMsg(null);

    try {
      const q = supabase
        .from("video_watch_daily")
        .select("id, completed, watched_on, video_id")
        .eq("user_id", authUid)
        .eq("video_id", videoId);

      const { data, error } = oncePerDay
        ? await q.eq("watched_on", dayKey).maybeSingle()
        : await q.order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (error) {
        // Si falla por RLS u otra cosa, lo dejamos bloqueado (así ves el error)
        setErrorMsg(error.message);
        setAllowed(false);
      } else {
        if (data?.completed) {
          if (oncePerDay) markDoneLocally();
          setAllowed(true);
        } else {
          setAllowed(false);
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Error verificando el video.");
      setAllowed(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // re-chequea cuando ya conocemos el authUid
    if (!mustEnforce) {
      setAllowed(true);
      setChecking(false);
      return;
    }
    setChecking(true);
    checkAlreadyDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustEnforce, authUid, videoId]);

  const saveCompletion = async () => {
    if (!authUid) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      // ✅ insert “simple” (si querés evitar duplicados, hacemos upsert con unique constraint)
      const payload: any = {
        user_id: authUid,
        username: user?.username ?? null,
        role: user?.role ?? null,
        video_id: videoId,
        watched_on: dayKey,
        completed: true,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("video_watch_daily").insert([payload]);

      if (error) {
        // si RLS está mal, lo vas a ver acá
        setErrorMsg(error.message);
        return;
      }

      if (oncePerDay) markDoneLocally();
      setAllowed(true);
    } catch (e: any) {
      setErrorMsg(e?.message || "Error guardando el video.");
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

          {errorMsg && (
            <p className="mt-2 text-sm text-red-600 break-words">{errorMsg}</p>
          )}
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
              title="Se habilita cuando termine el video"
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
