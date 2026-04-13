import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type UsuarioAppRow = {
  id: string;
  username: string | null;
  role: string | null;
};

type SnapshotRow = {
  id: number;
  snapshot_date: string | null;
  snapshot_taken_at: string | null;
  dia_codigo: string | null;
  user_id: string | null;
  username: string | null;
  nombre_mostrar: string | null;
  ffvv: string | null;
  role: string | null;
  pdv_planificados: number | null;
  pdv_visitados: number | null;
  pdv_menos_5_min: number | null;
  horas_trabajadas: number | null;
  puntos_gps: number | null;
  primera_marca: string | null;
  ultima_marca: string | null;
  created_at: string | null;
  fecha: string | null;
};

type Top5Row = {
  cliente: string | number | null;
  vendedor_username: string | number | null;
  dia: string | null;
};

type CoordenadaRow = {
  nombre: string | number | null;
  created_by: string | null;
  vendedor_username?: string | null;
  created_at: string | null;
};

type PopupItem = {
  id: string;
  title: string;
  body: string;
};

type Checkpoint = {
  id: "11:00" | "12:30" | "14:00";
  minutes: number;
  workedHours: number;
};

const CHECKPOINTS: Checkpoint[] = [
  { id: "11:00", minutes: 11 * 60, workedHours: 3 },
  { id: "12:30", minutes: 12 * 60 + 30, workedHours: 4.5 },
  { id: "14:00", minutes: 14 * 60, workedHours: 6 },
];

const FULL_DAY_HOURS = 7;

function getArgentinaNowParts() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dayText = dateFormatter.format(now); // YYYY-MM-DD
  const timeText = timeFormatter.format(now); // HH:mm

  const [year, month, day] = dayText.split("-");
  const [hour, minute] = timeText.split(":").map(Number);

  return {
    dateKey: `${year}-${month}-${day}`,
    minutesNow: hour * 60 + minute,
  };
}

function getDiaCodigoArgentina() {
  const buenosAiresNow = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    })
  );

  const map = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  return map[buenosAiresNow.getDay()];
}

function normalizeCliente(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^0+/, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSeenKey(username: string, type: string, checkpointId: string) {
  const { dateKey } = getArgentinaNowParts();
  return `route_popup_seen:${username}:${dateKey}:${type}:${checkpointId}`;
}

function wasSeen(username: string, type: string, checkpointId: string) {
  try {
    return localStorage.getItem(buildSeenKey(username, type, checkpointId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(username: string, type: string, checkpointId: string) {
  try {
    localStorage.setItem(buildSeenKey(username, type, checkpointId), "1");
  } catch {
    // ignore
  }
}

function getActiveCheckpoint(): Checkpoint | null {
  const { minutesNow } = getArgentinaNowParts();
  const eligible = CHECKPOINTS.filter((cp) => cp.minutes <= minutesNow);
  if (eligible.length === 0) return null;
  return eligible[eligible.length - 1];
}

function formatPercent(value: number) {
  return String(Math.round(value));
}

const RouteProgressPopup: React.FC = () => {
  const { user } = useAuth();

  const [items, setItems] = useState<PopupItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [verifiedVendor, setVerifiedVendor] = useState<boolean | null>(null);

  const checkingRef = useRef(false);

  const currentItem = useMemo(() => items[currentIndex] ?? null, [items, currentIndex]);

  useEffect(() => {
    let cancelled = false;

    const verifyRole = async () => {
      if (!user?.username && !user?.id) {
        if (!cancelled) setVerifiedVendor(false);
        return;
      }

      let query = supabase.from("usuarios_app").select("id, username, role").limit(1);

      if (user?.id) {
        query = query.eq("id", user.id);
      } else {
        query = query.eq("username", user?.username);
      }

      const { data, error } = await query.maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Error validando rol en usuarios_app:", error);
        setVerifiedVendor(false);
        return;
      }

      const row = (data as UsuarioAppRow | null) ?? null;
      setVerifiedVendor((row?.role || "").toLowerCase() === "vendedor");
    };

    verifyRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!user?.username) return;
    if (verifiedVendor !== true) return;

    const run = async () => {
      if (checkingRef.current) return;

      const checkpoint = getActiveCheckpoint();
      if (!checkpoint) return;

      const usernameStr = String(user.username);
      const usernameNum = Number(user.username);

      const needRoute = !wasSeen(usernameStr, "route", checkpoint.id);
      const needTop5 = !wasSeen(usernameStr, "top5", checkpoint.id);

      if (!needRoute && !needTop5) return;

      checkingRef.current = true;

      try {
        const newItems: PopupItem[] = [];

        if (needRoute) {
          const { data: snapshotRows, error: snapshotError } = await supabase
            .from("admin_equipo_snapshots")
            .select("*")
            .eq("username", usernameStr)
            .order("snapshot_date", { ascending: false })
            .order("snapshot_taken_at", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);

          if (snapshotError) {
            console.error("Error cargando snapshot:", snapshotError);
          } else {
            const snap = ((snapshotRows || [])[0] as SnapshotRow | undefined) ?? undefined;

            if (snap) {
              const visitados = safeNumber(snap.pdv_visitados);
              const planificados = safeNumber(snap.pdv_planificados);

              if (planificados > 0) {
                const projected =
                  (visitados / planificados) *
                  (FULL_DAY_HOURS / checkpoint.workedHours) *
                  100;

                const projectedBounded = Math.max(0, Math.min(100, projected));

                newItems.push({
                  id: `route-${checkpoint.id}`,
                  title: "Resumen de gestión",
                  body: `Visitaste "${visitados}" clientes de "${planificados}". Si seguís así terminás la ruta con el "${formatPercent(
                    projectedBounded
                  )}%".`,
                });
              }
            }
          }
        }

        if (needTop5) {
          const diaCodigo = getDiaCodigoArgentina();

          let top5Query = supabase
            .from("top_5")
            .select("cliente, vendedor_username, dia")
            .eq("dia", diaCodigo);

          if (Number.isFinite(usernameNum)) {
            top5Query = top5Query.eq("vendedor_username", usernameNum);
          } else {
            top5Query = top5Query.eq("vendedor_username", usernameStr);
          }

          const { data: top5Rows, error: top5Error } = await top5Query;

          if (top5Error) {
            console.error("Error cargando TOP 5:", top5Error);
          } else {
            const top5 = (top5Rows as Top5Row[] | null) ?? [];

            const clientesTop5 = Array.from(
              new Set(
                top5
                  .map((row) => normalizeCliente(row.cliente))
                  .filter((v) => v.length > 0)
              )
            );

            if (clientesTop5.length > 0) {
              const { dateKey } = getArgentinaNowParts();
              const startIso = `${dateKey}T00:00:00-03:00`;
              const endIso = `${dateKey}T23:59:59-03:00`;

              const { data: coordsRows, error: coordsError } = await supabase
                .from("coordenadas")
                .select("nombre, created_by, vendedor_username, created_at")
                .or(
                  `created_by.eq.${usernameStr},vendedor_username.eq.${usernameStr}`
                )
                .gte("created_at", startIso)
                .lte("created_at", endIso);

              if (coordsError) {
                console.error("Error cargando coordenadas para TOP 5:", coordsError);
              } else {
                const coords = (coordsRows as CoordenadaRow[] | null) ?? [];

                const visitadosTop5 = new Set(
                  coords
                    .map((row) => normalizeCliente(row.nombre))
                    .filter((nombre) => clientesTop5.includes(nombre))
                );

                const hechos = visitadosTop5.size;
                const total = clientesTop5.length;

                newItems.push({
                  id: `top5-${checkpoint.id}`,
                  title: "Seguimiento TOP 5",
                  body: `Ya hiciste "${hechos}" de "${total}" clientes de tu TOP 5, no olvides visitar los faltantes.`,
                });
              }
            }
          }
        }

        if (newItems.length > 0) {
          setItems(newItems);
          setCurrentIndex(0);

          if (needRoute) markSeen(usernameStr, "route", checkpoint.id);
          if (needTop5) markSeen(usernameStr, "top5", checkpoint.id);
        }
      } finally {
        checkingRef.current = false;
      }
    };

    run();

    const intervalId = window.setInterval(run, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.username, verifiedVendor]);

  const handleClose = () => {
    const next = currentIndex + 1;

    if (next < items.length) {
      setCurrentIndex(next);
      return;
    }

    setItems([]);
    setCurrentIndex(0);
  };

  if (verifiedVendor !== true) return null;
  if (!currentItem) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[90]" />

      <div className="fixed inset-0 z-[91] flex items-center justify-center px-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-red-600 to-rose-500 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm tracking-wide">
              ALERTA DE GESTIÓN
            </h3>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1 text-white/90 hover:bg-white/20"
              aria-label="Cerrar popup"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            <h4 className="mb-2 text-base font-bold text-gray-900">
              {currentItem.title}
            </h4>

            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-line">
              {currentItem.body}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteProgressPopup;
