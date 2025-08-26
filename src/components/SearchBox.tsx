import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  onSearch,
  disabled = false,
  placeholder = "Ingrese el número de cliente..."
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch();
    }
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            block w-full pl-10 pr-12 py-3 text-base border border-gray-300 rounded-lg 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-all duration-200
          `}
        />
        
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-red-600 transition-colors duration-200"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>
      
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={`
          w-full mt-4 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg
          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:bg-gray-400 disabled:cursor-not-allowed
          transition-all duration-200
        `}
      >
        Buscar Cliente
      </button>
    </form>
  );
};

export default SearchBox;