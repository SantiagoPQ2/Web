import { supabase } from "../config/supabase";
import { addToCart, removeFromCart, setCartQty } from "./cartActions";

const API_KEY = import.meta.env.VITE_OPENAI_KEY;

export async function askAI(userMessage: string): Promise<string> {
  try {
    // ⭐ 1) OBTENER PRODUCTOS REALES
    const { data: productos } = await supabase
      .from("z_productos")
      .select("id, articulo, nombre, marca, categoria, precio, stock");

    const catalogo = productos
      ?.map(
        (p) =>
          `• ${p.nombre} (marca: ${p.marca || "-"}, cat: ${
            p.categoria || "-"
          }, precio: $${p.precio}, stock: ${p.stock})`
      )
      .join("\n");

    // ⭐ 2) ANTI-ALUCINACIÓN (prompt fuerte)
    const systemPrompt = `
Sos el asistente B2B de VaFood.

Reglas estrictas:
- SOLO podés responder usando el catálogo real adjunto.
- SI NO existe en el catálogo → decí: "Ese producto no figura en catálogo."
- NO inventes nombres, marcas, productos ni categorías.
- NO completes con suposiciones.
- NO uses tono creativo.
- Respondé SIEMPRE de forma clara, profesional y breve (2–3 líneas).
- Cuando te pidan "qué hamburguesas tenés", buscá en el catálogo por categoría o coincidencia de nombre.
- Podés sugerir productos similares SOLO si están en el catálogo.

Catálogo real:
${catalogo}
    `;

    // ⭐ 3) Llamada a OpenAI
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

    // ⭐ 4) Procesar acciones (agregar/sacar productos)
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

// 🔍 Extraer números
function extraerNumero(msg: string): number | null {
  const match = msg.match(/\b\d+\b/);
  return match ? parseInt(match[0]) : null;
}

// 🔎 Buscar producto real
async function buscarProducto(msg: string) {
  const { data } = await supabase.from("z_productos").select("*");
  if (!data) return null;

  const texto = msg.toLowerCase();

  return (
    data.find((p: any) => texto.includes(p.nombre.toLowerCase())) ||
    data.find((p: any) => texto.includes((p.marca || "").toLowerCase())) ||
    data.find((p: any) => texto.includes((p.categoria || "").toLowerCase())) ||
    null
  );
}
