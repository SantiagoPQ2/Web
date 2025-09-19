import React, { useState } from "react";

interface Cliente {
  cliente_numero: string;
  deuda?: string;
  situacion?: string;
  promos?: string;
}

// 🔑 Diccionario de categorías (rellenalo con tus keywords)
const PROMO_CATEGORIES: Record<string, string[]> = {
  Fiambres: ["fiambres", "jamon", "mortadela", "salame"],
  Bebidas: ["am", "dada", "frizze", "vino", "cerveza"],
  Hamburguesas: ["hamburguesa", "paty", "mccain"],
  Otros: [] // fallback
};

// 👉 Función para categorizar promos
function categorizePromos(promosRaw: string | undefined) {
  if (!promosRaw) return {};

  const promos = promosRaw
    .split("\n")
    .map((p) => p.replace(/^[-–•]\s*/, "").trim()) // limpio guiones
    .filter((p) => p.length > 0);

  const categorized: Record<string, string[]> = {};
  Object.keys(PROMO_CATEGORIES).forEach((cat) => {
    categorized[cat] = [];
  });

  for (const promo of promos) {
    let foundCategory = "Otros";
    for (const [cat, keywords] of Object.entries(PROMO_CATEGORIES)) {
      if (
        keywords.some((kw) =>
          promo.toLowerCase().includes(kw.toLowerCase())
        )
      ) {
        foundCategory = cat;
        break;
      }
    }
    categorized[foundCategory].push(promo);
  }

  // 🚫 Elimino categorías vacías antes de devolver
  Object.keys(categorized).forEach((cat) => {
    if (categorized[cat].length === 0) {
      delete categorized[cat];
    }
  });

  return categorized;
}

const ClientResult: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
  const categorizedPromos = categorizePromos(cliente.promos);
  const tabs = Object.keys(categorizedPromos);
  const [activeTab, setActiveTab] = useState<string>(
    tabs.length > 0 ? tabs[0] : ""
  );

  return (
    <div className="space-y-6">
      {/* Encabezado cliente */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <h3 className="text-lg font-bold text-red-700 flex items-center">
          <span className="mr-2">👤</span> Cliente Encontrado
        </h3>
        <p className="text-gray-700 mt-1">N° {cliente.cliente_numero}</p>
      </div>

      {/* Deuda */}
      {cliente.deuda && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">💰 Deuda</h4>
          <p className="text-gray-700">{cliente.deuda}</p>
        </div>
      )}

      {/* Situación */}
      {cliente.situacion && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">📋 Situación</h4>
          <p className="whitespace-pre-line text-gray-700">
            {cliente.situacion}
          </p>
        </div>
      )}

      {/* Promos categorizadas */}
      {tabs.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    activeTab === tab
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido de la pestaña activa */}
          <div className="p-4 space-y-2">
            {categorizedPromos[activeTab]?.map((promo, i) => (
              <div
                key={i}
                className="bg-red-50 border border-red-200 rounded p-2 text-sm text-gray-800"
              >
                {promo}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientResult;
