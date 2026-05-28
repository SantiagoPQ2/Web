import React, { useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

const AltaClientePage: React.FC = () => {
  const { user } = useAuth();

  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [calle, setCalle] = useState("");
  const [altura, setAltura] = useState("");
  const [horarios, setHorarios] = useState("");
  const [facturacion, setFacturacion] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState("");
  const [ruta, setRuta] = useState("");
  const [diaVisita, setDiaVisita] = useState("");
  const [loading, setLoading] = useState(false);
  const [obteniendo, setObteniendo] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const handleObtenerCoordenadas = () => {
    if (!navigator.geolocation) {
      alert("❌ Tu navegador no soporta geolocalización");
      return;
    }
    setObteniendo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setObteniendo(false);
      },
      (err) => {
        alert("❌ Error obteniendo ubicación: " + err.message);
        setObteniendo(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!razonSocial || !cuit || !calle || !altura) {
      alert("⚠️ Completá los campos obligatorios: Razón Social, CUIT, Calle y Altura.");
      return;
    }

    const soloNumerosCuit = cuit.replace(/\D/g, "");
    if (soloNumerosCuit.length !== 11) {
      alert("⚠️ El CUIT debe tener exactamente 11 dígitos numéricos.");
      return;
    }

    if (!user) {
      alert("No hay usuario logueado.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("alta_de_clientes").insert([
        {
          razon_social: razonSocial,
          cuit: soloNumerosCuit,
          nombre_fantasia: nombreFantasia || null,
          calle,
          altura,
          horarios: horarios || null,
          facturacion: facturacion || null,
          tipo_negocio: tipoNegocio || null,
          ruta: ruta || null,
          dia_visita: diaVisita || null,
          vendedor_id: user.id,
          vendedor_nombre: user.name ?? user.username ?? "sin_nombre",
          vendedor_username: user.username ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
      ]);

      if (error) {
        console.error(error);
        alert("❌ Error al guardar el alta: " + error.message);
        return;
      }

      alert("✅ Alta de cliente registrada correctamente");

      // Reset
      setRazonSocial("");
      setCuit("");
      setNombreFantasia("");
      setCalle("");
      setAltura("");
      setHorarios("");
      setFacturacion("");
      setTipoNegocio("");
      setRuta("");
      setDiaVisita("");
      setCoords(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 shadow rounded-lg">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">
        Alta de Clientes
      </h2>

      <div className="space-y-4">
        {/* Razón Social */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Razón Social <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Nombre legal del negocio"
          />
        </div>

        {/* CUIT */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            CUIT <span className="text-red-500">*</span>{" "}
            <span className="text-xs text-gray-400">(11 dígitos)</span>
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={cuit}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 11);
              setCuit(val);
            }}
            placeholder="Ej: 20123456789"
            inputMode="numeric"
            maxLength={11}
          />
          {cuit.length > 0 && cuit.length !== 11 && (
            <p className="text-xs text-red-500 mt-1">
              {cuit.length}/11 dígitos
            </p>
          )}
        </div>

        {/* Nombre de Fantasía */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre de Fantasía
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={nombreFantasia}
            onChange={(e) => setNombreFantasia(e.target.value)}
            placeholder="Nombre comercial (opcional)"
          />
        </div>

        {/* Dirección: Calle + Altura */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Dirección <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 p-2 border rounded dark:bg-gray-800 dark:text-white dark:border-gray-600"
              value={calle}
              onChange={(e) => setCalle(e.target.value)}
              placeholder="Calle"
            />
            <input
              className="w-28 p-2 border rounded dark:bg-gray-800 dark:text-white dark:border-gray-600"
              value={altura}
              onChange={(e) => setAltura(e.target.value.replace(/\D/g, ""))}
              placeholder="Altura"
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Horarios */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Horarios
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={horarios}
            onChange={(e) => setHorarios(e.target.value)}
            placeholder="Ej: Lun-Vie 9-18hs"
          />
        </div>

        {/* Facturación */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Facturación
          </label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={facturacion}
            onChange={(e) => setFacturacion(e.target.value)}
          >
            <option value="">Seleccione...</option>
            <option value="Responsable Inscripto">Responsable Inscripto</option>
            <option value="Monotributista">Monotributista</option>
            <option value="Consumidor Final">Consumidor Final</option>
            <option value="Exento">Exento</option>
          </select>
        </div>

        {/* Tipo de Negocio */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipo de Negocio
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={tipoNegocio}
            onChange={(e) => setTipoNegocio(e.target.value)}
            placeholder="Ej: Almacén, Kiosco, Supermercado..."
          />
        </div>

        {/* Ruta */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Ruta
          </label>
          <input
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={ruta}
            onChange={(e) => setRuta(e.target.value)}
            placeholder="Número o nombre de ruta"
          />
        </div>

        {/* Día de Visita */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Día de Visita
          </label>
          <select
            className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={diaVisita}
            onChange={(e) => setDiaVisita(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {diasSemana.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Vendedor (solo lectura) */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Vendedor
          </label>
          <input
            className="w-full p-2 border rounded mt-1 bg-gray-100 dark:bg-gray-700 dark:text-white dark:border-gray-600 cursor-not-allowed"
            value={user?.name ?? user?.username ?? ""}
            readOnly
          />
        </div>

        {/* Geolocalización */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Geolocalización
          </label>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={handleObtenerCoordenadas}
              disabled={obteniendo}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                obteniendo
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {obteniendo ? "Obteniendo..." : "📍 Obtener Coordenadas"}
            </button>
            {coords && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✅ Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
              </span>
            )}
            {!coords && (
              <span className="text-xs text-gray-400">Sin coordenadas</span>
            )}
          </div>
        </div>

        {/* Botón Subir */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full p-3 rounded font-medium text-white transition ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Guardando..." : "Subir"}
        </button>
      </div>
    </div>
  );
};

export default AltaClientePage;
