import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// Icono de marcador estándar Leaflet
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Punto {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  created_at: string;
  vendedor_name: string;
}

interface Usuario {
  id: string;
  name: string;
}

const Mapa: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [puntos, setPuntos] = useState<Punto[]>([]);
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

  // 🧭 Cargar vendedores y coordenadas
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Traer todos los vendedores
      const { data: usuarios } = await supabase
        .from("usuarios_app")
        .select("id, name, role")
        .eq("role", "vendedor");

      setVendedores(usuarios || []);

      // Traer todas las coordenadas
      let query = supabase.from("coordenadas").select("*");

      if (fechaSeleccionada)
        query = query.gte("created_at", `${fechaSeleccionada} 00:00:00`).lte("created_at", `${fechaSeleccionada} 23:59:59`);

      if (vendedorSeleccionado) {
        const vendedorId = vendedorSeleccionado;
        query = query.eq("created_by", vendedorId);
      }

      const { data: coords, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando coordenadas:", error);
        setPuntos([]);
        setLoading(false);
        return;
      }

      // Vincular vendedor a coordenadas
      const usuariosMap = new Map((usuarios || []).map((u) => [u.id, u.name]));
      const mapped = (coords || []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        lat: c.lat,
        lng: c.lng,
        created_at: c.created_at,
        vendedor_name: usuariosMap.get(c.created_by) || "Desconocido",
      }));

      setPuntos(mapped);
      setLoading(false);
    };

    fetchData();
  }, [fechaSeleccionada, vendedorSeleccionado]);

  const center =
    puntos.length > 0
      ? [puntos[0].lat, puntos[0].lng]
      : [-31.4201, -64.1888]; // Centro por defecto (Córdoba)

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
        <p>Cargando puntos...</p>
      ) : puntos.length === 0 ? (
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

            {puntos.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={markerIcon}>
                <Popup>
                  <div className="text-sm">
                    <p>
                      <strong>Cliente:</strong> {p.nombre}
                    </p>
                    <p>
                      <strong>Vendedor:</strong> {p.vendedor_name}
                    </p>
                    <p>
                      <strong>Fecha:</strong>{" "}
                      {new Date(p.created_at).toLocaleString("es-AR")}
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
