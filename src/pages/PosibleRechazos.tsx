import React, { useState } from "react";
import { AlertCircle, CheckCircle, Save, Hash, DollarSign } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface FormData {
  numero_cliente: string;
  monto_aproximado: string;
}

interface FormErrors {
  numero_cliente?: string;
  monto_aproximado?: string;
}

type F96Row = {
  cliente: string | number;
  id: string | null;
  ffvv?: string | null;
  supervisor?: string | null;
};

type UsuarioAppRow = {
  id?: string;
  username?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  full_name?: string | null;
  name?: string | null;
};

const PosibleRechazos: React.FC = () => {
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    numero_cliente: "",
    monto_aproximado: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    if (message) {
      setMessage(null);
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!formData.numero_cliente.trim()) {
      newErrors.numero_cliente = "El número de cliente es obligatorio";
    }

    if (!formData.monto_aproximado.trim()) {
      newErrors.monto_aproximado = "El monto aproximado es obligatorio";
    } else {
      const monto = Number(formData.monto_aproximado);
      if (isNaN(monto) || monto <= 0) {
        newErrors.monto_aproximado = "Ingresá un monto válido mayor a 0";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const obtenerNombreVisibleRemitente = async () => {
    const username = user?.username?.trim();
    if (!username) return "Alguien";

    try {
      const { data, error } = await supabase
        .from("usuarios_app")
        .select("username, nombre, apellido, full_name, name")
        .eq("username", username)
        .maybeSingle();

      if (error) {
        console.error("Error leyendo usuarios_app:", error);
      }

      const row = data as UsuarioAppRow | null;

      const fullName =
        row?.full_name?.trim() ||
        [row?.nombre?.trim(), row?.apellido?.trim()].filter(Boolean).join(" ") ||
        row?.name?.trim();

      if (fullName) return fullName;

      return username;
    } catch (error) {
      console.error("Error obteniendo nombre visible del remitente:", error);
      return username;
    }
  };

  const crearNotificacionesYMensajes = async (
    numeroCliente: string,
    monto: number
  ) => {
    try {
      const clienteBuscado = numeroCliente.trim();

      const { data: f96Data, error: f96Error } = await supabase
        .from("f96")
        .select("cliente, id, ffvv, supervisor")
        .eq("cliente", clienteBuscado)
        .limit(1)
        .maybeSingle();

      if (f96Error) {
        console.error("Error leyendo tabla f96:", f96Error);
        return;
      }

      const fila = f96Data as F96Row | null;

      if (!fila) {
        console.warn(
          `No se encontró el cliente ${clienteBuscado} en la tabla f96`
        );
        return;
      }

      const vendedorId = fila.id?.toString().trim() || "";
      const supervisor = fila.supervisor?.toString().trim() || "";

      const destinatarios = Array.from(
        new Set([vendedorId, supervisor].filter(Boolean))
      );

      if (destinatarios.length === 0) {
        console.warn(
          `El cliente ${clienteBuscado} existe en f96 pero no tiene id/supervisor válidos`
        );
        return;
      }

      const remitenteUsername = user?.username?.trim() || "";
      const remitenteVisible = await obtenerNombreVisibleRemitente();

      if (!remitenteUsername) {
        console.warn("No hay username del usuario que carga el posible rechazo");
        return;
      }

      const textoMonto = monto.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      const mensajeVisible = `El ${remitenteVisible} informa que el cliente ${clienteBuscado} tiene un posible rechazo de $${textoMonto}`;

      const mensajeConMeta = `${mensajeVisible} [[CHAT_USER:${remitenteUsername}]]`;

      const notificacionesPayload = destinatarios.map((usuarioUsername) => ({
        usuario_username: usuarioUsername,
        titulo: "Posible rechazo cargado",
        mensaje: mensajeConMeta,
        leida: false,
      }));

      const { error: notiError } = await supabase
        .from("notificaciones")
        .insert(notificacionesPayload);

      if (notiError) {
        console.error("Error insertando notificaciones:", notiError);
      }

      const mensajesPayload = destinatarios.map((destinatario) => ({
        remitente_username: remitenteUsername,
        destinatario_username: destinatario,
        contenido: mensajeVisible,
        leido: false,
      }));

      const { error: chatError } = await supabase
        .from("mensajes")
        .insert(mensajesPayload);

      if (chatError) {
        console.error("Error insertando mensajes de chat:", chatError);
      }
    } catch (error) {
      console.error("Error creando notificaciones y mensajes:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setMessage(null);

    try {
      const numeroCliente = formData.numero_cliente.trim();
      const monto = Number(formData.monto_aproximado);

      const payload = {
        numero_cliente: numeroCliente,
        monto_aproximado: monto,
        creado_por_id: user?.id || null,
        creado_por_username: user?.username || null,
        creado_por_role: user?.role || null,
      };

      const { error } = await supabase
        .from("posibles_rechazos")
        .insert([payload]);

      if (error) {
        throw error;
      }

      await crearNotificacionesYMensajes(numeroCliente, monto);

      setMessage({
        type: "success",
        text: "Posible rechazo guardado correctamente.",
      });

      setFormData({
        numero_cliente: "",
        monto_aproximado: "",
      });
      setErrors({});
    } catch (error: any) {
      console.error("Error guardando posible rechazo:", error);
      setMessage({
        type: "error",
        text: error?.message || "No se pudo guardar el registro.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center mb-6">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <Save className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Posible Rechazos</h1>
            <p className="text-gray-600">
              Cargar número de cliente y monto aproximado
            </p>
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
            <span
              className={
                message.type === "success" ? "text-green-800" : "text-red-800"
              }
            >
              {message.text}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="numero_cliente"
              className="flex items-center text-sm font-medium text-gray-700 mb-2"
            >
              <Hash className="h-4 w-4 mr-1" />
              Número de cliente <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="numero_cliente"
              type="text"
              value={formData.numero_cliente}
              onChange={(e) => handleChange("numero_cliente", e.target.value)}
              placeholder="Ej: 12345"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.numero_cliente
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.numero_cliente && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.numero_cliente}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="monto_aproximado"
              className="flex items-center text-sm font-medium text-gray-700 mb-2"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Monto aproximado <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="monto_aproximado"
              type="number"
              min="0"
              step="0.01"
              value={formData.monto_aproximado}
              onChange={(e) =>
                handleChange("monto_aproximado", e.target.value)
              }
              placeholder="Ej: 150000"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.monto_aproximado
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {errors.monto_aproximado && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.monto_aproximado}
              </p>
            )}
          </div>

          <div className="pt-2">
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
                  Enviar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosibleRechazos;
