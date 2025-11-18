import { supabase } from "../config/supabase";
import { addToCart, removeFromCart, setCartQty } from "./cartActions";

const API_KEY = import.meta.env.VITE_OPENAI_KEY;

export async function askAI(userMessage: string): Promise<string> {
  try {
    // ⭐ 1) OBTENER PRODUCTOS
    const { data: productos } = await supabase
      .from("z_productos")
      .select("id, articulo, nombre, marca, categoria, precio");

    // ⭐ 2) FORMATEAR CATÁLOGO (solo nombre/marca/categoría/precio)
    const catalogo = productos
      ?.map(
        (p) =>
          `${p.nombre} | marca ${p.marca || "-"} | categoría ${
            p.categoria || "-"
          } | precio $${p.precio}`
      )
      .join("\n");

    // ⭐ 3) PROMPT ANTI-ALUCINACIÓN + FORMATO LIMPIO
    const systemPrompt = `
Sos el asistente B2B de VaFood.

Reglas:
1) SOLO podés usar los productos reales del catálogo adjunto.
2) NO inventes productos, marcas ni categorías.
3) SI NO existe en el catálogo → respondé: "Ese producto no figura en catálogo."
4) Tus respuestas deben ser cortas (2–4 líneas), claras y profesionales.
5) Cuando el usuario te pida un listado (ej: "qué salchichas tenés"):
   - Mostrá una lista con bullets.
   - Formato de cada item: "• Nombre – $precio"
   - NO mostrar stock.
   - NO agregar texto innecesario.

Catálogo:
${catalogo}
    `;

    // ⭐ 4) LLAMADA A OPENAI
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
    const reply =
      data?.choices?.[0]?.message?.content || "No pude entender tu consulta.";

    // ⭐ 5) ACCIONES (agregar, sacar, modificar cantidades)
    await interpretarAcciones(userMessage);

    return reply;
  } catch (error) {
    console.error(error);
    return "Hubo un error procesando tu mensaje.";
  }
}

// ------------------------------
// 🔧 interpretar acciones
// ------------------------------
async function interpretarAcciones(msg: string) {
  msg = msg.toLowerCase();

  if (
    msg.includes("agrega") ||
    msg.includes("añade") ||
    msg.includes("sumar") ||
    msg.includes("poneme")
  ) {
    const cantidad = extraerNumero(msg) || 1;
    const producto = await buscarProducto(msg);
    if (producto) addToCart(producto.id, cantidad);
  }

  if (msg.includes("saca") || msg.includes("elimina") || msg.includes("quitar")) {
    const producto = await buscarProducto(msg);
    if (producto) removeFromCart(producto.id);
  }

  if (msg.includes("ponele") || msg.includes("coloca") || msg.includes("setea")) {
    const cantidad = extraerNumero(msg);
    const producto = await buscarProducto(msg);
    if (producto && cantidad) setCartQty(producto.id, cantidad);
  }
}

function extraerNumero(msg: string): number | null {
  const m = msg.match(/\b\d+\b/);
  return m ? parseInt(m[0]) : null;
}

async function buscarProducto(msg: string) {
  const { data } = await supabase.from("z_productos").select("*");
  if (!data) return null;

  const texto = msg.toLowerCase();

  return (
    data.find((p: any) => texto.includes(p.nombre.toLowerCase())) ||
    data.find((p: any) =>
      texto.includes((p.marca || "").toLowerCase())
    ) ||
    data.find((p: any) =>
      texto.includes((p.categoria || "").toLowerCase())
    ) ||
    null
  );
}
