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
};

interface Props {
  onSelectUser: (username: string) => void;
  selectedUser: string | null;
}

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
          const other =
            m.remitente_username === user.username
              ? m.destinatario_username
              : m.remitente_username;

          setItems((prev) => {
            const idx = prev.findIndex((u) => u.username === other);
            if (idx === -1) return prev;

            const preview = m.audio_url
              ? "Audio"
              : m.imagen_url
              ? "Foto"
              : (m.contenido?.trim() || "Adjunto");

            const isMine = m.remitente_username === user.username;
            const addUnread =
              !isMine &&
              m.destinatario_username === user.username &&
              selectedUser !== other;

            const updated: ChatListItem = {
              ...prev[idx],
              lastMessage: preview,
              lastAt: m.created_at,
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
      });
    }

    for (const m of msgs) {
      const other =
        m.remitente_username === user.username
          ? m.destinatario_username
          : m.remitente_username;

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

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="px-3 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            className="w-full bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400 border-none focus:ring-0"
            placeholder="Buscar contacto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((it) => {
          const active = selectedUser === it.username;

          return (
            <button
              key={it.username}
              onClick={() => onSelectUser(it.username)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center gap-3 transition ${
                active ? "bg-red-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold shrink-0">
                {(it.name?.[0] || it.username[0] || "?").toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="font-medium text-sm truncate text-gray-900">
                    {it.name || it.username}
                  </p>

                  {it.lastAt && (
                    <span
                      className={`ml-auto text-[11px] shrink-0 ${
                        it.unread > 0 ? "text-red-600 font-semibold" : "text-gray-500"
                      }`}
                    >
                      {new Date(it.lastAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <p
                    className={`text-xs truncate ${
                      it.unread > 0 ? "text-gray-800 font-medium" : "text-gray-500"
                    }`}
                  >
                    {it.lastMessage || "Sin mensajes"}
                  </p>

                  {it.unread > 0 && (
                    <span className="ml-auto bg-red-600 text-white rounded-full min-w-[20px] h-5 px-1.5 text-[11px] flex items-center justify-center font-semibold shrink-0">
                      {it.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            No se encontraron contactos
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
