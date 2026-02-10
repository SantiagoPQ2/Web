import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;
  roleToEnforce?: string; // default: "test"
  videoSrc: string; // URL pública (Supabase Storage public o signed)
  oncePerDay?: boolean; // default: true
};

function ymd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const MandatoryVideoGate: React.FC<Props> = ({
  children,
  roleToEnforce = "test",
  videoSrc,
  oncePerDay = true,
}) => {
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [mustWatch, setMustWatch] = useState(false);
  const [maxTimeReached, setMaxTimeReached] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // iOS-friendly autoplay

  const storageKey = useMemo(() => {
    const userId = user?.id || user?.username || "anon";
    const datePart = oncePerDay ? ymd() : "always";
    return `mandatory_video_${roleToEnforce}_${userId}_${datePart}`;
  }, [user?.id, user?.username, oncePerDay, roleToEnforce]);

  useEffect(() => {
    // Si no hay user, no bloqueamos (igual te manda a Login por App)
    if (!user) {
      setMustWatch(false);
      return;
    }

    // Solo aplica al rol target
    if (user.role !== roleToEnforce) {
      setMustWatch(false);
      return;
    }

    // Si ya lo vio (por día), no bloquea
    const done = localStorage.getItem(storageKey) === "done";
    setMustWatch(!done);

    // Reset anti-skip cuando toca ver
    setMaxTimeReached(0);
    setIsMuted(true);
  }, [user, roleToEnforce, storageKey]);

  const markDone = () => {
    localStorage.setItem(storageKey, "done");
    setMustWatch(false);
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    // Guardamos el máximo alcanzado para evitar “seek” hacia adelante
    if (v.currentTime > maxTimeReached) {
      setMaxTimeReached(v.currentTime);
    }
  };

  const onSeeking = () => {
    const v = videoRef.current;
    if (!v) return;

    // Anti-skip: si quiere adelantarse más de lo visto, lo devolvemos
    const tolerance = 0.8; // tolerancia por buffering
    if (v.currentTime > maxTimeReached + tolerance) {
      v.currentTime = maxTimeReached;
    }
  };

  const onEnded = () => {
    markDone();
  };

  const tryPlayWithSound = async () => {
    const v = videoRef.current;
    if (!v) return;

    try {
      v.muted = false;
      setIsMuted(false);
      await v.play();
    } catch {
      // Si el navegador bloquea play con sonido hasta gesto del usuario,
      // el click ya es gesto, normalmente acá funciona.
    }
  };

  if (!mustWatch) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      style={{ touchAction: "none" }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Video obligatorio</h2>
          <p className="text-sm text-gray-600">
            Debés verlo completo para continuar.
          </p>
        </div>

        <div className="p-4">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full rounded-lg bg-black"
            autoPlay
            playsInline
            muted={isMuted}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onTimeUpdate={onTimeUpdate}
            onSeeking={onSeeking}
            onEnded={onEnded}
          />

          {/* iOS/Android: para asegurar sonido, arrancamos muteado */}
          {isMuted && (
            <button
              type="button"
              onClick={tryPlayWithSound}
              className="mt-3 w-full sm:w-auto px-4 py-2 rounded-md bg-red-700 text-white font-semibold hover:bg-red-800 transition"
            >
              Activar audio
            </button>
          )}

          <div className="mt-3 text-xs text-gray-500">
            * No se puede adelantar: si intentás, vuelve al último punto visto.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MandatoryVideoGate;
