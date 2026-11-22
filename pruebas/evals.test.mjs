// Pruebas del banco de evaluaciones (S28) y del resumen de actividad y tokens (S25).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { TAREAS, aRegExp, evaluar, modoPermisos, resumir, tablaResumen } from '../evals/ejecutar.mjs';
import { contarTokens, evento } from '../plugins/enjambre/scripts/registrar-actividad.mjs';
import { resumirActividad } from '../herramientas/actividad.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const AGENTES = readdirSync(join(RAIZ, 'plugins', 'enjambre', 'agents')).map((f) => f.replace(/\.md$/, ''));

test('el banco tiene 20 tareas con id único y cubre a los 10 agentes', () => {
  assert.equal(TAREAS.length, 20);
  assert.equal(new Set(TAREAS.map((t) => t.id)).size, 20);
  assert.deepEqual([...new Set(TAREAS.map((t) => t.agente))].sort(), [...AGENTES].sort());
});

for (const t of TAREAS) {
  test(`tarea ${t.id}: fixture existente y comprobaciones válidas`, () => {
    assert.ok(existsSync(join(RAIZ, 'evals', 'fixtures', t.fixture)), t.fixture);
    assert.ok(t.encargo.length > 30);
    assert.ok(t.comprobaciones.length > 0);
    for (const c of t.comprobaciones) {
      assert.ok(['contiene', 'no_contiene', 'comando', 'solo_ficheros', 'fichero_contiene'].includes(c.tipo), c.tipo);
      if (c.patron) assert.doesNotThrow(() => aRegExp(c.patron));
    }
  });
}

test('aRegExp entiende las banderas (?i) y (?s) al principio', () => {
  assert.ok(aRegExp('(?i)bloquear').test('BLOQUEAR'));
  assert.ok(aRegExp('(?s)a.*b').test('a\nb'));
  assert.ok(!aRegExp('bloquear').test('BLOQUEAR'));
});

test('evaluar puntúa texto, comandos y ficheros cambiados', () => {
  const tarea = TAREAS.find((t) => t.id === 'revisor-sql');
  const bueno = '## Revisión\n**Veredicto:** BLOQUEAR\n| 1 | crítica | src/buscar.mjs:3 | SQL concatenada |';
  const malo = '**Veredicto:** APROBAR';
  assert.ok(evaluar(tarea, bueno, '.').every((c) => c.ok));
  assert.ok(!evaluar(tarea, malo, '.').every((c) => c.ok));
  const alcance = TAREAS.find((t) => t.id === 'implementador-alcance');
  const pasa = evaluar(alcance, '', '.', { ejecutar: () => true, cambiados: () => ['src/descuento.mjs', 'test/descuento.test.mjs'] });
  assert.ok(pasa.every((c) => c.ok));
  const fuera = evaluar(alcance, '', '.', { ejecutar: () => true, cambiados: () => ['src/descuento.mjs', 'src/precio.mjs'] });
  assert.ok(!fuera.every((c) => c.ok));
});

test('el fixture de gobernanza no usa correos de proveedores reales', () => {
  const tarea = TAREAS.find((t) => t.id === 'gobernanza-datos');
  assert.ok(evaluar(tarea, 'Datos | 0 | clientes.csv contiene un correo', '.', { cambiados: () => [] }).every((c) => c.ok));
  assert.ok(!evaluar(tarea, 'Datos | 0 | clientes.csv: ana.garcia@correo-ejemplo.es', '.', { cambiados: () => [] }).every((c) => c.ok));
});

test('resumir calcula pass@1 global y por agente', () => {
  const r = resumir([{ agente: 'a', pasa: true }, { agente: 'a', pasa: false }, { agente: 'b', pasa: true }]);
  assert.equal(r.pass_at_1, 2 / 3);
  assert.deepEqual(r.por_agente.a, { tareas: 2, pasan: 1 });
});

const TRANSCRIPCION = [
  JSON.stringify({ message: { id: 'm1', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 } } }),
  JSON.stringify({ message: { id: 'm1', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 } } }),
  JSON.stringify({ message: { id: 'm2', usage: { input_tokens: 50, output_tokens: 10, cache_creation_input_tokens: 7 } } }),
  'no es json',
  JSON.stringify({ type: 'user', message: { content: 'hola' } }),
].join('\n');

test('contarTokens suma una vez por mensaje y tolera líneas raras', () => {
  assert.deepEqual(contarTokens('t.jsonl', () => TRANSCRIPCION), { entrada: 150, salida: 30, cache_lectura: 5, cache_escritura: 7 });
  assert.equal(contarTokens(undefined), null);
  assert.equal(contarTokens('no-existe.jsonl', () => { throw new Error('ENOENT'); }), null);
});

test('el evento de fin lleva los tokens y el de inicio no', () => {
  const fin = evento({ hook_event_name: 'SubagentStop', agent_type: 'enjambre:enjambre-revisor', agent_transcript_path: 't' }, new Date(), () => TRANSCRIPCION);
  assert.equal(fin.tokens.entrada, 150);
  assert.equal('tokens' in evento({ hook_event_name: 'SubagentStart', agent_type: 'enjambre-revisor' }), false);
});

test('resumirActividad suma ejecuciones, segundos y tokens por agente', () => {
  const lineas = [
    { fecha: '2026-11-21T10:00:00Z', evento: 'inicio', agente: 'enjambre-revisor', agent_id: 'x' },
    { fecha: '2026-11-21T10:01:30Z', evento: 'fin', agente: 'enjambre-revisor', agent_id: 'x', tokens: { entrada: 10, salida: 5, cache_lectura: 2, cache_escritura: 1 } },
  ].map((o) => JSON.stringify(o));
  assert.deepEqual(resumirActividad(lineas)['enjambre-revisor'], { ejecuciones: 1, segundos: 90, tokens_entrada: 10, tokens_salida: 5, tokens_cache: 3 });
});

test('evals: solo se saltan permisos en el devcontainer o en GitHub Actions', () => {
  assert.equal(modoPermisos({}), 'acceptEdits');
  assert.equal(modoPermisos({ DEVCONTAINER: 'true' }), 'bypassPermissions');
  assert.equal(modoPermisos({ GITHUB_ACTIONS: 'true' }), 'bypassPermissions');
  assert.equal(modoPermisos({ GITHUB_ACTIONS: 'false' }), 'acceptEdits');
});

test('evals: la tabla del resumen marca cada tarea y el motivo del fallo', () => {
  const resultados = [
    { id: 'a', agente: 'enjambre-revisor', pasa: true, turnos: 3, segundos: 40, error: null, comprobaciones: [{ tipo: 'contiene', ok: true }] },
    { id: 'b', agente: 'enjambre-seguridad', pasa: false, turnos: null, segundos: 9, error: null, comprobaciones: [{ tipo: 'contiene', ok: false }] },
  ];
  const tabla = tablaResumen(resumir(resultados), resultados);
  assert.match(tabla, /pass@1 50 % \(1\/2\)/);
  assert.match(tabla, /\| a \| enjambre-revisor \| PASA \| 3 \| 40 \|  \|/);
  assert.match(tabla, /\| b \| enjambre-seguridad \| FALLA \| — \| 9 \| contiene \|/);
});
