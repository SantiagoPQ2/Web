import React, { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";
import { askAI } from "../services/aiBot";

const ChatBot: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollBottom();
  }, [messages]);

  const scrollBottom = () => {
    setTimeout(() => {
      chatRef.current?.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  const sendMessage = async () => {
    if (input.trim() === "") return;

    const userMsg = input;
    setMessages((prev) => [...prev, { from: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    // Llamamos a nuestra IA
    const botReply = await askAI(userMsg);

    setMessages((prev) => [...prev, { from: "bot", text: botReply }]);
    setLoading(false);
  };

  return (
    <div
      className="
        fixed bottom-20 right-6 w-80 sm:w-96
        bg-white shadow-2xl rounded-xl
        border border-gray-200 z-50 flex flex-col
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-600 text-white rounded-t-xl">
        <h3 className="font-semibold">Asistente B2B</h3>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {/* CHAT */}
      <div
        ref={chatRef}
        className="flex-1 p-4 overflow-y-auto max-h-80 space-y-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.from === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`
                px-3 py-2 rounded-lg text-sm max-w-[75%]
                ${
                  m.from === "user"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }
              `}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-gray-500 text-xs italic">
            El asistente está escribiendo…
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="p-3 border-t flex items-center gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-600"
          placeholder="Escribe un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          onClick={sendMessage}
          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg shadow"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
