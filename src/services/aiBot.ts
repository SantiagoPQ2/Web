// src/services/aiBot.ts
import { supabase } from "../config/supabase";
import { addToCart, removeFromCart, setCartQty } from "./cartActions";

const API_KEY = import.meta.env.VITE_OPENAI_KEY;

export async function askAI(userMessage: string): Promise<string> {
  try {
    // ⭐ 1) Obtener catálogo real desde Supabase
    const { data: productos } = await supabase
      .from("z_productos")
      .select("id, articulo, nombre, marca, categoria, precio");

    // Transformar catálogo a formato legible
    const catalogo = productos
      ?.map(
        (p) =>
          `${p.nombre} | marca ${p.marca || "-"} | categoría ${
            p.categoria || "-"
          } | precio $${p.precio}`
      )
      .join("\n");

    // ⭐ 2) Prompt anti-alucinación + formato itemizado SIEMPRE
    const systemPrompt = `
Sos el asistente B2B de VaFood.

REGLAS OBLIGATORIAS:
1) SOLO podés usar los productos reales del catálogo adjunto.
2) NO inventes productos, marcas ni categorías.
3) SI no existe → respondé: "Ese producto no figura en catálogo."
4) Tus respuestas deben ser MUY cortas, claras y profesionales.
5) CUANDO respondas con un listado, siempre debe ser un ítem por renglón.
6) Formato OBLIGATORIO:
   • Nombre del producto – $precio
7) NO muestres stock.
8) NO muestres códigos de artículo.
9) NO pegues los ítems en una sola línea. Siempre una línea por producto.
10) NO uses textos largos.

EJEMPLO OBLIGATORIO:
Estas hamburguesas figuran en catálogo:
• Paty Clásica X6 – $1250.00
• Paty Premium X4 – $2630.00
• GreenLife Veggie – $2300.00

Catálogo oficial:
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
      data?.choices?.[0]?.message?.content ||
      "No pude entender tu consulta.";

    // ⭐ 4) Ejecutar acciones de carrito según el mensaje
    await interpretarAcciones(userMessage);

    return reply;
  } catch (error) {
    console.error("Error en askAI:", error);
    return "Hubo un error procesando tu mensaje.";
  }
}

// -------------------------------------------------------------
// 🔧 Interpretar acciones: agregar / sacar / setear cantidades
// -------------------------------------------------------------
async function interpretarAcciones(msg: string) {
  msg = msg.toLowerCase();

  if (
    msg.includes("agrega") ||
    msg.includes("añade") ||
    msg.includes("sumá") ||
    msg.includes("sumar") ||
    msg.includes("poneme")
  ) {
    const cantidad = extraerNumero(msg) || 1;
    const producto = await buscarProducto(msg);
    if (producto) addToCart(producto.id, cantidad);
  }

  if (
    msg.includes("saca") ||
    msg.includes("elimina") ||
    msg.includes("quitar") ||
    msg.includes("borra")
  ) {
    const producto = await buscarProducto(msg);
    if (producto) removeFromCart(producto.id);
  }

  if (
    msg.includes("ponele") ||
    msg.includes("coloca") ||
    msg.includes("setea") ||
    msg.includes("ajusta")
  ) {
    const cantidad = extraerNumero(msg);
    const producto = await buscarProducto(msg);

    if (producto && cantidad) setCartQty(producto.id, cantidad);
  }
}

// -------------------------------------------------------------
// 🔍 Extraer número del texto
// -------------------------------------------------------------
function extraerNumero(msg: string): number | null {
  const match = msg.match(/\b\d+\b/);
  return match ? parseInt(match[0]) : null;
}

// -------------------------------------------------------------
// 🔎 Buscar producto real dentro del catálogo
// -------------------------------------------------------------
async function buscarProducto(msg: string) {
  const { data } = await supabase.from("z_productos").select("*");
  if (!data) return null;

  const texto = msg.toLowerCase();

  return (
    data.find((p) => texto.includes(p.nombre.toLowerCase())) ||
    data.find((p) =>
      (p.marca || "").toLowerCase() &&
      texto.includes((p.marca || "").toLowerCase())
    ) ||
    data.find((p) =>
      (p.categoria || "").toLowerCase() &&
      texto.includes((p.categoria || "").toLowerCase())
    ) ||
    null
  );
}
