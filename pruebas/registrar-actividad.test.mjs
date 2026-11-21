// Pruebas del hook registrar-actividad (SubagentStart / SubagentStop).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evento } from '../plugins/enjambre/scripts/registrar-actividad.mjs';

const SCRIPT = fileURLToPath(new URL('../plugins/enjambre/scripts/registrar-actividad.mjs', import.meta.url));
const HOOKS = fileURLToPath(new URL('../plugins/enjambre/hooks/hooks.json', import.meta.url));
const FECHA = new Date('2026-11-21T10:00:00Z');

test('registra inicio y fin de agentes de Enjambre sin contenido de la conversación', () => {
  const inicio = evento({ hook_event_name: 'SubagentStart', agent_type: 'enjambre:enjambre-revisor', agent_id: 'a1', session_id: 's1', prompt: 'secreto' }, FECHA);
  assert.deepEqual(inicio, { fecha: '2026-11-21T10:00:00.000Z', evento: 'inicio', agente: 'enjambre-revisor', agent_id: 'a1', sesion: 's1' });
  assert.equal(evento({ hook_event_name: 'SubagentStop', agent_type: 'enjambre-verificador' }, FECHA).evento, 'fin');
});

test('ignora agentes que no son de Enjambre', () => {
  assert.equal(evento({ hook_event_name: 'SubagentStart', agent_type: 'Explore' }), null);
  assert.equal(evento({ hook_event_name: 'SubagentStart', agent_type: 'otro:enjambre-revisor' }), null);
  assert.equal(evento({}), null);
});

test('el hook escribe actividad.jsonl y sale siempre con 0, también con entrada rota', () => {
  const dir = mkdtempSync(join(tmpdir(), 'enjambre-act-'));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: dir };
  const r = spawnSync(process.execPath, [SCRIPT], { input: JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: 'enjambre:enjambre-analista' }), env, encoding: 'utf8' });
  assert.equal(r.status, 0);
  const lineas = readFileSync(join(dir, 'actividad.jsonl'), 'utf8').trim().split('\n');
  assert.equal(JSON.parse(lineas[0]).agente, 'enjambre-analista');
  const roto = spawnSync(process.execPath, [SCRIPT], { input: 'no es json', env: { ...process.env, CLAUDE_PLUGIN_DATA: join(dir, 'b') }, encoding: 'utf8' });
  assert.equal(roto.status, 0);
  assert.equal(existsSync(join(dir, 'b', 'actividad.jsonl')), false);
});

test('hooks.json registra la actividad en SubagentStart y SubagentStop sin bloquear', () => {
  const { hooks } = JSON.parse(readFileSync(HOOKS, 'utf8'));
  for (const ev of ['SubagentStart', 'SubagentStop']) {
    const h = hooks[ev]?.[0]?.hooks?.[0];
    assert.ok(h?.args?.some((a) => a.endsWith('registrar-actividad.mjs')), ev);
    assert.notEqual(h.onFailure, 'block', `${ev}: nunca debe bloquear`);
  }
});
