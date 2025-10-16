import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  Bell,
  User,
  Search,
  Save,
  FileText,
  MapPin,
  Info,
  MessageSquare,
  Compass,
  Plus,
  X,
  Settings as SettingsIcon,
  Wrench,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../config/supabase";

// -------------------------------
// COMPONENTE PRINCIPAL
// -------------------------------
const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [notisAbiertas, setNotisAbiertas] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ---------------------------------
  // MANEJO DE CLICK FUERA DE MENÚ USUARIO
  // ---------------------------------
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------------------------------
  // CARGAR Y ESCUCHAR NOTIFICACIONES
  // ---------------------------------
  const cargarNotificaciones = async () => {
    if (!user?.username) return;
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", user.username)
      .order("created_at", { ascending: false });
    if (!error && data) setNotificaciones(data);
  };

  const marcarLeidas = async () => {
    if (!user?.username) return;
    await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_username", user.username);
    cargarNotificaciones();
  };

  useEffect(() => {
    cargarNotificaciones();

    // Escucha en tiempo real
    const sub = supabase
      .channel("notificaciones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          if (payload.new.usuario_username === user?.username) cargarNotificaciones();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [user]);

  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  // ---------------------------------
  // RECORDATORIO AUTOMÁTICO 6 AM (solo vendedores)
  // ---------------------------------
  useEffect(() => {
    if (user?.role !== "vendedor") return;

    const now = new Date();
    const target = new Date();
    target.setHours(6, 0, 0, 0);
    if (now > target) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      await supabase.from("notificaciones").insert([
        {
          usuario_username: user.username,
          titulo: "Recordatorio diario",
          mensaje: "Recordá consultar tu pestaña de información",
        },
      ]);
      cargarNotificaciones();
    }, delay);

    return () => clearTimeout(timer);
  }, [user]);

  // ---------------------------------
  // NOMBRE DE PÁGINA ACTUAL
  // ---------------------------------
  const getCurrentPageName = () => {
    switch (location.pathname) {
      case "/":
        return "Buscar Cliente";
      case "/bonificaciones":
        return "Bonificaciones";
      case "/notas-credito":
        return "Notas de Crédito";
      case "/gps-logger":
        return "GPS Logger";
      case "/informacion":
        return "Información";
      case "/rechazos/nuevo":
        return "Nuevo Rechazo";
      case "/coordenadas":
        return "Coordenadas";
      case "/supervisor":
        return "Supervisor";
      case "/chat":
        return "Chat";
      case "/settings":
        return "Configuración";
      case "/admin":
        return "Panel Admin";
      default:
        return "VaFood SRL - AR";
    }
  };

  // ---------------------------------
  // MENÚS POR ROL
  // ---------------------------------
  let menuItems: { name: string; path: string; icon: any; description: string }[] = [];

  if (user?.role === "vendedor") {
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar información de clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar y ver coordenadas GPS" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen, Quiz y Clientes del Día" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Comunicación interna con supervisores" },
      { name: "Settings", path: "/settings", icon: SettingsIcon, description: "Configurar perfil y cerrar sesión" },
    ];
  } else if (user?.role === "supervisor") {
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar información de clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar y ver coordenadas GPS" },
      { name: "Supervisor", path: "/supervisor", icon: Compass, description: "Ver agenda y reuniones del día" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Comunicación interna con vendedores" },
      { name: "Settings", path: "/settings", icon: SettingsIcon, description: "Configurar perfil y cerrar sesión" },
    ];
  } else if (user?.role === "logistica") {
    menuItems = [
      { name: "Nuevo Rechazo", path: "/rechazos/nuevo", icon: Plus, description: "Registrar nuevo rechazo" },
      { name: "Coordenadas", path: "/coordenadas", icon: MapPin, description: "Consultar coordenadas de clientes" },
      { name: "Información", path: "/informacion", icon: Info, description: "Resumen, Quiz y Clientes del Día" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Comunicación interna con administración" },
      { name: "Settings", path: "/settings", icon: SettingsIcon, description: "Configurar perfil y cerrar sesión" },
    ];
  } else if (user?.role === "admin") {
    menuItems = [
      { name: "Buscar Cliente", path: "/", icon: Search, description: "Consultar información de clientes" },
      { name: "Bonificaciones", path: "/bonificaciones", icon: Save, description: "Registrar bonificaciones" },
      { name: "Nuevo Rechazo", path: "/rechazos/nuevo", icon: Plus, description: "Registrar nuevo rechazo" },
      { name: "Coordenadas", path: "/coordenadas", icon: MapPin, description: "Consultar coordenadas de clientes" },
      { name: "Notas de Crédito", path: "/notas-credito", icon: FileText, description: "Registrar notas de crédito" },
      { name: "GPS Logger", path: "/gps-logger", icon: MapPin, description: "Registrar y ver coordenadas GPS" },
      { name: "Panel Admin", path: "/admin", icon: Wrench, description: "Administrar tablas, CSVs y registros" },
      { name: "Chat", path: "/chat", icon: MessageSquare, description: "Comunicación interna general" },
      { name: "Settings", path: "/settings", icon: SettingsIcon, description: "Configurar perfil y cerrar sesión" },
    ];
  }

  // ---------------------------------
  // RENDER
  // ---------------------------------
  return (
    <>
      {/* HEADER */}
      <header className="w-full bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Menú lateral + título */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-red-600 transition"
              aria-label="Abrir menú"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center">
              <img src="/image.png" alt="VaFood" className="h-8 w-8 object-contain mr-2" />
              <h1 className="text-lg font-semibold text-gray-800">{getCurrentPageName()}</h1>
            </div>
          </div>

          {/* Notificaciones + usuario */}
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button
                className="relative p-2 text-gray-600 hover:text-red-600 transition"
                aria-label="Notificaciones"
                onClick={() => {
                  setNotisAbiertas(!notisAbiertas);
                  if (!notisAbiertas) marcarLeidas();
                }}
              >
                <Bell size={20} />
                {sinLeer > 0 && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {sinLeer}
                  </span>
                )}
              </button>

              {notisAbiertas && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border p-3 z-50">
                  <h4 className="font-semibold mb-2">Notificaciones</h4>
                  {notificaciones.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin notificaciones</p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto">
                      {notificaciones.map((n) => (
                        <li
                          key={n.id}
                          className={`text-sm p-2 rounded-md ${
                            n.leida ? "text-gray-500" : "text-black font-medium"
                          }`}
                        >
                          <strong>{n.titulo}</strong>
                          <br />
                          {n.mensaje}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Menú usuario */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                aria-label="Menú de usuario"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white font-semibold">
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                  <p className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    {user?.username || "Usuario"}
                  </p>
                  <button
                    onClick={() => (window.location.href = "/settings")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                  >
                    <User size={16} /> Configuración
                  </button>
                  <button
                    onClick={() => {
                      localStorage.clear();
                      window.location.href = "/";
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSidebarOpen(false)}
          ></div>

          <div className="fixed top-0 left-0 w-72 bg-white h-full shadow-xl z-50 flex flex-col p-4 overflow-y-auto animate-slideIn">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Menú</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-600 hover:text-red-600"
              >
                <X size={22} />
              </button>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors duration-150 ${
                      isActive
                        ? "bg-red-50 border-l-4 border-red-500 text-red-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 mt-0.5 ${
                        isActive ? "text-red-600" : "text-gray-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default Navigation;
