import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Search, Save } from 'lucide-react';

const Navigation: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar dropdown al cambiar de ruta
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [location]);

  const getCurrentPageName = () => {
    switch (location.pathname) {
      case '/':
        return 'Buscar Cliente';
      case '/drive':
        return 'Drive';
      default:
        return 'VaFood';
    }
  };

  const menuItems = [
    {
      name: 'Buscar Cliente',
      path: '/',
      icon: Search,
      description: 'Consultar información de clientes'
    },
    {
      name: 'Drive',
      path: '/drive',
      icon: Save,
      description: 'Registrar rechazos en Google Sheets'
    }
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y nombre */}
          <div className="flex items-center">
            <div className="mr-3">
              <img 
                src="/image.png" 
                alt="VaFood Logo" 
                className="h-10 w-10 rounded object-contain" 
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">VaFood</h1>
            </div>
          </div>

          {/* Navegación con dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <span className="mr-2">{getCurrentPageName()}</span>
              <ChevronDown 
                className={`h-4 w-4 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`} 
              />
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fadeIn">
                <div className="py-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center px-4 py-3 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive ? 'bg-red-50 text-red-700 border-r-2 border-red-700' : 'text-gray-700'
                        }`}
                      >
                        <Icon className={`h-4 w-4 mr-3 ${isActive ? 'text-red-700' : 'text-gray-400'}`} />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.description}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
