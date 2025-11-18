import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { useNavigate } from "react-router-dom";

interface Producto {
  id: string;
  articulo: string;
  nombre: string;
  marca: string;
  categoria: string;
  precio: number;
  stock: number;
  imagen_url?: string;
}

const CatalogoB2B: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Record<string, number>>({});

  // animación por producto
  const [btnAnimacion, setBtnAnimacion] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();

  useEffect(() => {
    cargarProductos();
    cargarCarrito();
  }, []);

  const cargarCarrito = () => {
    const data = localStorage.getItem("carrito_b2b");
    if (data) setCarrito(JSON.parse(data));
  };

  const guardarCarrito = (nuevo: Record<string, number>) => {
    setCarrito(nuevo);
    localStorage.setItem("carrito_b2b", JSON.stringify(nuevo));
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from("z_productos")
      .select("*")
      .eq("activo", true);

    if (error) console.error("Error cargando productos:", error);
    if (data) setProductos(data);
  };

  const agregarAlCarrito = (id: string) => {
    // seteo animación
    setBtnAnimacion((prev) => ({ ...prev, [id]: true }));

    // desactivo animación 300ms
    setTimeout(() => {
      setBtnAnimacion((prev) => ({ ...prev, [id]: false }));
    }, 300);

    // actualizo carrito
    const nuevo = { ...carrito, [id]: (carrito[id] || 0) + 1 };
    guardarCarrito(nuevo);
  };

  const totalItems = Object.values(carrito).reduce(
    (acc, v) => acc + (v || 0),
    0
  );

  const filtrados = productos.filter((p) => {
    return (
      (filtroMarca ? p.marca === filtroMarca : true) &&
      (filtroCategoria ? p.categoria === filtroCategoria : true) &&
      (busqueda
        ? p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          p.articulo.toLowerCase().includes(busqueda.toLowerCase())
        : true)
    );
  });

  const marcas = Array.from(new Set(productos.map((p) => p.marca).filter(Boolean)));
  const categorias = Array.from(
    new Set(productos.map((p) => p.categoria).filter(Boolean))
  );

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Catálogo B2B
            </h2>
            <p className="text-sm text-gray-500">
              Explorá productos y armá tu pedido.
            </p>
          </div>

          <button
            onClick={() => navigate("/b2b/carrito")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold shadow-md hover:bg-red-700 transition"
          >
            <span>Ver carrito</span>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-red-600 text-xs font-bold">
              {totalItems}
            </span>
          </button>
        </div>

        {/* Layout principal: sidebar + productos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* SIDEBAR FILTROS */}
          <div className="md:col-span-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-fit sticky top-20">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Filtros
            </h3>

            {/* Buscador */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Buscar
              </label>
              <input
                placeholder="Nombre, código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="mt-1 w-full px-3 py-2 mb-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Marca */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Marca
              </label>
              <select
                value={filtroMarca}
                onChange={(e) => setFiltroMarca(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Todas</option>
                {marcas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div className="mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Categoría
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* GRID DE PRODUCTOS */}
          <div className="md:col-span-3">
            {filtrados.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8 bg-white rounded-xl shadow-sm">
                No hay productos para mostrar.
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {filtrados.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Imagen */}
                    <div className="h-36 bg-gray-50 flex items-center justify-center">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-center px-4">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Sin imagen
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Código: {p.articulo}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 flex flex-col p-4">

                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {p.nombre}
                      </h3>

                      <p className="text-xs text-gray-500 mt-1 mb-2">
                        {p.marca} • {p.categoria}
                      </p>

                      <div className="mt-auto flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase">
                            Precio
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            ${p.precio.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>

                        <button
                          disabled={p.stock <= 0}
                          onClick={() => agregarAlCarrito(p.id)}
                          className={`
                            px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition 
                            ${
                              p.stock <= 0
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : btnAnimacion[p.id]
                                ? "bg-gray-300 text-gray-700 scale-105"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }
                          `}
                        >
                          {btnAnimacion[p.id] ? "Añadido ✔" : "Agregar"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default CatalogoB2B;
