import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Route,
  Clock3,
  RefreshCw,
  Search,
  Activity,
  Filter,
} from "lucide-react";
import { supabase } from "../config/supabase";

type UsuarioApp = {
  id: string;
  username: string;
  role: string;
  nombre?: string | null;
  apellido?: string | null;
  full_name?: string | null;
  name?: string | null;
  ffvv?: string | null;
  FFVV?: string | null;
  equipo?: string | null;
  team?: string | null;
  [key: string]: any;
};

type VisitaPlanificada = {
  id?: string;
  cliente: string | number;
  vendedor_username: string | number;
  dia_visita: string;
  buscado_hoy?: boolean | null;
  gps_hoy?: boolean | null;
  lat?: number | null;
  lon?: number | null;
  celular?: string | null;
  [key: string]: any;
};

type Coordenada = {
  id: string;
  nombre?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  created_by: string;
  vendedor_username?: string | null;
  gps_planificada?: boolean | null;
  [key: string]: any;
};

type FilaEquipo = {
  id: string;
  username: string;
  nombreMostrar: string;
  ffvv: string;
  role: "supervisor" | "vendedor";
  pdvPlanificados: number;
  pdvVisitados: number;
  pdvMenos5Min: number;
  horasTrabajadas: number;
  puntosGps: number;
  primeraMarca: string | null;
  ultimaMarca: string | null;
};

const PAGE_SIZE = 1000;

const AdminEquipoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([]);
  const [visitas, setVisitas] = useState<VisitaPlanificada[]>([]);
  const [coordenadas, setCoordenadas] = useState<Coordenada[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ffvvSeleccionado, setFfvvSeleccionado] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null
  );

  const diaActualCodigo = useMemo(() => {
    const dias = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
    return dias[new Date().getDay()];
  }, []);

  const fechaHoy = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const normalizar = (valor: any) =>
    String(valor ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const formatearFechaHora = (valor?: string | null) => {
    if (!valor) return "-";
    try {
      return new Date(valor).toLocaleString("es-AR");
    } catch {
      return valor;
    }
  };

  const formatearHoras = (horas: number) => {
    if (!horas || horas <= 0) return "0 hs";
    const minutosTotales = Math.round(horas * 60);
    const hs = Math.floor(minutosTotales / 60);
    const mins = minutosTotales % 60;
    return `${hs}h ${mins}m`;
  };

  const obtenerNombreUsuario = (u: UsuarioApp) => {
    return (
      String(u.name || "").trim() ||
      String(u.full_name || "").trim() ||
      [String(u.nombre || "").trim(), String(u.apellido || "").trim()]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      String(u.username || "").trim()
    );
  };

  const obtenerFFVV = (u: UsuarioApp) => {
    const posibles = [
      u.ffvv,
      u.FFVV,
      u.equipo,
      u.team,
      u["ffvv"],
      u["FFVV"],
      u["equipo"],
      u["team"],
      u["grupo_ffvv"],
      u["GRUPO_FFVV"],
      u["supervisor"],
      u["Supervisor"],
    ];

    for (const valor of posibles) {
      const limpio = String(valor ?? "").trim();
      if (limpio) return limpio;
    }

    return "";
  };

  const esCoordenadaDeHoy = (c: Coordenada) => {
    if (!c.created_at) return false;
    try {
      return new Date(c.created_at).toISOString().slice(0, 10) === fechaHoy;
    } catch {
      return String(c.created_at).slice(0, 10) === fechaHoy;
    }
  };

  const fetchAllRows = useCallback(
    async <T,>(
      tableName: string,
      queryBuilder?: (query: any) => any
    ): Promise<T[]> => {
      let allRows: T[] = [];
      let from = 0;
      let keepGoing = true;

      while (keepGoing) {
        let query = supabase
          .from(tableName)
          .select("*")
          .range(from, from + PAGE_SIZE - 1);

        if (queryBuilder) {
          query = queryBuilder(query);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`Error cargando ${tableName}:`, error);
          break;
        }

        const rows = (data || []) as T[];
        allRows = [...allRows, ...rows];

        if (rows.length < PAGE_SIZE) {
          keepGoing = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      return allRows;
    },
    []
  );

  const cargarTodo = useCallback(async () => {
    setLoading(true);

    try {
      const [usuariosData, visitasData, coordenadasData] = await Promise.all([
        fetchAllRows<UsuarioApp>("usuarios_app", (query) =>
          query
            .in("role", ["supervisor", "vendedor"])
            .order("role", { ascending: true })
            .order("username", { ascending: true })
        ),

        fetchAllRows<VisitaPlanificada>("visitas_planificadas", (query) =>
          query.order("vendedor_username", { ascending: true })
        ),

        fetchAllRows<Coordenada>("coordenadas", (query) =>
          query
            .gte("created_at", `${fechaHoy} 00:00:00`)
            .lte("created_at", `${fechaHoy} 23:59:59`)
            .order("created_at", { ascending: true })
        ),
      ]);

      setUsuarios(usuariosData || []);
      setVisitas(visitasData || []);
      setCoordenadas(coordenadasData || []);
      setUltimaActualizacion(new Date());
    } catch (error) {
      console.error("Error general cargando admin equipo:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchAllRows, fechaHoy]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const filas = useMemo(() => {
    const coordsHoy = coordenadas.filter(esCoordenadaDeHoy);

    return usuarios
      .filter((u) => {
        const role = normalizar(u.role);
        return role === "supervisor" || role === "vendedor";
      })
      .map((u) => {
        const username = String(u.username || "").trim();
        const userId = String(u.id || "").trim();
        const role = normalizar(u.role) as "supervisor" | "vendedor";
        const ffvv = obtenerFFVV(u);

        const visitasDelDia = visitas.filter((v) => {
          const vendedor = String(v.vendedor_username ?? "").trim();
          const dia = normalizar(v.dia_visita);
          return vendedor === username && dia === normalizar(diaActualCodigo);
        });

        const pdvPlanificados = visitasDelDia.length;

        const clientesVisitadosUnicos = new Set(
          visitasDelDia
            .filter((v) => Boolean(v.buscado_hoy) || Boolean(v.gps_hoy))
            .map((v) => String(v.cliente ?? "").trim())
            .filter(Boolean)
        );

        const pdvVisitados = clientesVisitadosUnicos.size;

        const coordsUsuario = coordsHoy
          .filter((c) => {
            const createdBy = String(c.created_by || "").trim();
            const vendedorUsername = String(c.vendedor_username || "").trim();
            return createdBy === userId || vendedorUsername === username;
          })
          .sort((a, b) =>
            a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
          );

        const puntosGps = coordsUsuario.length;

        let primeraMarca: string | null = null;
        let ultimaMarca: string | null = null;
        let horasTrabajadas = 0;

        if (coordsUsuario.length > 0) {
          primeraMarca = coordsUsuario[0].created_at;
          ultimaMarca = coordsUsuario[coordsUsuario.length - 1].created_at;

          if (coordsUsuario.length >= 2) {
            const inicio = new Date(primeraMarca).getTime();
            const fin = new Date(ultimaMarca).getTime();

            if (!isNaN(inicio) && !isNaN(fin) && fin >= inicio) {
              horasTrabajadas = (fin - inicio) / 1000 / 60 / 60;
            }
          }
        }

        const gruposPorCliente = new Map<string, Coordenada[]>();

        coordsUsuario.forEach((c) => {
          const nombreCliente = String(c.nombre || "").trim();
          if (!nombreCliente) return;
          if (!Boolean(c.gps_planificada)) return;

          if (!gruposPorCliente.has(nombreCliente)) {
            gruposPorCliente.set(nombreCliente, []);
          }

          gruposPorCliente.get(nombreCliente)!.push(c);
        });

        let pdvMenos5Min = 0;

        gruposPorCliente.forEach((puntosCliente) => {
          const ordenados = [...puntosCliente].sort((a, b) =>
            a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
          );

          if (ordenados.length < 2) return;

          const inicio = new Date(ordenados[0].created_at).getTime();
          const fin = new Date(ordenados[ordenados.length - 1].created_at).getTime();

          if (isNaN(inicio) || isNaN(fin) || fin < inicio) return;

          const minutos = (fin - inicio) / 1000 / 60;

          if (minutos < 5) {
            pdvMenos5Min += 1;
          }
        });

        return {
          id: userId || username,
          username,
          nombreMostrar: obtenerNombreUsuario(u),
          ffvv,
          role,
          pdvPlanificados,
          pdvVisitados,
          pdvMenos5Min,
          horasTrabajadas,
          puntosGps,
          primeraMarca,
          ultimaMarca,
        } as FilaEquipo;
      })
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === "supervisor" ? -1 : 1;
        }
        return a.username.localeCompare(b.username, "es");
      });
  }, [usuarios, visitas, coordenadas, diaActualCodigo]);

  const opcionesFfvv = useMemo(() => {
    return Array.from(
      new Set(
        usuarios
          .map((u) => obtenerFFVV(u))
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [usuarios]);

  const filasFiltradas = useMemo(() => {
    const q = normalizar(busqueda);

    return filas.filter((f) => {
      const coincideBusqueda =
        !q ||
        normalizar(f.username).includes(q) ||
        normalizar(f.nombreMostrar).includes(q) ||
        normalizar(f.role).includes(q) ||
        normalizar(f.ffvv).includes(q);

      const coincideFfvv =
        !ffvvSeleccionado || String(f.ffvv || "").trim() === ffvvSeleccionado;

      return coincideBusqueda && coincideFfvv;
    });
  }, [filas, busqueda, ffvvSeleccionado]);

  const resumen = useMemo(() => {
    return {
      personas: filasFiltradas.length,
      pdvPlanificados: filasFiltradas.reduce(
        (acc, f) => acc + f.pdvPlanificados,
        0
      ),
      pdvVisitados: filasFiltradas.reduce(
        (acc, f) => acc + f.pdvVisitados,
        0
      ),
      pdvMenos5Min: filasFiltradas.reduce(
        (acc, f) => acc + f.pdvMenos5Min,
        0
      ),
      horasTrabajadas: filasFiltradas.reduce(
        (acc, f) => acc + f.horasTrabajadas,
        0
      ),
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
                    Supervisores y vendedores con PDV planificados, visitados y
                    horas del día
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
                  placeholder="Buscar por ID, nombre, FFVV o rol"
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="relative">
                <Filter
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <select
                  value={ffvvSeleccionado}
                  onChange={(e) => setFfvvSeleccionado(e.target.value)}
                  className="w-full sm:w-56 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-500 text-gray-700 dark:text-gray-200"
                >
                  <option value="">Todos los FFVV</option>
                  {opcionesFfvv.map((ffvv) => (
                    <option key={ffvv} value={ffvv}>
                      {ffvv}
                    </option>
                  ))}
                </select>
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
            Día actual: <span className="font-medium">{diaActualCodigo}</span>
            {" · "}
            Fecha: <span className="font-medium">{fechaHoy}</span>
            {" · "}
            Última actualización:{" "}
            <span className="font-medium">
              {ultimaActualizacion
                ? ultimaActualizacion.toLocaleTimeString("es-AR")
                : "-"}
            </span>
            {ffvvSeleccionado ? (
              <>
                {" · "}
                FFVV: <span className="font-medium">{ffvvSeleccionado}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
                <p className="text-sm text-gray-500">PDV &lt; 5 min</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {resumen.pdvMenos5Min}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Activity size={22} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Horas trabajadas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatearHoras(resumen.horasTrabajadas)}
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
                      ID
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      FFVV
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
                      PDV &lt; 5 min
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
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {fila.username}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-700 dark:text-gray-300">
                            {fila.nombreMostrar}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {fila.ffvv || "-"}
                          </p>
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
                          {fila.pdvMenos5Min}
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                          {formatearHoras(fila.horasTrabajadas)}
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-white">
                          {fila.puntosGps}
                        </td>

                        <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300">
                          {formatearFechaHora(fila.primeraMarca)}
                        </td>

                        <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300">
                          {formatearFechaHora(fila.ultimaMarca)}
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
