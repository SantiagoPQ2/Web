// src/pages/Mapa.tsx
import React, { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css"; // ✅ Import local: evita conflictos con Tailwind
import { supabase } from "../config/supabase";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// Icono de marcador Leaflet
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
}

// Corrige render + centra en puntos visibles
const FixMapView = ({ puntos }: { puntos: Coordenada[] }) => {
  const map = useMap();
  useEffect(() => {
    // Recalcula tamaño luego de montar / filtrar
    map.invalidateSize();
    if (puntos.length > 0) {
      const bounds = L.latLngBounds(
        puntos.map((p) => [p.lat, p.lng]) as [number, number][]
      );
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      // Centro por defecto (Córdoba) si no hay puntos
      map.setView([-31.4201, -64.1888], 11);
    }
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

  // 🔒 Solo admin
  useEffect(() => {
    if (currentUser?.role !== "admin") navigate("/informacion");
  }, [currentUser, navigate]);

  // Vendedores
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("id, name, role")
        .eq("role", "vendedor");
      if (!error) setVendedores(data || []);
    })();
  }, []);

  // Coordenadas (con filtros)
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: users } = await supabase
        .from("usuarios_app")
        .select("id, name");
      const usersMap = new Map((users || []).map((u) => [u.id, u.name]));

      let q = supabase.from("coordenadas").select("*");
      if (vendedorSeleccionado) q = q.eq("created_by", vendedorSeleccionado);
      if (fechaSeleccionada) {
        q = q
          .gte("created_at", `${fechaSeleccionada} 00:00:00`)
          .lte("created_at", `${fechaSeleccionada} 23:59:59`);
      }
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) {
        setCoordenadas([]);
      } else {
        const mapped =
          (data || []).map((c: any) => ({
            id: c.id,
            nombre: c.nombre,
            lat: c.lat,
            lng: c.lng,
            created_at: c.created_at,
            created_by: c.created_by,
            vendedor_name: usersMap.get(c.created_by) || "Desconocido",
          })) || [];
        setCoordenadas(mapped);
      }
      setLoading(false);
    })();
  }, [vendedorSeleccionado, fechaSeleccionada]);

  // Clave para remount limpio del mapa al cambiar filtros
  const mapKey = useMemo(
    () => `${vendedorSeleccionado || "all"}_${fechaSeleccionada || "any"}`,
    [vendedorSeleccionado, fechaSeleccionada]
  );

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
          placeholder="yyyy-mm-dd"
        />
      </div>

      {/* Mapa */}
      <div
        className="
          rounded-lg overflow-hidden shadow-lg
          w-full
        "
        style={{ height: "70vh" }} // ✅ alto real del wrapper
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            Cargando coordenadas...
          </div>
        ) : (
          <MapContainer
            key={mapKey} // ✅ remount limpio en cada cambio de filtro
            center={[-31.4201, -64.1888]}
            zoom={11}
            className="w-full h-full" // ✅ el mapa ocupa todo el wrapper
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FixMapView puntos={coordenadas} />

            {coordenadas.map((c) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon}>
                <Popup>
                  <div className="text-sm">
                    <p>
                      <strong>Cliente:</strong> {c.nombre}
                    </p>
                    <p>
                      <strong>Vendedor:</strong> {c.vendedor_name}
                    </p>
                    <p>
                      <strong>Fecha:</strong>{" "}
                      {new Date(c.created_at).toLocaleString("es-AR")}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default Mapa;
