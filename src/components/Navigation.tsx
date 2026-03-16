import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Users,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";

type SystemNotification = {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  usuario_username: string;
};

type BellItem = {
  id: string;
  titulo: string;
  mensaje: string;
  created_at: string;
  leida: boolean;
  tipo: "sistema" | "chat";
  chatUser?: string;
  rawId?: number;
};

const CHAT_USER_META_REGEX = /\[\[CHAT_USER:([^\]]+)\]\]\s*$/i;

const extractChatUserFromMessage = (mensaje?: string) => {
  if (!mensaje) return null;
  const match = mensaje.match(CHAT_USER_META_REGEX);
  return match?.[1]?.trim() || null;
};

const cleanNotificationMessage = (mensaje?: string) => {
  if (!mensaje) return "";
  return mensaje.replace(CHAT_USER_META_REGEX, "").trim();
};

const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notisAbiertas, setNotisAbiertas] = useState(false);

  const [systemNotifications, setSystemNotifications] = useState<
    SystemNotification[]
  >([]);
  const [chatNotifications, setChatNotifications] = useState<BellItem[]>([]);

  const [bellHighlight, setBellHighlight] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastNotif, setToastNotif] = useState<BellItem | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);
  const bellTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }

      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setNotisAbiertas(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (bellTimeoutRef.current) window.clearTimeout(bellTimeoutRef.current);
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const formatearFecha = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleString("es-AR");
    } catch {
      return fecha;
    }
  };

  const esNotificacionGenericaDeChat = (titulo?: string, mensaje?: string) => {
    const t = (titulo || "").trim().toLowerCase();
    const m = cleanNotificationMessage(mensaje || "").trim().toLowerCase();

    return (
      t === "nuevo mensaje" ||
      m === "tienes un mensaje nuevo en el chat."
    );
  };

  const dispararAnimacionCampana = () => {
    setBellHighlight(true);

    if (bellTimeoutRef.current) {
      window.clearTimeout(bellTimeoutRef.current);
    }

    bellTimeoutRef.current = window.setTimeout(() => {
      setBellHighlight(false);
    }, 2500);
  };

  const mostrarToast = (notif: BellItem) => {
    setToastNotif(notif);
    setToastVisible(true);

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 4500);
  };

  const cargarNotificacionesSistema = async () => {
    if (!user?.username) return;

    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", user.username)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando notificaciones:", error);
      return;
    }

    setSystemNotifications((data || []) as SystemNotification[]);
  };

  const cargarNotificacionesChat = async () => {
    if (!user?.username) return;

    const { data, error } = await supabase
      .from("mensajes")
      .select(
        "id, remitente_username, destinatario_username, contenido, imagen_url, audio_url, leido, created_at"
      )
      .eq("destinatario_username", user.username)
      .eq("leido", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error cargando notificaciones de chat:", error);
      return;
    }

    const mapped: BellItem[] = (data || []).map((m: any) => ({
      id: `chat_${m.id}`,
      titulo: `Mensaje de ${m.remitente_username}`,
      mensaje: m.audio_url
        ? "Te envió un audio"
        : m.imagen_url
        ? "Te envió una foto"
        : (m.contenido?.trim() || "Te envió un mensaje"),
      created_at: m.created_at,
      leida: !!m.leido,
      tipo: "chat",
      chatUser: m.remitente_username,
      rawId: m.id,
    }));

    setChatNotifications(mapped);
  };

  const marcarLeidasSistema = async () => {
    if (!user?.username) return;

    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_username", user.username)
      .eq("leida", false);

    if (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      return;
    }

    setSystemNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  useEffect(() => {
    if (!user?.username) return;

    cargarNotificacionesSistema();
    cargarNotificacionesChat();

    const systemChannel = supabase
      .channel(`notificaciones_${user.username}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          const nueva = (payload as any)?.new as
            | SystemNotification
            | undefined;
          if (!nueva) return;
          if (nueva.usuario_username !== user.username) return;

          setSystemNotifications((prev) => [nueva, ...prev]);

          if (!esNotificacionGenericaDeChat(nueva.titulo, nueva.mensaje)) {
            const bellItem: BellItem = {
              id: `sys_${nueva.id}`,
              titulo: nueva.titulo,
              mensaje: cleanNotificationMessage(nueva.mensaje),
              created_at: nueva.created_at,
              leida: nueva.leida,
              tipo: "sistema",
              chatUser: extractChatUserFromMessage(nueva.mensaje) || undefined,
            };

            dispararAnimacionCampana();
            mostrarToast(bellItem);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificaciones" },
        (payload) => {
          const actualizada = (payload as any)?.new as
            | SystemNotification
            | undefined;
          if (!actualizada) return;
          if (actualizada.usuario_username !== user.username) return;

          setSystemNotifications((prev) =>
            prev.map((n) => (n.id === actualizada.id ? actualizada : n))
          );
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel(`mensajes_bell_${user.username}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          if (m.destinatario_username !== user.username) return;

          const nueva: BellItem = {
            id: `chat_${m.id}`,
            titulo: `Mensaje de ${m.remitente_username}`,
            mensaje: m.audio_url
              ? "Te envió un audio"
              : m.imagen_url
              ? "Te envió una foto"
              : (m.contenido?.trim() || "Te envió un mensaje"),
            created_at: m.created_at,
            leida: !!m.leido,
            tipo: "chat",
            chatUser: m.remitente_username,
            rawId: m.id,
          };

          setChatNotifications((prev) => {
            const exists = prev.some((x) => x.id === nueva.id);
            return exists ? prev : [nueva, ...prev];
          });

          dispararAnimacionCampana();
          mostrarToast(nueva);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          if (m.destinatario_username !== user.username) return;

          setChatNotifications((prev) =>
            prev.map((n) =>
              n.rawId === m.id ? { ...n, leida: !!m.leido } : n
            )
          );
        }
      )
      .subscribe();

    const handleChatOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const withUser = detail?.withUser;
      if (!withUser) return;

      setChatNotifications((prev) =>
        prev.map((n) =>
          n.tipo === "chat" && n.chatUser === withUser
            ? { ...n, leida: true }
            : n
        )
      );
    };

    document.addEventListener("chat:open", handleChatOpen);

    return () => {
      supabase.removeChannel(systemChannel);
      supabase.removeChannel(chatChannel);
      document.removeEventListener("chat:open", handleChatOpen);
    };
  }, [user?.username]);

  const bellItems = useMemo(() => {
    const fromSystem: BellItem[] = systemNotifications
      .filter((n) => !esNotificacionGenericaDeChat(n.titulo, n.mensaje))
      .map((n) => ({
        id: `sys_${n.id}`,
        titulo: n.titulo,
        mensaje: cleanNotificationMessage(n.mensaje),
        created_at: n.created_at,
        leida: n.leida,
        tipo: "sistema" as const,
        chatUser: extractChatUserFromMessage(n.mensaje) || undefined,
      }));

    const merged = [...chatNotifications, ...fromSystem];

    merged.sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
    );

    return merged;
  }, [systemNotifications, chatNotifications]);

  const sinLeer = bellItems.filter((n) => !n.leida).length;

  const handleNotificationClick = async (item: BellItem) => {
    setToastVisible(false);
    setNotisAbiertas(false);

    if (item.chatUser) {
      navigate(`/chat?user=${encodeURIComponent(item.chatUser)}`);
      return;
    }

    if (item.tipo === "chat" && item.chatUser) {
      navigate(`/chat?user=${encodeURIComponent(item.chatUser)}`);
      return;
    }
  };

  const handleLogout = () => {
    try {
      const keep: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("mandatory_video_done:")) {
          const v = localStorage.getItem(k);
          if (v !== null) keep[k] = v;
        }
      }

      localStorage.clear();
      Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {
      localStorage.clear();
    }

    window.location.href = "/";
  };

  const getCurrentPageName = () => {
    switch (location.pathname) {
      case "/":
        return user?.role === "administracion-cordoba"
          ? "Pedido de Compra"
          : user?.role === "logistica"
          ? "Posible Rechazos"
          : "Buscar Cliente";

      case "/bonificaciones":
        return "Bonificaciones";
      case "/revisar-bonificaciones":
        return "Revisar Bonificaciones";
      case "/posible-rechazos":
        return "Posible Rechazos";
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
      case "/admin-equipo":
        return "Equipo en Calle";
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
      case "/pedido-compra":
        return "Pedido de Compra";
      case "/revisar-compras":
        return "Revisar Compras";
      case "/video-log":
        return "Videos";
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

  let menuItems: {
    name: string;
    path: string;
    icon: any;
    description: string;
  }[] = [];

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
  } else if (user?.role === "vendedor") {
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
  } else if (user?.role === "supervisor") {
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
  } else if (user?.role === "logistica") {
    menuItems = [
      {
        name: "Posible Rechazos",
        path: "/posible-rechazos",
        icon: Plus,
        description: "Registrar cliente y monto aproximado",
      },
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
  } else if (user?.role === "administracion-cordoba") {
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
  } else if (user?.role === "admin") {
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
        name: "Revisar Bonificaciones",
        path: "/revisar-bonificaciones",
        icon: FileText,
        description: "Ver bonificaciones cargadas",
      },
      {
        name: "Posible Rechazos",
        path: "/posible-rechazos",
        icon: Plus,
        description: "Registrar cliente y monto aproximado",
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
        name: "Equipo en Calle",
        path: "/admin-equipo",
        icon: Users,
        description: "Ver PDV, visitas y horas del equipo",
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

          <div className="flex items-center gap-4 relative">
            {toastVisible && toastNotif && (
              <button
                type="button"
                onClick={() => handleNotificationClick(toastNotif)}
                className="absolute right-14 top-14 z-[70] w-80 max-w-[90vw] notification-toast text-left"
              >
                <div className="rounded-xl border border-red-200 bg-white shadow-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-100">
                    <p className="text-sm font-semibold text-red-700">
                      {toastNotif.tipo === "chat"
                        ? "Nuevo mensaje"
                        : "Nueva notificación"}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {toastNotif.titulo}
                    </p>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                      {toastNotif.mensaje}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatearFecha(toastNotif.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            )}

            <div className="relative" ref={notiRef}>
              <button
                className={`relative p-2 rounded-full transition-all duration-300 ${
                  sinLeer > 0
                    ? "text-red-600 bg-red-50"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                } ${bellHighlight ? "scale-110 animate-bellGlow" : ""}`}
                onClick={async () => {
                  const nuevoEstado = !notisAbiertas;
                  setNotisAbiertas(nuevoEstado);

                  if (nuevoEstado) {
                    setToastVisible(false);
                    await marcarLeidasSistema();
                  }
                }}
                title="Notificaciones"
              >
                <Bell
                  size={20}
                  className={`transition-transform duration-300 ${
                    bellHighlight ? "animate-bellShake" : ""
                  }`}
                />

                {sinLeer > 0 && (
                  <>
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold shadow-md">
                      {sinLeer > 99 ? "99+" : sinLeer}
                    </span>
                    <span className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-30"></span>
                  </>
                )}
              </button>

              {notisAbiertas && (
                <div className="absolute right-0 mt-2 w-80 max-w-[92vw] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      Notificaciones
                    </h4>
                    <span className="text-xs text-gray-500">
                      {sinLeer === 0 ? "Sin pendientes" : `${sinLeer} sin leer`}
                    </span>
                  </div>

                  {bellItems.length === 0 ? (
                    <p className="text-sm text-gray-500 px-1 py-2">
                      Sin notificaciones
                    </p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {bellItems.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className={`w-full text-left text-sm p-3 rounded-lg border transition ${
                              n.leida
                                ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                : "bg-red-50 border-red-200"
                            } ${n.chatUser ? "hover:bg-red-100" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {n.titulo}
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed break-words">
                                  {n.mensaje}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {formatearFecha(n.created_at)}
                                </p>
                              </div>

                              {!n.leida && (
                                <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

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
