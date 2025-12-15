// src/hooks/useSearchClientes.ts
import { useState } from "react";
import { supabase } from "../config/supabase";

export interface SearchCliente {
  id: number;
  cliente: number;
  razon_social_codigo: number | null;
  razon_social_nombre: string;
  situacion: string | null;
  promos: string | null;
}

export const useSearchClientes = () => {
  const [results, setResults] = useState<SearchCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchClientes = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("search_clientes")
      .select(`
        id,
        cliente,
        razon_social_codigo,
        razon_social_nombre,
        situacion,
        promos
      `)
      .ilike("razon_social_nombre", `%${term}%`)
      .order("razon_social_nombre", { ascending: true })
      .limit(20);

    if (error) {
      setError(error.message);
      setResults([]);
    } else {
      setResults(data || []);
    }

    setLoading(false);
  };

  return {
    results,
    loading,
    error,
    searchClientes,
  };
};
