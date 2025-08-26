import React from 'react';
import { Search, FileSpreadsheet } from 'lucide-react';

interface EmptyStateProps {
  type: 'initial' | 'not-found';
  searchTerm?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, searchTerm }) => {
  if (type === 'not-found') {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Search className="h-8 w-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Cliente no encontrado
        </h3>
        <p className="text-gray-600 mb-4">
          No se encontró ningún cliente con el número: <strong>{searchTerm}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Verifique que el número ingresado sea correcto y vuelva a intentar.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <FileSpreadsheet className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Sistema de Consulta de Clientes
      </h3>
      <p className="text-gray-600 mb-4">
        Ingrese el número de cliente en el campo de búsqueda para obtener su información completa.
      </p>
      <p className="text-sm text-gray-500">
        Los datos se cargan automáticamente desde el archivo Excel configurado.
      </p>
    </div>
  );
};

export default EmptyState;