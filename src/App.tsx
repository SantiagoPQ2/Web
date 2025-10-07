import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import SearchPage from "./pages/SearchPage";
import Bonificaciones from "./pages/Bonificaciones";
import RechazosForm from "./pages/RechazosForm";
import CoordsPage from "./pages/CoordsPage";
import NotasCredito from "./pages/NotasCredito";
import GpsLogger from "./pages/GpsLogger";
import Settings from "./pages/Settings";
import ChatPage from "./pages/ChatPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useVersionChecker } from "./hooks/useVersionChecker";
import UpdateBanner from "./components/UpdateBanner";

function ProtectedApp() {
  const { user } = useAuth();
  const hasUpdate = useVersionChecker(60000);

  if (!user) return <Login />;

  const role = user.role;

  let allowedRoutes;
  if (role === "vendedor") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Settings />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    );
  } else if (role === "supervisor") {
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Settings />} />
        <Route path="/supervisor" element={<CoordsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    );
  } else if (role === "logistica") {
    allowedRoutes = (
      <Routes>
        <Route path="/rechazos/nuevo" element={<RechazosForm />} />
        <Route path="/coordenadas" element={<CoordsPage />} />
        <Route path="/informacion" element={<Settings />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    );
  } else {
    // admin
    allowedRoutes = (
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/bonificaciones" element={<Bonificaciones />} />
        <Route path="/rechazos/nuevo" element={<RechazosForm />} />
        <Route path="/coordenadas" element={<CoordsPage />} />
        <Route path="/notas-credito" element={<NotasCredito />} />
        <Route path="/gps-logger" element={<GpsLogger />} />
        <Route path="/informacion" element={<Settings />} />
        <Route path="/supervisor" element={<CoordsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-14 md:pl-64">
      <Navigation />
      <main className="p-2 md:p-4 transition-all duration-300">{allowedRoutes}</main>

      {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}

      <footer className="bg-white border-t border-gray-200 mt-12 text-center py-4 text-sm text-gray-600">
        VaFood - Sistema de consulta de clientes
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </Router>
  );
}

export default App;
