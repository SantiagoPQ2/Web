import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, TrendingUp, Target } from "lucide-react";
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
  razon_social?: string | null;
};

type CoordenadaRow = {
  nombre: string | number | null;
  created_by: string | null;
  vendedor_username?: string | number | null;
  created_at: string | null;
  gps_planificada?: boolean | null;
};

type PopupItem =
  | {
      id: string;
      type: "route";
      visitados: number;
      planificados: number;
      projectedPercent: number;
    }
  | {
      id: string;
      type: "top5";
      hechos: number;
      total: number;
      pendientes: string[];
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

function normalizarTexto(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
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

  const dayText = dateFormatter.format(now);
  const timeText = timeFormatter.format(now);

  const [year, month, day] = dayText.split("-");
  const [hour, minute] = timeText.split(":").map(Number);

  return {
    dateKey: `${year}-${month}-${day}`,
    minutesNow: hour * 60 + minute,
  };
}

function getDiaCodigoArgentina() {
  const now = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    })
  );

  const map = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  return map[now.getDay()];
}

function getRangoUtcDiaArgentina(fechaYYYYMMDD: string) {
  const inicioUtc = new Date(`${fechaYYYYMMDD}T00:00:00-03:00`).toISOString();
  const finUtc = new Date(`${fechaYYYYMMDD}T23:59:59.999-03:00`).toISOString();
  return { inicioUtc, finUtc };
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

function getPercentColorClass(percent: number) {
  if (percent >= 90) return "text-emerald-600";
  if (percent >= 75) return "text-amber-500";
  return "text-red-600";
}

const RouteProgressPopup: React.FC = () => {
  const { user } = useAuth();

  const [items, setItems] = useState<PopupItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [verifiedVendor, setVerifiedVendor] = useState<boolean | null>(null);

  const checkingRef = useRef(false);

  const currentItem = useMemo(
    () => items[currentIndex] ?? null,
    [items, currentIndex]
  );

  useEffect(() => {
    let cancelled = false;

    const verifyRole = async () => {
      if (!user?.username && !user?.id) {
        if (!cancelled) setVerifiedVendor(false);
        return;
      }

      let query = supabase
        .from("usuarios_app")
        .select("id, username, role")
        .limit(1);

      if (user?.id) {
        query = query.eq("id", user.id);
      } else {
        query = query.eq("username", String(user?.username ?? "").trim());
      }

      const { data, error } = await query.maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Error validando rol en usuarios_app:", error);
        setVerifiedVendor(false);
        return;
      }

      const row = (data as UsuarioAppRow | null) ?? null;
      setVerifiedVendor(normalizarTexto(row?.role) === "VENDEDOR");
    };

    verifyRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!user?.username || !user?.id) return;
    if (verifiedVendor !== true) return;

    const run = async () => {
      if (checkingRef.current) return;

      const checkpoint = getActiveCheckpoint();
      if (!checkpoint) return;

      const usernameStr = String(user.username).trim();
      const userId = String(user.id).trim();

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
            const snap =
              ((snapshotRows || [])[0] as SnapshotRow | undefined) ?? undefined;

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
                  type: "route",
                  visitados,
                  planificados,
                  projectedPercent: projectedBounded,
                });
              }
            }
          }
        }

        if (needTop5) {
          const diaCodigo = getDiaCodigoArgentina();
          const { dateKey } = getArgentinaNowParts();
          const { inicioUtc, finUtc } = getRangoUtcDiaArgentina(dateKey);

          const { data: top5Rows, error: top5Error } = await supabase
            .from("top_5")
            .select("cliente, vendedor_username, dia, razon_social")
            .eq("vendedor_username", usernameStr)
            .eq("dia", diaCodigo);

          if (top5Error) {
            console.error("Error cargando TOP 5:", top5Error);
          } else {
            const top5 = (top5Rows as Top5Row[] | null) ?? [];

            const clientesTop5 = Array.from(
              new Set(
                top5
                  .filter(
                    (row) => normalizarTexto(row.dia) === normalizarTexto(diaCodigo)
                  )
                  .map((row) => normalizeCliente(row.cliente))
                  .filter(Boolean)
              )
            );

            if (clientesTop5.length > 0) {
              const { data: coordsRows, error: coordsError } = await supabase
                .from("coordenadas")
                .select("nombre, created_by, vendedor_username, created_at, gps_planificada")
                .gte("created_at", inicioUtc)
                .lte("created_at", finUtc)
                .or(
                  [
                    `created_by.eq.${userId}`,
                    `vendedor_username.eq.${usernameStr}`,
                  ].join(",")
                );

              if (coordsError) {
                console.error("Error cargando coordenadas para TOP 5:", coordsError);
              } else {
                const coords = (coordsRows as CoordenadaRow[] | null) ?? [];

                const visitadosSet = new Set(
                  coords
                    .map((row) => normalizeCliente(row.nombre))
                    .filter(Boolean)
                );

                const hechosList = clientesTop5.filter((cli) =>
                  visitadosSet.has(cli)
                );

                const pendientesList = clientesTop5.filter(
                  (cli) => !visitadosSet.has(cli)
                );

                newItems.push({
                  id: `top5-${checkpoint.id}`,
                  type: "top5",
                  hechos: hechosList.length,
                  total: clientesTop5.length,
                  pendientes: pendientesList,
                });
              }
            }
          }
        }

        if (newItems.length > 0) {
          setItems(newItems);
          setCurrentIndex(0);

          const routeWasAdded = newItems.some((item) => item.type === "route");
          const top5WasAdded = newItems.some((item) => item.type === "top5");

          if (routeWasAdded) {
            markSeen(usernameStr, "route", checkpoint.id);
          }

          if (top5WasAdded) {
            markSeen(usernameStr, "top5", checkpoint.id);
          }
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
  }, [user?.id, user?.username, verifiedVendor]);

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
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between bg-gradient-to-r from-red-600 via-red-500 to-rose-500 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-white/90" />
              <h3 className="text-sm font-extrabold tracking-wide text-white">
                ALERTA DE GESTIÓN
              </h3>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1.5 text-white/90 hover:bg-white/20"
              aria-label="Cerrar popup"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6">
            {currentItem.type === "route" ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50">
                    <TrendingUp size={20} className="text-red-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] leading-6 text-gray-900">
                      Visitaste{" "}
                      <span className="font-extrabold text-red-600">
                        {currentItem.visitados}
                      </span>{" "}
                      clientes de{" "}
                      <span className="font-extrabold text-gray-900">
                        {currentItem.planificados}
                      </span>
                      .
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Si seguís así, terminás la ruta con un avance estimado del{" "}
                      <span
                        className={`font-extrabold ${getPercentColorClass(
                          currentItem.projectedPercent
                        )}`}
                      >
                        {formatPercent(currentItem.projectedPercent)}%
                      </span>
                      .
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Visitados</span>
                    <span className="font-bold text-gray-900">
                      {currentItem.visitados}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Planificados</span>
                    <span className="font-bold text-gray-900">
                      {currentItem.planificados}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Proyección</span>
                    <span
                      className={`font-extrabold ${getPercentColorClass(
                        currentItem.projectedPercent
                      )}`}
                    >
                      {formatPercent(currentItem.projectedPercent)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50">
                    <Target size={20} className="text-red-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] leading-6 text-gray-900">
                      Ya buscaste{" "}
                      <span className="font-extrabold text-red-600">
                        {currentItem.hechos}
                      </span>{" "}
                      de{" "}
                      <span className="font-extrabold text-gray-900">
                        {currentItem.total}
                      </span>{" "}
                      clientes de tu TOP 5 de hoy.
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Te faltan{" "}
                      <span className="font-extrabold text-red-600">
                        {Math.max(0, currentItem.total - currentItem.hechos)}
                      </span>{" "}
                      para completar la prioridad del día.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">TOP 5 buscados</span>
                    <span className="font-bold text-gray-900">
                      {currentItem.hechos}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total TOP 5</span>
                    <span className="font-bold text-gray-900">
                      {currentItem.total}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Pendientes</span>
                    <span className="font-extrabold text-red-600">
                      {Math.max(0, currentItem.total - currentItem.hechos)}
                    </span>
                  </div>
                </div>

                {currentItem.pendientes.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                      Clientes pendientes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-red-900 break-words">
                      {currentItem.pendientes.join(", ")}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteProgressPopup;
