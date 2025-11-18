// src/services/cartActions.ts

export function addToCart(id: string, cantidad: number) {
  const carrito = JSON.parse(localStorage.getItem("carrito_b2b") || "{}");
  carrito[id] = (carrito[id] || 0) + cantidad;
  localStorage.setItem("carrito_b2b", JSON.stringify(carrito));
}

export function removeFromCart(id: string) {
  const carrito = JSON.parse(localStorage.getItem("carrito_b2b") || "{}");
  delete carrito[id];
  localStorage.setItem("carrito_b2b", JSON.stringify(carrito));
}

export function setCartQty(id: string, cantidad: number) {
  const carrito = JSON.parse(localStorage.getItem("carrito_b2b") || "{}");

  if (cantidad <= 0) {
    delete carrito[id];
  } else {
    carrito[id] = cantidad;
  }

  localStorage.setItem("carrito_b2b", JSON.stringify(carrito));
}

