import React from 'react';
import { FileSpreadsheet, Github, Globe } from 'lucide-react';
import { useExcelData } from './hooks/useExcelData';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import SearchBox from './components/SearchBox';
import ClientResult from './components/ClientResult';
import EmptyState from './components/EmptyState';
import { CONFIG } from './config/constants';

function App() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="mr-3">
                <img src="/image.png" alt="VaFood Logo" className="h-10 w-10 rounded" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {CONFIG.APP_NAME}
                </h1>
              </div>
            </div>
            
           
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estado de carga inicial */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <LoadingSpinner message={CONFIG.MESSAGES.LOADING} />
          </div>
        )}

        {/* Estado de error */}
        {error && !loading && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={retryLoad} />
          </div>
        )}

        {/* Contenido principal cuando los datos están cargados */}
        {data && !loading && !error && (
          <div className="space-y-6">
            
            {/* Caja de búsqueda */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Buscar Cliente
              </h2>
              <SearchBox
                value={searchTerm}
                onChange={setSearchTerm}
                onSearch={handleSearch}
                placeholder={CONFIG.MESSAGES.SEARCH_PLACEHOLDER}
              />
            </div>

            {/* Resultados de la búsqueda */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {searchResult ? (
                <ClientResult cliente={searchResult} />
              ) : hasSearched ? (
                <EmptyState type="not-found" searchTerm={searchTerm} />
              ) : (
                <EmptyState type="initial" />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>
              VaFood - Sistema de consulta de clientes - Desplegado en Netlify
            </p>
            <p className="mt-1">
              Consulte situación y promociones de clientes
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
