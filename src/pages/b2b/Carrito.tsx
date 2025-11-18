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

const CarritoB2B: React.FC = () => {
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [productos, setProductos] = useState<Producto[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem("carrito_b2b");
    if (data) setCarrito(JSON.parse(data));
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [carrito]);

  const guardarCarrito = (nuevo: Record<string, number>) => {
    setCarrito(nuevo);
    localStorage.setItem("carrito_b2b", JSON.stringify(nuevo));
  };

  const cargarProductos = async () => {
    const ids = Object.keys(carrito);
    if (ids.length === 0) return setProductos([]);

    const { data } = await supabase
      .from("z_productos")
      .select("*")
      .in("id", ids);

    setProductos((data as Producto[]) || []);
  };

  const total = productos.reduce(
    (acc, p) => acc + p.precio * (carrito[p.id] || 0),
    0
  );

  const cambiarCantidad = (id: string, nuevaCantidad: number) => {
    const current = carrito[id] || 0;
    if (nuevaCantidad <= 0) {
      const copia = { ...carrito };
      delete copia[id];
      guardarCarrito(copia);
      return;
    }
    if (current === nuevaCantidad) return;
    guardarCarrito({ ...carrito, [id]: nuevaCantidad });
  };

  const finalizarPedido = async () => {
    if (productos.length === 0) return;

    const { data: pedido, error } = await supabase
      .from("z_pedidos")
      .insert({
        created_by: "admin", // luego podemos reemplazar por user.username
        total: total,
      })
      .select()
      .single();

    if (error || !pedido) {
      alert("Error al crear pedido");
      console.error(error);
      return;
    }

    for (const p of productos) {
      const cantidad = carrito[p.id] || 0;
      if (!cantidad) continue;

      await supabase.from("z_pedido_items").insert({
        pedido_id: pedido.id,
        producto_id: p.id,
        articulo: p.articulo,
        nombre: p.nombre,
        cantidad: cantidad,
        precio_unitario: p.precio,
        subtotal: p.precio * cantidad,
      });
    }

    localStorage.removeItem("carrito_b2b");
    setCarrito({});
    alert("Pedido creado correctamente");
    navigate("/b2b/pedidos");
  };

  const totalItems = Object.values(carrito).reduce(
    (acc, v) => acc + (v || 0),
    0
  );

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Carrito B2B
            </h2>
            <p className="text-sm text-gray-500">
              Revisá los productos antes de confirmar el pedido.
            </p>
          </div>

          <button
            onClick={() => navigate("/b2b/catalogo")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
          >
            ← Seguir comprando
          </button>
        </div>

        {productos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            Tu carrito está vacío.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de items */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-100">
              <div className="border-b border-gray-100 px-4 py-3 flex justify-between text-sm text-gray-500">
                <span>Productos ({totalItems})</span>
                <span>Subtotal</span>
              </div>

              <div className="divide-y divide-gray-100">
                {productos.map((p) => {
                  const qty = carrito[p.id] || 0;
                  const subtotal = p.precio * qty;

                  return (
                    <div
                      key={p.id}
                      className="px-4 py-3 flex items-center gap-3 sm:gap-4"
                    >
                      {/* Imagen */}
                      <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400 text-center px-1">
                            {p.articulo}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                              {p.nombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {p.marca} • {p.categoria}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Precio unitario:{" "}
                              <span className="font-semibold text-gray-700">
                                $
                                {p.precio?.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-600">
                              $
                              {subtotal.toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Controles */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="inline-flex items-center rounded-full border border-gray-200 overflow-hidden">
                            <button
                              onClick={() =>
                                cambiarCantidad(p.id, qty - 1)
                              }
                              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                            >
                              −
                            </button>
                            <span className="px-3 py-1 text-sm font-semibold text-gray-800 min-w-[2rem] text-center">
                              {qty}
                            </span>
                            <button
                              onClick={() =>
                                cambiarCantidad(p.id, qty + 1)
                              }
                              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => cambiarCantidad(p.id, 0)}
                            className="text-xs text-gray-400 hover:text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Resumen del pedido
                </h3>
                <p className="text-xs text-gray-500">
                  Verificá los datos antes de confirmar.
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Productos</span>
                <span className="font-semibold text-gray-800">
                  {totalItems} ítems
                </span>
              </div>

              <div className="border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  Total
                </span>
                <span className="text-xl font-bold text-red-600">
                  $
                  {total.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <button
                onClick={finalizarPedido}
                disabled={productos.length === 0}
                className={`mt-2 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold shadow-md transition
                  ${
                    productos.length === 0
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
              >
                Confirmar pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarritoB2B;
