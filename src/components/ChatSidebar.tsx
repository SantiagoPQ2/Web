import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type ChatListItem = {
  username: string;
  name: string | null;
  role?: string | null;
  lastMessage: string;
  lastAt: string | null;          // ISO date string
  unread: number;                 // no leídos
};

interface Props {
  onSelectUser: (username: string) => void;
  selectedUser: string | null;
}

/**
 * Sidebar estilo WhatsApp:
 * - Ordenado por última actividad (lastAt desc)
 * - Contador de no leídos (unread)
 * - Preview del último mensaje
 * - Realtime: INSERT/UPDATE en "mensajes"
 */
const ChatSidebar: React.FC<Props> = ({ onSelectUser, selectedUser }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [query, setQuery] = useState("");

  // --------------------------------------------
  // Carga inicial: usuarios + mensajes relacionados
  // --------------------------------------------
  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadContactsAndMessages();
    })();
  }, [user]);

  // Si el usuario abre un chat, dejamos en 0 el contador local de ese contacto.
  useEffect(() => {
    if (!selectedUser) return;
    setItems((prev) =>
      prev.map((it) =>
        it.username === selectedUser ? { ...it, unread: 0 } : it
      )
    );
  }, [selectedUser]);

  // --------------------------------------------
  // Realtime: INSERT (mensaje nuevo) y UPDATE (lecturas)
  // --------------------------------------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("sidebar_mensajes")
      // Mensajes nuevos -> subir contacto a tope y actualizar preview/contador
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          const isMine = m.remitente_username === user.username;
          const other =
            m.remitente_username === user.username
              ? m.destinatario_username
              : m.remitente_username;

          setItems((prev) => {
            const idx = prev.findIndex((u) => u.username === other);
            if (idx === -1) return prev; // si no está en la lista (p.ej. un usuario que no listamos), ignoramos

            const preview =
              m.imagen_url
                ? "Foto"
                : (m.contenido?.trim() || "Adjunto"); // fallback

            // Si el mensaje es para mí y ese chat NO está abierto, sumar no leídos
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
            // quitar y poner al inicio (sube al tope)
            arr.splice(idx, 1);
            return [updated, ...arr];
          });
        }
      )
      // Actualizaciones de lectura: cuando ChatRoom marca leídos
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes" },
        (payload) => {
          const m: any = payload.new;
          // si me marcaron como leído mensajes que me enviaron desde 'other', ajusto contador si estuviera mal
          if (m.leido && m.destinatario_username === user.username) {
            const other = m.remitente_username;
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

  // --------------------------------------------
  // Carga inicial combinando usuarios y mensajes
  // --------------------------------------------
  const loadContactsAndMessages = async () => {
    // 1) Usuarios excepto el propio
    const { data: usersData, error: uErr } = await supabase
      .from("usuarios_app")
      .select("username, name, role")
      .neq("username", user!.username);

    if (uErr || !usersData) return;

    // 2) Todos los mensajes donde yo soy remitente o destinatario (orden desc)
    const { data: msgs, error: mErr } = await supabase
      .from("mensajes")
      .select(
        "id, remitente_username, destinatario_username, contenido, imagen_url, leido, created_at"
      )
      .or(
        `remitente_username.eq.${user!.username},destinatario_username.eq.${user!.username}`
      )
      .order("created_at", { ascending: false });

    if (mErr || !msgs) {
      // si no hay mensajes todavía, construimos lista básica
      const base = usersData.map((u) => ({
        username: u.username,
        name: u.name,
        role: u.role,
        lastMessage: "",
        lastAt: null as string | null,
        unread: 0,
      }));
      // ordenar por nombre
      base.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "") ||
        a.username.localeCompare(b.username)
      );
      setItems(base);
      return;
    }

    // 3) Mapear por contacto: último mensaje + no leídos
    const map = new Map<string, ChatListItem>();

    // inicializamos con usuarios
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

    // recorremos mensajes más recientes primero
    for (const m of msgs) {
      const other =
        m.remitente_username === user!.username
          ? m.destinatario_username
          : m.remitente_username;

      if (!map.has(other)) continue;

      // setear último mensaje solo si no está aún (como están desc, el primero que toque es el último)
      const current = map.get(other)!;

      if (!current.lastAt) {
        const preview =
          m.imagen_url ? "Foto" : (m.contenido?.trim() || "Adjunto");

        current.lastAt = m.created_at;
        current.lastMessage = preview;
      }

      // contador de no leídos: mensajes dirigidos a mí sin leer
      if (
        m.destinatario_username === user!.username &&
        m.remitente_username === other &&
        m.leido === false
      ) {
        current.unread = (current.unread || 0) + 1;
      }

      map.set(other, current);
    }

    // 4) Pasar a array y ordenar por lastAt desc; sin lastAt quedan abajo
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
      if (a.lastAt && !b.lastAt) return -1;
      if (!a.lastAt && b.lastAt) return 1;
      // si ninguno tiene lastAt, ordenar por nombre
      return (
        (a.name || "").localeCompare(b.name || "") ||
        a.username.localeCompare(b.username)
      );
    });

    setItems(arr);
  };

  // --------------------------------------------
  // Filtro de búsqueda (por name o username)
  // --------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.username.toLowerCase().includes(q) ||
        (it.name || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  // --------------------------------------------
  // UI
  // --------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      <div className="p-2">
        <input
          className="w-full border rounded p-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Buscar contacto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Lista de conversaciones */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((it) => {
          const active = selectedUser === it.username;
          return (
            <button
              key={it.username}
              onClick={() => onSelectUser(it.username)}
              className={`w-full text-left px-3 py-3 border-b flex items-center gap-3 transition ${
                active ? "bg-red-50" : "hover:bg-gray-50"
              }`}
            >
              {/* Inicial del contacto (círculo) */}
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold">
                {(it.name?.[0] || it.username[0] || "?").toUpperCase()}
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <p className="font-medium text-sm truncate">
                    {it.username} – {it.name || "Sin nombre"}
                  </p>
                  {/* fecha/hora del último mensaje */}
                  {it.lastAt && (
                    <span className="ml-auto text-[11px] text-gray-500">
                      {new Date(it.lastAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {it.lastMessage || "Sin mensajes"}
                </p>
              </div>

              {/* burbuja de no leídos */}
              {it.unread > 0 && (
                <span className="ml-2 bg-red-600 text-white rounded-full px-2 py-0.5 text-[11px]">
                  {it.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatSidebar;

