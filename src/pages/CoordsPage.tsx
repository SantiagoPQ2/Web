import React, { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useCoordsData } from "../hooks/useCoordsData";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const CoordsPage: React.FC = () => {
  const { data, loading, error } = useCoordsData();
  const [searchTerm, setSearchTerm] = useState("");

  const clienteEncontrado = data.find(
    (c) => c.cliente.toLowerCase() === searchTerm.toLowerCase()
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Buscador */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Buscar Coordenadas</h2>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ingrese número de cliente..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          />
          <button
            onClick={() => setSearchTerm(searchTerm.trim())}
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Estados */}
      {loading && <LoadingSpinner message="Cargando archivo F96.xlsx..." />}
      {error && <ErrorMessage message={error} onRetry={() => window.location.reload()} />}

      {/* Resultado */}
      {!loading && !error && clienteEncontrado && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <MapPin className="h-6 w-6 text-red-700 mr-2" />
            <h3 className="text-xl font-bold text-gray-900">
              Cliente {clienteEncontrado.cliente}
            </h3>
          </div>
          <p><strong>Coord Y:</strong> {clienteEncontrado.coordY}</p>
          <p><strong>Coord X:</strong> {clienteEncontrado.coordX}</p>
          <p><strong>Dirección:</strong> {clienteEncontrado.direccion || "Sin información"}</p>
        </div>
      )}

      {!loading && !error && !clienteEncontrado && searchTerm && (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
          ❌ No se encontraron coordenadas para el cliente "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default CoordsPage;

