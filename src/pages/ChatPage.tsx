import React, { useState, useEffect } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";

const ChatPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col md:flex-row flex-1 bg-gray-50 overflow-hidden">
      {/* sidebar – en móvil, se oculta si hay chat abierto */}
      <div
        className={`transition-all duration-300 ${
          isMobile
            ? selectedUser
              ? "hidden"
              : "h-full w-full"
            : "h-full w-80 border-r bg-white"
        }`}
      >
        <ChatSidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
      </div>

      {/* chat – en móvil, se oculta si no hay chat seleccionado */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isMobile && !selectedUser ? "hidden" : "block"
        }`}
      >
        {selectedUser ? (
          <ChatRoom destino={selectedUser} volverSidebar={() => setSelectedUser(null)} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Seleccioná un contacto para comenzar a chatear 💬
          </div>
        )}
      </div>

      {/* botón volver sólo en móvil */}
      {isMobile && selectedUser && (
        <button
          className="fixed top-16 left-4 z-50 p-2 bg-white rounded-full shadow border"
          onClick={() => setSelectedUser(null)}
        >
          ←
        </button>
      )}
    </div>
  );
};

export default ChatPage;
