
interface RechazoData {
  transporte: string;
  cliente: string;
  motivoRechazo: string;
  monto: string;
  fecha?: string;
  timestamp?: string;
}
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Truck, User, FileText, DollarSign, RefreshCw, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

interface RechazoData {
  transporte: string;
  cliente: string;
  motivoRechazo: string;
  monto: string;
  fecha?: string;
  timestamp?: string;
}

const Rechazos: React.FC = () => {
  const [rechazos, setRechazos] = useState<RechazoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRechazos, setFilteredRechazos] = useState<RechazoData[]>([]);

  const loadRechazos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/.netlify/functions/get-rechazos', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron cargar los rechazos`);
      }

      const data = await response.json();
      setRechazos(data.rechazos || []);
      setFilteredRechazos(data.rechazos || []);

    } catch (err) {
      console.error('Error al cargar rechazos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar rechazos basado en el término de búsqueda
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRechazos(rechazos);
    } else {
      const filtered = rechazos.filter(rechazo =>
        rechazo.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rechazo.transporte.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rechazo.motivoRechazo.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRechazos(filtered);
    }
  }, [searchTerm, rechazos]);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadRechazos();
  }, []);

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return isNaN(num) ? amount : `$${num.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-red-100 rounded-full p-2 mr-3">
              <AlertTriangle className="h-6 w-6 text-red-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rechazos Registrados</h1>
              <p className="text-gray-600">Visualización de rechazos guardados en Google Sheets</p>
            </div>
          </div>
          <button
            onClick={loadRechazos}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 transition-colors duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="max-w-md">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Buscar en rechazos
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, transporte o motivo..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          />
        </div>
      </div>

      {/* Estados de carga y error */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-8">
          <LoadingSpinner message="Cargando rechazos desde Google Sheets..." />
        </div>
      )}

      {error && !loading && (
        <div className="mb-6">
          <ErrorMessage message={error} onRetry={loadRechazos} />
        </div>
      )}

      {/* Lista de rechazos */}
      {!loading && !error && (
        <div className="space-y-4">
          {filteredRechazos.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {searchTerm ? 'No se encontraron rechazos' : 'No hay rechazos registrados'}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `No hay rechazos que coincidan con "${searchTerm}"`
                  : 'Aún no se han registrado rechazos en el sistema'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Contador de resultados */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">
                  Mostrando {filteredRechazos.length} de {rechazos.length} rechazos
                  {searchTerm && ` para "${searchTerm}"`}
                </p>
              </div>

              {/* Grid de rechazos */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRechazos.map((rechazo, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
                    {/* Header de la tarjeta */}
                    <div className="flex items-center mb-4">
                      <div className="bg-red-100 rounded-full p-2 mr-3">
                        <AlertTriangle className="h-5 w-5 text-red-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 truncate">
                          {rechazo.cliente}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(rechazo.fecha || rechazo.timestamp || '')}
                        </p>
                      </div>
                    </div>

                    {/* Información del rechazo */}
                    <div className="space-y-3">
                      {/* Transporte */}
                      <div className="flex items-start">
                        <Truck className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Transporte</p>
                          <p className="text-sm font-medium text-gray-800">{rechazo.transporte}</p>
                        </div>
                      </div>

                      {/* Cliente */}
                      <div className="flex items-start">
                        <User className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Cliente</p>
                          <p className="text-sm font-medium text-gray-800">{rechazo.cliente}</p>
                        </div>
                      </div>

                      {/* Motivo */}
                      <div className="flex items-start">
                        <FileText className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Motivo</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{rechazo.motivoRechazo}</p>
                        </div>
                      </div>

                      {/* Monto */}
                      <div className="flex items-start">
                        <DollarSign className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Monto</p>
                          <p className="text-sm font-medium text-gray-800">{formatCurrency(rechazo.monto)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Rechazos;