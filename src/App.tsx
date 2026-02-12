import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import Navigation from "./components/Navigation";

import SearchPage from "./pages/SearchPage";
import Bonificaciones from "./pages/Bonificaciones";
import RechazosForm from "./pages/RechazosForm";
import CoordsPage from "./pages/CoordsPage";
import NotasCredito from "./pages/NotasCredito";
import GpsLogger from "./pages/GpsLogger";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Informacion from "./pages/Informacion";
import SupervisorPage from "./pages/SupervisorPage";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import PlanillaCarga from "./pages/PlanillaCarga";
import Mapa from "./pages/Mapa";
import PowerBIPage from "./pages/PowerBIPage";
import PDFs from "./pages/PDFs";
import VideoWatchLog from "./pages/VideoWatchLog";

import BajaClienteCambioRuta from "./pages/BajaClienteCambioRuta";
import RevisarBajas from "./pages/RevisarBajas";

// ✅ NUEVAS PÁGINAS
import PedidoDeCompra from "./pages/PedidoDeCompra";
import RevisarCompras from "./pages/RevisarCompras";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import UpdateBanner from "./components/UpdateBanner";

// 🔹 B2B PAGES
import CatalogoB2B from "./pages/b2b/Catalogo";
import CarritoB2B from "./pages/b2b/Carrito";
import PedidosB2B from "./pages/b2b/Pedidos";

// 🔹 ChatBot components
import ChatBubble from "./components/ChatBubble";
import ChatBot from "./components/ChatBot";

// ✅ Video gate
import MandatoryVideoGate from "./components/MandatoryVideoGate";

const INTRO_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%20Introduccion.mp4";

// ✅ ID del video: si mañana cambiás el video, cambiás este string (v2, v3, etc.)
const INTRO_VIDEO_ID = "capsula_intro_v1";

function ProtectedApp() {
  const { user } = useAuth();
  const hasUpdate = useVersionChecker(60000);
  const location = useLocation();

  const [openChat, setOpenChat] = useState(false);

  // NO logueado ⇒ Login
  if (!user) return <Login />;

  const role = user.role;

  let allowedRoutes: React.ReactNode;

  // ---------------------------
  // 🚀 0) TEST + catch-all
  // ---------------------------
  if (role === "test") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/baja-cliente" element={<BajaClienteCambioRuta />} />

        {/* ✅ Videoteca */}
        <Route path="/video-log" element={<VideoWatchLog />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 1) VENDEDOR + catch-all
  // ---------------------------
  else if (role === "vendedor") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/baja-cliente" element={<BajaClienteCambioRuta />} />

        {/* ✅ Videoteca también para vendedor */}
        <Route path="/video-log" element={<VideoWatchLog />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 2) SUPERVISOR + catch-all
  // ---------------------------
  else if (role === "supervisor") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/supervisor" element={<SupervisorPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/powerbi" element={<PowerBIPage />} />
        <Route path="/pdfs" element={<PDFs />} />
        <Route path="/revisar-bajas" element={<RevisarBajas />} />
        <Route path="/pedido-compra" element={<PedidoDeCompra />} />
        <Route path="/revisar-compras" element={<RevisarCompras />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 3) LOGÍSTICA + catch-all
  // ---------------------------
  else if (role === "logistica") {
    allowedRoutes = (
      <Routes>
        <Route path="/rechazos/nuevo" element={<RechazosForm />} />
        <Route path="/coordenadas" element={<CoordsPage />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/rechazos/nuevo" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 4) ADMIN (incluye B2B) + catch-all
  // ---------------------------
  else if (role === "admin") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/rechazos/nuevo" element={<RechazosForm />} />
        <Route path="/coordenadas" element={<CoordsPage />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/supervisor" element={<SupervisorPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/planilla-carga" element={<PlanillaCarga />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/powerbi" element={<PowerBIPage />} />
        <Route path="/revisar-bajas" element={<RevisarBajas />} />
        <Route path="/pdfs" element={<PDFs />} />
        <Route path="/pedido-compra" element={<PedidoDeCompra />} />
        <Route path="/revisar-compras" element={<RevisarCompras />} />

        {/* 🌟 B2B */}
        <Route path="/b2b/catalogo" element={<CatalogoB2B />} />
        <Route path="/b2b/carrito" element={<CarritoB2B />} />
        <Route path="/b2b/pedidos" element={<PedidosB2B />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 5) ADMINISTRACION - CÓRDOBA + catch-all
  // ---------------------------
  else if (role === "administracion-cordoba") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<PedidoDeCompra />} />
        <Route path="/pedido-compra" element={<PedidoDeCompra />} />
        <Route path="/revisar-compras" element={<RevisarCompras />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🚀 6) Default + catch-all
  // ---------------------------
  else {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ---------------------------
  // 🌟 Mostrar ChatBot SOLO en B2B
  // ---------------------------
  const showChatBot =
    location.pathname.startsWith("/b2b") ||
    location.pathname === "/b2b/catalogo" ||
    location.pathname === "/b2b/carrito" ||
    location.pathname === "/b2b/pedidos";

  const appLayout = (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden">
      <Navigation />

      <main className="flex-1 overflow-hidden">{allowedRoutes}</main>

      {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}

      {showChatBot && !openChat && (
        <ChatBubble onOpen={() => setOpenChat(true)} />
      )}

      {showChatBot && openChat && <ChatBot onClose={() => setOpenChat(false)} />}
    </div>
  );

  // ✅ Gate para TEST y VENDEDOR (una vez por día, guardado en Supabase)
  return role === "test" || role === "vendedor" ? (
    <MandatoryVideoGate
      rolesToEnforce={["test", "vendedor"]}
      videoId={INTRO_VIDEO_ID}
      videoSrc={INTRO_VIDEO_URL}
      oncePerDay
    >
      {appLayout}
    </MandatoryVideoGate>
  ) : (
    appLayout
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ProtectedApp />
      </Router>
    </AuthProvider>
  );
}

export default App;
