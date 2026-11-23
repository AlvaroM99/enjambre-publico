// Vistas derivadas del estado del panel (ADR 0015). Funciones puras: las usa la página y las prueba
// pruebas/panel.test.mjs sin navegador.

export const NOMBRES = {
  'jefe-proyecto': 'Jefe de proyecto', implementador: 'Implementador', revisor: 'Revisor', seguridad: 'Seguridad',
  analista: 'Analista', investigador: 'Investigador', gobernanza: 'Gobernanza', ci: 'CI', sistema: 'Paso automático',
  despliegue: 'Despliegue', otro: 'Workflow',
};
export const INICIALES = {
  'jefe-proyecto': 'JP', implementador: 'IM', revisor: 'RV', seguridad: 'SG', analista: 'AN', investigador: 'IN',
  gobernanza: 'GB', ci: 'CI', sistema: '··', despliegue: 'DP', otro: 'WF',
};

const HORA = 3600e3;

// Cada etiqueta dispara todos los workflows de agentes y los que no tocan terminan «skipped»: no son trabajo de un
// agente y no cuentan (Hive en los repos reales, 23-11-2026).
export const omitida = (e) => e.estado === 'completed' && e.conclusion === 'skipped';

export function repos(estado, filtro = 'todos') {
  return Object.keys(estado?.repos ?? {}).sort().filter((r) => filtro === 'todos' || r === filtro);
}

const coincide = (texto, q) => !q || String(texto ?? '').toLowerCase().includes(q.toLowerCase());

/** Ejecuciones en marcha, con el job activo y el agente que de verdad trabaja (no los pasos automáticos). */
export function agentesActivos(estado, filtro = 'todos') {
  const salida = [];
  for (const repo of repos(estado, filtro)) {
    for (const e of Object.values(estado.repos[repo].ejecuciones)) {
      if (e.estado === 'completed') continue;
      const jobs = Object.values(e.jobs ?? {}).sort((a, b) => (a.inicio ?? '~').localeCompare(b.inicio ?? '~'));
      const activo = jobs.find((j) => j.estado === 'in_progress' && j.agente !== 'sistema') ?? jobs.find((j) => j.estado === 'in_progress') ?? null;
      const agente = activo?.agente && activo.agente !== 'sistema' ? activo.agente : e.agente;
      salida.push({ repo, ejecucion: e, jobs, activo, agente });
    }
  }
  return salida.sort((a, b) => (a.ejecucion.inicio ?? '').localeCompare(b.ejecucion.inicio ?? ''));
}

export function terminadas(estado, filtro = 'todos', ahora = Date.now(), ventana = 2 * HORA) {
  const salida = [];
  for (const repo of repos(estado, filtro)) {
    for (const e of Object.values(estado.repos[repo].ejecuciones)) {
      if (e.estado === 'completed' && !omitida(e) && ahora - Date.parse(e.actualizado ?? 0) < ventana) salida.push({ repo, ejecucion: e });
    }
  }
  return salida.sort((a, b) => (b.ejecucion.actualizado ?? '').localeCompare(a.ejecucion.actualizado ?? ''));
}

export function estadoCi(pr) {
  const enj = pr.ci?.['ci (Enjambre)']?.estado;
  if (enj) return enj === 'error' ? 'failure' : enj;
  const checks = Object.values(pr.checks ?? {});
  if (!checks.length) return null;
  if (checks.some((c) => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure';
  if (checks.every((c) => ['success', 'skipped', 'neutral'].includes(c))) return 'success';
  return 'pending';
}

/** Lo que espera de Álvaro, en orden de urgencia. Cada elemento dice qué es y qué botón lo resuelve. */
export function bandeja(estado, { filtro = 'todos', propietario = null, ahora = Date.now() } = {}) {
  const salida = [];
  const activos = agentesActivos(estado, filtro);
  for (const repo of repos(estado, filtro)) {
    const r = estado.repos[repo];
    for (const pr of Object.values(r.prs)) {
      if (pr.estado !== 'open') continue;
      const ci = estadoCi(pr);
      const rev = pr.veredictos?.revisor?.veredicto;
      const seg = pr.veredictos?.seguridad?.veredicto;
      const revisando = activos.some((a) => a.repo === repo && a.ejecucion.vinculo?.pr === pr.numero);
      if (pr.aprobado && ci === 'success') {
        salida.push({ tipo: 'fusionar', prioridad: 1, repo, numero: pr.numero, titulo: pr.titulo, texto: 'Aprobado y en verde: fusiónalo' });
      } else if (!pr.borrador && rev === 'APROBAR' && (!seg || seg === 'APROBAR') && ci !== 'failure') {
        salida.push({ tipo: 'revisar-pr', prioridad: 2, repo, numero: pr.numero, titulo: pr.titulo, texto: ci === 'success' ? 'Revisor APROBAR y CI verde: revísalo' : 'Revisor APROBAR: revísalo (CI en marcha)' });
      } else if ((rev === 'CAMBIOS' || rev === 'BLOQUEAR' || seg === 'CAMBIOS' || seg === 'BLOQUEAR') && !revisando) {
        salida.push({ tipo: 'cambios', prioridad: 3, repo, numero: pr.numero, titulo: pr.titulo, texto: `Revisión: ${rev ?? '—'}${seg ? ` · seguridad: ${seg}` : ''}. Decide qué hacer` });
      } else if (ci === 'failure' && !revisando) {
        salida.push({ tipo: 'ci-roja', prioridad: 3, repo, numero: pr.numero, titulo: pr.titulo, texto: 'La CI está en rojo' });
      } else if (propietario && pr.revisores?.includes(propietario)) {
        salida.push({ tipo: 'revisar-pr', prioridad: 4, repo, numero: pr.numero, titulo: pr.titulo, texto: 'Te han pedido la revisión' });
      }
    }
    for (const i of Object.values(r.issues)) {
      if (i.estado !== 'open' || !i.plan) continue;
      const trabajando = activos.filter((a) => a.repo === repo && a.ejecucion.vinculo?.issue === i.numero).map((a) => a.agente);
      const implementando = i.etiquetas?.includes('enjambre:en-curso') || trabajando.includes('implementador');
      // Mientras el jefe rehace el plan, aún no hay nada que aprobar.
      const planificando = trabajando.includes('jefe-proyecto');
      const conPr = Object.values(r.prs).some((p) => p.estado === 'open' && p.issue === i.numero);
      if (!implementando && !planificando && !conPr) salida.push({ tipo: 'aprobar-plan', prioridad: 2, repo, numero: i.numero, titulo: i.titulo, texto: 'Plan listo: léelo y apruébalo' });
    }
    for (const e of Object.values(r.ejecuciones)) {
      if (e.estado !== 'completed' || e.conclusion !== 'failure' || e.agente === 'otro') continue;
      // Un fallo sobre una issue o un PR que ya no está abierto (cerrado, fusionado) ya no pide nada. Todo lo abierto está en
      // el estado; si el objetivo no está, es que no está abierto. Sin objetivo conocido, solo cuentan los workflows
      // que no van sobre una issue o un PR (CI de main, gobernanza, investigador).
      const objetivo = e.vinculo?.pr ? r.prs[e.vinculo.pr] : e.vinculo?.issue ? r.issues[e.vinculo.issue] : null;
      if (e.vinculo && objetivo?.estado !== 'open') continue;
      if (!e.vinculo && ['enjambre-planificar', 'enjambre-implementar', 'enjambre-revisar', 'enjambre-analizar'].includes(e.workflow)) continue;
      if (ahora - Date.parse(e.actualizado ?? 0) > 24 * HORA) continue;
      // Si después hubo otra ejecución del mismo workflow sobre lo mismo y fue bien, el fallo ya no importa.
      const despues = Object.values(r.ejecuciones).some((x) => x.workflow === e.workflow && x.id !== e.id && (x.inicio ?? '') > (e.inicio ?? '') && JSON.stringify(x.vinculo) === JSON.stringify(e.vinculo));
      if (despues) continue;
      salida.push({ tipo: 'fallo', prioridad: 3, repo, id: e.id, numero: e.vinculo?.pr ?? e.vinculo?.issue ?? null, titulo: e.titulo ?? e.workflow, texto: `${NOMBRES[e.agente] ?? e.workflow}: ${e.workflow} falló` });
    }
  }
  return salida.sort((a, b) => a.prioridad - b.prioridad || a.repo.localeCompare(b.repo) || (a.numero ?? 0) - (b.numero ?? 0));
}

export function resumen(estado, opciones = {}) {
  const b = bandeja(estado, opciones);
  const filtro = opciones.filtro ?? 'todos';
  let abiertas = 0;
  let prs = 0;
  for (const repo of repos(estado, filtro)) {
    abiertas += Object.values(estado.repos[repo].issues).filter((i) => i.estado === 'open').length;
    prs += Object.values(estado.repos[repo].prs).filter((p) => p.estado === 'open').length;
  }
  return {
    agentes: agentesActivos(estado, filtro).length,
    paraTi: b.filter((x) => x.tipo === 'fusionar' || x.tipo === 'revisar-pr').length,
    planes: b.filter((x) => x.tipo === 'aprobar-plan').length,
    fallos: b.filter((x) => x.tipo === 'fallo' || x.tipo === 'ci-roja').length,
    bandeja: b.length,
    abiertas,
    prs,
  };
}

// Columnas del tablero: salen de lo que pasa (agentes, plan, PR), no solo de las etiquetas.
export const COLUMNAS = [
  ['propuesta', 'Propuestas', (i) => i.etiquetas.includes('enjambre:propuesta')],
  ['preparar', 'Análisis', (i, x) => i.etiquetas.includes('enjambre:analizar') || x.agentes.includes('analista')],
  ['planificar', 'Plan', (i, x) => i.etiquetas.includes('enjambre:planificar') || Boolean(i.plan) || x.agentes.includes('jefe-proyecto')],
  ['implementar', 'Implementando', (i, x) => i.etiquetas.includes('enjambre:en-curso') || x.agentes.includes('implementador')],
  ['revision', 'PR abierto', (i, x) => x.tienePr],
];

export function tablero(estado, { filtro = 'todos', busqueda = '' } = {}) {
  const grupos = Object.fromEntries([...COLUMNAS.map((c) => c[0]), 'otras'].map((c) => [c, []]));
  const activos = agentesActivos(estado, filtro);
  for (const repo of repos(estado, filtro)) {
    const r = estado.repos[repo];
    const conPr = new Set(Object.values(r.prs).filter((p) => p.estado === 'open' && p.issue).map((p) => p.issue));
    for (const i of Object.values(r.issues)) {
      if (i.estado !== 'open' || !(coincide(i.titulo, busqueda) || coincide(`#${i.numero}`, busqueda))) continue;
      const agentes = activos.filter((a) => a.repo === repo && a.ejecucion.vinculo?.issue === i.numero).map((a) => a.agente);
      const x = { tienePr: conPr.has(i.numero), agentes };
      let columna = 'otras';
      for (let k = COLUMNAS.length - 1; k >= 0; k--) if (COLUMNAS[k][2](i, x)) { columna = COLUMNAS[k][0]; break; }
      grupos[columna].push({ repo, issue: i, agentes });
    }
  }
  for (const lista of Object.values(grupos)) lista.sort((a, b) => (b.issue.actualizado ?? '').localeCompare(a.issue.actualizado ?? ''));
  return grupos;
}

export function prsAbiertos(estado, { filtro = 'todos', busqueda = '', incluirCerrados = false, ahora = Date.now() } = {}) {
  const salida = [];
  for (const repo of repos(estado, filtro)) {
    for (const pr of Object.values(estado.repos[repo].prs)) {
      const reciente = ahora - Date.parse(pr.actualizado ?? 0) < 24 * HORA;
      if (pr.estado !== 'open' && !(incluirCerrados && reciente)) continue;
      if (!(coincide(pr.titulo, busqueda) || coincide(`#${pr.numero}`, busqueda) || coincide(pr.rama, busqueda))) continue;
      salida.push({ repo, pr, ci: estadoCi(pr) });
    }
  }
  return salida.sort((a, b) => Number(b.pr.estado === 'open') - Number(a.pr.estado === 'open') || (b.pr.actualizado ?? '').localeCompare(a.pr.actualizado ?? ''));
}

/** Ejecuciones de las últimas 24 h, para la tabla de actividad. */
export function ejecuciones(estado, { filtro = 'todos', ahora = Date.now(), incluirOmitidas = false } = {}) {
  const salida = [];
  for (const repo of repos(estado, filtro)) {
    for (const e of Object.values(estado.repos[repo].ejecuciones)) {
      if (e.estado === 'completed' && ahora - Date.parse(e.actualizado ?? 0) > 24 * HORA) continue;
      if (omitida(e) && !incluirOmitidas) continue;
      salida.push({ repo, ejecucion: e });
    }
  }
  return salida.sort((a, b) => (b.ejecucion.inicio ?? '').localeCompare(a.ejecucion.inicio ?? ''));
}

/** Rendimiento por agente en 24 h: ejecuciones, fallos y duración mediana. */
export function porAgente(estado, { filtro = 'todos', ahora = Date.now() } = {}) {
  const m = new Map();
  for (const { ejecucion: e } of ejecuciones(estado, { filtro, ahora })) {
    if (e.estado !== 'completed' || e.agente === 'otro') continue;
    const x = m.get(e.agente) ?? { agente: e.agente, total: 0, fallos: 0, duraciones: [] };
    x.total++;
    if (e.conclusion === 'failure') x.fallos++;
    const d = Date.parse(e.actualizado ?? 0) - Date.parse(e.inicio ?? 0);
    if (d > 0) x.duraciones.push(d);
    m.set(e.agente, x);
  }
  return [...m.values()].map((x) => {
    const d = x.duraciones.sort((a, b) => a - b);
    return { agente: x.agente, total: x.total, fallos: x.fallos, mediana: d.length ? d[Math.floor((d.length - 1) / 2)] : null };
  }).sort((a, b) => b.total - a.total);
}

/** Claves de eventos que merecen aviso del navegador (plan listo, PR para ti, fallo). */
export function eventosAvisables(estado) {
  return (estado?.eventos ?? []).filter((e) => /plan listo|listo para revisar|falló|failure|BLOQUEAR|CAMBIOS|revisor: APROBAR/.test(e.texto ?? ''));
}
