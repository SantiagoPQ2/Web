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
  BarChart3,
  File,
  ShoppingCart,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../config/supabase";

const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [notisAbiertas, setNotisAbiertas] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown user al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar notificaciones
  const cargarNotificaciones = async () => {
    if (!user?.username) return;

    const { data } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", user.username)
      .order("created_at", { ascending: false });

    if (data) setNotificaciones(data);
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
    if (!user?.username) return;

    cargarNotificaciones();

    const sub = supabase
      .channel("notificaciones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          if ((payload as any)?.new?.usuario_username === user?.username) {
            cargarNotificaciones();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  // ✅ Logout sin borrar el “once per day” del video gate
  const handleLogout = () => {
    try {
      const keep: Record<string, string> = {};

      // guardamos todas las keys del gate
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("mandatory_video_done:")) {
          const v = localStorage.getItem(k);
          if (v !== null) keep[k] = v;
        }
      }

      localStorage.clear();

      // restauramos keys del gate
      Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {
      // si falla, al menos no rompemos logout
      localStorage.clear();
    }

    window.location.href = "/";
  };

  // Nombre de página actual
  const getCurrentPageName = () => {
    switch (location.pathname) {
      case "/":
        return user?.role === "administracion-cordoba"
          ? "Pedido de Compra"
          : "Buscar Cliente";

      case "/bonificaciones":
        return "Bonificaciones";

      // ✅ NUEVO
      case "/revisar-bonificaciones":
        return "Revisar Bonificaciones";

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
      case "/planilla-carga":
        return "Planilla de Carga";
      case "/mapa":
        return "Mapa de Visitas";
      case "/powerbi":
        return "Dashboard Power BI";
      case "/baja-cliente":
        return "Baja / Cambio Ruta";
      case "/revisar-bajas":
        return "Revisión de Bajas";
      case "/pdfs":
        return "Documentos PDF";

      // ✅ COMPRAS
      case "/pedido-compra":
        return "Pedido de Compra";
      case "/revisar-compras":
        return "Revisar Compras";

      // ✅ VIDEO (lista para ver videos)
      case "/video-log":
        return "Videos";

      // === B2B ===
      case "/b2b/catalogo":
        return "B2B - Catálogo";
      case "/b2b/carrito":
        return "B2B - Carrito";
      case "/b2b/pedidos":
        return "B2B - Pedidos";

      default:
        return "VaFood SRL - AR";
    }
  };

  // -------------------------
  // MENÚ SEGÚN ROL
  // -------------------------

  let menuItems: {
    name: string;
    path: string;
    icon: any;
    description: string;
  }[] = [];

  // ✅ TEST (igual a vendedor) + ✅ incluye Videos
  if (user?.role === "test") {
    menuItems = [
      {
        name: "Buscar Cliente",
        path: "/",
        icon: Search,
        description: "Consultar información de clientes",
      },
      {
        name: "Bonificaciones",
        path: "/bonificaciones",
        icon: Save,
        description: "Registrar bonificaciones",
      },
      {
        name: "Notas de Crédito",
        path: "/notas-credito",
        icon: FileText,
        description: "Registrar notas de crédito",
      },
      {
        name: "GPS Logger",
        path: "/gps-logger",
        icon: MapPin,
        description: "Registrar y ver coordenadas GPS",
      },
      {
        name: "Información",
        path: "/informacion",
        icon: Info,
        description: "Resumen y clientes del día",
      },
      {
        name: "Baja / Cambio Ruta",
        path: "/baja-cliente",
        icon: FileText,
        description: "Solicitar baja o cambio de ruta",
      },
      {
        name: "Videos",
        path: "/video-log",
        icon: FileText,
        description: "Ver videos disponibles",
      },
      {
        name: "Chat",
        path: "/chat",
        icon: MessageSquare,
        description: "Comunicación interna",
      },
      {
        name: "Configuración",
        path: "/settings",
        icon: SettingsIcon,
        description: "Configuración del usuario",
      },
    ];
  }

  // ✅ VENDEDOR + ✅ incluye Videos
  else if (user?.role === "vendedor") {
    menuItems = [
      {
        name: "Buscar Cliente",
        path: "/",
        icon: Search,
        description: "Consultar información de clientes",
      },
      {
        name: "Bonificaciones",
        path: "/bonificaciones",
        icon: Save,
        description: "Registrar bonificaciones",
      },
      {
        name: "Notas de Crédito",
        path: "/notas-credito",
        icon: FileText,
        description: "Registrar notas de crédito",
      },
      {
        name: "GPS Logger",
        path: "/gps-logger",
        icon: MapPin,
        description: "Registrar y ver coordenadas GPS",
      },
      {
        name: "Información",
        path: "/informacion",
        icon: Info,
        description: "Resumen y clientes del día",
      },
      {
        name: "Baja / Cambio Ruta",
        path: "/baja-cliente",
        icon: FileText,
        description: "Solicitar baja o cambio de ruta",
      },
      {
        name: "Videos",
        path: "/video-log",
        icon: FileText,
        description: "Ver videos disponibles",
      },
      {
        name: "Chat",
        path: "/chat",
        icon: MessageSquare,
        description: "Comunicación interna",
      },
      {
        name: "Configuración",
        path: "/settings",
        icon: SettingsIcon,
        description: "Configuración del usuario",
      },
    ];
  }

  // SUPERVISOR
  else if (user?.role === "supervisor") {
    menuItems = [
      {
        name: "Buscar Cliente",
        path: "/",
        icon: Search,
        description: "Consultar información de clientes",
      },
      {
        name: "Pedido de Compra",
        path: "/pedido-compra",
        icon: ShoppingCart,
        description: "Cargar un pedido de compra",
      },
      {
        name: "Revisar Compras",
        path: "/revisar-compras",
        icon: FileText,
        description: "Ver pedidos de compra",
      },
      {
        name: "Bonificaciones",
        path: "/bonificaciones",
        icon: Save,
        description: "Registrar bonificaciones",
      },

      // ✅ NUEVO: supervisor puede ver esta página
      {
        name: "Revisar Bonificaciones",
        path: "/revisar-bonificaciones",
        icon: FileText,
        description: "Aprobar bonificaciones cargadas",
      },

      {
        name: "Notas de Crédito",
        path: "/notas-credito",
        icon: FileText,
        description: "Registrar notas",
      },
      {
        name: "GPS Logger",
        path: "/gps-logger",
        icon: MapPin,
        description: "Registrar y ver coordenadas GPS",
      },
      {
        name: "Revisar Bajas",
        path: "/revisar-bajas",
        icon: FileText,
        description: "Aprobar solicitudes de baja",
      },
      {
        name: "Documentos PDF",
        path: "/pdfs",
        icon: File,
        description: "Documentación interna",
      },
      {
        name: "Mapa de Visitas",
        path: "/mapa",
        icon: Compass,
        description: "Rutas y visitas",
      },
      {
        name: "Dashboard Power BI",
        path: "/powerbi",
        icon: BarChart3,
        description: "Indicadores",
      },
      {
        name: "Supervisor",
        path: "/supervisor",
        icon: Compass,
        description: "Panel del supervisor",
      },
      {
        name: "Chat",
        path: "/chat",
        icon: MessageSquare,
        description: "Comunicación interna",
      },
      {
        name: "Configuración",
        path: "/settings",
        icon: SettingsIcon,
        description: "Configuración del usuario",
      },
    ];
  }

  // LOGÍSTICA
  else if (user?.role === "logistica") {
    menuItems = [
      {
        name: "Nuevo Rechazo",
        path: "/rechazos/nuevo",
        icon: Plus,
        description: "Registrar nuevo rechazo",
      },
      {
        name: "Coordenadas",
        path: "/coordenadas",
        icon: MapPin,
        description: "Consultar coordenadas",
      },
      {
        name: "Información",
        path: "/informacion",
        icon: Info,
        description: "Resumen y datos",
      },
      {
        name: "Chat",
        path: "/chat",
        icon: MessageSquare,
        description: "Comunicación interna",
      },
      {
        name: "Configuración",
        path: "/settings",
        icon: SettingsIcon,
        description: "Configuración del usuario",
      },
    ];
  }

  // ADMINISTRACION - CÓRDOBA (SOLO 2 PÁGINAS)
  else if (user?.role === "administracion-cordoba") {
    menuItems = [
      {
        name: "Pedido de Compra",
        path: "/pedido-compra",
        icon: ShoppingCart,
        description: "Cargar un pedido de compra",
      },
      {
        name: "Revisar Compras",
        path: "/revisar-compras",
        icon: FileText,
        description: "Ver pedidos de compra",
      },
    ];
  }

  // ADMIN
  else if (user?.role === "admin") {
    menuItems = [
      {
        name: "Buscar Cliente",
        path: "/",
        icon: Search,
        description: "Consultar información de clientes",
      },
      {
        name: "Bonificaciones",
        path: "/bonificaciones",
        icon: Save,
        description: "Registrar bonificaciones",
      },

      // ✅ NUEVO: admin puede ver esta página (pero no aprueba dentro de la página)
      {
        name: "Revisar Bonificaciones",
        path: "/revisar-bonificaciones",
        icon: FileText,
        description: "Ver bonificaciones cargadas",
      },

      {
        name: "Nuevo Rechazo",
        path: "/rechazos/nuevo",
        icon: Plus,
        description: "Registrar rechazos",
      },
      {
        name: "Coordenadas",
        path: "/coordenadas",
        icon: MapPin,
        description: "Consultar coordenadas",
      },
      {
        name: "Notas de Crédito",
        path: "/notas-credito",
        icon: FileText,
        description: "Registrar notas",
      },
      {
        name: "GPS Logger",
        path: "/gps-logger",
        icon: MapPin,
        description: "Registrar coordenadas",
      },
      {
        name: "Revisar Bajas",
        path: "/revisar-bajas",
        icon: FileText,
        description: "Aprobar solicitudes de baja",
      },
      {
        name: "Pedido de Compra",
        path: "/pedido-compra",
        icon: ShoppingCart,
        description: "Cargar un pedido de compra",
      },
      {
        name: "Revisar Compras",
        path: "/revisar-compras",
        icon: FileText,
        description: "Aprobar y auditar pedidos de compra",
      },
      {
        name: "Documentos PDF",
        path: "/pdfs",
        icon: File,
        description: "Documentación interna",
      },
      {
        name: "Mapa de Visitas",
        path: "/mapa",
        icon: Compass,
        description: "Rutas y visitas",
      },
      {
        name: "Dashboard Power BI",
        path: "/powerbi",
        icon: BarChart3,
        description: "Indicadores",
      },
      {
        name: "Panel Admin",
        path: "/admin",
        icon: Wrench,
        description: "Herramientas admin",
      },
      {
        name: "Chat",
        path: "/chat",
        icon: MessageSquare,
        description: "Comunicación interna",
      },
      {
        name: "Configuración",
        path: "/settings",
        icon: SettingsIcon,
        description: "Configuración del usuario",
      },
    ];
  }

  const hideSettingsEverywhere = user?.role === "administracion-cordoba";

  return (
    <>
      {/* HEADER SUPERIOR */}
      <header className="w-full bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 transition"
            >
              <Menu size={24} />
            </button>

            <div className="flex items-center">
              <img src="/image.png" className="h-8 w-8 mr-2" alt="Logo" />
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {getCurrentPageName()}
              </h1>
            </div>
          </div>

          {/* ICONOS DERECHA */}
          <div className="flex items-center gap-4 relative">
            {/* NOTIFICACIONES */}
            <div className="relative">
              <button
                className="relative p-2"
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

              {/* LISTA NOTIS */}
              {notisAbiertas && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50">
                  <h4 className="font-semibold mb-2">Notificaciones</h4>

                  {notificaciones.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin notificaciones</p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto">
                      {notificaciones.map((n) => (
                        <li
                          key={n.id}
                          className="text-sm p-2 border-b border-gray-200 dark:border-gray-700"
                        >
                          <strong>{n.titulo}</strong>
                          <br />
                          {n.mensaje}
                          <br />
                          <span className="text-xs text-gray-500">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* USUARIO */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-full bg-gray-100 dark:bg-gray-800"
              >
                <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
                  <p className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
                    {user?.username}
                  </p>

                  {!hideSettingsEverywhere && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      onClick={() => (window.location.href = "/settings")}
                    >
                      <User size={16} /> Configuración
                    </button>
                  )}

                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={handleLogout}
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

          <div className="fixed top-0 left-0 w-full max-w-xs sm:w-72 bg-white dark:bg-gray-900 h-full shadow-xl z-50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Menú</h2>
              <button
                className="text-gray-600 hover:text-red-600"
                onClick={() => setSidebarOpen(false)}
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
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      isActive
                        ? "bg-red-50 border-l-4 border-red-500"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 mt-0.5 ${
                        isActive ? "text-red-600" : "text-gray-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.description}
                      </div>
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
