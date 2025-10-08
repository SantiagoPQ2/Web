import React, { useEffect, useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";

const ChatPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    // bloquear scroll del body mientras estoy en /chat
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    // fijamos la vista: de borde a borde bajo el header (ajusta el top si tu header es más alto)
    <div className="fixed inset-x-0 bottom-0 top-16 md:top-16 bg-gray-50">
      <div className="h-full w-full flex md:flex-row flex-col overflow-hidden">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 bg-white border-r ${
            isMobile ? (selectedUser ? "hidden" : "block h-full w-full") : "block h-full w-80"
          }`}
        >
          <ChatSidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
        </div>

        {/* Chat */}
        <div className={`flex-1 h-full ${isMobile && !selectedUser ? "hidden" : "block"}`}>
          {selectedUser ? (
            <ChatRoom destino={selectedUser} volverSidebar={() => setSelectedUser(null)} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Seleccioná un contacto para comenzar a chatear 💬
            </div>
          )}
        </div>

        {/* botón volver solo en mobile */}
        {isMobile && selectedUser && (
          <button
            className="fixed top-20 left-4 z-50 p-2 bg-white rounded-full shadow border"
            onClick={() => setSelectedUser(null)}
          >
            ←
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
