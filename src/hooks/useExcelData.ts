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
      const result = await loadExcelFromPublic();
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al cargar el Excel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = () => {
    if (!data) return;
    setHasSearched(true);
    const result = searchClient(data, searchTerm);
    setSearchResult(result);
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
    retryLoad: loadData,
  };
};

