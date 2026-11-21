// Banco de evaluaciones de Enjambre (historia S28). Ejecuta cada tarea de evals/tareas.json con su agente en una
// copia temporal de su fixture y puntúa pass@1 con comprobaciones deterministas (texto, comandos y ficheros).
//
// Uso:  node evals/ejecutar.mjs --simular            valida las tareas y muestra qué se ejecutaría (sin Claude)
//       node evals/ejecutar.mjs                      ejecuta todas (necesita `claude` con sesión iniciada)
//       node evals/ejecutar.mjs --tarea revisor-sql  ejecuta una
//
// Ejecútalo dentro del devcontainer: allí usa --permission-mode bypassPermissions con el sandbox y los hooks
// activos. Fuera del contenedor usa acceptEdits y los comandos de shell piden permiso [POR CONFIRMAR en -p].
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const PLUGIN = join(RAIZ, 'plugins', 'enjambre');
export const TAREAS = JSON.parse(readFileSync(join(RAIZ, 'evals', 'tareas.json'), 'utf8'));

// «(?i)patrón» y «(?s)patrón»: banderas al principio, como en Python; JavaScript las recibe aparte.
export function aRegExp(patron) {
  const m = patron.match(/^\(\?([ims]+)\)/);
  return m ? new RegExp(patron.slice(m[0].length), m[1]) : new RegExp(patron);
}

export function ficherosCambiados(cwd) {
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const sinCommit = git(['status', '--porcelain=v1', '-uall']).split('\n').filter(Boolean).map((l) => l.slice(3).trim());
  const enRamas = git(['diff', '--name-only', 'main', 'HEAD']).split('\n').filter(Boolean);
  return [...new Set([...sinCommit, ...enRamas])].map((f) => f.replace(/\\/g, '/')).sort();
}

export function evaluar(tarea, salida, cwd, { cambiados = () => ficherosCambiados(cwd), ejecutar } = {}) {
  const correr = ejecutar ?? ((comando) => spawnSync(comando, { cwd, shell: true, encoding: 'utf8', timeout: 120000 }).status === 0);
  return tarea.comprobaciones.map((c) => {
    let ok;
    switch (c.tipo) {
      case 'contiene': ok = aRegExp(c.patron).test(salida); break;
      case 'no_contiene': ok = !aRegExp(c.patron).test(salida); break;
      case 'comando': ok = correr(c.comando); break;
      case 'solo_ficheros': ok = cambiados().every((f) => c.ficheros.includes(f)); break;
      case 'fichero_contiene': {
        const ruta = join(cwd, c.fichero);
        ok = existsSync(ruta) && aRegExp(c.patron).test(readFileSync(ruta, 'utf8'));
        break;
      }
      default: throw new Error(`comprobación desconocida: ${c.tipo}`);
    }
    return { ...c, ok };
  });
}

function prepararFixture(nombre) {
  const dir = mkdtempSync(join(tmpdir(), `enjambre-eval-${nombre}-`));
  cpSync(join(RAIZ, 'evals', 'fixtures', nombre), dir, { recursive: true });
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git(['init', '-q', '-b', 'main']);
  git(['add', '-A']);
  git(['-c', 'user.name=enjambre-evals', '-c', 'user.email=evals@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture']);
  return dir;
}

function lanzarAgente(tarea, cwd) {
  const modo = process.env.DEVCONTAINER === 'true' ? 'bypassPermissions' : 'acceptEdits';
  const r = spawnSync(process.env.CLAUDE_BIN || 'claude', ['-p', tarea.encargo, '--agent', `enjambre:${tarea.agente}`,
    '--plugin-dir', PLUGIN, '--output-format', 'json', '--permission-mode', modo],
  { cwd, encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  try {
    const j = JSON.parse(r.stdout);
    return { salida: String(j.result ?? ''), turnos: j.num_turns ?? null, coste_usd: j.total_cost_usd ?? null, error: j.is_error ? j.subtype : null };
  } catch {
    return { salida: r.stdout || '', turnos: null, coste_usd: null, error: (r.stderr || 'salida no JSON').slice(0, 500) };
  }
}

export function resumir(resultados) {
  const porAgente = {};
  for (const r of resultados) {
    porAgente[r.agente] ??= { tareas: 0, pasan: 0 };
    porAgente[r.agente].tareas += 1;
    if (r.pasa) porAgente[r.agente].pasan += 1;
  }
  const pasan = resultados.filter((r) => r.pasa).length;
  return { total: resultados.length, pasan, pass_at_1: resultados.length ? pasan / resultados.length : 0, por_agente: porAgente };
}

function principal() {
  const simular = process.argv.includes('--simular');
  const i = process.argv.indexOf('--tarea');
  const tareas = i > 0 ? TAREAS.filter((t) => t.id === process.argv[i + 1]) : TAREAS;
  if (!tareas.length) throw new Error('No hay tareas con ese id.');
  const resultados = [];
  for (const tarea of tareas) {
    for (const c of tarea.comprobaciones) if (c.patron) aRegExp(c.patron);
    if (simular) {
      console.log(`· ${tarea.id} → ${tarea.agente} sobre ${tarea.fixture} (${tarea.comprobaciones.length} comprobaciones)`);
      continue;
    }
    const cwd = prepararFixture(tarea.fixture);
    const inicio = Date.now();
    const agente = lanzarAgente(tarea, cwd);
    const comprobaciones = evaluar(tarea, agente.salida, cwd);
    const pasa = !agente.error && comprobaciones.every((c) => c.ok);
    resultados.push({ id: tarea.id, agente: tarea.agente, pasa, segundos: Math.round((Date.now() - inicio) / 1000), ...agente, salida: undefined, comprobaciones });
    console.log(`${pasa ? 'PASA ' : 'FALLA'} ${tarea.id}${agente.error ? ` (${agente.error})` : ''}`);
    rmSync(cwd, { recursive: true, force: true });
  }
  if (simular) {
    console.log(`\n${tareas.length} tareas válidas. Para ejecutarlas: node evals/ejecutar.mjs (con claude con sesión iniciada).`);
    return;
  }
  const resumen = resumir(resultados);
  const dir = join(RAIZ, 'evals', 'resultados');
  mkdirSync(dir, { recursive: true });
  const fichero = join(dir, `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  writeFileSync(fichero, JSON.stringify({ fecha: new Date().toISOString(), resumen, resultados }, null, 2));
  console.log(`\npass@1: ${(resumen.pass_at_1 * 100).toFixed(0)} % (${resumen.pasan}/${resumen.total}). Detalle: ${fichero}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    principal();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
