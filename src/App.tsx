import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
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

import BajaClienteCambioRuta from "./pages/BajaClienteCambioRuta";
import RevisarBajas from "./pages/RevisarBajas";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import UpdateBanner from "./components/UpdateBanner";

// ⭐ B2B CLIENTE
import CatalogoB2B from "./pages/b2b/Catalogo";
import CarritoB2B from "./pages/b2b/Carrito";
import PedidosB2B from "./pages/b2b/Pedidos";

function ProtectedApp() {
  const { user } = useAuth();
  const hasUpdate = useVersionChecker(60000);
  const location = useLocation();

  const [openChat, setOpenChat] = useState(false);

  // Si NO está logueado → Login
  if (!user) return <Login />;

  const role = user.role;
  let allowedRoutes;

  // ========================================
  // 🚀 CLIENTE B2B
  // ========================================
  if (role === "cliente") {
    allowedRoutes = (
      <Routes>
        <Route path="/b2b/catalogo" element={<CatalogoB2B />} />
        <Route path="/b2b/carrito" element={<CarritoB2B />} />
        <Route path="/b2b/pedidos" element={<PedidosB2B />} />

        {/* logout universal */}
        <Route
          path="/logout"
          element={
            <div>
              {localStorage.clear()}
              {window.location.replace("/")}
            </div>
          }
        />

        <Route path="*" element={<CatalogoB2B />} />
      </Routes>
    );

    return (
      <div className="min-h-screen bg-white">
        <main className="flex-1">{allowedRoutes}</main>
      </div>
    );
  }

  // ========================================
  // 🚀 VENDEDOR
  // ========================================
  if (role === "vendedor") {
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

        <Route
          path="/logout"
          element={
            <div>
              {localStorage.clear()}
              {window.location.replace("/")}
            </div>
          }
        />
      </Routes>
    );
  }

  // ========================================
  // 🚀 SUPERVISOR
  // ========================================
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
        <Route path="/revisar-bajas" element={<RevisarBajas />} />

        <Route
          path="/logout"
          element={
            <div>
              {localStorage.clear()}
              {window.location.replace("/")}
            </div>
          }
        />
      </Routes>
    );
  }

  // ========================================
  // 🚀 LOGÍSTICA
  // ========================================
  else if (role === "logistica") {
    allowedRoutes = (
      <Routes>
        <Route path="/rechazos/nuevo" element={<RechazosForm />} />
        <Route path="/coordenadas" element={<CoordsPage />} />
        <Route path="/informacion" element={<Informacion />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />

        <Route
          path="/logout"
          element={
            <div>
              {localStorage.clear()}
              {window.location.replace("/")}
            </div>
          }
        />
      </Routes>
    );
  }

  // ========================================
  // 🚀 ADMIN
  // ========================================
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

        {/* B2B disponible para admin */}
        <Route path="/b2b/catalogo" element={<CatalogoB2B />} />
        <Route path="/b2b/carrito" element={<CarritoB2B />} />
        <Route path="/b2b/pedidos" element={<PedidosB2B />} />

        <Route
          path="/logout"
          element={
            <div>
              {localStorage.clear()}
              {window.location.replace("/")}
            </div>
          }
        />
      </Routes>
    );
  }

  // ========================================
  // 🚀 DEFAULT
  // ========================================
  else {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
      </Routes>
    );
  }

  // ========================================
  // 🚀 APP INTERNA (con Navigation)
  // ========================================
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navigation />
      <main className="flex-1">{allowedRoutes}</main>

      {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}
    </div>
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
