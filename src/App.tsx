import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import SearchPage from './pages/SearchPage';
import Bonificaciones from './pages/Bonificaciones';
import Rechazos from './pages/Rechazos';
import RechazosForm from './pages/RechazosForm';
import NotasCredito from './pages/NotasCredito'; // 👈 nuevo

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation />

        <main>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/bonificaciones" element={<Bonificaciones />} />
            <Route path="/rechazos" element={<Rechazos />} />
            <Route path="/rechazos/nuevo" element={<RechazosForm />} />
            <Route path="/notas-credito" element={<NotasCredito />} /> {/* 👈 nueva ruta */}
          </Routes>
        </main>

        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-gray-600">
              <p>VaFood - Sistema de consulta de clientes</p>
              <p className="mt-1">Consulte situación y promociones de clientes</p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
