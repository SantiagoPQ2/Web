import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

interface Top5 {
  cliente: string;
  diferencia: number;
  categoria: string;
}

export default function TuDia() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState<Top5[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      const dayName = new Date().toLocaleDateString("es-ES", { weekday: "long" }); 
      const dia = dayName.charAt(0).toUpperCase() + dayName.slice(1); // "Lunes"

      const { data, error } = await supabase
        .from("top_5")
        .select("cliente, diferencia, categoria")
        .eq("vendedor_username", user.username)
        .eq("dia", dia);

      if (!error && data) {
        setTareas(data);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (loading) return <p>⏳ Cargando...</p>;

  if (tareas.length === 0) return <p>Hoy no tenés clientes asignados en Top 5</p>;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="text-lg font-bold text-red-700 mb-4">📊 Top 5 Clientes de Hoy</h2>
      {tareas.map((t, i) => (
        <p key={i} className="text-gray-800">
          📌 Tenes que visitar al cliente <b>{t.cliente}</b>, la diferencia para
          recuperar es de <b>{t.diferencia.toLocaleString("es-AR")}</b> y la
          categoría a atacar es <b>{t.categoria}</b>.
        </p>
      ))}
    </div>
  );
}
