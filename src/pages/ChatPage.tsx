import React, { useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";
import { useAuth } from "../context/AuthContext";

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // En móvil, si hay chat seleccionado, ocultar sidebar
  const isMobile = window.innerWidth < 768;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden rounded-md shadow-inner">
      {/* Sidebar (oculta en móvil si hay chat abierto) */}
      <div
        className={`${
          isMobile
            ? selectedUser
              ? "hidden"
              : "block"
            : "w-1/3 max-w-sm border-r border-gray-200"
        } flex-shrink-0 bg-white`}
      >
        <ChatSidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
      </div>

      {/* Chat principal */}
      <div
        className={`flex-1 flex flex-col ${
          isMobile && !selectedUser ? "hidden" : "block"
        }`}
      >
        <ChatRoom destino={selectedUser || ""} volverSidebar={() => setSelectedUser(null)} />
      </div>
    </div>
  );
};

export default ChatPage;
