// Worker «enjambre-panel» (ADR 0015): reparte cada petición entre los ficheros estáticos y la Sala, y añade las
// cabeceras de seguridad a todo lo que sale.

import { conCabeceras } from './cabeceras.js';

export { Sala } from './sala.js';

const DINAMICAS = /^\/(webhook|login|callback|salir|ws|api\/)/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (DINAMICAS.test(url.pathname)) {
      const respuesta = await env.SALA.get(env.SALA.idFromName('sala')).fetch(request);
      return respuesta.status === 101 ? respuesta : conCabeceras(respuesta);
    }
    return conCabeceras(await env.ASSETS.fetch(request));
  },
};
