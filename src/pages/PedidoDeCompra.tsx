import React, { useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

const PedidoDeCompra: React.FC = () => {
  const { user } = useAuth();

  const [queEs, setQueEs] = useState("");
  const [tipoGasto, setTipoGasto] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [detalleAdicional, setDetalleAdicional] = useState("");
  const [montoEstimado, setMontoEstimado] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const tiposGasto = [
    "Gaseosas/festejos",
    "Cadete",
    "Insumos Marca propia",
    "Insumos Computacion",
    "Insumos Logistica",
    "Insumos Oficina",
    "Insumos RRHH",
    "Jardinero",
    "Libreria",
    "Limpieza",
    "Mantenimiento Camioneta",
    "Marketing",
    "Otros",
    "Reparaciones Deposito/Oficinas",
    "Representacion Comercial",
    "RRHH",
    "Telefono",
  ];

  const urgencias = ["Se para la operacion", "Compra Habitual", "Reparacion"];

  const montos = ["0-50K", "50-300K", "300K a +"];

  const handleSubmit = async () => {
    if (!queEs || !tipoGasto || !urgencia || !montoEstimado) {
      alert("Complete todos los campos obligatorios");
      return;
    }

    if (!user) {
      alert("No hay usuario logueado");
      return;
    }

    setLoading(true);

    // --------------------------
    // SUBIR FOTO (si existe)
    // --------------------------
    let fotoUrl: string | null = null;

    try {
      if (foto) {
        const fileExt = foto.name.split(".").pop() || "jpg";
        const fileName = `compra_${Date.now()}.${fileExt}`;
        const filePath = `${user?.username}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat_uploads")
          .upload(filePath, foto, {
            upsert: false,
            contentType: foto.type || "image/*",
          });

        if (uploadError) {
          console.error(uploadError);
          alert("Error subiendo la foto");
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(filePath);

        fotoUrl = urlData.publicUrl;
      }

      // --------------------------
      // INSERTAR PEDIDO DE COMPRA
      // --------------------------
      const { error: insertError } = await supabase
        .from("pedidos_compra")
        .insert([
          {
            que_es: queEs,
            tipo_gasto: tipoGasto,
            urgencia,
            detalle_adicional: detalleAdicional || null,
            monto_total_estimado: montoEstimado,
            vendedor_nombre: user?.name ?? user?.username ?? "sin_nombre",
            vendedor_username: user?.username ?? null,
            foto_url: fotoUrl,
            aprobado: false,
            supervisor_nombre: null,
            estado: "pendiente",
          },
        ]);

      if (insertError) {
        console.error(insertError);
        alert("Error al registrar el pedido");
        setLoading(false);
        return;
      }

      // --------------------------
      // NOTIFICACIONES A SUPERVISORES
      // --------------------------
      const { data: supervisores, error: supError } = await supabase
        .from("usuarios_app")
        .select("username, name, role")
        .eq("role", "supervisor");

      if (supError) {
        // No frenamos el flujo si falla la notificación
        console.error("Error buscando supervisores:", supError);
      } else if (supervisores && supervisores.length > 0) {
        const titulo = "Nuevo pedido de compra";
        const mensaje = `${
          user?.name ?? user?.username ?? "Un vendedor"
        } cargó un pedido de compra: ${queEs}. Tipo: ${tipoGasto}. Urgencia: ${urgencia}. Monto: ${montoEstimado}${
          detalleAdicional ? ` (Detalle: ${detalleAdicional})` : ""
        }`;

        const notis = supervisores.map((s) => ({
          usuario_username: s.username,
          titulo,
          mensaje,
          leida: false,
        }));

        const { error: notiError } = await supabase
          .from("notificaciones")
          .insert(notis);

        if (notiError) console.error("Error insertando notificaciones:", notiError);
      }

      alert("Pedido registrado correctamente");

      // Reset
      setQueEs("");
      setTipoGasto("");
      setUrgencia("");
      setDetalleAdicional("");
      setMontoEstimado("");
      setFoto(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 shadow rounded-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        Pedido de Compra
      </h2>

      <div className="space-y-4">
        {/* 1) Qué es */}
        <div>
          <label className="text-sm font-medium">¿Qué es? *</label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={queEs}
            onChange={(e) => setQueEs(e.target.value)}
            placeholder="Ej: compra de insumos para..."
          />
        </div>

        {/* 2) Tipo de gasto */}
        <div>
          <label className="text-sm font-medium">Tipo de Gasto *</label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={tipoGasto}
            onChange={(e) => setTipoGasto(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {tiposGasto.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 3) Urgencia */}
        <div>
          <label className="text-sm font-medium">Urgencia *</label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={urgencia}
            onChange={(e) => setUrgencia(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {urgencias.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* 4) Detalle adicional */}
        <div>
          <label className="text-sm font-medium">Detalle Adicional</label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={detalleAdicional}
            onChange={(e) => setDetalleAdicional(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        {/* 5) Monto total estimado */}
        <div>
          <label className="text-sm font-medium">Monto Total Estimado *</label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={montoEstimado}
            onChange={(e) => setMontoEstimado(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {montos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 6) Foto */}
        <div>
          <label className="text-sm font-medium">Foto (opcional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-emerald-600 text-white p-3 rounded hover:bg-emerald-700 transition"
        >
          {loading ? "Guardando..." : "Enviar Pedido"}
        </button>
      </div>
    </div>
  );
};

export default PedidoDeCompra;
