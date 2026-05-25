import React, { useEffect, useState } from "react";
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
import PosibleRechazos from "./pages/PosibleRechazos";
import CoordsPage from "./pages/CoordsPage";
import NotasCredito from "./pages/NotasCredito";
import GpsLogger from "./pages/GpsLogger";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Informacion from "./pages/Informacion";
import SupervisorPage from "./pages/SupervisorPage";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import AdminEquipoPage from "./pages/AdminEquipoPage";
import PlanillaCarga from "./pages/PlanillaCarga";
import Mapa from "./pages/Mapa";
import PowerBIPage from "./pages/PowerBIPage";
import PDFs from "./pages/PDFs";
import VideoWatchLog from "./pages/VideoWatchLog";
import BajaClienteCambioRuta from "./pages/BajaClienteCambioRuta";
import RevisarBajas from "./pages/RevisarBajas";
import PedidoDeCompra from "./pages/PedidoDeCompra";
import RevisarCompras from "./pages/RevisarCompras";
import CatalogoB2B from "./pages/b2b/Catalogo";
import CarritoB2B from "./pages/b2b/Carrito";
import PedidosB2B from "./pages/b2b/Pedidos";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import UpdateBanner from "./components/UpdateBanner";
import ChatBubble from "./components/ChatBubble";
import ChatBot from "./components/ChatBot";
import DailyTrainingGate from "./components/DailyTrainingGate";
import { registerPushForUser } from "./utils/pushNotifications";
import { supabase } from "./config/supabase";

import {
  getRoutesForRole,
  getDefaultPathForRole,
  type AppRole,
} from "./config/routeConfig";

// ─── Constantes de capacitación ───────────────────────────────────────────────

const DEFAULT_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%204.mp4";

const EUSCKOR_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%204.mp4";

const DEFAULT_VIDEO_ID = "capsula_1_v1";
const EUSCKOR_VIDEO_ID = "capsula_eusckor_1_v1";

const DEFAULT_QUIZ_XLSX_PATH = "/Quiz.xlsx";
const EUSCKOR_QUIZ_XLSX_PATH = "/Quiz2.xlsx";

// ─── Mapa de path → componente página ────────────────────────────────────────
//
// Si agregás una nueva ruta en routeConfig.ts, también agregá la entrada acá.
//
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_COMPONENTS: Record<string, React.ReactElement> = {
  "/": <SearchPage />,
  "/bonificaciones": <Bonificaciones />,
  "/revisar-bonificaciones": <RevisarBonificaciones />,
  "/rechazos/nuevo": <RechazosForm />,
  "/posible-rechazos": <PosibleRechazos />,
  "/coordenadas": <CoordsPage />,
  "/notas-credito": <NotasCredito />,
  "/gps-logger": <GpsLogger />,
  "/settings": <Settings />,
  "/informacion": <Informacion />,
  "/supervisor": <SupervisorPage />,
  "/chat": <ChatPage />,
  "/admin": <AdminPanel />,
  "/admin-equipo": <AdminEquipoPage />,
  "/planilla-carga": <PlanillaCarga />,
  "/mapa": <Mapa />,
  "/powerbi": <PowerBIPage />,
  "/pdfs": <PDFs />,
  "/video-log": <VideoWatchLog />,
  "/baja-cliente": <BajaClienteCambioRuta />,
  "/revisar-bajas": <RevisarBajas />,
  "/pedido-compra": <PedidoDeCompra />,
  "/revisar-compras": <RevisarCompras />,
  "/b2b/catalogo": <CatalogoB2B />,
  "/b2b/carrito": <CarritoB2B />,
  "/b2b/pedidos": <PedidosB2B />,
};

// ─── Componente principal protegido ──────────────────────────────────────────

function ProtectedApp() {
  const { user } = useAuth();
  const hasUpdate = useVersionChecker(60000);
  const location = useLocation();

  const [openChat, setOpenChat] = useState(false);
  const [ffvv, setFfvv] = useState<string | null>(null);
  const [loadingTrainingConfig, setLoadingTrainingConfig] = useState(true);

  // Registro de push notifications
  useEffect(() => {
    if (!user?.username) return;
    registerPushForUser(user.username).catch((err) => {
      console.error("No se pudo registrar push:", err);
    });
  }, [user?.username]);

  // Carga del campo FFVV (solo para vendedores)
  useEffect(() => {
    let isMounted = true;

    async function loadTrainingConfig() {
      if (!user || user.role !== "vendedor") {
        if (isMounted) {
          setFfvv(null);
          setLoadingTrainingConfig(false);
        }
        return;
      }

      try {
        setLoadingTrainingConfig(true);

        const { data, error } = await supabase
          .from("usuarios_app")
          .select("FFVV, ffvv")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error cargando FFVV del usuario:", error);
          if (isMounted) setFfvv(null);
          return;
        }

        if (isMounted) {
          setFfvv(data?.FFVV ?? data?.ffvv ?? null);
        }
      } catch (err) {
        console.error("Error inesperado cargando FFVV:", err);
        if (isMounted) setFfvv(null);
      } finally {
        if (isMounted) setLoadingTrainingConfig(false);
      }
    }

    loadTrainingConfig();
    return () => { isMounted = false; };
  }, [user]);

  if (!user) return <Login />;

  const role = user.role as AppRole;
  const defaultPath = getDefaultPathForRole(role);
  const allowedRoutes = getRoutesForRole(role);

  // ── Spinner mientras carga la config de capacitación (solo vendedor) ────────
  if (role === "vendedor" && loadingTrainingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
        Cargando capacitación...
      </div>
    );
  }

  // ── ChatBot solo en sección B2B ─────────────────────────────────────────────
  const showChatBot = location.pathname.startsWith("/b2b");

  // ── Layout principal ────────────────────────────────────────────────────────
  const appLayout = (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden">
      <Navigation />

      <main className="flex-1 overflow-hidden">
        <Routes>
          {allowedRoutes.map((route) => {
            const element = PAGE_COMPONENTS[route.path];
            if (!element) return null;
            return (
              <Route key={route.path} path={route.path} element={element} />
            );
          })}

          {/* Fallback: redirige a la ruta raíz del rol */}
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </main>

      {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}

      {showChatBot && !openChat && (
        <ChatBubble onOpen={() => setOpenChat(true)} />
      )}
      {showChatBot && openChat && (
        <ChatBot onClose={() => setOpenChat(false)} />
      )}
    </div>
  );

  // ── Gate de capacitación diaria (vendedor / test) ───────────────────────────
  if (role === "test") {
    return (
      <DailyTrainingGate
        rolesToEnforce={["test"]}
        videoId={DEFAULT_VIDEO_ID}
        videoSrc={DEFAULT_VIDEO_URL}
        quizXlsxPath={DEFAULT_QUIZ_XLSX_PATH}
        passingScorePct={90}
      >
        {appLayout}
      </DailyTrainingGate>
    );
  }

  if (role === "vendedor") {
    const isEusckor =
      String(ffvv ?? "").trim().toLowerCase() === "eusckor";

    return (
      <DailyTrainingGate
        rolesToEnforce={["vendedor"]}
        videoId={isEusckor ? EUSCKOR_VIDEO_ID : DEFAULT_VIDEO_ID}
        videoSrc={isEusckor ? EUSCKOR_VIDEO_URL : DEFAULT_VIDEO_URL}
        quizXlsxPath={isEusckor ? EUSCKOR_QUIZ_XLSX_PATH : DEFAULT_QUIZ_XLSX_PATH}
        passingScorePct={90}
      >
        {appLayout}
      </DailyTrainingGate>
    );
  }

  return appLayout;
}

// ─── Raíz de la app ───────────────────────────────────────────────────────────

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
