import React, { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { supabase } from "../config/supabase";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// Icono clásico de marcador
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Tipos
interface Coordenada {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  created_at: string;
  created_by: string;
  vendedor_name: string;
}
interface Usuario {
  id: string;
  name: string;
}

// Corrige render del mapa al montar
const FixMapView = ({ puntos }: { puntos: Coordenada[] }) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (puntos.length > 0) {
      const bounds = L.latLngBounds(
        puntos.map((p) => [p.lat, p.lng]) as [number, number][]
      );
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      map.setView([-31.4201, -64.1888], 11);
    }
  }, [map, puntos]);
  return null;
};

// 🔵 Nuevo componente: RoutingMachine
const RoutingMachine = ({ puntos }: { puntos: [number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || puntos.length < 2) return;

    const routing = L.Routing.control({
      waypoints: puntos.map(([lat, lng]) => L.latLng(lat, lng)),
      lineOptions: {
        styles: [{ color: "blue", weight: 4 }],
      },
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
    }).addTo(map);

    return () => {
      map.removeControl(routing);
    };
  }, [map, puntos]);

  return null;
};

const Mapa: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [coordenadas, setCoordenadas] = useState<Coordenada[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [loading, setLoading] = useState(true);
  const [ordenAsc, setOrdenAsc] = useState(true);

  // Solo admins
  useEffect(() => {
    if (currentUser?.role !== "admin") navigate("/informacion");
  }, [currentUser, navigate]);

  // Traer vendedores
  useEffect(() => {
    const fetchVendedores = async () => {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("id, name, role")
        .eq("role", "vendedor");

      if (!error) setVendedores(data || []);
    };
    fetchVendedores();
  }, []);

  // Traer coordenadas filtradas
  useEffect(() => {
    const fetchCoordenadas = async () => {
      setLoading(true);

      const { data: usuarios } = await supabase
        .from("usuarios_app")
        .select("id, name");
      const userMap = new Map((usuarios || []).map((u) => [u.id, u.name]));

      let query = supabase.from("coordenadas").select("*");

      if (vendedorSeleccionado)
        query = query.eq("created_by", vendedorSeleccionado);
      if (fechaSeleccionada)
        query = query
          .gte("created_at", `${fechaSeleccionada} 00:00:00`)
          .lte("created_at", `${fechaSeleccionada} 23:59:59`);

      const { data, error } = await query.order("created_at", {
        ascending: true,
      });

      if (error) {
        setCoordenadas([]);
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        lat: c.lat,
        lng: c.lng,
        created_at: c.created_at,
        created_by: c.created_by,
        vendedor_name: userMap.get(c.created_by) || "Desconocido",
      }));

      setCoordenadas(mapped);
      setLoading(false);
    };

    fetchCoordenadas();
  }, [vendedorSeleccionado, fechaSeleccionada]);

  const center = useMemo(() => {
    return coordenadas.length > 0
      ? [coordenadas[0].lat, coordenadas[0].lng]
      : [-31.4201, -64.1888];
  }, [coordenadas]);

  const toggleOrden = () => {
    const sorted = [...coordenadas].sort((a, b) =>
      ordenAsc
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setCoordenadas(sorted);
    setOrdenAsc(!ordenAsc);
  };

  const puntosRuta = useMemo(() => {
    return coordenadas.map((c) => [c.lat, c.lng]) as [number, number][];
  }, [coordenadas]);

  const formatHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Visitas</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={vendedorSeleccionado}
          onChange={(e) => setVendedorSeleccionado(e.target.value)}
          className="border p-2 rounded w-full md:w-auto"
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fechaSeleccionada}
          onChange={(e) => setFechaSeleccionada(e.target.value)}
          className="border p-2 rounded w-full md:w-auto"
        />
      </div>

      {/* Mapa + Tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg">
          {loading ? (
            <p className="p-4">Cargando coordenadas...</p>
          ) : coordenadas.length === 0 ? (
            <p className="p-4 italic text-gray-500">
              No hay puntos para mostrar.
            </p>
          ) : (
            <MapContainer
              center={center as [number, number]}
              zoom={12}
              className="w-full h-[70vh]"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FixMapView puntos={coordenadas} />

              {/* 🔵 Routing por calles */}
              {vendedorSeleccionado && fechaSeleccionada && (
                <RoutingMachine puntos={puntosRuta} />
              )}

              {/* Marcadores */}
              {coordenadas.map((c, index) => (
                <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon}>
                  <Popup>
                    <div className="text-sm">
                      <p>
                        <strong>Cliente:</strong> {c.nombre}
                      </p>
                      <p>
                        <strong>Hora:</strong> {formatHora(c.created_at)}
                      </p>
                      <p>
                        <strong>Orden:</strong> {index + 1}
                      </p>
                      <p>
                        <strong>Vendedor:</strong> {c.vendedor_name}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Tabla lateral */}
        <div className="bg-white rounded-lg shadow-lg p-4 h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-lg">Puntos del día</h2>
            <button
              onClick={toggleOrden}
              className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition"
            >
              Ordenar {ordenAsc ? "↓" : "↑"}
            </button>
          </div>

          {coordenadas.length === 0 ? (
            <p className="text-sm text-gray-500">Sin registros.</p>
          ) : (
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1 border">#</th>
                  <th className="text-left px-2 py-1 border">Cliente</th>
                  <th className="text-left px-2 py-1 border">Hora</th>
                </tr>
              </thead>
              <tbody>
                {coordenadas.map((c, i) => (
                  <tr key={c.id} className="hover:bg-blue-50">
                    <td className="px-2 py-1 border">{i + 1}</td>
                    <td className="px-2 py-1 border">{c.nombre}</td>
                    <td className="px-2 py-1 border">
                      {formatHora(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Mapa;
