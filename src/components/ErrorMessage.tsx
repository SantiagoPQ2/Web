import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  const isRepoError = message.includes('repositorio') || message.includes('privado') || message.includes('público');
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
        <h3 className="text-lg font-semibold text-red-800">Error</h3>
      </div>
      <div className="text-red-700 mb-4 whitespace-pre-line">
        {message}
      </div>
      
      {isRepoError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-yellow-800 text-sm">
            💡 <strong>Tip:</strong> Si el repositorio es privado, GitHub no permite acceso directo a los archivos. Hazlo público temporalmente para que la aplicación pueda acceder al Excel.
          </p>
        </div>
      )}
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;