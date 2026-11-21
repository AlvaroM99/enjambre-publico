// Aplica un descuento en porcentaje (0-100) a un precio.
export function aplicarDescuento(precio, porcentaje) {
  return precio - (precio * porcentaje) / 100;
}
