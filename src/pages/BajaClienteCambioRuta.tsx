import { useState } from "react";
import { supabase } from "../config/supabase";

export default function BajaClienteCambioRuta() {
  const [form, setForm] = useState({
    cliente: "",
    razon_social: "",
    motivo: "",
    detalle: ""
  });
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente || !form.razon_social || !form.motivo) return alert("Complete todos los campos obligatorios");

    setLoading(true);
    const { error } = await supabase.from("bajas_cambio_ruta").insert({
      ...form,
      vendedor_id: user.id,
      vendedor_nombre: user.name
    });

    setLoading(false);
    if (error) alert("Error al guardar: " + error.message);
    else {
      alert("Enviado correctamente ✅");
      setForm({ cliente: "", razon_social: "", motivo: "", detalle: "" });
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4 text-center">Baja Cliente - Cambio de Ruta</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Cliente *</label>
          <input type="text" name="cliente" value={form.cliente} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Razón Social *</label>
          <input type="text" name="razon_social" value={form.razon_social} onChange={handleChange} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Motivo *</label>
          <select name="motivo" value={form.motivo} onChange={handleChange} className="w-full border rounded p-2">
            <option value="">Seleccione</option>
            <option value="Cierre">Cierre</option>
            <option value="Duplicado">Duplicado</option>
            <option value="Cambio de ruta">Cambio de ruta</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Detalle</label>
          <textarea name="detalle" value={form.detalle} onChange={handleChange} className="w-full border rounded p-2" placeholder="Código duplicado, nueva ruta o comentario adicional" />
        </div>
        <button disabled={loading} type="submit" className="bg-red-600 text-white w-full py-2 rounded hover:bg-red-700">
          {loading ? "Guardando..." : "Guardar Registro"}
        </button>
      </form>
    </div>
  );
}
