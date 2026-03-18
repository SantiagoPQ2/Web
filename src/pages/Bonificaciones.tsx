// src/pages/Bonificaciones.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Package,
  DollarSign,
  User,
  FileText,
  Save,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Motivo =
  | "Volumen"
  | "Bonificacion Especial"
  | "Pedido Dividido"
  | "Ruptura/Falta de Frio/Falta de Vacio";

type EstadoBonificacion = "pendiente" | "aprobado";

interface FormData {
  cliente: string;
  articulo: string;
  bultos: string;
  porcentajeBonificacion: string;
  montoAdicional: string;
  motivo: Motivo | "";
  fechaEntrega: string;
}

interface FormErrors {
  cliente?: string;
  articulo?: string;
  bultos?: string;
  porcentajeBonificacion?: string;
  montoAdicional?: string;
  motivo?: string;
  fechaEntrega?: string;
}

interface BonificacionRow {
  id: string;
  cliente: string;
  articulo: string;
  bultos: number;
  porcentaje_bonificacion: number;
  monto_adicional: number;
  motivo: string;
  fecha_entrega: string;
  estado: EstadoBonificacion | string | null;
  created_at?: string | null;
  created_by?: string | null;
}

const MOTIVOS: Motivo[] = [
  "Volumen",
  "Bonificacion Especial",
  "Pedido Dividido",
  "Ruptura/Falta de Frio/Falta de Vacio",
];

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date + (date.includes("T") ? "" : "T00:00:00"));
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-AR");
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString("es-AR");
}

const Bonificaciones: React.FC = () => {
  const { user } = useAuth();

  const minFechaEntrega = addDays(getTodayKey(), 1);

  const [formData, setFormData] = useState<FormData>({
    cliente: "",
    articulo: "",
    bultos: "",
    porcentajeBonificacion: "",
    montoAdicional: "",
    motivo: "",
    fechaEntrega: minFechaEntrega,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [bonificaciones, setBonificaciones] = useState<BonificacionRow[]>([]);

  const canUsePage = useMemo(() => !!user, [user]);

  const validate = (): boolean => {
    const e: FormErrors = {};

    if (!formData.cliente.trim()) e.cliente = "Cliente es obligatorio";
    if (!formData.articulo.trim()) e.articulo = "Artículo es obligatorio";

    if (!formData.bultos.trim()) e.bultos = "Bultos es obligatorio";
    else {
      const n = Number(formData.bultos);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        e.bultos = "Bultos debe ser entero > 0";
      }
    }

    if (!formData.porcentajeBonificacion.trim()) {
      e.porcentajeBonificacion = "%Bonificación es obligatorio";
    } else {
      const n = Number(formData.porcentajeBonificacion);
      if (!Number.isFinite(n) || n < 0) {
        e.porcentajeBonificacion = "%Bonificación debe ser >= 0";
      }
    }

    if (formData.montoAdicional.trim() === "") {
      e.montoAdicional = "Monto adicional es obligatorio (0 si no aplica)";
    } else {
      const n = Number(formData.montoAdicional);
      if (!Number.isFinite(n) || n < 0) {
        e.montoAdicional = "Monto adicional debe ser >= 0";
      }
    }

    if (!formData.motivo) e.motivo = "Motivo es obligatorio";

    if (!formData.fechaEntrega) {
      e.fechaEntrega = "Fecha de entrega es obligatoria";
    } else if (formData.fechaEntrega <= getTodayKey()) {
      e.fechaEntrega = "La fecha de entrega debe ser posterior a hoy";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setField = (k: keyof FormData, v: string) => {
    setFormData((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) {
      setErrors((p) => ({ ...p, [k]: undefined }));
    }
    if (message) setMessage(null);
  };

  const fetchBonificaciones = async () => {
    if (!user?.id) return;

    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("bonificaciones")
        .select(
          `
          id,
          cliente,
          articulo,
          bultos,
          porcentaje_bonificacion,
          monto_adicional,
          motivo,
          fecha_entrega,
          estado,
          created_at,
          created_by
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setBonificaciones((data as BonificacionRow[]) || []);
    } catch (err: any) {
      console.error("Error cargando bonificaciones:", err?.message || err);
      setMessage({
        type: "error",
        text: `❌ Error al cargar bonificaciones: ${err?.message ?? "Intente nuevamente"}`,
      });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (canUsePage) {
      fetchBonificaciones();
    }
  }, [canUsePage, user?.id]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canUsePage) return;
    if (!validate()) return;

    if (!user?.id) {
      setMessage({
        type: "error",
        text: "❌ No se encontró user.id (usuarios_app.id). Revisá tu AuthContext/login.",
      });
      return;
    }

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
        fecha_entrega: formData.fechaEntrega,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("bonificaciones")
        .insert(payload)
        .select(
          `
          id,
          cliente,
          articulo,
          bultos,
          porcentaje_bonificacion,
          monto_adicional,
          motivo,
          fecha_entrega,
          estado,
          created_at,
          created_by
        `
        )
        .single();

      if (error) throw error;

      setMessage({ type: "success", text: "✅ Bonificación registrada correctamente" });

      setFormData({
        cliente: "",
        articulo: "",
        bultos: "",
        porcentajeBonificacion: "",
        montoAdicional: "",
        motivo: "",
        fechaEntrega: minFechaEntrega,
      });
      setErrors({});

      if (data) {
        setBonificaciones((prev) => [data as BonificacionRow, ...prev].slice(0, 50));
      } else {
        fetchBonificaciones();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: `❌ Error al guardar: ${err?.message ?? "Intente nuevamente"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleEstado = async (id: string, estadoActual: string | null) => {
    const nuevoEstado: EstadoBonificacion =
      estadoActual === "aprobado" ? "pendiente" : "aprobado";

    const prevRows = bonificaciones;

    setTogglingId(id);
    setMessage(null);

    setBonificaciones((prev) =>
      prev.map((row) => (row.id === id ? { ...row, estado: nuevoEstado } : row))
    );

    try {
      const { error } = await supabase
        .from("bonificaciones")
        .update({ estado: nuevoEstado })
        .eq("id", id);

      if (error) throw error;

      setMessage({
        type: "success",
        text:
          nuevoEstado === "aprobado"
            ? "✅ Bonificación aprobada correctamente"
            : "✅ Bonificación devuelta a pendiente correctamente",
      });
    } catch (err: any) {
      setBonificaciones(prevRows);
      setMessage({
        type: "error",
        text: `❌ Error al cambiar estado: ${err?.message ?? "Intente nuevamente"}`,
      });
    } finally {
      setTogglingId(null);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* FORMULARIO */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-6">
            <div className="bg-red-100 rounded-full p-2 mr-3">
              <Save className="h-6 w-6 text-red-700" />
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
                <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
              )}
              <span className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                {message.text}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 mr-1" /> Cliente
                <span className="text-red-500 ml-1">*</span>
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

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 mr-1" /> Artículo
                <span className="text-red-500 ml-1">*</span>
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

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 mr-1" /> Bultos
                <span className="text-red-500 ml-1">*</span>
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

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 mr-1" /> %Bonificación
                <span className="text-red-500 ml-1">*</span>
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

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 mr-1" /> Monto Adicional de Dinero
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
              {errors.montoAdicional && (
                <p className="mt-1 text-sm text-red-600">{errors.montoAdicional}</p>
              )}
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 mr-1" /> Fecha de entrega
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="date"
                min={minFechaEntrega}
                value={formData.fechaEntrega}
                onChange={(e) => setField("fechaEntrega", e.target.value)}
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  errors.fechaEntrega ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              />
              {errors.fechaEntrega && (
                <p className="mt-1 text-sm text-red-600">{errors.fechaEntrega}</p>
              )}
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 mr-1" /> Motivo
                <span className="text-red-500 ml-1">*</span>
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
                className={`w-full flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium transition-all ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Bonificación
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> Se guardará en Supabase con estado{" "}
              <code>pendiente</code>. En la tabla de abajo podés tocar el estado y cambiarlo de{" "}
              <code>pendiente</code> a <code>aprobado</code>, y también volverlo otra vez a{" "}
              <code>pendiente</code>.
            </p>
          </div>
        </div>

        {/* LISTADO */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bonificaciones cargadas</h2>
              <p className="text-gray-600">Tocá el estado para aprobar o volver a pendiente</p>
            </div>

            <button
              type="button"
              onClick={fetchBonificaciones}
              disabled={loadingList}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingList ? "animate-spin" : ""}`} />
              Recargar
            </button>
          </div>

          {loadingList ? (
            <div className="py-10 text-center text-gray-500">Cargando bonificaciones...</div>
          ) : bonificaciones.length === 0 ? (
            <div className="py-10 text-center text-gray-500">No hay bonificaciones cargadas.</div>
          ) : (
            <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1">
              {bonificaciones.map((item) => {
                const estadoActual: EstadoBonificacion =
                  item.estado === "aprobado" ? "aprobado" : "pendiente";

                const isUpdating = togglingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{item.cliente}</h3>
                        <p className="text-sm text-gray-500">{item.articulo}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleEstado(item.id, item.estado)}
                        disabled={isUpdating}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                          estadoActual === "aprobado"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        } ${isUpdating ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {isUpdating
                          ? "Guardando..."
                          : estadoActual === "aprobado"
                          ? "Aprobado"
                          : "Pendiente"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Bultos:</span>{" "}
                        <span className="font-medium text-gray-900">{item.bultos}</span>
                      </div>

                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">% Bonificación:</span>{" "}
                        <span className="font-medium text-gray-900">
                          {item.porcentaje_bonificacion}
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Monto adicional:</span>{" "}
                        <span className="font-medium text-gray-900">
                          ${Number(item.monto_adicional || 0).toLocaleString("es-AR")}
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Fecha entrega:</span>{" "}
                        <span className="font-medium text-gray-900">
                          {formatDate(item.fecha_entrega)}
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-lg px-3 py-2 sm:col-span-2">
                        <span className="text-gray-500">Motivo:</span>{" "}
                        <span className="font-medium text-gray-900">{item.motivo}</span>
                      </div>

                      <div className="bg-gray-50 rounded-lg px-3 py-2 sm:col-span-2">
                        <span className="text-gray-500">Creado:</span>{" "}
                        <span className="font-medium text-gray-900">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bonificaciones;
