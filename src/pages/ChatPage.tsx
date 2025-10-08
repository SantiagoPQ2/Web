import React, { useState, useEffect } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";
import { useAuth } from "../context/AuthContext";

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detecta cambio de tamaño (para manejo móvil)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${
          isMobile
            ? selectedUser
              ? "hidden"
              : "block w-full"
            : "block w-80"
        }`}
      >
        <div className="h-full overflow-y-auto">
          <ChatSidebar
            onSelectUser={setSelectedUser}
            selectedUser={selectedUser}
          />
        </div>
      </div>

      {/* Chat principal */}
      <div
        className={`flex-1 flex flex-col relative transition-all duration-300 ${
          isMobile && !selectedUser ? "hidden" : "flex"
        }`}
      >
        {selectedUser ? (
          <ChatRoom
            destino={selectedUser}
            volverSidebar={() => setSelectedUser(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 select-none">
            Seleccioná un contacto para comenzar a chatear 💬
          </div>
        )}
      </div>

      {/* Botón volver en móvil */}
      {isMobile && selectedUser && (
        <button
          onClick={() => setSelectedUser(null)}
          className="absolute top-16 left-4 z-50 bg-white shadow-md rounded-full p-2 border border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          ←
        </button>
      )}
    </div>
  );
};

export default ChatPage;
