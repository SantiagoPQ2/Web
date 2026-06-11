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

// ── Campos requeridos para considerar el perfil completo ──────────────────────
const isProfileComplete = (profile: {
  name?: string | null;
  phone?: string | null;
  mail?: string | null;
}): boolean => {
  return !!(
    profile.name?.trim() &&
    profile.phone?.trim() &&
    profile.mail?.trim()
  );
};

// ── Banner de perfil incompleto ───────────────────────────────────────────────
const SettingsBlocker: React.FC = () => {
  const location = useLocation();

  // Permitir navegar libremente dentro de /settings
  if (location.pathname === "/settings") return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <span className="text-3xl">👤</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          Completá tu perfil
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Para acceder a la aplicación necesitás completar tu nombre, teléfono y
          correo electrónico en la configuración.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Una vez que completes tus datos, la app vuelve a la normalidad
          automáticamente.
        </p>
        <a
          href="/settings"
          className="block w-full bg-[#8B0000] hover:bg-[#6b0000] text-white py-3 rounded-xl text-sm font-semibold transition"
        >
          Ir a Configuración
        </a>
      </div>
    </div>
  );
};

// ── Hook: chequea si el perfil está completo ──────────────────────────────────
function useProfileCheck() {
  const { user } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setProfileComplete(null); return; }

    // Admin siempre pasa
    if (user.role === "admin") { setProfileComplete(true); return; }

    let mounted = true;

    supabase
      .from("usuarios_app")
      .select("name, phone, mail")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (!data) { setProfileComplete(false); return; }
        setProfileComplete(isProfileComplete(data));
      });

    return () => { mounted = false; };
  }, [user]);

  return profileComplete;
}

// ── App principal ─────────────────────────────────────────────────────────────
function ProtectedApp() {
  const { user } = useAuth();
  const location = useLocation();
  const { hasUpdate } = useVersionChecker();
  const [openChat, setOpenChat] = useState(false);
  const [ffvv, setFfvv] = useState<string | null>(null);
  const [loadingTrainingConfig, setLoadingTrainingConfig] = useState(true);

  const profileComplete = useProfileCheck();

  useEffect(() => {
    if (!user) return;
    registerPushForUser(user.username).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadTrainingConfig() {
      try {
        const { data } = await supabase
          .from("usuarios_app")
          .select("ffvv")
          .eq("id", user!.id)
          .maybeSingle();

        if (isMounted) setFfvv(data?.ffvv ?? null);
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

  if (role === "vendedor" && loadingTrainingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
        Cargando capacitación...
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

      {/* Bloqueador si el perfil está incompleto (no admin, no null=cargando) */}
      {profileComplete === false && <SettingsBlocker />}
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
