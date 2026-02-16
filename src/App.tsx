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
import RevisarBonificaciones from "./pages/RevisarBonificaciones";

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

import PedidoDeCompra from "./pages/PedidoDeCompra";
import RevisarCompras from "./pages/RevisarCompras";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import UpdateBanner from "./components/UpdateBanner";

import CatalogoB2B from "./pages/b2b/Catalogo";
import CarritoB2B from "./pages/b2b/Carrito";
import PedidosB2B from "./pages/b2b/Pedidos";

import ChatBubble from "./components/ChatBubble";
import ChatBot from "./components/ChatBot";

// ✅ gate video + quiz
import DailyTrainingGate from "./components/DailyTrainingGate";

// ✅ VIDEO
const INTRO_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%201.mp4";

const INTRO_VIDEO_ID = "capsula_1_v1";

// ✅ QUIZ (en /public/Quiz.xlsx)
const QUIZ_XLSX_PATH = "/Quiz.xlsx";

function ProtectedApp() {
  const { user } = useAuth();
  const hasUpdate = useVersionChecker(60000);
  const location = useLocation();

  const [openChat, setOpenChat] = useState(false);

  if (!user) return <Login />;

  const role = user.role;

  let allowedRoutes: React.ReactNode;

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
        <Route path="/video-log" element={<VideoWatchLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } else if (role === "vendedor") {
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
        <Route path="/video-log" element={<VideoWatchLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } else if (role === "supervisor") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />

        <Route
          path="/revisar-bonificaciones"
          element={<RevisarBonificaciones />}
        />

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
  } else if (role === "logistica") {
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
  } else if (role === "admin") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />

        <Route
          path="/revisar-bonificaciones"
          element={<RevisarBonificaciones />}
        />

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

        <Route path="/b2b/catalogo" element={<CatalogoB2B />} />
        <Route path="/b2b/carrito" element={<CarritoB2B />} />
        <Route path="/b2b/pedidos" element={<PedidosB2B />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } else if (role === "administracion-cordoba") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<PedidoDeCompra />} />
        <Route path="/pedido-compra" element={<PedidoDeCompra />} />
        <Route path="/revisar-compras" element={<RevisarCompras />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } else {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

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
      {showChatBot && openChat && (
        <ChatBot onClose={() => setOpenChat(false)} />
      )}
    </div>
  );

  // ✅ TEST y VENDEDOR: Video + Quiz obligatorio (no pasan hasta 90%)
  if (role === "test" || role === "vendedor") {
    return (
      <DailyTrainingGate
        rolesToEnforce={["test", "vendedor"]}
        videoId={INTRO_VIDEO_ID}
        videoSrc={INTRO_VIDEO_URL}
        quizXlsxPath={QUIZ_XLSX_PATH}
        passingScorePct={90}
      >
        {appLayout}
      </DailyTrainingGate>
    );
  }

  return appLayout;
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
