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
  vendedor_username: string | null;
  dia: string | null;
};

type CoordenadaRow = {
  nombre: string | null;
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

function getNowInArgentina() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  const weekdayRaw = pick("weekday").toLowerCase();

  return {
    dateKey: `${year}-${month}-${day}`,
    minutesNow: hour * 60 + minute,
    weekdayRaw,
  };
}

function getDiaCodigoArgentina() {
  const { weekdayRaw } = getNowInArgentina();

  if (weekdayRaw.includes("sun")) return "DOM";
  if (weekdayRaw.includes("mon")) return "LUN";
  if (weekdayRaw.includes("tue")) return "MAR";
  if (weekdayRaw.includes("wed")) return "MIE";
  if (weekdayRaw.includes("thu")) return "JUE";
  if (weekdayRaw.includes("fri")) return "VIE";
  return "SAB";
}

function normalizeValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSeenKey(username: string, type: string, checkpointId: string) {
  const { dateKey } = getNowInArgentina();
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

function getActiveCheckpoint() {
  const { minutesNow } = getNowInArgentina();
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

      const query = supabase
        .from("usuarios_app")
        .select("id, username, role")
        .limit(1);

      let finalQuery = query;

      if (user?.id) {
        finalQuery = finalQuery.eq("id", user.id);
      } else {
        finalQuery = finalQuery.eq("username", user?.username);
      }

      const { data, error } = await finalQuery.maybeSingle();

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

      const needRoute = !wasSeen(user.username!, "route", checkpoint.id);
      const needTop5 = !wasSeen(user.username!, "top5", checkpoint.id);

      if (!needRoute && !needTop5) return;

      checkingRef.current = true;

      try {
        const newItems: PopupItem[] = [];

        if (needRoute) {
          const { data: snapshotRows, error: snapshotError } = await supabase
            .from("admin_equipo_snapshots")
            .select("*")
            .eq("username", user.username)
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
                  title: "Resumen de ruta",
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

          const { data: top5Rows, error: top5Error } = await supabase
            .from("top_5")
            .select("cliente, vendedor_username, dia")
            .eq("vendedor_username", user.username)
            .eq("dia", diaCodigo);

          if (top5Error) {
            console.error("Error cargando TOP 5:", top5Error);
          } else {
            const top5 = (top5Rows as Top5Row[] | null) ?? [];

            const clientesTop5 = Array.from(
              new Set(
                top5
                  .map((row) => normalizeValue(row.cliente))
                  .filter((v) => v.length > 0)
              )
            );

            if (clientesTop5.length > 0) {
              const { dateKey } = getNowInArgentina();
              const startIso = `${dateKey}T00:00:00-03:00`;
              const endIso = `${dateKey}T23:59:59-03:00`;

              const { data: coordsRows, error: coordsError } = await supabase
                .from("coordenadas")
                .select("nombre, created_by, vendedor_username, created_at")
                .or(
                  `created_by.eq.${user.username},vendedor_username.eq.${user.username}`
                )
                .gte("created_at", startIso)
                .lte("created_at", endIso);

              if (coordsError) {
                console.error("Error cargando coordenadas para TOP 5:", coordsError);
              } else {
                const coords = (coordsRows as CoordenadaRow[] | null) ?? [];

                const visitadosTop5 = new Set(
                  coords
                    .map((row) => normalizeValue(row.nombre))
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

          if (needRoute) markSeen(user.username!, "route", checkpoint.id);
          if (needTop5) markSeen(user.username!, "top5", checkpoint.id);
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
      <div className="fixed inset-0 bg-black/35 z-[90]" />

      <div className="fixed inset-0 z-[91] flex items-center justify-center px-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-5">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar popup"
          >
            <X size={18} />
          </button>

          <div className="pr-10">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {currentItem.title}
            </h3>

            <p className="text-sm leading-6 text-gray-700 whitespace-pre-line">
              {currentItem.body}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteProgressPopup;
