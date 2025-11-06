import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../config/supabase";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// Icono de marcador
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

// 👇 Corrige el render del mapa y centra los puntos visibles
const FixMapView = ({ coordenadas }: { coordenadas: Coordenada[] }) => {
  const map = useMap();

  useEffect(() => {
    // Forzar a Leaflet a redibujar correctamente
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Si hay coordenadas, ajusta el zoom automáticamente
    if (coordenadas.length > 0) {
      const bounds = L.latLngBounds(
        coordenadas.map((c) => [c.lat, c.lng]) as [number, number][]
      );
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [map, coordenadas]);

  return null;
};

const Mapa: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [coordenadas, setCoordenadas] = useState<Coordenada[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 🔒 Redirigir si no es admin
  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/informacion");
    }
  }, [currentUser, navigate]);

  // Cargar lista de vendedores
  useEffect(() => {
    const fetchVendedores = async () => {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("id, name, role")
        .eq("role", "vendedor");

      if (error) console.error("Error cargando vendedores:", error);
      else setVendedores(data || []);
    };
    fetchVendedores();
  }, []);

  // Cargar coordenadas según filtros
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
        ascending: false,
      });

      if (error) {
        console.error("Error cargando coordenadas:", error);
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

  // Calcular centro base
  const center = useMemo(() => {
    return coordenadas.length > 0
      ? [coordenadas[0].lat, coordenadas[0].lng]
      : [-31.4201, -64.1888]; // Córdoba como valor por defecto
  }, [coordenadas]);

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

      {/* Mapa */}
      {loading ? (
        <p>Cargando coordenadas...</p>
      ) : coordenadas.length === 0 ? (
        <p className="italic text-gray-500">No hay puntos para mostrar.</p>
      ) : (
        <div className="rounded-lg overflow-hidden shadow-lg">
          <MapContainer
            center={center as [number, number]}
            zoom={11}
            className="w-full h-[70vh] z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Corrige tiles y centra el mapa */}
            <FixMapView coordenadas={coordenadas} />

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
        </div>
      )}
    </div>
  );
};

export default Mapa;
