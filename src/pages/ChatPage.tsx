import React, { useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";

const ChatPage: React.FC = () => {
  const [destino, setDestino] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="flex flex-col md:flex-row h-[80vh] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        onSelect={setDestino}
        destino={destino}
        visible={sidebarVisible}
        setVisible={setSidebarVisible}
      />

      {/* Chat principal */}
      <div className="flex-1 relative flex flex-col">
        {destino ? (
          <>
            {/* Flecha volver solo en mobile */}
            <div className="md:hidden flex items-center bg-white border-b px-3 py-2">
              <button
                onClick={() => setSidebarVisible(true)}
                className="text-gray-500 hover:text-red-600 mr-2"
              >
                ←
              </button>
              <h2 className="text-sm font-semibold text-gray-700">Chat con {destino}</h2>
            </div>
            <div className="flex-1 p-2">
              <ChatRoom destino={destino} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Seleccioná un contacto para comenzar a chatear 💬
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
