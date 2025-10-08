import React, { useState, useEffect } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";
import { useAuth } from "../context/AuthContext";

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 🔹 Detectar cambio de tamaño
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔹 Función para volver atrás en móvil
  const volverSidebar = () => setSelectedUser(null);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] bg-gray-50">
      {/* Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 md:w-80 flex-shrink-0 transition-all duration-300 ${
          isMobile ? (selectedUser ? "hidden" : "block w-full") : "block"
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
        {selectedUser ? (
          <ChatRoom destino={selectedUser} volverSidebar={volverSidebar} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Seleccioná un contacto para comenzar a chatear 💬
          </div>
        )}
      </div>

      {/* Botón volver (solo móvil) */}
      {isMobile && selectedUser && (
        <button
          onClick={volverSidebar}
          className="absolute top-16 left-4 z-50 bg-white shadow-md rounded-full p-2 border border-gray-200 text-gray-700 hover:bg-gray-100"
        >
          ←
        </button>
      )}
    </div>
  );
};

export default ChatPage;
