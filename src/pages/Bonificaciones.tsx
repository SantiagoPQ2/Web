import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Package, DollarSign, User, FileText } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Motivo =
  | "Volumen"
  | "Bonificacion Especial"
  | "Pedido Dividido"
  | "Ruptura/Falta de Frio/Falta de Vacio";

interface FormData {
  cliente: string;
  articulo: string;
  bultos: string;
  porcentajeBonificacion: string;
  montoAdicional: string;
  motivo: Motivo | "";
}

interface FormErrors {
  cliente?: string;
  articulo?: string;
  bultos?: string;
  porcentajeBonificacion?: string;
  montoAdicional?: string;
  motivo?: string;
}

const MOTIVOS: Motivo[] = [
  "Volumen",
  "Bonificacion Especial",
  "Pedido Dividido",
  "Ruptura/Falta de Frio/Falta de Vacio",
];

const Bonificaciones: React.FC = () => {
  const { user, role } = useAuth(); // asumo que tu AuthContext expone role
  const [formData, setFormData] = useState<FormData>({
    cliente: "",
    articulo: "",
    bultos: "",
    porcentajeBonificacion: "",
    montoAdicional: "",
    motivo: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canUsePage = useMemo(() => {
    // si querés limitar quién carga, ajustá acá (ej: vendedor/admin/supervisor)
    return !!user;
  }, [user]);

  const validate = (): boolean => {
    const e: FormErrors = {};

    if (!formData.cliente.trim()) e.cliente = "Cliente es obligatorio";
    if (!formData.articulo.trim()) e.articulo = "Artículo es obligatorio";

    if (!formData.bultos.trim()) e.bultos = "Bultos es obligatorio";
    else {
      const n = Number(formData.bultos);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) e.bultos = "Bultos debe ser entero > 0";
    }

    if (!formData.porcentajeBonificacion.trim()) e.porcentajeBonificacion = "%Bonificación es obligatorio";
    else {
      const n = Number(formData.porcentajeBonificacion);
      if (!Number.isFinite(n) || n < 0) e.porcentajeBonificacion = "%Bonificación debe ser >= 0";
    }

    if (!formData.montoAdicional.trim()) e.montoAdicional = "Monto adicional es obligatorio (0 si no aplica)";
    else {
      const n = Number(formData.montoAdicional);
      if (!Number.isFinite(n) || n < 0) e.montoAdicional = "Monto adicional debe ser >= 0";
    }

    if (!formData.motivo) e.motivo = "Motivo es obligatorio";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setField = (k: keyof FormData, v: string) => {
    setFormData((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (message) setMessage(null);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canUsePage) return;
    if (!validate()) return;

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        cliente: formData.cliente.trim(),
        articulo: formData.articulo.trim(),
        bultos: Number(formData.bultos),
        porcentaje_bonificacion: Number(formData.porcentajeBonificacion),
        monto_adicional: Number(formData.montoAdicional),
        motivo: formData.motivo,
        // estado queda 'pendiente' por default
        // created_by queda auth.uid() por default (o por policy)
      };

      const { error } = await supabase.from("bonificaciones").insert(payload);
      if (error) throw error;

      setMessage({ type: "success", text: "✅ Bonificación registrada correctamente" });
      setFormData({
        cliente: "",
        articulo: "",
        bultos: "",
        porcentajeBonificacion: "",
        montoAdicional: "",
        motivo: "",
      });
      setErrors({});
    } catch (err: any) {
      setMessage({
        type: "error",
        text: `❌ Error al guardar: ${err?.message ?? "Intente nuevamente"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canUsePage) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-700">No autorizado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-6">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <FileText className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonificaciones</h1>
            <p className="text-gray-600">Registrar bonificaciones en Supabase</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center ${
              message.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            )}
            <span className={message.type === "success" ? "text-green-800" : "text-red-800"}>
              {message.text}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 mr-1" /> Cliente <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              value={formData.cliente}
              onChange={(e) => setField("cliente", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.cliente ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Ingrese el nombre del cliente"
            />
            {errors.cliente && <p className="mt-1 text-sm text-red-600">{errors.cliente}</p>}
          </div>

          {/* Artículo */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" /> Artículo <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              value={formData.articulo}
              onChange={(e) => setField("articulo", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.articulo ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Ingrese el nombre del artículo"
            />
            {errors.articulo && <p className="mt-1 text-sm text-red-600">{errors.articulo}</p>}
          </div>

          {/* Bultos */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" /> Bultos <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={formData.bultos}
              onChange={(e) => setField("bultos", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.bultos ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Cantidad de bultos/unidades"
            />
            {errors.bultos && <p className="mt-1 text-sm text-red-600">{errors.bultos}</p>}
          </div>

          {/* % Bonificación */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="h-4 w-4 mr-1" /> %Bonificación <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={formData.porcentajeBonificacion}
              onChange={(e) => setField("porcentajeBonificacion", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.porcentajeBonificacion ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Ej: 5"
            />
            {errors.porcentajeBonificacion && (
              <p className="mt-1 text-sm text-red-600">{errors.porcentajeBonificacion}</p>
            )}
          </div>

          {/* Monto adicional */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="h-4 w-4 mr-1" /> Monto Adicional de Dinero{" "}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={formData.montoAdicional}
              onChange={(e) => setField("montoAdicional", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.montoAdicional ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="0 si no aplica"
            />
            {errors.montoAdicional && <p className="mt-1 text-sm text-red-600">{errors.montoAdicional}</p>}
          </div>

          {/* Motivo */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 mr-1" /> Motivo <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={formData.motivo}
              onChange={(e) => setField("motivo", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.motivo ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
            >
              <option value="">Seleccione un motivo</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {errors.motivo && <p className="mt-1 text-sm text-red-600">{errors.motivo}</p>}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-red-700 hover:bg-red-800"
              }`}
            >
              {loading ? "Guardando..." : "Guardar Bonificación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Bonificaciones;
