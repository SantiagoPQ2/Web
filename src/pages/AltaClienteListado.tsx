import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import { Search, MapPin, ExternalLink } from "lucide-react";

interface AltaCliente {
  id: string;
  razon_social: string;
  cuit: string;
  nombre_fantasia: string;
  calle: string;
  altura: string;
  horarios: string;
  facturacion: string;
  tipo_negocio: string;
  ruta: string;
  dia_visita: string;
  vendedor_nombre: string | null;
  vendedor_username: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

const REGISTROS_POR_PAGINA = 10;

const AltaClienteListado: React.FC = () => {
  const [items, setItems] = useState<AltaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [detalle, setDetalle] = useState<AltaCliente | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alta_de_clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setItems((data || []) as AltaCliente[]);
    setLoading(false);
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatFechaIso = (iso: string) =>
    new Date(iso).toISOString().slice(0, 10);

  const vendedores = useMemo(() => {
    const set = new Set(items.map((i) => i.vendedor_nombre ?? "").filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return items.filter((i) => {
      const coincideBusqueda =
        !q ||
        i.razon_social?.toLowerCase().includes(q) ||
        i.nombre_fantasia?.toLowerCase().includes(q) ||
        i.cuit?.includes(q) ||
        i.ruta?.toLowerCase().includes(q) ||
        i.tipo_negocio?.toLowerCase().includes(q);

      const coincideVendedor =
        !filtroVendedor || i.vendedor_nombre === filtroVendedor;

      const fecha = formatFechaIso(i.created_at);
      const coincideFechaDesde = !filtroFechaDesde || fecha >= filtroFechaDesde;
      const coincideFechaHasta = !filtroFechaHasta || fecha <= filtroFechaHasta;

      return coincideBusqueda && coincideVendedor && coincideFechaDesde && coincideFechaHasta;
    });
  }, [items, busqueda, filtroVendedor, filtroFechaDesde, filtroFechaHasta]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / REGISTROS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaSegura - 1) * REGISTROS_POR_PAGINA;
  const paginados = filtrados.slice(inicio, inicio + REGISTROS_POR_PAGINA);

  const resetFiltros = () => {
    setBusqueda("");
    setFiltroVendedor("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setPaginaActual(1);
  };

  const abrirMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const badgeColor = (dia: string) => {
    const map: Record<string, string> = {
      Lunes: "bg-blue-100 text-blue-700",
      Martes: "bg-purple-100 text-purple-700",
      Miércoles: "bg-yellow-100 text-yellow-700",
      Jueves: "bg-orange-100 text-orange-700",
      Viernes: "bg-green-100 text-green-700",
      Sábado: "bg-pink-100 text-pink-700",
    };
    return map[dia] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Alta de Clientes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtrados.length} registro{filtrados.length !== 1 ? "s" : ""} encontrado{filtrados.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={cargar}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Razón social, CUIT, ruta..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            />
          </div>

          {/* Vendedor */}
          <select
            className="w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-red-500"
            value={filtroVendedor}
            onChange={(e) => { setFiltroVendedor(e.target.value); setPaginaActual(1); }}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Fecha desde */}
          <input
            type="date"
            className="w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-red-500"
            value={filtroFechaDesde}
            onChange={(e) => { setFiltroFechaDesde(e.target.value); setPaginaActual(1); }}
          />

          {/* Fecha hasta */}
          <input
            type="date"
            className="w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-red-500"
            value={filtroFechaHasta}
            onChange={(e) => { setFiltroFechaHasta(e.target.value); setPaginaActual(1); }}
          />
        </div>

        {(busqueda || filtroVendedor || filtroFechaDesde || filtroFechaHasta) && (
          <button
            onClick={resetFiltros}
            className="mt-3 text-xs text-red-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Cargando registros...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No se encontraron registros con los filtros aplicados.
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginados.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-50 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">
                        {item.razon_social}
                      </h3>
                      {item.nombre_fantasia && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.nombre_fantasia}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor(item.dia_visita)}`}>
                      {item.dia_visita}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex-1 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">CUIT</span>
                    <span className="font-mono">{item.cuit}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">Dirección</span>
                    <span className="truncate">{item.calle} {item.altura}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">Horarios</span>
                    <span>{item.horarios}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">Factura</span>
                    <span>{item.facturacion}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">Negocio</span>
                    <span>{item.tipo_negocio}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase">Ruta</span>
                    <span>{item.ruta}</span>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-4 py-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    <span className="font-medium text-gray-500 dark:text-gray-300">
                      {item.vendedor_nombre ?? "-"}
                    </span>
                    <span className="mx-1">·</span>
                    {formatFecha(item.created_at)}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.lat && item.lng && (
                      <button
                        onClick={() => abrirMaps(item.lat!, item.lng!)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Maps
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setDetalle(item)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium transition"
                    >
                      Ver todo
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                ◀
              </button>
              <span className="text-gray-600 dark:text-gray-300">
                {paginaSegura} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                ▶
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDetalle(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {detalle.razon_social}
                </h2>
                {detalle.nombre_fantasia && (
                  <p className="text-sm text-gray-400">{detalle.nombre_fantasia}</p>
                )}
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: "CUIT", value: detalle.cuit },
                { label: "Facturación", value: detalle.facturacion },
                { label: "Calle", value: detalle.calle },
                { label: "Altura", value: detalle.altura },
                { label: "Horarios", value: detalle.horarios },
                { label: "Tipo de negocio", value: detalle.tipo_negocio },
                { label: "Ruta", value: detalle.ruta },
                { label: "Día de visita", value: detalle.dia_visita },
                { label: "Vendedor", value: detalle.vendedor_nombre ?? "-" },
                { label: "Fecha alta", value: formatFecha(detalle.created_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-400 uppercase mb-0.5">{label}</p>
                  <p className="text-gray-800 dark:text-gray-100 font-medium">{value}</p>
                </div>
              ))}
            </div>

            {/* Coordenadas */}
            {detalle.lat && detalle.lng ? (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-1">
                  📍 Lat: {detalle.lat.toFixed(6)} · Lng: {detalle.lng.toFixed(6)}
                </p>
                <button
                  onClick={() => abrirMaps(detalle.lat!, detalle.lng!)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir en Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                Sin coordenadas registradas
              </p>
            )}

            <button
              onClick={() => setDetalle(null)}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AltaClienteListado;
