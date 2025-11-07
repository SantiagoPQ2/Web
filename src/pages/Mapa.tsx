import React, { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { supabase } from "../config/supabase";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// 🔹 Marcador clásico de Leaflet (evita issues de assets en build)
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  role?: string;
}

// ================== Fix de vista ==================
const FixMapView = ({ puntos }: { puntos: Coordenada[] }) => {
  const map = useMap();
  useEffect(() => {
    // Asegura que Leaflet calcule tamaño correcto tras render
    setTimeout(() => map.invalidateSize(), 0);

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

// ================== Router OSRM seguro ==================
/**
 * - Hace fetch tramo a tramo (A→B, B→C, …) con cancelación entre filtros.
 * - Convierte [lng,lat] → [lat,lng], cachea por "vendorId|fecha|hashCoords".
 * - Fallback a línea recta si falla cualquier tramo.
 */
const RoutingLine = ({ puntos }: { puntos: [number, number][] }) => {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Cache en memoria por sesión
  const cacheRef = useRef<Map<string, [number, number][]>>(new Map());

  useEffect(() => {
    if (!puntos || puntos.length < 2) {
      setRouteCoords([]);
      return;
    }

    // Clave de cache simple con redondeo (reduce ruido por decimales)
    const key = puntos
      .map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`)
      .join("|");

    const cached = cacheRef.current.get(key);
    if (cached) {
      setRouteCoords(cached);
      return;
    }

    // Cancelar petición anterior (si existiera)
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchSegment = async (
      a: [number, number],
      b: [number, number]
    ): Promise<[number, number][]> => {
      // OSRM espera lng,lat
      const aStr = `${a[1]},${a[0]}`;
      const bStr = `${b[1]},${b[0]}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${aStr};${bStr}?overview=full&geometries=geojson`;

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();

      const coords = data?.routes?.[0]?.geometry?.coordinates as
        | [number, number][]
        | undefined;
      if (!coords) throw new Error("OSRM sin geometry");

      // De [lng,lat] a [lat,lng]
      return coords.map((c) => [c[1], c[0]]);
    };

    const fetchAll = async () => {
      try {
        const merged: [number, number][][] = [];

        for (let i = 0; i < puntos.length - 1; i++) {
          const a = puntos[i];
          const b = puntos[i + 1];

          // Evitar tramos idénticos
          if (a[0] === b[0] && a[1] === b[1]) continue;

          // eslint-disable-next-line no-await-in-loop
          const seg = await fetchSegment(a, b);
          merged.push(seg);

          // Pequeño delay contra rate-limit
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 110));
        }

        // Aplastar segmentos y evitar duplicados consecutivos
        const flat: [number, number][] = [];
        for (const seg of merged) {
          for (const pt of seg) {
            const prev = flat[flat.length - 1];
            if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) flat.push(pt);
          }
        }

        const finalCoords = flat.length > 1 ? flat : puntos;
        cacheRef.current.set(key, finalCoords);
        setRouteCoords(finalCoords);
      } catch (err) {
        if ((err as any)?.name === "AbortError") return; // filtros cambiaron
        console.error("OSRM routing error:", err);
        setRouteCoords(puntos); // fallback
      }
    };

    fetchAll();
    // cleanup al cambiar dependencias
    return () => controller.abort();
  }, [puntos]);

  return routeCoords.length > 1 ? (
    <Polyline pathOptions={{ color: "blue", weight: 4 }} positions={routeCoords} />
  ) : null;
};

// ================== Componente principal ==================
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

  // Cargar vendedores
  useEffect(() => {
    const fetchVendedores = async () => {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("id, name, role")
        .eq("role", "vendedor");
      if (error) console.error(error);
      setVendedores(data || []);
    };
    fetchVendedores();
  }, []);

  // Cargar coordenadas (con coerción a número)
  useEffect(() => {
    const fetchCoordenadas = async () => {
      setLoading(true);

      const { data: usuarios, error: eUsers } = await supabase
        .from("usuarios_app")
        .select("id, name");
      if (eUsers) console.error(eUsers);

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
      if (error) console.error(error);

      const mapped: Coordenada[] =
        (data || []).map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          lat: Number(c.lat),
          lng: Number(c.lng),
          created_at: c.created_at,
          created_by: c.created_by,
          vendedor_name: userMap.get(c.created_by) || "Desconocido",
        })) || [];

      setCoordenadas(mapped);
      setLoading(false);
    };

    fetchCoordenadas();
  }, [vendedorSeleccionado, fechaSeleccionada]);

  const puntosRuta = useMemo<[number, number][]>(() => {
    return coordenadas.map((c) => [c.lat, c.lng]);
  }, [coordenadas]);

  const center = useMemo<[number, number]>(() => {
    return coordenadas.length > 0
      ? [coordenadas[0].lat, coordenadas[0].lng]
      : [-31.4201, -64.1888];
  }, [coordenadas]);

  const formatHora = (fecha: string) =>
    new Date(fecha).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const toggleOrden = () => {
    const sorted = [...coordenadas].sort((a, b) =>
      ordenAsc
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setCoordenadas(sorted);
    setOrdenAsc(!ordenAsc);
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
        <div className="lg:col-span-2 rounded-lg overflow-hidden shadow-lg">
          {loading ? (
            <p className="p-4">Cargando coordenadas...</p>
          ) : (
            <MapContainer center={center} zoom={12} className="w-full h-[70vh]">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FixMapView puntos={coordenadas} />

              {/* 🚗 Ruta por calles (solo si hay filtro + puntos suficientes) */}
              {vendedorSeleccionado &&
                fechaSeleccionada &&
                puntosRuta.length > 1 && <RoutingLine puntos={puntosRuta} />}

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
                  <td className="px-2 py-1 border">{formatHora(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Mapa;
