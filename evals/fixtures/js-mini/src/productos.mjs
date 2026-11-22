// Catálogo de ejemplo (datos inventados). La interfaz pinta lo que devuelve listarProductos().
const PRODUCTOS = [
  { id: 'p1', nombre: 'Taza', precio: 8 },
  { id: 'p2', nombre: 'Camiseta', precio: 15 },
  { id: 'p3', nombre: 'Libreta', precio: 4.5 },
];

export function listarProductos() {
  return PRODUCTOS.map((p) => ({ ...p }));
}
