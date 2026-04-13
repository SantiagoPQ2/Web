import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../config/supabase";

type StoredUser = {
  id?: string;
  username?: string;
  role?: string;
  name?: string;
} | null;

type SnapshotRow = {
  user_id: string | null;
  username: string | null;
  pdv_planificados: number | null;
  pdv_visitados: number | null;
  snapshot_date?: string | null;
  snapshot_taken_at?: string | null;
  created_at?: string | null;
};

type Top5Row = {
  cliente: string | number | null;
  vendedor_username: string | number | null;
  dia: string | null;
};

type CoordenadaRow = {
  nombre: string | number | null;
  created_at: string | null;
  created_by?: string | null;
};

type PopupMessage = {
  id: string;
  title: string;
  body: string;
};

type Checkpoint = {
  id: string;
  minutes: number;
  workedHours: number;
};

const CHECKPOINTS: Checkpoint[] = [
  { id: "11:00", minutes: 11 * 60, workedHours: 3 },
  { id: "12:30", minutes: 12 * 60 + 30, workedHours: 4.5 },
  { id: "14:00", minutes: 14 * 60, workedHours: 6 },
];

const WORKDAY_HOURS = 7;

function getStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayDayCode() {
  const days = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  return days[new Date().getDay()];
}

function getMinutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function normalizeValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function buildSeenKey(type: string, checkpointId: string) {
  return `route-popup:${type}:${getTodayKey()}:${checkpointId}`;
}

function isSeen(type: string, checkpointId: string) {
  return localStorage.getItem(buildSeenKey(type, checkpointId)) === "1";
}

function markSeen(type: string, checkpointId: string) {
  localStorage.setItem(buildSeenKey(type, checkpointId), "1");
}

function getActiveCheckpoint(): Checkpoint | null {
  const currentMinutes = getMinutesNow();

  const eligible = CHECKPOINTS.filter((cp) => cp.minutes <= currentMinutes);
  if (eligible.length === 0) return null;

  // Tomo el último checkpoint alcanzado del día.
  return eligible[eligible.length - 1];
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value));
}

const RouteProgressPopup: React.FC = () => {
  const [messages, setMessages] = useState<PopupMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const user = useMemo(() => getStoredUser(), []);

  useEffect(() => {
    const run = async () => {
      if (!user?.username && !user?.id) return;
      if (user?.role === "admin") return;

      const checkpoint = getActiveCheckpoint();
      if (!checkpoint) return;

      const pendingRoute = !isSeen("route", checkpoint.id);
      const pendingTop5 = !isSeen("top5", checkpoint.id);

      if (!pendingRoute && !pendingTop5) return;

      setLoading(true);

      try {
        const newMessages: PopupMessage[] = [];

        // =========================
        // 1) MENSAJE DE RUTA
        // =========================
        if (pendingRoute) {
          let snapshotQuery = supabase
            .from("admin_equipo_snapshots")
            .select(
              "user_id, username, pdv_planificados, pdv_visitados, snapshot_date, snapshot_taken_at, created_at"
            )
            .order("snapshot_date", { ascending: false })
            .order("snapshot_taken_at", { ascending: false })
            .limit(1);

          if (user.id) {
            snapshotQuery = snapshotQuery.eq("user_id", user.id);
          } else if (user.username) {
            snapshotQuery = snapshotQuery.eq("username", String(user.username));
          }

          const { data: snapshotData, error: snapshotError } = await snapshotQuery;

          if (snapshotError) {
            console.error("❌ Error cargando snapshot:", snapshotError.message);
          } else {
            const snapshot = (snapshotData?.[0] as SnapshotRow | undefined) ?? undefined;
            const visitados = Number(snapshot?.pdv_visitados ?? 0);
            const planificados = Number(snapshot?.pdv_planificados ?? 0);

            if (planificados > 0) {
              const projectedPercent =
                (visitados / planificados) * (WORKDAY_HOURS / checkpoint.workedHours) * 100;

              const boundedPercent = Math.max(0, Math.min(100, projectedPercent));

              newMessages.push({
                id: `route-${checkpoint.id}`,
                title: "Avance de ruta",
                body: `Visitaste "${visitados}" clientes de "${planificados}". Si seguís así terminás la ruta con el "${formatPercent(
                  boundedPercent
                )}%".`,
              });
            }
          }
        }

        // =========================
        // 2) MENSAJE TOP 5
        // =========================
        if (pendingTop5 && user.username) {
          const todayCode = getTodayDayCode();

          const { data: top5Data, error: top5Error } = await supabase
            .from("top_5")
            .select("cliente, vendedor_username, dia")
            .eq("vendedor_username", String(user.username))
            .eq("dia", todayCode);

          if (top5Error) {
            console.error("❌ Error cargando top_5:", top5Error.message);
          } else {
            const top5Rows = (top5Data as Top5Row[] | null) ?? [];
            const top5Clientes = Array.from(
              new Set(
                top5Rows
                  .map((r) => normalizeValue(r.cliente))
                  .filter((v) => v.length > 0)
              )
            );

            const totalTop5 = top5Clientes.length;

            if (totalTop5 > 0) {
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);

              const endOfDay = new Date();
              endOfDay.setHours(23, 59, 59, 999);

              const { data: coordsData, error: coordsError } = await supabase
                .from("coordenadas")
                .select("nombre, created_at, created_by")
                .eq("created_by", String(user.username))
                .gte("created_at", startOfDay.toISOString())
                .lte("created_at", endOfDay.toISOString());

              if (coordsError) {
                console.error("❌ Error cargando coordenadas:", coordsError.message);
              } else {
                const coordsRows = (coordsData as CoordenadaRow[] | null) ?? [];

                const visitadosHoy = new Set(
                  coordsRows
                    .map((r) => normalizeValue(r.nombre))
                    .filter((v) => top5Clientes.includes(v))
                );

                const hechos = visitadosHoy.size;

                newMessages.push({
                  id: `top5-${checkpoint.id}`,
                  title: "Avance de TOP 5",
                  body: `Ya hiciste "${hechos}" de "${totalTop5}" clientes de tu TOP 5, no olvides visitar los faltantes.`,
                });
              }
            }
          }
        }

        if (newMessages.length > 0) {
          setMessages(newMessages);
          setCurrentIndex(0);

          if (pendingRoute) markSeen("route", checkpoint.id);
          if (pendingTop5) markSeen("top5", checkpoint.id);
        }
      } finally {
        setLoading(false);
      }
    };

    run();

    const interval = window.setInterval(() => {
      run();
    }, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [user?.id, user?.role, user?.username]);

  const currentMessage = messages[currentIndex] ?? null;

  const handleClose = () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex < messages.length) {
      setCurrentIndex(nextIndex);
      return;
    }

    setMessages([]);
    setCurrentIndex(0);
  };

  if (loading && !currentMessage) return null;
  if (!currentMessage) return null;

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
              {currentMessage.title}
            </h3>

            <p className="text-sm leading-6 text-gray-700">
              {currentMessage.body}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteProgressPopup;
