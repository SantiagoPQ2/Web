import { useState, useEffect, useCallback } from 'react';
import { ExcelData, ClienteData } from '../types';
import { loadExcelFromGitHub, searchClient } from '../utils/excelProcessor';
import { CONFIG } from '../config/constants';

export const useExcelData = () => {
  const [data, setData] = useState<ExcelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<ClienteData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Cargar datos al inicializar
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const excelData = await loadExcelFromGitHub(CONFIG.EXCEL_FILE_URL);
      setData(excelData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : CONFIG.MESSAGES.ERROR_GENERIC;
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar cliente
  const handleSearch = useCallback(() => {
    if (!data || !searchTerm.trim()) {
      setSearchResult(null);
      setHasSearched(false);
      return;
    }

    const result = searchClient(data, searchTerm.trim());
    setSearchResult(result);
    setHasSearched(true);
  }, [data, searchTerm]);

  // Reintentar carga de datos
  const retryLoad = useCallback(() => {
    loadData();
  }, [loadData]);

  // Limpiar búsqueda
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResult(null);
    setHasSearched(false);
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    searchTerm,
    searchResult,
    hasSearched,
    setSearchTerm,
    handleSearch,
    retryLoad,
    clearSearch,
  };
};