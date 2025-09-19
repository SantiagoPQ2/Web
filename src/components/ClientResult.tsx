import React from "react";
import { User, FileText, List, Info, ChevronDown } from "lucide-react";
import { ClienteData } from "../types";

// 🔑 Diccionario de categorías (rellenalo con tus keywords)
const PROMO_CATEGORIES: Record<string, string[]> = {
  Fiambres: ["fiambres", "jamon", "mortadela", "salame", "paleta"],
  Peñaflor: ["dada", "frizze", "vino", "cerveza", "SMF", "gordons", "MSD"],
  Hamburguesas: ["hamburguesa", "paty"],
  Salchichas: ["VSS", "ICB"],
  Azucar: ["Azucar"],
  Softys: ["Softy"],
  Molinos: ["Molino","Snack"],
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

  // 🚫 Elimino categorías vacías
  Object.keys(categorized).forEach((cat) => {
    if (categorized[cat].length === 0) {
      delete categorized[cat];
    }
  });

  return categorized;
}

const ClientResult: React.FC<{ cliente: ClienteData }> = ({ cliente }) => {
  const categorizedPromos = categorizePromos(cliente.columnaD);
  const categories = Object.keys(categorizedPromos);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 animate-fadeIn">
      {/* Encabezado cliente */}
      <div className="flex items-center mb-6">
        <div className="bg-red-100 rounded-full p-2 mr-3">
          <User className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Cliente Encontrado
          </h2>
          <p className="text-red-700 font-medium">N° {cliente.numero}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Deuda */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Info className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-800">Deuda</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {cliente.columnaB || "Sin información"}
          </p>
        </div>

        {/* Situación */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <List className="h-5 w-5 text-red-700 mr-2" />
            <h3 className="font-semibold text-gray-800">Situación</h3>
          </div>
          <p className="whitespace-pre-line text-gray-700">
            {cliente.columnaC || "Sin información"}
          </p>
        </div>

        {/* Promos categorizadas */}
        {categories.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center mb-2">
              <FileText className="h-5 w-5 text-red-800 mr-2" />
              <h3 className="font-semibold text-gray-800">Promos</h3>
            </div>

            {categories.map((cat) => (
              <div
                key={cat}
                className="bg-red-100 border border-red-300 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-red-700">{cat}</h4>
                  <ChevronDown className="h-4 w-4 text-red-700" />
                </div>

                <div className="space-y-2">
                  {categorizedPromos[cat].map((promo, i) => (
                    <div
                      key={i}
                      className="bg-white border border-red-200 rounded p-2 text-sm text-gray-800"
                    >
                      {promo}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Si no hay promos */}
        {categories.length === 0 && (
          <div className="bg-red-100 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <FileText className="h-5 w-5 text-red-800 mr-2" />
              <h3 className="font-semibold text-gray-800">Promos</h3>
            </div>
            <p className="text-gray-700">Sin información</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientResult;
