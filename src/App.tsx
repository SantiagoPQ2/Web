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
import ResetPassword from "./pages/ResetPassword";
import Informacion from "./pages/Informacion";
import SupervisorPage from "./pages/SupervisorPage";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import AdminEquipoPage from "./pages/AdminEquipoPage";
import AdminUsuarios from "./pages/AdminUsuarios";
import VendedoresResumen from "./pages/VendedoresResumen";
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
import CuentaCorriente from "./pages/CuentaCorriente";
import CuentaCorrienteJefe from "./pages/CuentaCorrienteJefe";
import AltaClientePage from "./pages/AltaClientePage";
import AltaClienteListado from "./pages/AltaClienteListado";
import Medidas from "./pages/Medidas";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import { useUserPermissions } from "./hooks/useUserPermissions";
import UpdateBanner from "./components/UpdateBanner";
import ChatBubble from "./components/ChatBubble";
import ChatBot from "./components/ChatBot";
import DailyTrainingGate from "./components/DailyTrainingGate";
import { registerPushForUser } from "./utils/pushNotifications";
import { supabase } from "./config/supabase";

import {
  getDefaultPathForRole,
  type AppRole,
} from "./config/routeConfig";

const DEFAULT_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%204.mp4";
const EUSCKOR_VIDEO_URL =
  "https://qnhjoheazstrjyhhfxev.supabase.co/storage/v1/object/public/documentos_pdf/Capsula%204.mp4";
const DEFAULT_VIDEO_ID = "capsula_1_v1";
const EUSCKOR_VIDEO_ID = "capsula_eusckor_1_v1";
const DEFAULT_QUIZ_XLSX_PATH = "/Quiz.xlsx";
const EUSCKOR_QUIZ_XLSX_PATH = "/Quiz2.xlsx";

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
  "/admin-usuarios": <AdminUsuarios />,
  "/vendedores-resumen": <VendedoresResumen />,
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
  "/cuenta-corriente": <CuentaCorriente />,
  "/cuenta-corriente-jefe": <CuentaCorrienteJefe />,
  "/alta-cliente": <AltaClientePage />,
  "/alta-cliente-listado": <AltaClienteListado />,
  "/medidas": <Medidas />,
};

// ─── App protegida (requiere login) ──────────────────────────────────────────

function ProtectedApp() {
  const { user, logout } = useAuth();
  const hasUpdate = useVersionChecker(60000);
  const location = useLocation();

  const [openChat, setOpenChat] = useState(false);
  const [ffvv, setFfvv] = useState<string | null>(null);
  const [loadingTrainingConfig, setLoadingTrainingConfig] = useState(true);

  // Permisos: rutas base del rol + extras/revocaciones de Supabase
  const { allRoutes: allowedRoutes, loading: loadingPermisos } = useUserPermissions(
    user?.id,
    user?.role as AppRole | undefined
  );

  // Registrar push notifications
  useEffect(() => {
    if (!user?.username) return;
    registerPushForUser(user.username).catch((err) => {
      console.error("No se pudo registrar push:", err);
    });
  }, [user?.username]);

  // Cargar FFVV para vendedores (para el gate de capacitación)
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
          .select("FFVV, active")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error cargando config del usuario:", error);
          if (isMounted) setFfvv(null);
          return;
        }

        if (isMounted) setFfvv(data?.FFVV ?? null);
      } catch (err) {
        console.error("Error inesperado cargando FFVV:", err);
        if (isMounted) setFfvv(null);
      } finally {
        if (isMounted) setLoadingTrainingConfig(false);
      }
    }

    loadTrainingConfig();
    return () => { isMounted = false; };
  }, [user, logout]);

  // Sin login → mostrar Login
  if (!user) return <Login />;

  const role = user.role as AppRole;
  const defaultPath = getDefaultPathForRole(role);

  // Loading combinado
  const isLoading = loadingPermisos || (role === "vendedor" && loadingTrainingConfig);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
        Cargando...
      </div>
    );
  }

  const showChatBot = location.pathname.startsWith("/b2b");

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
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </main>
      {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}
      {showChatBot && !openChat && <ChatBubble onOpen={() => setOpenChat(true)} />}
      {showChatBot && openChat && <ChatBot onClose={() => setOpenChat(false)} />}
    </div>
  );

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
    const isEusckor = String(ffvv ?? "").trim().toLowerCase() === "eusckor";
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

// ─── App root — rutas públicas fuera del guard de login ──────────────────────

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Ruta pública: accesible sin login */}
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Todo lo demás pasa por ProtectedApp */}
          <Route path="*" element={<ProtectedApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
