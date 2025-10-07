import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  ChevronDown,
  Search,
  Save,
  Plus,
  FileText,
  MapPin,
  User,
  Info,
  Compass,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsDropdownOpen(false);
  }, [location]);

  // 🔹 Menú lateral según rol
  let menuItems: { name: string; path: string; icon: any; description: string }[] = [];

  if (user?.role === "vendedor") {
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar coordenadas" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen del día" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Chat interno" },
    ];
  } else if (user?.role === "supervisor") {
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar coordenadas" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen del día" },
      { name: "Supervisor", path: "/supervisor", icon: Compass, description: "Revisar vendedores" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Chat interno" },
    ];
  } else if (user?.role === "logistica") {
    menuItems = [
      { name: "Nuevo Rechazo", path: "/rechazos/nuevo", icon: Plus, description: "Registrar rechazo" },
      { name: "Coordenadas", path: "/coordenadas", icon: MapPin, description: "Ver coordenadas" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen del día" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Chat interno" },
    ];
  } else {
    // admin
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Nuevo Rechazo", path: "/rechazos/nuevo", icon: Plus, description: "Registrar rechazo" },
      { name: "Coordenadas", path: "/coordenadas", icon: MapPin, description: "Ver coordenadas" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar coordenadas" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen del día" },
      { name: "Supervisor", path: "/supervisor", icon: Compass, description: "Revisar vendedores" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Chat interno" },
    ];
  }

  return (
    <>
      {/* 🔺 HEADER SUPERIOR */}
      <header className="bg-white border-b border-gray-200 shadow-sm h-14 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-gray-700 hover:text-red-600 focus:outline-none"
        >
          {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="flex items-center space-x-2">
          <img src="/image.png" alt="VaFood Logo" className="h-7 w-7 object-contain" />
        </div>

        <div className="flex items-center space-x-4" ref={dropdownRef}>
          {user && (
            <div className="text-right text-xs leading-tight">
              <p className="text-gray-500">
                Rol: <b>{user.role}</b>
              </p>
              <p className="text-gray-800">
                Usuario: <b>{user.username}</b>
              </p>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none"
            >
              Chat
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Configuración
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t"
                >
                  <LogOut className="inline mr-2 h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 🔻 SIDEBAR LATERAL */}
      <aside
        className={`fixed top-14 left-0 h-[calc(100%-3.5rem)] bg-white border-r border-gray-200 shadow-md transition-all duration-300 z-30 overflow-y-auto ${
          isSidebarOpen ? "w-64" : "w-0 md:w-64"
        }`}
      >
        <nav className="mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2 text-sm transition ${
                  active ? "bg-red-100 text-red-700 font-medium" : "text-gray-700 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Navigation;
