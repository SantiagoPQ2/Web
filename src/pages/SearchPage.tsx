import React from 'react';
import { useExcelData } from '../hooks/useExcelData';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import SearchBox from '../components/SearchBox';
import ClientResult from '../components/ClientResult';
import EmptyState from '../components/EmptyState';
import { CONFIG } from '../config/constants';
import { supabase } from '../config/supabase';  // 👈 importar supabase

const SearchPage: React.FC = () => {
  const {
    data,
    loading,
    error,
    searchTerm,
    searchResult,
    hasSearched,
    setSearchTerm,
    handleSearch: handleExcelSearch,
    retryLoad,
  } = useExcelData();

  // 🔹 Envolvemos handleSearch para también guardar en Supabase
  const handleSearch = async () => {
    if (!searchTerm) return;

    // Guardar en Supabase
    const { error } = await supabase
      .from("busquedas_clientes")
      .insert([{ cliente_numero: searchTerm }]);

    if (error) {
      console.error("❌ Error al guardar búsqueda:", error.message);
    } else {
      console.log("✅ Búsqueda guardada en Supabase:", searchTerm);
    }

    // Ejecutar búsqueda normal en Excel
    handleExcelSearch();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-8">
          <LoadingSpinner message={CONFIG.MESSAGES.LOADING} />
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
              Buscar Cliente
            </h2>
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleSearch}  {/* 👈 usamos el nuevo handleSearch */}
              placeholder={CONFIG.MESSAGES.SEARCH_PLACEHOLDER}
            />
          </div>

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
    </div>
  );
};

export default SearchPage;
