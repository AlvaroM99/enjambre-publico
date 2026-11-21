// Precio final con IVA, redondeado a céntimos.
export function precioConIva(base, tipo = 0.21) {
  return Math.round(base * tipo * 100) / 100;
}
