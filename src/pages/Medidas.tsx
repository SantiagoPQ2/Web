import React, { useState, useEffect } from "react";
import { Truck, Package, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Tab = "camioneta" | "sku";
type TipoSKU = "bulto" | "unidad";

interface Camioneta {
  id: string;
  nombre: string;
  volumen_m3: number;
  peso_kg: number;
}

interface SKU {
  id: string;
  nombre: string;
  tipo: TipoSKU;
  largo_m: number;
  ancho_m: number;
  alto_m: number;
  volumen_m3: number;
  peso_kg: number;
}

export default function Medidas() {
  const [tab, setTab] = useState<Tab>("camioneta");

  // Camioneta form
  const [camNombre, setCamNombre] = useState("");
  const [camVolumen, setCamVolumen] = useState("");
  const [camPeso, setCamPeso] = useState("");
  const [camionetas, setCamionetas] = useState<Camioneta[]>([]);
  const [loadingCam, setLoadingCam] = useState(false);

  // SKU form
  const [skuNombre, setSkuNombre] = useState("");
  const [skuTipo, setSkuTipo] = useState<TipoSKU>("bulto");
  const [skuLargo, setSkuLargo] = useState("");
  const [skuAncho, setSkuAncho] = useState("");
  const [skuAlto, setSkuAlto] = useState("");
  const [skuPeso, setSkuPeso] = useState("");
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loadingSKU, setLoadingSKU] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Volumen calculado en tiempo real
  const volumenCalculado =
    skuLargo && skuAncho && skuAlto
      ? (parseFloat(skuLargo) * parseFloat(skuAncho) * parseFloat(skuAlto)).toFixed(4)
      : null;

  useEffect(() => {
    fetchCamionetas();
    fetchSKUs();
  }, []);

  async function fetchCamionetas() {
    setLoadingCam(true);
    const { data, error } = await supabase
      .from("medidas_camionetas")
      .select("*")
      .order("nombre");
    if (!error && data) setCamionetas(data);
    setLoadingCam(false);
  }

  async function fetchSKUs() {
    setLoadingSKU(true);
    const { data, error } = await supabase
      .from("medidas_skus")
      .select("*")
      .order("nombre");
    if (!error && data) setSkus(data);
    setLoadingSKU(false);
  }

  function resetCamForm() {
    setCamNombre("");
    setCamVolumen("");
    setCamPeso("");
  }

  function resetSKUForm() {
    setSkuNombre("");
    setSkuTipo("bulto");
    setSkuLargo("");
    setSkuAncho("");
    setSkuAlto("");
    setSkuPeso("");
  }

  async function handleGuardarCamioneta() {
    setError(null);
    setSuccess(null);
    if (!camNombre.trim() || !camVolumen || !camPeso) {
      setError("Completá todos los campos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("medidas_camionetas").insert({
      nombre: camNombre.trim(),
      volumen_m3: parseFloat(camVolumen),
      peso_kg: parseFloat(camPeso),
    });
    if (error) {
      setError("Error al guardar: " + error.message);
    } else {
      setSuccess("Camioneta guardada correctamente.");
      resetCamForm();
      fetchCamionetas();
    }
    setSaving(false);
  }

  async function handleGuardarSKU() {
    setError(null);
    setSuccess(null);
    if (!skuNombre.trim() || !skuLargo || !skuAncho || !skuAlto || !skuPeso) {
      setError("Completá todos los campos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("medidas_skus").insert({
      nombre: skuNombre.trim(),
      tipo: skuTipo,
      largo_m: parseFloat(skuLargo),
      ancho_m: parseFloat(skuAncho),
      alto_m: parseFloat(skuAlto),
      peso_kg: parseFloat(skuPeso),
    });
    if (error) {
      setError("Error al guardar: " + error.message);
    } else {
      setSuccess("SKU guardado correctamente.");
      resetSKUForm();
      fetchSKUs();
    }
    setSaving(false);
  }

  async function handleEliminarCamioneta(id: string) {
    if (!confirm("¿Eliminar esta camioneta?")) return;
    await supabase.from("medidas_camionetas").delete().eq("id", id);
    fetchCamionetas();
  }

  async function handleEliminarSKU(id: string) {
    if (!confirm("¿Eliminar este SKU?")) return;
    await supabase.from("medidas_skus").delete().eq("id", id);
    fetchSKUs();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Medidas
      </h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab("camioneta"); setError(null); setSuccess(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
            tab === "camioneta"
              ? "bg-blue-600 text-white shadow"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <Truck className="w-4 h-4" /> Camioneta
        </button>
        <button
          onClick={() => { setTab("sku"); setError(null); setSuccess(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
            tab === "sku"
              ? "bg-blue-600 text-white shadow"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <Package className="w-4 h-4" /> SKU
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* ── CAMIONETA ── */}
      {tab === "camioneta" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-base">
              Nueva camioneta
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Nombre / Descripción
                </label>
                <input
                  type="text"
                  value={camNombre}
                  onChange={(e) => setCamNombre(e.target.value)}
                  placeholder="Ej: Kangoo furgón"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Volumen de carga (m³)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={camVolumen}
                    onChange={(e) => setCamVolumen(e.target.value)}
                    placeholder="Ej: 3.3"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Peso soportado (kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={camPeso}
                    onChange={(e) => setCamPeso(e.target.value)}
                    placeholder="Ej: 800"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleGuardarCamioneta}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar camioneta"}
            </button>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Camionetas cargadas
            </h3>
            {loadingCam ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : camionetas.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No hay camionetas cargadas todavía.
              </p>
            ) : (
              camionetas.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                      {c.nombre}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {c.volumen_m3} m³ · {c.peso_kg} kg
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminarCamioneta(c.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── SKU ── */}
      {tab === "sku" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-base">
              Nuevo SKU
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Nombre / Descripción
                </label>
                <input
                  type="text"
                  value={skuNombre}
                  onChange={(e) => setSkuNombre(e.target.value)}
                  placeholder="Ej: Caja aceite Natura x12"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Tipo
                </label>
                <div className="flex gap-2">
                  {(["bulto", "unidad"] as TipoSKU[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSkuTipo(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                        skuTipo === t
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensiones */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Dimensiones (metros)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Largo", val: skuLargo, set: setSkuLargo },
                    { label: "Ancho", val: skuAncho, set: setSkuAncho },
                    { label: "Alto", val: skuAlto, set: setSkuAlto },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Volumen calculado */}
              {volumenCalculado && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-blue-600 dark:text-blue-300 font-medium">
                    Volumen calculado
                  </span>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-200">
                    {volumenCalculado} m³
                  </span>
                </div>
              )}

              {/* Peso */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={skuPeso}
                  onChange={(e) => setSkuPeso(e.target.value)}
                  placeholder="Ej: 12.5"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <button
              onClick={handleGuardarSKU}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar SKU"}
            </button>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              SKUs cargados
            </h3>
            {loadingSKU ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : skus.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No hay SKUs cargados todavía.
              </p>
            ) : (
              skus.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                        {s.nombre}
                      </p>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full capitalize">
                        {s.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {s.largo_m} × {s.ancho_m} × {s.alto_m} m · {s.volumen_m3} m³ · {s.peso_kg} kg
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminarSKU(s.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
