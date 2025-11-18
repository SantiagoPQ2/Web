// src/services/aiBot.ts
import { supabase } from "../config/supabase";
import { addToCart, removeFromCart, setCartQty } from "./cartActions";

const API_KEY = import.meta.env.VITE_OPENAI_KEY;

export async function askAI(userMessage: string): Promise<string> {
  try {
    const systemPrompt = `
Sos el asistente B2B de VaFood.
Podés:
- Responder sobre precios, stock y productos.
- Buscar productos por nombre o categoría.
- Modificar el carrito: agregar, sacar, cambiar cantidades.
Tu estilo debe ser claro, profesional y directo.
Si el usuario pide agregar productos, eliminarlos o modificar cantidades, respondé normalmente y además ejecutá la acción.
    `;

    // 🔥 Llamada a OpenAI
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await res.json();
    const reply: string =
      data?.choices?.[0]?.message?.content || "No entendí eso.";

    // Procesamos acciones del usuario
    await interpretarAcciones(userMessage);

    return reply;
  } catch (error) {
    console.error("Error en askAI:", error);
    return "Hubo un error procesando tu mensaje.";
  }
}

/* ---------------------------------------------------------
 * 🔧 Interpreta si el usuario pidió una acción concreta
 * --------------------------------------------------------- */
async function interpretarAcciones(msg: string) {
  msg = msg.toLowerCase();

  // AGREGAR PRODUCTOS
  if (
    msg.includes("agrega") ||
    msg.includes("añade") ||
    msg.includes("agregar") ||
    msg.includes("sumar") ||
    msg.includes("poneme")
  ) {
    const cantidad = extraerNumero(msg) || 1;
    const producto = await buscarProducto(msg);
    if (producto) {
      addToCart(producto.id, cantidad);
    }
  }

  // SACAR / ELIMINAR PRODUCTOS
  if (
    msg.includes("saca") ||
    msg.includes("elimina") ||
    msg.includes("sacar") ||
    msg.includes("quitar")
  ) {
    const producto = await buscarProducto(msg);
    if (producto) {
      removeFromCart(producto.id);
    }
  }

  // CAMBIAR CANTIDAD ESPECÍFICA
  if (msg.includes("ponele") || msg.includes("poné") || msg.includes("coloca")) {
    const cantidad = extraerNumero(msg);
    const producto = await buscarProducto(msg);

    if (producto && cantidad) {
      setCartQty(producto.id, cantidad);
    }
  }
}

/* ---------------------------------------------------------
 * 🔍 Extrae un número del texto (ej: "agrega 3 patys")
 * --------------------------------------------------------- */
function extraerNumero(msg: string): number | null {
  const match = msg.match(/\b\d+\b/);
  return match ? parseInt(match[0]) : null;
}

/* ---------------------------------------------------------
 * 🔎 Busca un producto que coincida con el mensaje
 * --------------------------------------------------------- */
async function buscarProducto(msg: string) {
  const { data } = await supabase.from("z_productos").select("*");

  if (!data) return null;

  const texto = msg.toLowerCase();

  const encontrado = data.find((p: any) =>
    texto.includes(p.nombre.toLowerCase()) ||
    (p.marca && texto.includes(p.marca.toLowerCase())) ||
    (p.categoria && texto.includes(p.categoria.toLowerCase())) ||
    (p.articulo && texto.includes(p.articulo.toLowerCase()))
  );

  return encontrado || null;
}
