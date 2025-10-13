import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { Upload, Trash2, Save } from "lucide-react";

interface TableInfo {
  name: string;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const esAdmin = user?.role === "admin";

  const [tablas, setTablas] = useState<TableInfo[]>([]);
  const [tablaSeleccionada, setTablaSeleccionada] = useState<string>("");
  const [datos, setDatos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<Record<number, any>>({});

  // 🔒 Si no es admin, redirige
  if (!esAdmin) return <Navigate to="/home" replace />;

  // 🧾 Cargar listado de tablas (puede venir de un RPC o lista fija)
  useEffect(() => {
    const fetchTables = async () => {
      try {
        // Si tenés un RPC para traer nombres de tablas, podés usarlo acá
        const { data, error } = await supabase.rpc("get_tablas_disponibles");
        if (!error && data) setTablas(data);
        else {
          // Fallback manual
          setTablas([
            { name: "usuarios_app" },
            { name: "top_5" },
            { name: "coordenadas" },
            { name: "visitas_planificadas" },
            { name: "resumenes_diarios" },
          ]);
        }
      } catch (e) {
        console.error("Error cargando tablas", e);
      }
    };
    fetchTables();
  }, []);

  // 📥 Cargar datos de una tabla
  const cargarTabla = async (tabla: string) => {
    setCargando(true);
    const { data, error } = await supabase.from(tabla).select("*").limit(1000);
    if (error) alert("Error al obtener datos: " + error.message);
    else setDatos(data || []);
    setCargando(false);
  };

  // 📤 Subir CSV e insertar datos
  const handleUpload = async (file: File) => {
    if (!tablaSeleccionada) return alert("Selecciona una tabla primero");
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const { error } = await supabase.from(tablaSeleccionada).insert(results.data);
        if (error) alert("Error al cargar CSV: " + error.message);
        else {
          alert("Datos cargados correctamente ✅");
          cargarTabla(tablaSeleccionada);
        }
      },
    });
  };

  // ❌ Eliminar fila
  const eliminarFila = async (id: any) => {
    if (!tablaSeleccionada) return;
    if (!window.confirm("¿Seguro que deseas eliminar esta fila?")) return;
    const { error } = await supabase.from(tablaSeleccionada).delete().eq("id", id);
    if (error) alert("Error al eliminar: " + error.message);
    else setDatos(datos.filter((d) => d.id !== id));
  };

  // ✏️ Editar celda localmente
  const handleChange = (id: number, campo: string, valor: any) => {
    setEditando({
      ...editando,
      [id]: { ...editando[id], [campo]: valor },
    });
  };

  // 💾 Guardar cambios
  const guardarCambios = async (id: number) => {
    if (!tablaSeleccionada) return;
    const cambios = editando[id];
    const { error } = await supabase.from(tablaSeleccionada).update(cambios).eq("id", id);
    if (error) alert("Error al guardar: " + error.message);
    else {
      alert("Fila actualizada ✅");
      setEditando((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      cargarTabla(tablaSeleccionada);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Panel de Administración</h1>

      {/* 🔹 Selector de tabla + botón de carga CSV */}
      <div className="mb-6 flex gap-4 items-center flex-wrap">
        <select
          value={tablaSeleccionada}
          onChange={(e) => {
            setTablaSeleccionada(e.target.value);
            cargarTabla(e.target.value);
          }}
          className="border rounded-lg px-4 py-2 shadow-sm"
        >
          <option value="">Seleccionar tabla...</option>
          {tablas.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg">
          <Upload size={18} />
          Subir CSV
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
            className="hidden"
          />
        </label>
      </div>

      {/* 📊 Tabla con edición inline */}
      {cargando ? (
        <p className="text-gray-600">Cargando datos...</p>
      ) : (
        tablaSeleccionada &&
        datos.length > 0 && (
          <div className="overflow-auto border rounded-lg shadow-sm">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(datos[0]).map((col) => (
                    <th key={col} className="border px-3 py-2 text-sm text-gray-600">
                      {col}
                    </th>
                  ))}
                  <th className="border px-3 py-2 text-sm">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((fila) => (
                  <tr key={fila.id} className="hover:bg-gray-50">
                    {Object.entries(fila).map(([campo, valor]) => (
                      <td key={campo} className="border px-3 py-2 text-sm">
                        <input
                          className="w-full bg-transparent border-none outline-none"
                          value={
                            editando[fila.id]?.[campo] !== undefined
                              ? editando[fila.id][campo]
                              : valor ?? ""
                          }
                          onChange={(e) => handleChange(fila.id, campo, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border px-3 py-2 text-center">
                      <button
                        onClick={() => guardarCambios(fila.id)}
                        className="text-green-600 hover:text-green-800 mr-2"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => eliminarFila(fila.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default AdminPanel;
