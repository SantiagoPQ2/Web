import React, { useState, useRef } from "react";
import { useExcelData } from "../hooks/useExcelData";
import { supabase } from "../config/supabase";
import { CONFIG } from "../config/constants";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SearchBox from "../components/SearchBox";
import ClientResult from "../components/ClientResult";
import EmptyState from "../components/EmptyState";

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

  const lastSearchRef = useRef<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Recuperamos el usuario logueado desde localStorage
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const handleSearch = async () => {
    setLocalError(null);
    if (!searchTerm) return;

    if (lastSearchRef.current === searchTerm) {
      setLocalError("⚠️ Ya buscaste este cliente, prueba con otro distinto.");
      return;
    }

    console.log("Intentando guardar en Supabase:", searchTerm);

    const { data: inserted, error } = await supabase
      .from("busquedas_clientes")
      .insert([
        {
          cliente_numero: searchTerm,
          created_by: currentUser.id,
        },
      ])
      .select();

    if (error) {
      console.error("❌ Error al guardar búsqueda:", error.message);
      setLocalError("❌ Error al guardar búsqueda.");
    } else {
      console.log("✅ Búsqueda guardada en Supabase:", inserted);
      lastSearchRef.current = searchTerm;
    }

    handleExcelSearch();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 🌀 Loading */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-8">
          <LoadingSpinner message={CONFIG.MESSAGES.LOADING} />
        </div>
      )}

      {/* ⚠️ Error */}
      {(error || localError) && !loading && (
        <div className="mb-6">
          <ErrorMessage message={error || localError} onRetry={retryLoad} />
        </div>
      )}

      {/* ✅ Contenido principal */}
      {data && !loading && !error && (
        <div className="space-y-6">
          {/* 🔍 Caja de búsqueda */}
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

          {/* 🧾 Resultado del cliente */}
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
