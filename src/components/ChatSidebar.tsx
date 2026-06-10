import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type ChatListItem = {
  username: string;
  name: string | null;
  role?: string | null;
  lastMessage: string;
  lastAt: string | null;
  unread: number;
  lastIsMine?: boolean;
};

interface Props {
  onSelectUser: (username: string) => void;
  selectedUser: string | null;
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

const formatSidebarDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  if (d >= startOfToday) {
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  if (d >= startOfYesterday) {
    return "Ayer";
  }
  if (d >= startOfWeek) {
    return d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
  }
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
};

// ── Badge de rol ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  vendedor:             { label: "Vendedor",    color: "bg-blue-100 text-blue-700" },
  supervisor:           { label: "Supervisor",  color: "bg-purple-100 text-purple-700" },
  logistica:            { label: "Transporte",  color: "bg-amber-100 text-amber-700" },
  "jefe-transporte":    { label: "Jefe Transp", color: "bg-orange-100 text-orange-700" },
  admin:                { label: "Admin",       color: "bg-red-100 text-red-700" },
  "administracion-cordoba": { label: "Administración", color: "bg-teal-100 text-teal-700" },
  test:                 { label: "Test",        color: "bg-gray-100 text-gray-500" },
};

const RoleBadge: React.FC<{ role?: string | null }> = ({ role }) => {
  if (!role) return null;
  const cfg = ROLE_LABELS[role];
  if (!cfg) return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

const ChatSidebar: React.FC<Props> = ({ onSelectUser, selectedUser }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    loadContactsAndMessages();
  }, [user]);

  useEffect(() => {
    if (!selectedUser) return;
    setItems((prev) =>
      prev.map((it) =>
        it.username === selectedUser ? { ...it, unread: 0 } : it
      )
    );
  }, [selectedUser]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`sidebar_mensajes_${user.username}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          const isMine = m.remitente_username === user.username;
          const other = isMine ? m.destinatario_username : m.remitente_username;

          setItems((prev) => {
            const idx = prev.findIndex((u) => u.username === other);
            if (idx === -1) return prev;

            const preview = m.audio_url
              ? "Audio"
              : m.imagen_url
              ? "Foto"
              : (m.contenido?.trim() || "Adjunto");

            const addUnread =
              !isMine &&
              m.destinatario_username === user.username &&
              selectedUser !== other;

            const updated: ChatListItem = {
              ...prev[idx],
              lastMessage: preview,
              lastAt: m.created_at,
              lastIsMine: isMine,
              unread: Math.max(0, (prev[idx].unread || 0) + (addUnread ? 1 : 0)),
            };

            const arr = [...prev];
            arr.splice(idx, 1);
            return [updated, ...arr];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          const other = m.remitente_username;

          if (m.leido && m.destinatario_username === user.username) {
            setItems((prev) =>
              prev.map((it) =>
                it.username === other ? { ...it, unread: 0 } : it
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  const loadContactsAndMessages = async () => {
    if (!user) return;

    const { data: usersData, error: uErr } = await supabase
      .from("usuarios_app")
      .select("username, name, role")
      .neq("username", user.username);

    if (uErr || !usersData) return;

    const { data: msgs, error: mErr } = await supabase
      .from("mensajes")
      .select(
        "id, remitente_username, destinatario_username, contenido, imagen_url, audio_url, leido, created_at"
      )
      .or(
        `remitente_username.eq.${user.username},destinatario_username.eq.${user.username}`
      )
      .order("created_at", { ascending: false });

    if (mErr || !msgs) {
      const base = usersData.map((u) => ({
        username: u.username,
        name: u.name,
        role: u.role,
        lastMessage: "",
        lastAt: null as string | null,
        unread: 0,
        lastIsMine: false,
      }));

      base.sort(
        (a, b) =>
          (a.name || "").localeCompare(b.name || "") ||
          a.username.localeCompare(b.username)
      );

      setItems(base);
      return;
    }

    const map = new Map<string, ChatListItem>();

    for (const u of usersData) {
      map.set(u.username, {
        username: u.username,
        name: u.name,
        role: u.role,
        lastMessage: "",
        lastAt: null,
        unread: 0,
        lastIsMine: false,
      });
    }

    for (const m of msgs) {
      const isMine = m.remitente_username === user.username;
      const other = isMine ? m.destinatario_username : m.remitente_username;

      if (!map.has(other)) continue;

      const current = map.get(other)!;

      if (!current.lastAt) {
        const preview = m.audio_url
          ? "Audio"
          : m.imagen_url
          ? "Foto"
          : (m.contenido?.trim() || "Adjunto");

        current.lastAt = m.created_at;
        current.lastMessage = preview;
        current.lastIsMine = isMine;
      }

      if (
        m.destinatario_username === user.username &&
        m.remitente_username === other &&
        m.leido === false
      ) {
        current.unread = (current.unread || 0) + 1;
      }

      map.set(other, current);
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
      if (a.lastAt && !b.lastAt) return -1;
      if (!a.lastAt && b.lastAt) return 1;
      return (
        (a.name || "").localeCompare(b.name || "") ||
        a.username.localeCompare(b.username)
      );
    });

    setItems(arr);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter(
      (it) =>
        it.username.toLowerCase().includes(q) ||
        (it.name || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  // Separar en "Con mensajes" y "Sin mensajes"
  const { conMensajes, sinMensajes } = useMemo(() => {
    return {
      conMensajes: filtered.filter((it) => it.lastAt),
      sinMensajes: filtered.filter((it) => !it.lastAt),
    };
  }, [filtered]);

  const renderItem = (it: ChatListItem) => {
    const active = selectedUser === it.username;
    const initial = (it.name?.[0] || it.username[0] || "?").toUpperCase();

    // Preview con prefijo "Vos: " si el último mensaje lo envié yo
    const previewText = it.lastIsMine
      ? `Vos: ${it.lastMessage}`
      : it.lastMessage || "Sin mensajes";

    return (
      <button
        key={it.username}
        onClick={() => onSelectUser(it.username)}
        className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center gap-3 transition-colors ${
          active ? "bg-red-50 border-l-2 border-l-red-500" : "hover:bg-gray-50"
        }`}
      >
        {/* Avatar */}
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold shrink-0 text-sm ${
            active ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"
          }`}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          {/* Fila 1: nombre + fecha */}
          <div className="flex items-center gap-1.5">
            <p
              className={`font-semibold text-sm truncate ${
                it.unread > 0 ? "text-gray-900" : "text-gray-800"
              }`}
            >
              {it.name || it.username}
            </p>
            <RoleBadge role={it.role} />
            {it.lastAt && (
              <span
                className={`ml-auto text-[11px] shrink-0 ${
                  it.unread > 0 ? "text-red-600 font-semibold" : "text-gray-400"
                }`}
              >
                {formatSidebarDate(it.lastAt)}
              </span>
            )}
          </div>

          {/* Fila 2: preview + badge no leídos */}
          <div className="flex items-center gap-2 mt-0.5">
            <p
              className={`text-xs truncate leading-snug ${
                it.unread > 0 ? "text-gray-800 font-medium" : "text-gray-400"
              }`}
            >
              {previewText}
            </p>

            {it.unread > 0 && (
              <span className="ml-auto bg-red-600 text-white rounded-full min-w-[20px] h-5 px-1.5 text-[11px] flex items-center justify-center font-bold shrink-0">
                {it.unread > 99 ? "99+" : it.unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Buscador */}
      <div className="px-3 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            className="w-full bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400 border-none focus:ring-0"
            placeholder="Buscar contacto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <span className="text-xs">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            No se encontraron contactos
          </div>
        )}

        {/* Conversaciones activas */}
        {conMensajes.length > 0 && (
          <>
            {conMensajes.map(renderItem)}
          </>
        )}

        {/* Separador si hay ambos grupos */}
        {conMensajes.length > 0 && sinMensajes.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Otros contactos
            </p>
          </div>
        )}

        {/* Sin mensajes */}
        {sinMensajes.map(renderItem)}
      </div>
    </div>
  );
};

export default ChatSidebar;
