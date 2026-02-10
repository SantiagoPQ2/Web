import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabase";

type VideoLogRow = {
  id: string;
  user_id: string;
  username: string | null;
  role: string | null;
  video_id: string;
  video_url: string | null;
  watched_at: string;
  watch_date: string; // YYYY-MM-DD (date)
  seconds_watched: number;
  completed: boolean;
  user_agent: string | null;
};

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const VideoWatchLog: React.FC = () => {
  const [rows, setRows] = useState<VideoLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [date, setDate] = useState<string>(todayYMD());
  const [videoId, setVideoId] = useState<string>("capsula_intro_v1"); // default
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(false);
  const [searchUser, setSearchUser] = useState<string>("");

  const filteredRows = useMemo(() => {
    const q = searchUser.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.username || "").toLowerCase().includes(q));
  }, [rows, searchUser]);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("video_watch_log")
        .select("*")
        .eq("watch_date", date)
        .order("watched_at", { ascending: false });

      if (videoId.trim()) query = query.eq("video_id", videoId.trim());
      if (onlyCompleted) query = query.eq("completed", true);

      const { data, error } = await query.limit(500);

      if (error) throw error;

      setRows((data as VideoLogRow[]) || []);
    } catch (e: any) {
      setError(e?.message || "Error al cargar logs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, videoId, onlyCompleted]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Registro de Videos Vistos
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Visualizaciones guardadas en <code>video_watch_log</code>.
        </p>

        {/* Filtros */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Video ID
            </label>
            <input
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder='Ej: "capsula_intro_v1"'
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Buscar usuario
            </label>
            <input
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="username..."
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 select-none">
              <input
                type="checkbox"
                checked={onlyCompleted}
                onChange={(e) => setOnlyCompleted(e.target.checked)}
              />
              Solo completados
            </label>
          </div>
        </div>

        {/* Estado */}
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Resultados:{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {filteredRows.length}
            </span>
          </div>

          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-md bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition"
          >
            Refrescar
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 p-3 text-sm">
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="mt-5 overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Hora</th>
                <th className="text-left px-3 py-2">Usuario</th>
                <th className="text-left px-3 py-2">Rol</th>
                <th className="text-left px-3 py-2">Video</th>
                <th className="text-left px-3 py-2">Visto (s)</th>
                <th className="text-left px-3 py-2">Completó</th>
                <th className="text-left px-3 py-2">Link</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={7}>
                    <div className="text-gray-600 dark:text-gray-300">
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4" colSpan={7}>
                    <div className="text-gray-600 dark:text-gray-300">
                      Sin registros para los filtros elegidos.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-gray-800">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(r.watched_at).toLocaleTimeString()}
                    </td>

                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.username || "(sin username)"}
                      </div>
                      <div className="text-xs text-gray-500">{r.user_id}</div>
                    </td>

                    <td className="px-3 py-2">{r.role || "-"}</td>

                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.video_id}</div>
                      <div className="text-xs text-gray-500">{r.watch_date}</div>
                    </td>

                    <td className="px-3 py-2">{r.seconds_watched}</td>

                    <td className="px-3 py-2">
                      {r.completed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-semibold">
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-semibold">
                          No
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {r.video_url ? (
                        <a
                          href={r.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-red-700 font-semibold hover:underline"
                        >
                          Abrir
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Tip: si mañana cambiás el video, poné otro <b>videoId</b> (ej:
          <code> capsula_intro_v2</code>) y acá lo filtrás igual.
        </div>
      </div>
    </div>
  );
};

export default VideoWatchLog;
