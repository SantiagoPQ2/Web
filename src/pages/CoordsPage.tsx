import React from 'react';
import { MapPin } from 'lucide-react';
import { useExcelData } from '../hooks/useExcelData';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import SearchBox from '../components/SearchBox';
import EmptyState from '../components/EmptyState';
import { CONFIG } from '../config/constants';

const CoordsPage: React.FC = () => {
  const {
    data,
    loading,
    error,
    searchTerm,
    searchResult,
    hasSearched,
    setSearchTerm,
    handleSearch,
    retryLoad,
  } = useExcelData();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-8">
          <LoadingSpinner message="Cargando coordenadas desde Google Sheets..." />
        </div>
      )}

      {error && !loading && (
        <div className="mb-6">
          <ErrorMessage message={error} onRetry={retryLoad} />
        </div>
      )}

      {data && !loading && !error && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Buscar Coordenadas
            </h2>
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleSearch}
              placeholder="Ingrese el número de cliente"
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            {searchResult ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="bg-red-100 rounded-full p-2 mr-3">
                    <MapPin className="h-6 w-6 text-red-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Cliente {searchResult.Cliente}
                    </h3>
                    <p className="text-sm text-gray-600">Coordenadas encontradas</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Coord X</p>
                    <p className="text-lg font-semibold text-gray-900">{searchResult['Coord X']}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Coord Y</p>
                    <p className="text-lg font-semibold text-gray-900">{searchResult['Coord Y']}</p>
                  </div>
                </div>
              </div>
            ) : hasSearched ? (
              <EmptyState type="not-found" searchTerm={searchTerm} />
            ) : (
              <EmptyState type="initial" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordsPage;
