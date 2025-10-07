import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Usuario {
  username: string;
  role: string;
}

interface Props {
  onSelect: (username: string) => void;
  destino: string;
}

const ChatSidebar: React.FC<Props> = ({ onSelect, destino }) => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      if (!user) return;

      let query = supabase.from("usuarios_app").select("username, role");

      if (user.role === "vendedor")
        query = query.in("role", ["supervisor", "admin"]);
      else if (user.role === "supervisor")
        query = query.eq("role", "vendedor");
      else query = query.neq("username", user.username);

      const { data } = await query;
      if (data) setUsuarios(data);
    };
    fetchUsuarios();
  }, [user]);

  return (
    <div className="w-64 bg-white border-r overflow-y-auto">
      <div className="p-3 font-semibold border-b bg-gray-50 text-gray-700">
        Conversaciones
      </div>
      {usuarios.map((u) => (
        <div
          key={u.username}
          onClick={() => onSelect(u.username)}
          className={`p-3 cursor-pointer border-b hover:bg-red-50 ${
            destino === u.username ? "bg-red-100" : ""
          }`}
        >
          <p className="font-medium text-sm text-gray-800">{u.username}</p>
          <p className="text-xs text-gray-500">{u.role}</p>
        </div>
      ))}
    </div>
  );
};

export default ChatSidebar;
