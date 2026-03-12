import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Route,
  Clock3,
  RefreshCw,
  Search,
  Activity,
} from "lucide-react";
import { supabase } from "../config/supabase";

type UsuarioApp = {
  id?: string;
  username?: string;
  role?: string;
  nombre?: string;
  full_name?: string;
  apellido?: string;
  [key: string]: any;
};

type FilaEquipo = {
  id: string;
  username: string;
  nombre: string;
  role: "supervisor" | "vendedor";
  pdvPlanificados: number;
  pdvVisitados: number;
  horasTrabajadas: number;
  puntosMarcados: number;
  primeraMarca?: string | null;
  ultimaMarca?: string | null;
};

const ROLES_VALIDOS = ["supervisor", "vendedor"];

const AdminEquipoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [coordenadas, setCoordenadas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null
  );

  const hoyStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("es-AR");
    } catch {
      return value;
    }
  };

  const formatHours = (hours: number) => {
    if (!hours || hours <= 0) return "0 hs";
    const totalMinutes = Math.round(hours * 60);
    const hs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hs}h ${mins}m`;
  };

  const normalizar = (v: any) => String(v ?? "").trim().toLowerCase();

  const getUsernameFromRow = (row: any): string => {
    const posibles = [
      row?.username,
      row?.usuario_username,
      row?.vendedor_username,
      row?.supervisor_username,
      row?.user_username,
      row?.nombre_usuario,
      row?.usuario,
      row?.vendedor,
      row?.supervisor,
      row?.created_by_username,
      row?.remitente_username,
      row?.destinatario_username,
    ];

    for (const valor of posibles) {
      if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
        return String(valor).trim();
      }
    }

    return "";
  };

  const getDateFromRow = (row: any): string | null => {
    const posibles = [
      row?.fecha,
      row?.fecha_visita,
      row?.fecha_planificada,
      row?.dia,
      row?.visit_date,
      row?.created_at,
      row?.timestamp,
      row?.hora,
      row?.fecha_hora,
      row?.check_in,
    ];

    for (const valor of posibles) {
      if (!valor) continue;
      try {
        const iso = new Date(valor).toISOString().slice(0, 10);
        if (iso) return iso;
      } catch {
        const txt = String(valor).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
      }
    }

    return null;
  };

  const isVisitada = (row: any): boolean => {
    const booleanos = [
      row?.visitado,
      row?.visited,
      row?.realizada,
      row?.completada,
      row?.completo,
      row?.hecha,
      row?.check_in_realizado,
      row?.fue_visitado,
    ];

    for (const valor of booleanos) {
      if (valor === true) return true;
      if (typeof valor === "string") {
        const v = normalizar(valor);
        if (
          ["si", "sí", "true", "ok", "visitado", "visitada", "realizada", "completada", "hecha"].includes(v)
        ) {
          return true;
        }
      }
      if (valor === 1) return true;
    }

    const estados = [
      row?.estado,
      row?.status,
      row?.resultado,
      row?.situacion,
    ];

    for (const valor of estados) {
      const v = normalizar(valor);
      if (
        [
          "visitado",
          "visitada",
          "realizada",
          "realizado",
          "completada",
          "completado",
          "hecha",
          "hecho",
          "cerrada",
          "cerrado",
          "ok",
        ].includes(v)
      ) {
        return true;
      }
    }

    return false;
  };

  const getTimestampCoordenada = (row: any): string | null => {
    const posibles = [
      row?.created_at,
      row?.timestamp,
      row?.fecha_hora,
      row?.hora,
      row?.fecha,
      row?.check_in,
    ];

    for (const valor of posibles) {
      if (!valor) continue;
      try {
        const date = new Date(valor);
        if (!isNaN(date.getTime())) return date.toISOString();
      } catch {}
    }

    return null;
  };

  const cargarTodo = useCallback(async () => {
    setLoading(true);

    try {
      const [usuariosRes, visitasRes, coordenadasRes] = await Promise.all([
        supabase.from("usuarios_app").select("*").in("role", ROLES_VALIDOS),
        supabase.from("visitas_planificadas").select("*"),
        supabase.from("coordenadas").select("*"),
      ]);

      if (usuariosRes.error) {
        console.error("Error cargando usuarios_app:", usuariosRes.error);
      }
      if (visitasRes.error) {
        console.error("Error cargando visitas_planificadas:", visitasRes.error);
      }
      if (coordenadasRes.error) {
        console.error("Error cargando coordenadas:", coordenadasRes.error);
      }

      setUsuarios((usuariosRes.data || []) as UsuarioApp[]);
      setVisitas((visitasRes.data || []) as any[]);
      setCoordenadas((coordenadasRes.data || []) as any[]);
      setUltimaActualizacion(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();

    const channelUsuarios = supabase
      .channel("admin-equipo-usuarios")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usuarios_app" },
        () => {
          cargarTodo();
        }
      )
      .subscribe();

    const channelVisitas = supabase
      .channel("admin-equipo-visitas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas_planificadas" },
        () => {
          cargarTodo();
        }
      )
      .subscribe();

    const channelCoords = supabase
      .channel("admin-equipo-coordenadas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coordenadas" },
        () => {
          cargarTodo();
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      cargarTodo();
    }, 60000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channelUsuarios);
      supabase.removeChannel(channelVisitas);
      supabase.removeChannel(channelCoords);
    };
  }, [cargarTodo]);

  const filas: FilaEquipo[] = useMemo(() => {
    const usuariosValidos = usuarios
      .filter((u) => ROLES_VALIDOS.includes(String(u.role || "").toLowerCase()))
      .map((u) => {
        const username = String(u.username || "").trim();
        const nombreArmado =
          String(u.nombre || "").trim() ||
          String(u.full_name || "").trim() ||
          [
            String(u.nombre || "").trim(),
            String(u.apellido || "").trim(),
          ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          username;

        const visitasHoyUsuario = visitas.filter((v) => {
          const userRow = normalizar(getUsernameFromRow(v));
          const fechaRow = getDateFromRow(v);
          return userRow === normalizar(username) && fechaRow === hoyStr;
        });

        const pdvPlanificados = visitasHoyUsuario.length;
        const pdvVisitados = visitasHoyUsuario.filter(isVisitada).length;

        const coordsHoyUsuario = coordenadas
          .filter((c) => {
            const userRow = normalizar(getUsernameFromRow(c));
            const fechaRow = getDateFromRow(c);
            return userRow === normalizar(username) && fechaRow === hoyStr;
          })
          .map((c) => ({
            ...c,
            __ts: getTimestampCoordenada(c),
          }))
          .filter((c) => !!c.__ts)
          .sort((a, b) =>
            String(a.__ts) < String(b.__ts) ? -1 : String(a.__ts) > String(b.__ts) ? 1 : 0
          );

        let horasTrabajadas = 0;
        let primeraMarca: string | null = null;
        let ultimaMarca: string | null = null;

        if (coordsHoyUsuario.length >= 2) {
          primeraMarca = coordsHoyUsuario[0].__ts;
          ultimaMarca = coordsHoyUsuario[coordsHoyUsuario.length - 1].__ts;

          const inicio = new Date(primeraMarca).getTime();
          const fin = new Date(ultimaMarca).getTime();

          if (!isNaN(inicio) && !isNaN(fin) && fin >= inicio) {
            horasTrabajadas = (fin - inicio) / 1000 / 60 / 60;
          }
        } else if (coordsHoyUsuario.length === 1) {
          primeraMarca = coordsHoyUsuario[0].__ts;
          ultimaMarca = coordsHoyUsuario[0].__ts;
          horasTrabajadas = 0;
        }

        return {
          id: String(u.id || username),
          username,
          nombre: nombreArmado,
          role: String(u.role).toLowerCase() as "supervisor" | "vendedor",
          pdvPlanificados,
          pdvVisitados,
          horasTrabajadas,
          puntosMarcados: coordsHoyUsuario.length,
          primeraMarca,
          ultimaMarca,
        };
      });

    return usuariosValidos.sort((a, b) => {
      if (a.role !== b.role) return a.role === "supervisor" ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [usuarios, visitas, coordenadas, hoyStr]);

  const filasFiltradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return filas;

    return filas.filter(
      (f) =>
        normalizar(f.nombre).includes(q) ||
        normalizar(f.username).includes(q) ||
        normalizar(f.role).includes(q)
    );
  }, [filas, busqueda]);

  const resumen = useMemo(() => {
    return {
      personas: filasFiltradas.length,
      pdvPlanificados: filasFiltradas.reduce((acc, f) => acc + f.pdvPlanificados, 0),
      pdvVisitados: filasFiltradas.reduce((acc, f) => acc + f.pdvVisitados, 0),
      horas: filasFiltradas.reduce((acc, f) => acc + f.horasTrabajadas, 0),
    };
  }, [filasFiltradas]);

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-gradient-to-br from-red-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Equipo en Calle
                  </h1>
                  <p className="text-sm text-gray-500">
                    Supervisores y vendedores con PDV, visitas y horas trabajadas de hoy
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, username o rol"
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <button
                onClick={cargarTodo}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Fecha: <span className="font-medium">{hoyStr}</span>
            {" · "}
            Última actualización:{" "}
            <span className="font-medium">
              {ultimaActualizacion
                ? ultimaActualizacion.toLocaleTimeString("es-AR")
                : "-"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Personas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {resumen.personas}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserCheck size={22} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">PDV planificados</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {resumen.pdvPlanificados}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Route size={22} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">PDV visitados</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {resumen.pdvVisitados}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <Activity size={22} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Horas trabajadas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatHours(resumen.horas)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Clock3 size={22} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detalle del equipo
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando datos...</div>
          ) : filasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No se encontraron usuarios para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Usuario
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Rol
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      PDV planificados
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      PDV visitados
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Horas trabajadas
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Puntos GPS
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Primera marca
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Última marca
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filasFiltradas.map((fila) => {
                    const progreso =
                      fila.pdvPlanificados > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (fila.pdvVisitados / fila.pdvPlanificados) * 100
                            )
                          )
                        : 0;

                    return (
                      <tr
                        key={fila.id}
                        className="border-t border-gray-100 dark:border-gray-800 hover:bg-red-50/40 dark:hover:bg-gray-800/40 transition"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {fila.nombre}
                            </p>
                            <p className="text-xs text-gray-500">@{fila.username}</p>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              fila.role === "supervisor"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {fila.role === "supervisor" ? "Supervisor" : "Vendedor"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                          {fila.pdvPlanificados}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {fila.pdvVisitados}
                            </span>
                            <div className="w-28 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${progreso}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {progreso}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                          {formatHours(fila.horasTrabajadas)}
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                          {fila.puntosMarcados}
                        </td>

                        <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300">
                          {formatDateTime(fila.primeraMarca)}
                        </td>

                        <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300">
                          {formatDateTime(fila.ultimaMarca)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminEquipoPage;
