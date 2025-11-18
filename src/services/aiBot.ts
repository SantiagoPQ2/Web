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
- Modificar el carrito: agregar, sacar, o cambiar cantidades.
- Siempre respondé corto, claro y profesional.
    `;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${API_KEY}\`,
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
    const reply = data?.choices?.[0]?.message?.content || "No entendí eso.";

    // Procesar acciones concretas
    await interpretarAcciones(userMessage);

    return reply;
  } catch (error) {
    console.error(error);
    return "Hubo un error procesando tu mensaje.";
  }
}

// -------------------------------------------------------------
// 🔧 Detecta si el usuario pidió una acción (agregar, sacar, etc.)
// -------------------------------------------------------------
async function interpretarAcciones(msg: string) {
  msg = msg.toLowerCase();

  if (msg.includes("agrega") || msg.includes("añade")) {
    const cantidad = extraerNumero(msg) || 1;
    const producto = await buscarProducto(msg);
    if (producto) addToCart(producto.id, cantidad);
  }

  if (msg.includes("saca") || msg.includes("elimina")) {
    const producto = await buscarProducto(msg);
    if (producto) removeFromCart(producto.id);
  }

  if (msg.includes("pone") || msg.includes("ponele")) {
    const cantidad = extraerNumero(msg);
    const producto = await buscarProducto(msg);

    if (producto && cantidad) setCartQty(producto.id, cantidad);
  }
}

// Extrae un número de un texto
function extraerNumero(msg: string): number | null {
  const match = msg.match(/\b\d+\b/);
  return match ? parseInt(match[0]) : null;
}

// Busca un producto por coincidencia de texto
async function buscarProducto(msg: string) {
  const { data } = await supabase.from("z_productos").select("*");

  if (!data) return null;

  const texto = msg.toLowerCase();

  const encontrado = data.find((p: any) =>
    texto.includes(p.nombre.toLowerCase()) ||
    (p.marca && texto.includes(p.marca.toLowerCase())) ||
    (p.categoria && texto.includes(p.categoria.toLowerCase()))
  );

  return encontrado || null;
}
