import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { Upload, Trash2, Save, Filter, FileDown, ChevronLeft, ChevronRight } from "lucide-react";

interface TableInfo {
  name: string;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <p className="p-6 text-center text-gray-600">Cargando usuario...</p>;
  const esAdmin = user?.role?.toLowerCase().trim() === "admin";
  if (!esAdmin)
    return (
      <p className="p-6 text-center text-gray-600">
        Acceso restringido — solo disponible para administradores.
      </p>
    );

  const [tablas, setTablas] = useState<TableInfo[]>([]);
  const [tablaSeleccionada, setTablaSeleccionada] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [datos, setDatos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<Record<number, any>>({});

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 15;
  const totalPaginas = Math.ceil(datos.length / registrosPorPagina);
  const datosPagina = datos.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina);

  // Cargar tablas
  useEffect(() => {
    setTablas([
      { name: "usuarios_app" },
      { name: "top_5" },
      { name: "coordenadas" },
      { name: "visitas_planificadas" },
      { name: "resumenes_diarios" },
    ]);

    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);
    setFechaDesde(hace7.toISOString().slice(0, 10));
    setFechaHasta(hoy.toISOString().slice(0, 10));
  }, []);

  // Filtrar
  const filtrarPorFecha = async () => {
    if (!tablaSeleccionada) return alert("Selecciona una tabla primero");
    if (!fechaDesde || !fechaHasta) return alert("Selecciona un rango de fechas");

    setCargando(true);
    const { data, error } = await supabase
      .from(tablaSeleccionada)
      .select("*")
      .gte("created_at", fechaDesde)
      .lte("created_at", fechaHasta)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) alert("Error al filtrar datos: " + error.message);
    else {
      setDatos(data || []);
      setPaginaActual(1);
    }
    setCargando(false);
  };

  // Subir CSV
  const handleUpload = async (file: File) => {
    if (!tablaSeleccionada) return alert("Selecciona una tabla primero");
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const { error } = await supabase.from(tablaSeleccionada).insert(results.data);
        if (error) alert("Error al cargar CSV: " + error.message);
        else {
          alert("Datos cargados correctamente ✅");
          filtrarPorFecha();
        }
      },
    });
  };

  // Exportar
  const exportarXLSX = () => {
    if (!datos.length) return alert("No hay datos para exportar");
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tablaSeleccionada || "Datos");
    XLSX.writeFile(wb, `${tablaSeleccionada || "export"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Edición
  const handleChange = (id: number, campo: string, valor: any) => {
    setEditando({
      ...editando,
      [id]: { ...editando[id], [campo]: valor },
    });
  };

  const guardarCambios = async (id: number) => {
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
      filtrarPorFecha();
    }
  };

  // Eliminar
  const eliminarFila = async (id: any) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta fila?")) return;
    const { error } = await supabase.from(tablaSeleccionada).delete().eq("id", id);
    if (error) alert("Error al eliminar: " + error.message);
    else setDatos(datos.filter((d) => d.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Panel de Administración</h1>

      {/* FILTROS */}
      <div className="bg-white border rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter size={18} /> Filtros de búsqueda
          </h2>
          <div className="flex gap-3">
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
            <button
              onClick={exportarXLSX}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
            >
              <FileDown size={18} /> Exportar XLSX
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tabla</label>
            <select
              value={tablaSeleccionada}
              onChange={(e) => setTablaSeleccionada(e.target.value)}
              className="border rounded-lg px-4 py-2 shadow-sm"
            >
              <option value="">Seleccionar tabla...</option>
              {tablas.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="border rounded-lg px-4 py-2 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="border rounded-lg px-4 py-2 shadow-sm"
            />
          </div>

          <button
            onClick={filtrarPorFecha}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
          >
            Procesar
          </button>
        </div>
      </div>

      {/* TABLA */}
      {cargando ? (
        <p className="text-gray-600">Cargando datos...</p>
      ) : (
        datos.length > 0 && (
          <div className="overflow-auto border rounded-lg shadow-sm bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {Object.keys(datos[0]).map((col) => (
                    <th key={col} className="border px-3 py-2 text-gray-600 text-left">
                      {col}
                    </th>
                  ))}
                  <th className="border px-3 py-2 text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datosPagina.map((fila) => (
                  <tr key={fila.id} className="hover:bg-gray-50">
                    {Object.entries(fila).map(([campo, valor]) => (
                      <td key={campo} className="border px-3 py-2">
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

            {/* Paginación */}
            <div className="flex justify-center items-center gap-4 py-3 bg-gray-50 border-t">
              <button
                onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                className="p-2 text-gray-600 hover:text-red-600 disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-700">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="p-2 text-gray-600 hover:text-red-600 disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default AdminPanel;
