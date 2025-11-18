import React from "react";
import { MessageCircle } from "lucide-react";

interface Props {
  onOpen: () => void;
}

const ChatBubble: React.FC<Props> = ({ onOpen }) => {
  return (
    <button
      onClick={onOpen}
      className="
        fixed bottom-6 right-6
        bg-red-600 hover:bg-red-700
        text-white p-4 rounded-full shadow-xl
        flex items-center justify-center
        transition transform hover:scale-110
        z-50
      "
      style={{ animation: "pulse 1.4s infinite ease-in-out" }}
    >
      <MessageCircle size={24} />
    </button>
  );
};

export default ChatBubble;
