import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { MapPin, Calendar, User, Filter } from "lucide-react";

interface Coordenada {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  created_at: string;
  created_by: string;
  usuario?: { id: string; name: string };
}

interface Usuario {
  id: string;
  name: string;
}

export default function Mapa() {
  const [coordenadas, setCoordenadas] = useState<Coordenada[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    fetchCoordenadas();
  }, [selectedDate, selectedUser]);

  // Cargar usuarios disponibles
  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from("usuarios_app")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error fetching usuarios:", error);
      return;
    }

    setUsuarios(data || []);
  };

  // Cargar coordenadas con filtros
  const fetchCoordenadas = async () => {
    setLoading(true);

    let query = supabase
      .from("coordenadas")
      .select("*")
      .order("created_at", { ascending: false });

    if (selectedDate) {
      const startOfDay = `${selectedDate} 00:00:00`;
      const endOfDay = `${selectedDate} 23:59:59`;
      query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
    }

    if (selectedUser) {
      query = query.eq("created_by", selectedUser);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching coordenadas:", error);
      setLoading(false);
      return;
    }

    // Vincular usuario a cada coordenada
    const coordenadasConUsuarios = await Promise.all(
      (data || []).map(async (coord) => {
        const { data: usuario } = await supabase
          .from("usuarios_app")
          .select("id, name")
          .eq("id", coord.created_by)
          .maybeSingle();

        return { ...coord, usuario };
      })
    );

    setCoordenadas(coordenadasConUsuarios);
    setLoading(false);
  };

  const clearFilters = () => {
    setSelectedDate("");
    setSelectedUser("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <MapPin className="text-blue-600" size={40} />
            Mapa de Coordenadas
          </h1>
          <p className="text-slate-600">
            Visualiza y filtra las coordenadas registradas por los vendedores.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="text-slate-600" size={20} />
            <h2 className="text-lg font-semibold text-slate-700">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Calendar size={16} />
                Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <User size={16} />
                Usuario
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {(selectedDate || selectedUser) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Filtros activos:</span>{" "}
                {selectedDate && `Fecha: ${selectedDate}`}
                {selectedDate && selectedUser && " | "}
                {selectedUser &&
                  `Usuario: ${
                    usuarios.find((u) => u.id === selectedUser)?.name
                  }`}
              </p>
            </div>
          )}
        </div>

        {/* Lista de coordenadas */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              Coordenadas Registradas
            </h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {coordenadas.length}{" "}
              {coordenadas.length === 1 ? "registro" : "registros"}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : coordenadas.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 text-lg">
                No se encontraron coordenadas
              </p>
              <p className="text-slate-400 text-sm mt-2">
                Intenta cambiar los filtros de búsqueda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coordenadas.map((coord) => (
                <div
                  key={coord.id}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition hover:border-blue-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {coord.nombre || "Sin nombre"}
                    </h3>
                    <MapPin className="text-blue-600 flex-shrink-0" size={20} />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium">Latitud:</span>
                      <span className="font-mono">
                        {coord.lat?.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium">Longitud:</span>
                      <span className="font-mono">
                        {coord.lng?.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <User size={14} />
                      <span>{coord.usuario?.name || "Usuario desconocido"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={14} />
                      <span>{formatDate(coord.created_at)}</span>
                    </div>
                  </div>

                  <a
                    href={`https://www.google.com/maps?q=${coord.lat},${coord.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    <MapPin size={16} />
                    Ver en Google Maps
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
