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

  const guardarCarrito = (nuevoCarrito: any) => {
    setCarrito(nuevoCarrito);
    localStorage.setItem("carrito_b2b", JSON.stringify(nuevoCarrito));
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from("B2B.z_productos")
      .select("*")
      .eq("activo", true);

    if (!error && data) setProductos(data);
  };

  const agregarAlCarrito = (id: string) => {
    const nuevo = { ...carrito, [id]: (carrito[id] || 0) + 1 };
    guardarCarrito(nuevo);
  };

  const filtrados = productos.filter((p) => {
    return (
      (filtroMarca ? p.marca === filtroMarca : true) &&
      (filtroCategoria ? p.categoria === filtroCategoria : true) &&
      (busqueda
        ? p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          p.articulo.includes(busqueda)
        : true)
    );
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>🛒 Catálogo B2B</h2>

      <button onClick={() => navigate("/b2b/carrito")}>
        Ver carrito ({Object.keys(carrito).length})
      </button>

      <input
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginTop: 10, width: "100%", padding: 8 }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {[...new Set(productos.map((p) => p.marca))].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {[...new Set(productos.map((p) => p.categoria))].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 20,
        marginTop: 20
      }}>
        {filtrados.map((p) => (
          <div key={p.id} style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 10
          }}>
            <h4>{p.nombre}</h4>
            <p><b>Marca:</b> {p.marca}</p>
            <p><b>Categoría:</b> {p.categoria}</p>
            <p><b>Precio:</b> ${p.precio}</p>
            <p><b>Stock:</b> {p.stock}</p>

            <button onClick={() => agregarAlCarrito(p.id)}>
              Agregar al carrito
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};

export default CatalogoB2B;
