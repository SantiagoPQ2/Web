import React, { useState, useRef, useEffect, useMemo } from "react";
import { Bell, Menu, User, X } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";
import RouteProgressPopup from "./RouteProgressPopup";

import {
  getMenuItemsForRole,
  getLabelForPath,
  type AppRole,
} from "../config/routeConfig";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Helpers de notificaciones ────────────────────────────────────────────────

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

const esNotificacionGenericaDeChat = (titulo?: string, mensaje?: string) => {
  const t = (titulo || "").trim().toLowerCase();
  const m = cleanNotificationMessage(mensaje || "").trim().toLowerCase();
  return (
    t === "nuevo mensaje" ||
    m === "tienes un mensaje nuevo en el chat."
  );
};

const formatearFecha = (fecha: string) => {
  try {
    return new Date(fecha).toLocaleString("es-AR");
  } catch {
    return fecha;
  }
};

// ─── Hook: lógica de notificaciones ──────────────────────────────────────────

function useNotifications(username: string | undefined) {
  const navigate = useNavigate();

  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [chatNotifications, setChatNotifications] = useState<BellItem[]>([]);
  const [bellHighlight, setBellHighlight] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastNotif, setToastNotif] = useState<BellItem | null>(null);
  const bellTimeoutRef = useRef<number | null>(null);

  const dispararAnimacionCampana = () => {
    setBellHighlight(true);
    if (bellTimeoutRef.current) window.clearTimeout(bellTimeoutRef.current);
    bellTimeoutRef.current = window.setTimeout(() => setBellHighlight(false), 2500);
  };

  const mostrarToast = (notif: BellItem) => {
    setToastNotif(notif);
    setToastVisible(true);
  };

  const cerrarToast = () => {
    setToastVisible(false);
    setToastNotif(null);
  };

  const cargarNotificacionesSistema = async () => {
    if (!username) return;
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", username)
      .order("created_at", { ascending: false });

    if (error) { console.error("Error cargando notificaciones:", error); return; }
    setSystemNotifications((data || []) as SystemNotification[]);
  };

  const cargarNotificacionesChat = async () => {
    if (!username) return;
    const { data, error } = await supabase
      .from("mensajes")
      .select("id, remitente_username, destinatario_username, contenido, imagen_url, audio_url, leido, created_at")
      .eq("destinatario_username", username)
      .eq("leido", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) { console.error("Error cargando notificaciones de chat:", error); return; }

    const mapped: BellItem[] = (data || []).map((m: any) => ({
      id: `chat_${m.id}`,
      titulo: `Mensaje de ${m.remitente_username}`,
      mensaje: m.audio_url
        ? "Te envió un audio"
        : m.imagen_url
        ? "Te envió una foto"
        : m.contenido?.trim() || "Te envió un mensaje",
      created_at: m.created_at,
      leida: !!m.leido,
      tipo: "chat",
      chatUser: m.remitente_username,
      rawId: m.id,
    }));

    setChatNotifications(mapped);
  };

  const marcarLeidasSistema = async () => {
    if (!username) return;
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_username", username)
      .eq("leida", false);

    if (error) { console.error("Error marcando notificaciones:", error); return; }
    setSystemNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  // Suscripciones realtime
  useEffect(() => {
    if (!username) return;

    cargarNotificacionesSistema();
    cargarNotificacionesChat();

    const systemChannel = supabase
      .channel(`notificaciones_${username}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones" }, (payload) => {
        const nueva = (payload as any)?.new as SystemNotification | undefined;
        if (!nueva || nueva.usuario_username !== username) return;

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
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notificaciones" }, (payload) => {
        const actualizada = (payload as any)?.new as SystemNotification | undefined;
        if (!actualizada || actualizada.usuario_username !== username) return;
        setSystemNotifications((prev) =>
          prev.map((n) => (n.id === actualizada.id ? actualizada : n))
        );
      })
      .subscribe();

    const chatChannel = supabase
      .channel(`mensajes_bell_${username}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (payload) => {
        const m: any = payload.new;
        if (m.destinatario_username !== username) return;

        const nueva: BellItem = {
          id: `chat_${m.id}`,
          titulo: `Mensaje de ${m.remitente_username}`,
          mensaje: m.audio_url ? "Te envió un audio" : m.imagen_url ? "Te envió una foto" : m.contenido?.trim() || "Te envió un mensaje",
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
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensajes" }, (payload) => {
        const m: any = payload.new;
        if (m.destinatario_username !== username) return;
        setChatNotifications((prev) =>
          prev.map((n) => (n.rawId === m.id ? { ...n, leida: !!m.leido } : n))
        );
      })
      .subscribe();

    const handleChatOpen = (event: Event) => {
      const withUser = (event as CustomEvent).detail?.withUser;
      if (!withUser) return;
      setChatNotifications((prev) =>
        prev.map((n) =>
          n.tipo === "chat" && n.chatUser === withUser ? { ...n, leida: true } : n
        )
      );
    };

    document.addEventListener("chat:open", handleChatOpen);

    return () => {
      supabase.removeChannel(systemChannel);
      supabase.removeChannel(chatChannel);
      document.removeEventListener("chat:open", handleChatOpen);
      if (bellTimeoutRef.current) window.clearTimeout(bellTimeoutRef.current);
    };
  }, [username]);

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

    return [...chatNotifications, ...fromSystem].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
    );
  }, [systemNotifications, chatNotifications]);

  const sinLeer = bellItems.filter((n) => !n.leida).length;

  const handleNotificationClick = (item: BellItem, cerrarPanel: () => void) => {
    setToastVisible(false);
    cerrarPanel();
    if (item.chatUser) {
      navigate(`/chat?user=${encodeURIComponent(item.chatUser)}`);
    }
  };

  return {
    bellItems,
    sinLeer,
    bellHighlight,
    toastVisible,
    toastNotif,
    cerrarToast,
    marcarLeidasSistema,
    handleNotificationClick,
  };
}

interface NotificationBellProps {
  bellItems: BellItem[];
  sinLeer: number;
  bellHighlight: boolean;
  toastVisible: boolean;
  toastNotif: BellItem | null;
  cerrarToast: () => void;
  marcarLeidasSistema: () => Promise<void>;
  handleNotificationClick: (item: BellItem, cerrarPanel: () => void) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  bellItems,
  sinLeer,
  bellHighlight,
  toastVisible,
  toastNotif,
  cerrarToast,
  marcarLeidasSistema,
  handleNotificationClick,
}) => {
  const [notisAbiertas, setNotisAbiertas] = useState(false);
  const cerrarPanel = () => setNotisAbiertas(false);
  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotisAbiertas(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Toast flotante */}
      {toastVisible && toastNotif && (
        <div className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[80] w-[92vw] max-w-[420px] sm:left-auto sm:right-4 sm:translate-x-0">
          <div className="rounded-xl border border-red-200 bg-white shadow-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-2 border-b border-red-100">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-red-700">
                  {toastNotif.tipo === "chat" ? "Nuevo mensaje" : "Nueva notificación"}
                </p>
                <button
                  type="button"
                  onClick={cerrarToast}
                  className="shrink-0 rounded-md p-1 text-red-700 hover:bg-red-100"
                  aria-label="Cerrar notificación"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-gray-900">{toastNotif.titulo}</p>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-line">{toastNotif.mensaje}</p>
              <p className="text-xs text-gray-500 mt-3">{formatearFecha(toastNotif.created_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Botón campana */}
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
            if (nuevoEstado) await marcarLeidasSistema();
          }}
          title="Notificaciones"
        >
          <Bell
            size={20}
            className={`transition-transform duration-300 ${bellHighlight ? "animate-bellShake" : ""}`}
          />
          {sinLeer > 0 && (
            <>
              <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold shadow-md">
                {sinLeer > 99 ? "99+" : sinLeer}
              </span>
              <span className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-30" />
            </>
          )}
        </button>

        {/* Panel de notificaciones */}
        {notisAbiertas && (
          <div className="absolute right-0 mt-2 w-80 max-w-[92vw] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h4>
              <span className="text-xs text-gray-500">
                {sinLeer === 0 ? "Sin pendientes" : `${sinLeer} sin leer`}
              </span>
            </div>

            {bellItems.length === 0 ? (
              <p className="text-sm text-gray-500 px-1 py-2">Sin notificaciones</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {bellItems.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n, cerrarPanel)}
                      className={`w-full text-left text-sm p-3 rounded-lg border transition ${
                        n.leida
                          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          : "bg-red-50 border-red-200"
                      } ${n.chatUser ? "hover:bg-red-100" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{n.titulo}</p>
                          <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed break-words whitespace-pre-line">{n.mensaje}</p>
                          <p className="text-xs text-gray-500 mt-2">{formatearFecha(n.created_at)}</p>
                        </div>
                        {!n.leida && (
                          <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
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
    </>
  );
};

// ─── Subcomponente: Menú de usuario ──────────────────────────────────────────

interface UserMenuProps {
  username: string;
  hideSettings: boolean;
  onLogout: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ username, hideSettings, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-semibold">
          {username?.[0]?.toUpperCase()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
          <p className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">{username}</p>

          {!hideSettings && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={() => (window.location.href = "/settings")}
            >
              <User size={16} /> Configuración
            </button>
          )}

          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Subcomponente: Sidebar ───────────────────────────────────────────────────

interface SidebarProps {
  role: AppRole;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, onClose }) => {
  const location = useLocation();
  const menuItems = getMenuItemsForRole(role);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 left-0 w-full max-w-xs sm:w-72 bg-white dark:bg-gray-900 h-full shadow-xl z-50 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Menú</h2>
          <button className="text-gray-600 hover:text-red-600" onClick={onClose}>
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
                onClick={onClose}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  isActive
                    ? "bg-red-50 border-l-4 border-red-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {Icon && (
                  <Icon
                    className={`h-5 w-5 mt-0.5 ${isActive ? "text-red-600" : "text-gray-500"}`}
                  />
                )}
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

// ─── Componente principal: Navigation ────────────────────────────────────────

const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role as AppRole | undefined;

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

  const notifications = useNotifications(user?.username);

  const pageLabel = getLabelForPath(location.pathname, role);
  const hideSettings = role === "administracion-cordoba";

  return (
    <>
      <RouteProgressPopup />

      <header className="w-full bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-2">

          {/* Izquierda: hamburger + logo + título */}
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
                {pageLabel}
              </h1>
            </div>
          </div>

          {/* Derecha: campana + menú usuario */}
          <div className="flex items-center gap-4">
            <NotificationBell {...notifications} />

            {user && (
              <UserMenu
                username={user.username}
                hideSettings={hideSettings}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      </header>

      {sidebarOpen && role && (
        <Sidebar role={role} onClose={() => setSidebarOpen(false)} />
      )}
    </>
  );
};

export default Navigation;
