export function createPageUrl(name) {
  const map = {
    Empleos: "/empleos",
    Alquileres: "/alquileres",
    Ventas: "/ventas",
    Emprendimientos: "/emprendimientos",
    Delivery: "/delivery",
    RestaurantMenu: "/restaurant",
  };
  return map[name] || "/";
}

export const asARS = (v) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v);
