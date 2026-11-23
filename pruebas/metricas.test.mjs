// Pruebas de la extracción y las métricas de F4 (S60). Con datos de ejemplo: no llaman a GitHub.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueDeRama, veredictoDe, resumenTranscripcion, normalizarIssue, normalizarPr, normalizarEjecucion, enlazarRevisiones } from '../herramientas/extraer.mjs';
import { mediana, duracion, ciclosDeCambios, historias, resumen, porAgente } from '../herramientas/metricas.mjs';

test('extraer: número de issue a partir de la rama del agente', () => {
  assert.equal(issueDeRama('enjambre/10-gobernanza-readme'), 10);
  assert.equal(issueDeRama('enjambre/issue-15-ticker'), 15);
  assert.equal(issueDeRama('enjambre/revision-automatica'), null);
  assert.equal(issueDeRama('feature/10-x'), null);
  assert.equal(issueDeRama(undefined), null);
});

test('extraer: veredicto del revisor y de seguridad; el último del comentario manda', () => {
  assert.deepEqual(veredictoDe('## Revisión de Enjambre\n\n**Veredicto:** APROBAR\n'), { tipo: 'revisor', veredicto: 'APROBAR' });
  assert.deepEqual(veredictoDe('## Revisión de seguridad de Enjambre\n**Veredicto:** CAMBIOS'), { tipo: 'seguridad', veredicto: 'CAMBIOS' });
  assert.deepEqual(veredictoDe('## Revisión de Enjambre\n_respaldo_\n**Veredicto:** CAMBIOS\n…\n**Veredicto:** APROBAR'), { tipo: 'revisor', veredicto: 'APROBAR' });
  assert.equal(veredictoDe('## Plan de Enjambre\n**Veredicto:** APROBAR'), null);
  assert.equal(veredictoDe('Comentario normal'), null);
});

test('extraer: de la transcripción solo salen números', () => {
  const r = resumenTranscripcion([{ type: 'system' }, { type: 'result', num_turns: 6, total_cost_usd: 0.27810583, duration_ms: 90000, permission_denials: [{}, {}], result: 'texto que no se guarda' }]);
  assert.deepEqual(r, { turnos: 6, coste_usd: 0.2781, duracion_ms: 90000, permisos_denegados: 2, error: false });
  assert.equal(resumenTranscripcion([]), null);
  assert.equal(resumenTranscripcion({}), null);
});

test('extraer: issue sin contenido, con las etiquetas que puso el propietario', () => {
  const i = normalizarIssue({ number: 10, title: 'no se guarda', body: 'tampoco', created_at: '2026-11-22T17:05:17Z', closed_at: '2026-11-23T11:32:11Z', user: { login: 'github-actions[bot]' } }, [
    { event: 'labeled', actor: { login: 'github-actions[bot]' }, label: { name: 'enjambre:propuesta' }, created_at: '2026-11-22T17:05:17Z' },
    { event: 'labeled', actor: { login: 'AlvaroM99' }, label: { name: 'enjambre:implementar' }, created_at: '2026-11-23T11:20:02Z' },
    { event: 'labeled', actor: { login: 'AlvaroM99' }, label: { name: 'enjambre:planificar' }, created_at: '2026-11-23T11:15:16Z' },
    { event: 'commented', actor: { login: 'AlvaroM99' }, created_at: '2026-11-23T11:19:00Z' },
  ], 'AlvaroM99');
  assert.equal(i.inicio, '2026-11-23T11:15:16Z');
  assert.equal(i.autor, 'bot');
  assert.deepEqual(i.etiquetas_propietario.map((e) => e.etiqueta), ['enjambre:planificar', 'enjambre:implementar']);
  assert.ok(!('title' in i) && !('body' in i), 'sin título ni cuerpo');
});

test('extraer: PR enlazado con su issue y ejecuciones enlazadas por título sin guardarlo', () => {
  const pr = normalizarPr({ number: 20, title: 'x', head: { ref: 'enjambre/10-readme' }, user: { login: 'app/github-actions' }, created_at: 'a', merged_at: 'b', closed_at: 'b' }, 'AlvaroM99');
  assert.deepEqual(pr, { numero: 20, issue: 10, autor: 'bot', creado: 'a', fusionado: 'b', cerrado: 'b' });
  const e = normalizarEjecucion({ id: 1, name: 'enjambre-planificar', event: 'issues', display_title: 'Título del issue', actor: { login: 'AlvaroM99' }, run_started_at: 'i', updated_at: 'f', conclusion: 'success' }, new Map([['Título del issue', 10]]), new Map());
  assert.equal(e.issue, 10);
  assert.ok(!JSON.stringify(e).includes('Título'), 'el título no se guarda');
});

test('extraer: la revisión lanzada por workflow_dispatch se enlaza con el veredicto publicado durante el run', () => {
  const ejecuciones = [
    { workflow: 'enjambre-revisar', evento: 'workflow_dispatch', inicio: '2026-11-23T11:21:00Z', fin: '2026-11-23T11:24:00Z', issue: null, pr: null },
    { workflow: 'enjambre-revisar', evento: 'workflow_dispatch', inicio: '2026-11-23T12:00:00Z', fin: '2026-11-23T12:01:00Z', issue: null, pr: null },
  ];
  enlazarRevisiones(ejecuciones, [{ pr: 20, tipo: 'revisor', veredicto: 'APROBAR', fecha: '2026-11-23T11:23:30Z' }]);
  assert.equal(ejecuciones[0].pr, 20);
  assert.equal(ejecuciones[1].pr, null, 'sin veredicto en su ventana, sin enlace');
});

test('métricas: mediana, duración legible y ciclos por ronda', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([]), null);
  assert.equal(duracion(17 * 60000), '17 min');
  assert.equal(duracion((119 * 60 + 5) * 1000), '1 h 59 min');
  assert.equal(duracion(null), '—');
  // Revisor y seguridad en la misma ronda cuentan uno; una segunda ronda horas después, otro.
  assert.equal(ciclosDeCambios([
    { veredicto: 'CAMBIOS', fecha: '2026-11-22T22:00:00Z' }, { veredicto: 'CAMBIOS', fecha: '2026-11-22T22:05:00Z' },
    { veredicto: 'APROBAR', fecha: '2026-11-23T06:50:00Z' },
  ]), 1);
  assert.equal(ciclosDeCambios([{ veredicto: 'BLOQUEAR', fecha: '2026-11-22T10:00:00Z' }, { veredicto: 'CAMBIOS', fecha: '2026-11-22T14:00:00Z' }]), 2);
  assert.equal(ciclosDeCambios([]), 0);
});

test('métricas: historia con lead time desde la primera etiqueta del propietario, ciclos y coste', () => {
  const datos = {
    repo: 'AlvaroM99/lobby',
    issues: [{ numero: 10, creado: '2026-11-22T17:05:17Z', inicio: '2026-11-23T11:15:16Z' }],
    prs: [{ numero: 20, issue: 10, creado: '2026-11-23T11:21:28Z', fusionado: '2026-11-23T11:32:09Z' }, { numero: 21, issue: null, fusionado: 'x' }],
    veredictos: [{ pr: 20, tipo: 'revisor', veredicto: 'APROBAR', fecha: '2026-11-23T11:23:30Z' }],
    ejecuciones: [
      { issue: 10, pr: null, agentes: [{ agente: 'jefe-proyecto', turnos: 11, coste_usd: 0.52, permisos_denegados: 0 }] },
      { issue: 10, pr: null, agentes: [{ agente: 'implementador', turnos: 11, coste_usd: 0.16, permisos_denegados: 1 }] },
      { issue: null, pr: 20, agentes: [{ agente: 'revisor', turnos: 6, coste_usd: 0.24, permisos_denegados: 0 }] },
    ],
  };
  const [h, ...resto] = historias(datos);
  assert.equal(resto.length, 0, 'solo PR de agentes');
  assert.equal(duracion(h.lead_ms), '17 min');
  assert.equal(h.ciclos, 0);
  assert.equal(h.coste_usd, 0.92);
  assert.equal(h.coste_parcial, false);
  assert.deepEqual(resumen([h, { ...h, lead_ms: 3 * 3600000, ciclos: 2 }]), { historias: 2, lead_mediana_ms: (h.lead_ms + 3 * 3600000) / 2, sin_retrabajo: 1, pct_sin_retrabajo: 50, coste_conocido_usd: 1.84 });
  assert.equal(porAgente([datos]).implementador.permisos_denegados, 1);
});
