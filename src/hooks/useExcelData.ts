import { useState, useEffect } from 'react';
import { ExcelData, ClienteData } from '../types';
import { loadExcelFromPublic, searchClient } from '../utils/excelProcessor';

export const useExcelData = () => {
  const [data, setData] = useState<ExcelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<ClienteData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 👇 acá llamamos a CSV.xlsx desde /public
      const result = await loadExcelFromPublic('/CSV.xlsx');
      setData(result);
    } catch (err) {
      console.error('Error al cargar CSV.xlsx:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar Excel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = () => {
    if (data && searchTerm.trim()) {
      const result = searchClient(data, searchTerm);
      setSearchResult(result);
      setHasSearched(true);
    }
  };

  const retryLoad = () => {
    loadData();
  };

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
  };
};
