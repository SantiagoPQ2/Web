import React, { useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";

const ChatPage: React.FC = () => {
  const [destino, setDestino] = useState("");

  return (
    <div className="flex h-[80vh] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg overflow-hidden">
      {/* Sidebar izquierda */}
      <ChatSidebar onSelect={setDestino} destino={destino} />

      {/* Chat principal */}
      <div className="flex-1 p-4">
        {destino ? (
          <ChatRoom destino={destino} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            Seleccioná un contacto para comenzar a chatear 💬
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
