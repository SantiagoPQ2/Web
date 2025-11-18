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
              Explorá el catálogo y armá pedidos de forma rápida y segura.
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

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-red-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Buscar
              </label>
              <input
                placeholder="Nombre, código o artículo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Marca
              </label>
              <select
                value={filtroMarca}
                onChange={(e) => setFiltroMarca(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Todas las marcas</option>
                {marcas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Categoría
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid de productos */}
        {filtrados.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8 bg-white rounded-xl shadow-sm">
            No se encontraron productos con los filtros seleccionados.
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Imagen */}
                <div className="h-32 sm:h-36 bg-gray-50 flex items-center justify-center">
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
                <div className="flex-1 flex flex-col p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {p.nombre}
                    </h3>
                    {p.stock <= 0 ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        Sin stock
                      </span>
                    ) : p.stock < 20 ? (
                      <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                        Stock bajo
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Stock OK
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-2">
                    {p.marca && (
                      <span className="font-medium text-gray-700">
                        {p.marca}
                      </span>
                    )}{" "}
                    {p.categoria && (
                      <>• <span>{p.categoria}</span></>
                    )}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase">
                        Precio unitario
                      </div>
                      <div className="text-lg font-bold text-red-600">
                        ${p.precio?.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Stock:{" "}
                        <span className="font-semibold text-gray-700">
                          {p.stock}
                        </span>
                      </div>
                    </div>

                    <button
                      disabled={p.stock <= 0}
                      onClick={() => agregarAlCarrito(p.id)}
                      className={`ml-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition
                        ${
                          p.stock <= 0
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }`}
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogoB2B;
