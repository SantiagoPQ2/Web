import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { MapPin, Phone, MessageCircle, ExternalLink } from "lucide-react";

interface Visita {
  id: string;
  cliente_nombre: string;
  direccion: string;
  lat?: number;
  lng?: number;
  celular?: string;
  turno: string; // Mañana / Tarde
  vendedor_id: string;
}

export default function ClientesDelDia() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [selected, setSelected] = useState<Visita | null>(null);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchVisitas = async () => {
      const hoy = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("visitas_planificadas")
        .select("*")
        .eq("vendedor_id", currentUser.id)
        .eq("fecha", hoy);

      if (error) console.error(error);
      else setVisitas(data || []);
    };

    fetchVisitas();
  }, [currentUser.id]);

  const openMaps = (lat?: number, lng?: number) => {
    if (lat && lng) {
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      window.open(url, "_blank");
    }
  };

  const openWhatsApp = (celular?: string) => {
    if (celular) {
      const cleanNumber = celular.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanNumber}`, "_blank");
    }
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
              <p className="font-medium">{v.cliente_nombre}</p>
              <p className="text-sm text-gray-600">{v.direccion}</p>
              <p className="text-sm text-gray-700">Visita: {v.turno}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Modal / Tarjeta expandible */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
            <button
              className="absolute top-2 right-3 text-gray-400 hover:text-gray-600"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
            <h3 className="text-xl font-semibold mb-2">
              {selected.cliente_nombre}
            </h3>
            <p className="text-gray-600 mb-1">{selected.direccion}</p>
            {selected.lat && selected.lng && (
              <button
                onClick={() => openMaps(selected.lat, selected.lng)}
                className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
              >
                <MapPin size={16} /> Ver en Google Maps
              </button>
            )}

            {selected.celular && (
              <button
                onClick={() => openWhatsApp(selected.celular)}
                className="flex items-center gap-2 mt-2 text-green-600 text-sm hover:underline"
              >
                <MessageCircle size={16} /> Contactar por WhatsApp
              </button>
            )}

            <div className="mt-4 border-t pt-2 text-sm text-gray-500">
              <p>Turno: {selected.turno}</p>
              <p>ID visita: {selected.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
