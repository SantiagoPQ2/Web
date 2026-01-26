import React, { useMemo, useState } from "react";
import { User, FileText, List, Info, ChevronDown, Building } from "lucide-react";
import { ClienteData } from "../types";

const PROMO_CATEGORIES: Record<string, string[]> = {
  Fiambres: ["fiambres", "jamon", "mortadela", "salame", "nuyun", "paleta", "cremoso", "queso"],
  Peñaflor: ["dada", "frizze", "vino", "cerveza", "smf", "gordons", "msd", "trapiche", "alma mora", "alaris", "navarro", "san telmo", "cazador", "brut", "80094", "bubble"],
  Hamburguesas: ["hamburguesa", "paty"],
  Salchichas: ["vss", "icb", "patyviena"],
  Azucar: ["azucar"],
  Softys: ["softy"],
  Molinos: ["molino", "snack"],
  QuesoRallado: ["rallado"],
  Yerba: ["manto", "yerba"],
  Vanuts: ["vanuts"],
  Otros: [],
};

function categorizePromos(promosRaw: string | undefined) {
  if (!promosRaw) return {};

  const promos = promosRaw
    .split("\n")
    .map((p) => p.replace(/^[-–•]\s*/, "").trim())
    .filter((p) => p.length > 0);

  const categorized: Record<string, string[]> = {};
  Object.keys(PROMO_CATEGORIES).forEach((cat) => {
    categorized[cat] = [];
  });

  for (const promo of promos) {
    let foundCategory = "Otros";
    for (const [cat, keywords] of Object.entries(PROMO_CATEGORIES)) {
      if (keywords.some((kw) => promo.toLowerCase().includes(kw.toLowerCase()))) {
        foundCategory = cat;
        break;
      }
    }
    categorized[foundCategory].push(promo);
  }

  Object.keys(categorized).forEach((cat) => {
    if (categorized[cat].length === 0) delete categorized[cat];
  });

  return categorized;
}

type PromoTab = "estrategicas" | "operativas" | "escalas";

const tabLabel: Record<PromoTab, string> = {
  estrategicas: "Estrategicas",
  operativas: "Operativas",
  escalas: "Escalas",
};

const ClientResult: React.FC<{ cliente: ClienteData }> = ({ cliente }) => {
  const [tab, setTab] = useState<PromoTab>("estrategicas");

  // Elegimos el texto a mostrar según tab.
  // Compatibilidad:
  // - Estrategicas: usa columnaE si existe; si no, usa columnaD (Promos legacy)
  // - Operativas/Escalas: si no existen, quedan vacías
  const promosText = useMemo(() => {
    if (tab === "estrategicas") {
      return (
        cliente.columnaE ||
        cliente.promos_estrategicas ||
        cliente.columnaD ||
        ""
      );
    }
    if (tab === "operativas") {
      return cliente.columnaF || cliente.promos_operativas || "";
    }
    return cliente.columnaG || cliente.promos_escalas || "";
  }, [tab, cliente]);

  const categorizedPromos = useMemo(() => categorizePromos(promosText), [promosText]);
  const categories = Object.keys(categorizedPromos);

  const TabButton: React.FC<{ value: PromoTab }> = ({ value }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={[
          "px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors",
          active
            ? "bg-red-700 border-red-700 text-white"
            : "bg-white dark:bg-gray-800 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30",
        ].join(" ")}
      >
        {tabLabel[value]}
      </button>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 animate-fadeIn transition-colors duration-300">
      {/* Encabezado cliente */}
      <div className="flex items-center mb-6">
        <div className="bg-red-100 dark:bg-red-900/40 rounded-full p-2 mr-3">
          <User className="h-6 w-6 text-red-700 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cliente Encontrado</h2>
          <p className="text-red-700 dark:text-red-400 font-medium">N° {cliente.numero}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Razón Social */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors duration-300">
          <div className="flex items-center mb-2">
            <Building className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-2" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Razón Social</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
            {cliente.razon_social || "No disponible"}
          </p>
        </div>

        {/* Deuda */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors duration-300">
          <div className="flex items-center mb-2">
            <Info className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-2" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Deuda</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
            {cliente.columnaB || "Sin información"}
          </p>
        </div>

        {/* Situación */}
        <div className="bg-red-50 dark:bg-red-900/40 rounded-lg p-4 transition-colors duration-300">
          <div className="flex items-center mb-2">
            <List className="h-5 w-5 text-red-700 dark:text-red-400 mr-2" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Situación</h3>
          </div>
          <p className="whitespace-pre-line text-gray-700 dark:text-gray-200">
            {cliente.columnaC || "Sin información"}
          </p>
        </div>

        {/* Promos + Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-red-800 dark:text-red-400 mr-2" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Promos</h3>
            </div>

            <div className="flex items-center gap-2">
              <TabButton value="estrategicas" />
              <TabButton value="operativas" />
              <TabButton value="escalas" />
            </div>
          </div>

          {/* Si hay promos en la tab actual */}
          {categories.length > 0 ? (
            categories.map((cat) => (
              <div
                key={cat}
                className="bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded-lg p-4 transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-red-700 dark:text-red-400">{cat}</h4>
                  <ChevronDown className="h-4 w-4 text-red-700 dark:text-red-400" />
                </div>

                <div className="space-y-2">
                  {categorizedPromos[cat].map((promo, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-700 border border-red-200 dark:border-red-700 rounded p-2 text-sm text-gray-800 dark:text-gray-100 transition-colors duration-300"
                    >
                      {promo}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-red-100 dark:bg-red-900/40 rounded-lg p-4 transition-colors duration-300">
              <p className="text-gray-700 dark:text-gray-200">Sin información</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientResult;
