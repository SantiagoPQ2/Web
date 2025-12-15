// src/components/SearchClientes.tsx
import React, { useState } from "react";
import { useSearchClientes } from "../hooks/useSearchClientes";

const SearchClientes: React.FC = () => {
  const [term, setTerm] = useState("");
  const { results, loading, error, searchClientes } = useSearchClientes();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTerm(value);
    searchClientes(value);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <input
        type="text"
        value={term}
        onChange={handleChange}
        placeholder="Buscar cliente por razón social..."
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:border-blue-400"
      />

      {loading && (
        <p className="mt-4 text-sm text-gray-500">Buscando clientes…</p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">
          Error: {error}
        </p>
      )}

      {!loading && results.length === 0 && term.length >= 2 && (
        <p className="mt-4 text-sm text-gray-500">
          No se encontraron clientes.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {results.map((cliente) => (
          <li
            key={cliente.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <p className="font-semibold text-gray-800">
              {cliente.razon_social_nombre}
            </p>

            {cliente.situacion && (
              <p className="mt-1 text-sm text-gray-600">
                {cliente.situacion}
              </p>
            )}

            {cliente.promos && (
              <p className="mt-2 text-sm text-blue-700">
                {cliente.promos}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchClientes;
