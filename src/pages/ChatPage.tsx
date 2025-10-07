import React, { useState, useEffect } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";
import { useAuth } from "../context/AuthContext";

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 🔹 Detectar cambio de tamaño (por si el usuario rota el móvil o cambia tamaño)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔹 Layout responsivo y funcional
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 rounded-md shadow-inner relative">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 bg-white border-r border-gray-200 ${
          isMobile
            ? selectedUser
              ? "hidden"
              : "w-full"
            : "w-80"
        }`}
      >
        <ChatSidebar
          onSelectUser={setSelectedUser}
          selectedUser={selectedUser}
        />
      </div>

      {/* Chat principal */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isMobile && !selectedUser ? "hidden" : "flex"
        }`}
      >
        <ChatRoom
          destino={selectedUser || ""}
          volverSidebar={() => setSelectedUser(null)}
        />
      </div>

      {/* 🔙 Botón volver solo visible en móvil */}
      {isMobile && selectedUser && (
        <button
          onClick={() => setSelectedUser(null)}
          className="absolute top-3 left-3 bg-white shadow-md rounded-full p-2 border border-gray-200 z-20"
        >
          ←
        </button>
      )}
    </div>
  );
};

export default ChatPage;
