import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../config/supabase";

const NotificationBell = ({ username }: { username: string }) => {
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);

  const cargarNotificaciones = async () => {
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_username", username)
      .order("created_at", { ascending: false });
    if (!error) setNotificaciones(data || []);
  };

  const marcarLeidas = async () => {
    await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_username", username);
    cargarNotificaciones();
  };

  useEffect(() => {
    cargarNotificaciones();

    // Realtime listener para nuevas notificaciones
    const sub = supabase
      .channel("notificaciones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          if (payload.new.usuario_username === username) cargarNotificaciones();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [username]);

  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="relative">
      <button
        className="relative p-2"
        onClick={() => {
          setAbierto(!abierto);
          if (!abierto) marcarLeidas();
        }}
      >
        <Bell size={22} />
        {sinLeer > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {sinLeer}
          </span>
        )}
      </button>

      {abierto && (
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
  );
};

export default NotificationBell;
