import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ChatSidebar from "../components/ChatSidebar";
import ChatRoom from "../components/ChatRoom";

const MOBILE_BREAKPOINT = 768;

const ChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUser = searchParams.get("user");

  const [selectedUser, setSelectedUser] = useState<string | null>(initialUser);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [viewportHeight, setViewportHeight] = useState<number>(
    window.visualViewport?.height || window.innerHeight
  );

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setViewportHeight(window.visualViewport?.height || window.innerHeight);
    };

    syncViewport();

    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);

      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const paramUser = searchParams.get("user");
    if (paramUser && paramUser !== selectedUser) {
      setSelectedUser(paramUser);
    }
    if (!paramUser && selectedUser && !isMobile) {
      setSelectedUser(selectedUser);
    }
  }, [searchParams, selectedUser, isMobile]);

  const handleSelectUser = (username: string) => {
    setSelectedUser(username);
    setSearchParams({ user: username });
  };

  const handleBack = () => {
    setSelectedUser(null);
    setSearchParams({});
  };

  const chatHeight = useMemo(() => {
    return Math.max(320, viewportHeight - 64);
  }, [viewportHeight]);

  return (
    <div
      className="fixed inset-x-0 top-16 bg-[#e9eef6]"
      style={{ height: `${chatHeight}px` }}
    >
      <div className="h-full w-full flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`h-full bg-white border-r border-gray-200 ${
            isMobile
              ? selectedUser
                ? "hidden"
                : "block w-full"
              : "block w-[360px] shrink-0"
          }`}
        >
          <ChatSidebar
            onSelectUser={handleSelectUser}
            selectedUser={selectedUser}
          />
        </div>

        {/* Sala */}
        <div
          className={`h-full min-w-0 flex-1 ${
            isMobile && !selectedUser ? "hidden" : "block"
          }`}
        >
          {selectedUser ? (
            <ChatRoom destino={selectedUser} volverSidebar={handleBack} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Seleccioná un contacto para comenzar a chatear
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
