// src/components/MandatoryVideoGate.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;
  roleToEnforce: string; // "test" o "vendedor"
  videoId: string; // ej: "capsula_intro_v1"
  videoSrc: string; // URL pública del mp4
  oncePerDay?: boolean; // default true
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

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const dayKey = useMemo(() => getLocalDayKey(), []);

  const mustEnforce = useMemo(() => {
    if (!user) return false;
    return user.role === roleToEnforce;
  }, [user, roleToEnforce]);

  const storageKey = useMemo(() => {
    const uid = (user as any)?.id || (user as any)?.user_id || "unknown";
    return `mandatory_video_done:${uid}:${roleToEnforce}:${videoId}:${dayKey}`;
  }, [user, roleToEnforce, videoId, dayKey]);

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

  // 🔒 Anti-seek (dificulta adelantar, no es 100% imposible)
  const lastTimeRef = useRef(0);
  const allowSeekTolerance = 0.75; // segs permitidos por buffering

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    const t = v.currentTime;

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

    if (oncePerDay && isDoneLocally()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    const uid = (user as any)?.id || (user as any)?.user_id;
    if (!uid) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    try {
      setErrorMsg(null);

      const q = supabase
        .from("video_watch_daily")
        .select("id, completed, watched_on, video_id")
        .eq("user_id", uid)
        .eq("video_id", videoId);

      const { data, error } = oncePerDay
        ? await q.eq("watched_on", dayKey).maybeSingle()
        : await q.order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (error) {
        console.warn("video_watch_daily select error:", error.message);
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
      console.warn("video_watch_daily check exception:", e?.message || e);
      setAllowed(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAlreadyDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustEnforce, videoId]);

  const saveCompletion = async () => {
    if (!user) return;
    const uid = (user as any)?.id || (user as any)?.user_id;
    if (!uid) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        user_id: uid,
        username: user.username,
        role: user.role,
        video_id: videoId,
        watched_on: dayKey,
        completed: true,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("video_watch_daily").insert([payload]);

      if (error) {
        console.warn("video_watch_daily insert error:", error.message);
        setErrorMsg(error.message);

        // ✅ fallback local para que sea 1 vez al día aunque falle el insert
        if (oncePerDay) markDoneLocally();
        setAllowed(true);
        return;
      }

      if (oncePerDay) markDoneLocally();
      setAllowed(true);
    } catch (e: any) {
      console.warn("saveCompletion exception:", e?.message || e);
      setErrorMsg(e?.message || "Error guardando el video.");

      // ✅ fallback local para no romper operación
      if (oncePerDay) markDoneLocally();
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              *Se dificulta el adelanto, pero no existe bloqueo 100% sin DRM/streaming
              controlado.
            </div>

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
