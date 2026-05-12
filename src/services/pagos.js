import { Platform } from "react-native";

// Claves de prueba - cambiar por produccion cuando este listo
export const STRIPE_PUBLISHABLE_KEY = "pk_test_51TSkzUD0pEHJeBo6QBkfbngTviGNvb21g7oPmykcVgsnvZxsI4H8aBltMdVnxEsBUy9ShdjTsm9jN7pUzggSGyMY0030LgkEM1";
export const MP_ACCESS_TOKEN = "TEST-2901423997839960-050115-8f38bbd0234f1c04e6fe0520760db9c0-207844753";

// Paises de Sudamerica que usan MercadoPago
const PAISES_MP = ["AR","BO","BR","CL","CO","EC","PY","PE","UY","VE"];

export function usarMercadoPago(codigoPais) {
  return PAISES_MP.includes(codigoPais);
}

// Precios segun region
export function getPrecio(codigoPais) {
  return usarMercadoPago(codigoPais) ? 1.00 : 2.00;
}

export function getMoneda(codigoPais) {
  return usarMercadoPago(codigoPais) ? "USD" : "USD";
}
