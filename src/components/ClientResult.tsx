import React from 'react';
import { User, FileText, List, Info } from 'lucide-react';
import { ClienteData } from '../types';

interface ClientResultProps {
  cliente: ClienteData;
}

const ClientResult: React.FC<ClientResultProps> = ({ cliente }) => {
  const formatContent = (content: string) => {
    if (!content) return 'Sin información';
    
    // Convertir saltos de línea a elementos JSX
    return content.split('\n').map((line, index) => (
      <span key={index}>
        {line.trim()}
        {index < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 animate-fadeIn">
      {/* Encabezado con número de cliente */}
      <div className="flex items-center mb-6">
        <div className="bg-red-100 rounded-full p-2 mr-3">
          <User className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Cliente Encontrado</h2>
          <p className="text-red-700 font-medium">N° {cliente.numero}</p>
        </div>
      </div>

      {/* Grid de información */}
      <div className="space-y-6">
        {/* Columna B */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Info className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-800">Información Principal</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {cliente.columnaB || 'Sin información'}
          </p>
        </div>

        {/* Columna C */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <List className="h-5 w-5 text-red-700 mr-2" />
            <h3 className="font-semibold text-gray-800">Situación</h3>
          </div>
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {formatContent(cliente.columnaC)}
          </div>
        </div>

        {/* Columna D */}
        <div className="bg-red-100 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <FileText className="h-5 w-5 text-red-800 mr-2" />
            <h3 className="font-semibold text-gray-800">Promos</h3>
          </div>
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {formatContent(cliente.columnaD)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientResult;