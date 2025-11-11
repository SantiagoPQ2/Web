import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { MapPin, MessageCircle } from "lucide-react";

interface Visita {
  id: string;
  cliente: string;
  vendedor_id: number;
  dia_visita: string;
  lat?: number;
  lon?: number;
  celular?: string | null;
}

export default function ClientesDelDia() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [selected, setSelected] = useState<Visita | null>(null);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchVisitas = async () => {
      const dias = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
      const hoy = dias[new Date().getDay()]; // Ej: "MIE"

      const { data, error } = await supabase
        .from("visitas_planificadas")
        .select("id, cliente, vendedor_id, dia_visita, lat, lon, celular")
        .eq("vendedor_id", currentUser.id)
        .eq("dia_visita", hoy);

      if (error) {
        console.error("Error cargando visitas:", error);
      } else {
        setVisitas(data || []);
      }
    };

    fetchVisitas();
  }, [currentUser.id]);

  const openMaps = (lat?: number, lon?: number) => {
    if (lat && lon) {
      window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
    }
  };

  const openWhatsApp = (celular?: string | null) => {
    if (!celular) return;
    const clean = celular.toString().replace(/\D/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  };

  return (
    <div className="p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-3">Clientes del Día</h2>

      {visitas.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay visitas planificadas hoy.</p>
      ) : (
        <ul className="space-y-3">
          {visitas.map((v) => (
            <li
              key={v.id}
              onClick={() => setSelected(v)}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition"
            >
              <p className="font-medium">Cliente #{v.cliente}</p>
              <p className="text-sm text-gray-600">
                Día de visita: {v.dia_visita}
              </p>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>

            <h3 className="text-xl font-semibold mb-2">
              Cliente #{selected.cliente}
            </h3>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-medium">Día:</span>{" "}
                {selected.dia_visita}
              </p>
              <p>
                <span className="font-medium">Latitud:</span>{" "}
                {selected.lat || "—"}
              </p>
              <p>
                <span className="font-medium">Longitud:</span>{" "}
                {selected.lon || "—"}
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {selected.lat && selected.lon && (
                <button
                  onClick={() => openMaps(selected.lat, selected.lon)}
                  className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
                >
                  <MapPin size={16} /> Ver en Google Maps
                </button>
              )}

              {selected.celular && (
                <button
                  onClick={() => openWhatsApp(selected.celular)}
                  className="flex items-center gap-2 text-green-600 text-sm hover:underline"
                >
                  <MessageCircle size={16} /> Contactar por WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
