import React, { useMemo, useState } from "react";
import {
  User,
  FileText,
  List,
  Info,
  ChevronDown,
  Building,
} from "lucide-react";
import { ClienteData } from "../types";

// ✅ Import del PDF como asset (Netlify lo copia al build sí o sí)
import escalasPdf from "../assets/Escalas.pdf";

const PROMO_CATEGORIES: Record<string, string[]> = {
  Fiambres: ["fiambres", "jamon", "mortadela", "salame", "paleta", "queso", "Cremoso", "Nuyun","1153";"593030";"1154";"Ibarazi"],
  Peñaflor: ["vino", "cerveza", "trapiche", "alma mora", "dada"],
  Hamburguesas: ["hamburguesa", "paty"],
  Salchichas: ["viena", "vss", "ICB", "Vienissima" ],
  Azucar: ["azucar"],
  Yerba: ["yerba", "manto"],
  Vanuts: ["vanuts"],
  Manteca: ["manteca"],
  QuesoRallado: ["rallado"],
  Otros: [],
};;

function categorizePromos(promosRaw: string) {
  if (!promosRaw) return {};

  const promos = promosRaw
    .split("\n")
    .map((p) => p.replace(/^[-–•]\s*/, "").trim())
    .filter(Boolean);

  const categorized: Record<string, string[]> = {};
  Object.keys(PROMO_CATEGORIES).forEach((cat) => (categorized[cat] = []));

  promos.forEach((promo) => {
    let found = "Otros";
    for (const [cat, keywords] of Object.entries(PROMO_CATEGORIES)) {
      if (keywords.some((kw) => promo.toLowerCase().includes(kw))) {
        found = cat;
        break;
      }
    }
    categorized[found].push(promo);
  });

  Object.keys(categorized).forEach((cat) => {
    if (categorized[cat].length === 0) delete categorized[cat];
  });

  return categorized;
}

type PromoTab = "estrategicas" | "operativas" | "escalas";

const ESCALAS_PDF_URL = escalasPdf;

const ClientResult: React.FC<{ cliente: ClienteData }> = ({ cliente }) => {
  const [tab, setTab] = useState<PromoTab>("estrategicas");

  // ✅ Link a Google Viewer para que en celular abra SIEMPRE
  const escalasAbsoluteUrl = useMemo(() => {
    // asegura URL absoluta para gview
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${ESCALAS_PDF_URL}`;
  }, []);

  const escalasGViewUrl = useMemo(() => {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
      escalasAbsoluteUrl
    )}`;
  }, [escalasAbsoluteUrl]);

  const promosText = useMemo(() => {
    if (tab === "estrategicas") return cliente.columnaD || "";
    if (tab === "operativas") return cliente.columnaF || "";
    return ""; // ✅ En "escalas" NO mostramos texto, mostramos PDF
  }, [tab, cliente]);

  const categorizedPromos = useMemo(
    () => categorizePromos(promosText),
    [promosText]
  );

  const categories = Object.keys(categorizedPromos);

  const TabButton = ({
    value,
    label,
  }: {
    value: PromoTab;
    label: string;
  }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={`px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors w-full sm:w-auto ${
          active
            ? "bg-red-700 text-white border-red-700"
            : "border-red-300 text-red-700 hover:bg-red-50"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="bg-white border rounded-lg shadow p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <div className="bg-red-100 rounded-full p-2 mr-3">
          <User className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Cliente Encontrado</h2>
          <p className="text-red-700 font-medium">N° {cliente.numero}</p>
        </div>
      </div>

      {/* Razón Social */}
      <div className="bg-gray-50 p-4 rounded">
        <div className="flex items-center mb-1">
          <Building className="h-5 w-5 mr-2" />
          <h3 className="font-semibold">Razón Social</h3>
        </div>
        <p>{cliente.razon_social || "No disponible"}</p>
      </div>

      {/* Deuda */}
      <div className="bg-gray-50 p-4 rounded">
        <div className="flex items-center mb-1">
          <Info className="h-5 w-5 mr-2" />
          <h3 className="font-semibold">Deuda</h3>
        </div>
        <p>{cliente.columnaB || "Sin información"}</p>
      </div>

      {/* Situación */}
      <div className="bg-red-50 p-4 rounded">
        <div className="flex items-center mb-1">
          <List className="h-5 w-5 mr-2 text-red-700" />
          <h3 className="font-semibold">Situación</h3>
        </div>
        <p className="whitespace-pre-line">{cliente.columnaC}</p>
      </div>

      {/* Promos / Tabs */}
      <div className="space-y-3">
        {/* Header responsivo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-red-700" />
            <h3 className="font-semibold">Promos</h3>
          </div>

          {/* Mobile: grilla 2 columnas; Desktop: fila */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:justify-end">
            <TabButton value="estrategicas" label="Estrategicas" />
            <TabButton value="operativas" label="Operativas" />
            <TabButton value="escalas" label="Escalas" />
            <div className="hidden sm:block" />
          </div>
        </div>

        {/* ✅ Si el tab es "Escalas", mostramos SOLO el PDF (gview para mobile) */}
        {tab === "escalas" ? (
          <div className="bg-white border rounded-lg p-3">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p className="text-sm text-gray-700">Escalas (PDF)</p>

              {/* ✅ En mobile abre el visor gview, no el PDF nativo */}
              <a
                href={escalasGViewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                Abrir en otra pestaña
              </a>
            </div>

            {/* ✅ Embebido con gview (más compatible en celulares) */}
            <div className="w-full overflow-hidden rounded-md border">
              <iframe
                title="Escalas PDF"
                src={escalasGViewUrl}
                className="w-full"
                style={{ height: "70vh" }}
              />
            </div>
          </div>
        ) : (
          <>
            {categories.length > 0 ? (
              categories.map((cat) => (
                <div key={cat} className="bg-red-100 p-4 rounded border">
                  <div className="flex justify-between mb-2">
                    <h4 className="font-bold text-red-700">{cat}</h4>
                    <ChevronDown className="h-4 w-4 text-red-700" />
                  </div>
                  {categorizedPromos[cat].map((promo, i) => (
                    <div
                      key={i}
                      className="bg-white border rounded p-2 text-sm mb-1"
                    >
                      {promo}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="bg-red-100 p-4 rounded">Sin información</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClientResult;
