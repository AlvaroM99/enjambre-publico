// Estado compartido de la página: lo que manda el servidor y lo que elige quien mira.
export const app = {
  estado: null, // estado del panel (Sala)
  filtro: 'todos', // repo elegido
  busqueda: '',
  vista: 'vivo',
  cajon: null, // { tipo: 'issue'|'pr'|'ejecucion'|'nueva', repo, numero|id, detalle, … }
  repintar: () => {},
};
