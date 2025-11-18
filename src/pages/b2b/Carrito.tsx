import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { useNavigate } from "react-router-dom";

const CarritoB2B: React.FC = () => {
  const [carrito, setCarrito] = useState<any>({});
  const [productos, setProductos] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem("carrito_b2b");
    if (data) setCarrito(JSON.parse(data));
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [carrito]);

  const cargarProductos = async () => {
    const ids = Object.keys(carrito);

    if (ids.length === 0) return setProductos([]);

    const { data } = await supabase
      .schema("B2B")
      .from("z_productos")
      .select("*")
      .in("id", ids);

    setProductos(data || []);
  };

  const total = productos.reduce(
    (acc, p) => acc + p.precio * carrito[p.id],
    0
  );

  const finalizarPedido = async () => {
    const { data: pedido, error } = await supabase
      .schema("B2B")
      .from("z_pedidos")
      .insert({
        created_by: "admin",
        total: total,
      })
      .select()
      .single();

    if (error) {
      alert("Error al crear pedido");
      return;
    }

    for (const p of productos) {
      await supabase
        .schema("B2B")
        .from("z_pedido_items")
        .insert({
          pedido_id: pedido.id,
          producto_id: p.id,
          articulo: p.articulo,
          nombre: p.nombre,
          cantidad: carrito[p.id],
          precio_unitario: p.precio,
          subtotal: p.precio * carrito[p.id],
        });
    }

    localStorage.removeItem("carrito_b2b");
    setCarrito({});
    alert("Pedido creado correctamente");
    navigate("/b2b/pedidos");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🧺 Carrito B2B</h2>

      <button onClick={() => navigate("/b2b/catalogo")}>Volver al catálogo</button>

      {productos.length === 0 && <p>El carrito está vacío.</p>}

      {productos.map((p) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <b>{p.nombre}</b> — ${p.precio} x {carrito[p.id]}
        </div>
      ))}

      <h3>Total: ${total.toFixed(2)}</h3>

      {productos.length > 0 && (
        <button onClick={finalizarPedido} style={{ padding: 10, marginTop: 10 }}>
          Finalizar pedido
        </button>
      )}
    </div>
  );
};

export default CarritoB2B;
