import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";

const PedidosB2B = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    const { data } = await supabase
      .schema("B2B")
      .from("z_pedidos")
      .select("*")
      .order("created_at", { ascending: false });

    setPedidos(data || []);
  };

  const cargarItems = async (pedidoId: string) => {
    setSelected(pedidoId);

    const { data } = await supabase
      .schema("B2B")
      .from("z_pedido_items")
      .select("*")
      .eq("pedido_id", pedidoId);

    setItems(data || []);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>📦 Pedidos B2B</h2>

      <div style={{ marginTop: 20 }}>
        {pedidos.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              padding: 10,
              borderRadius: 8,
              marginBottom: 10,
              background: selected === p.id ? "#f5f5f5" : "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>Pedido #{p.id.slice(0, 8)}</b>
              <span>Total: ${p.total}</span>
            </div>

            <button style={{ marginTop: 5 }} onClick={() => cargarItems(p.id)}>
              Ver detalle
            </button>

            {selected === p.id && (
              <div style={{ marginTop: 10, paddingLeft: 20 }}>
                {items.map((i) => (
                  <div key={i.id}>
                    {i.nombre} — x{i.cantidad} — ${i.subtotal}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PedidosB2B;
