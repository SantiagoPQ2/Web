import React, { useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

const BajaClienteCambioRuta: React.FC = () => {
  const { user } = useAuth();

  const [cliente, setCliente] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [loading, setLoading] = useState(false);

  const motivos = ["Cierre", "Duplicado", "Cambio de ruta", "Otro"];

  const handleSubmit = async () => {
    if (!cliente || !razonSocial || !motivo) {
      alert("Complete todos los campos obligatorios");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("bajas_cambio_ruta").insert([
      {
        cliente,
        razon_social: razonSocial,
        motivo,
        detalle,
        vendedor_nombre: user?.name ?? user?.username ?? "sin_nombre",
      },
    ]);

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Error al registrar la solicitud");
    } else {
      alert("Solicitud registrada correctamente");
      setCliente("");
      setRazonSocial("");
      setMotivo("");
      setDetalle("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 shadow rounded-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        Baja Cliente / Cambio de Ruta
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Cliente *</label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Razón Social *</label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Motivo *</label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {motivos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">
            {motivo === "Duplicado"
              ? "Código original del cliente"
              : motivo === "Cambio de ruta"
              ? "Nueva ruta"
              : "Detalle adicional"}
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-red-600 text-white p-3 rounded hover:bg-red-700 transition"
        >
          {loading ? "Guardando..." : "Enviar Solicitud"}
        </button>
      </div>
    </div>
  );
};

export default BajaClienteCambioRuta;
