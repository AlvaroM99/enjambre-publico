// F4: métricas de Enjambre a partir de los JSON de herramientas/extraer.mjs. Es el paso que hará dbt-duckdb (S61);
// mientras tanto, calcula lo mismo en Node, sin dependencias.
// - Lead time: de la primera etiqueta que pone el propietario en el issue a la fusión del PR del agente.
//   Es la definición usada en docs/operacion.md.
// - Retrabajo: rondas de revisión con CAMBIOS o BLOQUEAR en el PR fusionado. Revisor y seguridad de la misma ronda
//   cuentan una vez: veredictos a menos de 30 min. El objetivo de F3 es ≤ 1 ciclo en el 60 % de los PR.
// - Coste: suma del coste de las transcripciones enlazadas con el issue o el PR. Es parcial si falta alguna, porque
//   las transcripciones caducan a los 7 días.
//
// Uso: node herramientas/metricas.mjs [--entrada .metricas]   → tabla en pantalla y .metricas/metricas.json
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function mediana(valores) {
  const v = valores.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Rondas de revisión que pidieron cambios: veredictos CAMBIOS o BLOQUEAR agrupados si distan menos de 30 min. */
export function ciclosDeCambios(veredictos, ventanaMs = 30 * 60000) {
  const fechas = veredictos.filter((v) => ['CAMBIOS', 'BLOQUEAR'].includes(v.veredicto)).map((v) => Date.parse(v.fecha)).sort((a, b) => a - b);
  let ciclos = 0, ultima = -Infinity;
  for (const f of fechas) { if (f - ultima >= ventanaMs) ciclos += 1; ultima = f; }
  return ciclos;
}

export function duracion(ms) {
  if (ms === null || ms === undefined) return '—';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return h < 48 ? `${h} h ${r} min` : `${Math.round(h / 24 * 10) / 10} días`;
}

/** Una fila por PR de agente fusionado. */
export function historias(datos) {
  const filas = [];
  for (const pr of datos.prs.filter((p) => p.issue !== null && p.fusionado)) {
    const issue = datos.issues.find((i) => i.numero === pr.issue);
    const inicio = issue?.inicio ?? issue?.creado ?? pr.creado;
    const ciclos = ciclosDeCambios(datos.veredictos.filter((v) => v.pr === pr.numero));
    const runs = datos.ejecuciones.filter((e) => e.issue === pr.issue || e.pr === pr.numero);
    const agentes = runs.flatMap((e) => e.agentes ?? []);
    const costes = agentes.map((a) => a.coste_usd).filter((c) => typeof c === 'number');
    filas.push({
      repo: datos.repo,
      issue: pr.issue,
      pr: pr.numero,
      inicio,
      fusionado: pr.fusionado,
      lead_ms: Date.parse(pr.fusionado) - Date.parse(inicio),
      ciclos,
      veredicto_final: datos.veredictos.filter((v) => v.pr === pr.numero && v.tipo === 'revisor').pop()?.veredicto ?? null,
      ejecuciones: runs.length,
      coste_usd: costes.length ? Math.round(costes.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      coste_parcial: runs.some((e) => !(e.agentes ?? []).some((a) => typeof a.coste_usd === 'number')),
    });
  }
  return filas;
}

export function resumen(filas) {
  return {
    historias: filas.length,
    lead_mediana_ms: mediana(filas.map((f) => f.lead_ms)),
    sin_retrabajo: filas.filter((f) => f.ciclos <= 1).length,
    pct_sin_retrabajo: filas.length ? Math.round(filas.filter((f) => f.ciclos <= 1).length / filas.length * 100) : null,
    coste_conocido_usd: Math.round(filas.reduce((a, f) => a + (f.coste_usd ?? 0), 0) * 100) / 100,
  };
}

/** Por agente: ejecuciones, turnos y coste medios, y permisos denegados (para S65 y el panel). */
export function porAgente(conjuntos) {
  const t = {};
  for (const d of conjuntos) for (const e of d.ejecuciones) for (const a of e.agentes ?? []) {
    if (typeof a.turnos !== 'number') continue;
    const x = (t[a.agente] ??= { ejecuciones: 0, turnos: 0, coste_usd: 0, permisos_denegados: 0 });
    x.ejecuciones += 1; x.turnos += a.turnos; x.coste_usd += a.coste_usd ?? 0; x.permisos_denegados += a.permisos_denegados ?? 0;
  }
  for (const x of Object.values(t)) { x.turnos_medios = Math.round(x.turnos / x.ejecuciones * 10) / 10; x.coste_usd = Math.round(x.coste_usd * 100) / 100; }
  return t;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const i = process.argv.indexOf('--entrada');
  const dir = i > 0 ? process.argv[i + 1] : '.metricas';
  const conjuntos = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'metricas.json').map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  const filas = conjuntos.flatMap(historias).sort((a, b) => a.fusionado.localeCompare(b.fusionado));
  const r = resumen(filas);
  const agentes = porAgente(conjuntos);
  console.log('| Repo | Issue | PR | Lead time | Ciclos | Revisor | Coste |\n|---|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| ${f.repo.split('/')[1]} | #${f.issue} | #${f.pr} | ${duracion(f.lead_ms)} | ${f.ciclos} | ${f.veredicto_final ?? '—'} | ${f.coste_usd === null ? '—' : `${f.coste_usd.toFixed(2)} USD${f.coste_parcial ? ' (parcial)' : ''}`} |`);
  console.log(`\n${r.historias} historias · lead time mediano ${duracion(r.lead_mediana_ms)} · ${r.sin_retrabajo} de ${r.historias} con ≤ 1 ciclo (${r.pct_sin_retrabajo} %) · coste conocido ${r.coste_conocido_usd} USD`);
  console.log('\n| Agente | Ejecuciones | Turnos medios | Coste | Permisos denegados |\n|---|---|---|---|---|');
  for (const [n, x] of Object.entries(agentes).sort()) console.log(`| ${n} | ${x.ejecuciones} | ${x.turnos_medios} | ${x.coste_usd.toFixed(2)} USD | ${x.permisos_denegados} |`);
  writeFileSync(join(dir, 'metricas.json'), JSON.stringify({ generado: new Date().toISOString(), resumen: r, historias: filas, agentes }, null, 2) + '\n');
}
