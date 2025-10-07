import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../config/supabase";

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
}

const NotificationBell: React.FC<{ username: string }> = ({ username }) => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetchNotificaciones();

    // 🔄 Escucha en tiempo real
    const channel = supabase
      .channel("notificaciones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          const nueva = payload.new as Notificacion;
          if (nueva.usuario_username === username) {
            setNotificaciones((prev) => [nueva, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  const fetchNotificaciones = async () => {
    const { data } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", username)
      .order("created_at", { ascending: false });
    setNotificaciones(data || []);
  };

  const marcarLeido = async (id: number) => {
    await supabase.from("notificaciones").update({ leido: true }).eq("id", id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leido: true } : n))
    );
  };

  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-gray-200 rounded-full transition"
      >
        <Bell className="h-6 w-6 text-gray-700" />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white shadow-lg rounded-lg border z-50 max-h-80 overflow-y-auto">
          {notificaciones.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              No hay notificaciones
            </div>
          ) : (
            notificaciones.map((n) => (
              <div
                key={n.id}
                onClick={() => marcarLeido(n.id)}
                className={`p-3 border-b cursor-pointer ${
                  n.leido ? "bg-gray-50" : "bg-blue-50"
                }`}
              >
                <p className="font-semibold text-sm">{n.titulo}</p>
                <p className="text-xs text-gray-600">{n.mensaje}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
