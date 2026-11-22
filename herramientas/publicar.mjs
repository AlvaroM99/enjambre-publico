// Publica una instantánea del repositorio privado de Enjambre en el repositorio público.
// No copia el historial: los commits privados llevan el correo personal de Álvaro. Cada publicación es un commit
// nuevo en el público, firmado con la dirección noreply de GitHub. Solo lo ejecuta Álvaro (los agentes no pueden
// hacer push a main: hook bloquear-comandos). Ver docs/decisiones/0006-repo-publico-y-organigrama.md.
//
// Uso:  node herramientas/publicar.mjs            (publica)
//       node herramientas/publicar.mjs --prueba   (prepara el commit en una carpeta temporal y no hace push)
//
// Tras publicar crea la etiqueta v<versión de plugin.json> si no existe: los proyectos instalan el plugin desde esa
// etiqueta (vars.ENJAMBRE_VERSION, ADR 0009). Si la etiqueta ya existe en otro commit, avisa de subir la versión.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLICO = 'AlvaroM99/enjambre-publico';
export const AUTOR = { nombre: 'AlvaroM99', correo: '129555669+AlvaroM99@users.noreply.github.com' };
// Patrones que nunca deben salir al repositorio público (se comprueban sobre el contenido versionado).
export const PROHIBIDO = [
  ['correo personal', /[A-Za-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.[a-z]{2,}/i],
  ['token de GitHub', /\b(ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['clave de API', /\b(sk-ant-|sk-)[A-Za-z0-9_-]{20,}/],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const git = (args, cwd = RAIZ, opciones = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opciones });

export function etiquetaDe(pluginJson) {
  const version = JSON.parse(pluginJson).version;
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error(`Versión no válida en plugin.json: ${version}`);
  return `v${version}`;
}

export function revisarContenido(ficheros) {
  const problemas = [];
  for (const [ruta, contenido] of ficheros) {
    for (const [tipo, patron] of PROHIBIDO) if (patron.test(contenido)) problemas.push(`${ruta}: ${tipo}`);
  }
  return problemas;
}

function principal() {
  const prueba = process.argv.includes('--prueba');
  if (git(['status', '--porcelain']).trim()) throw new Error('Hay cambios sin commit: publica solo desde un árbol limpio.');
  if (git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() !== 'main') throw new Error('Publica desde main.');
  const sha = git(['rev-parse', '--short', 'HEAD']).trim();

  // Contenido exacto de HEAD (bytes del repositorio, sin depender de los finales de línea locales).
  const entradas = git(['ls-tree', '-r', '-z', 'HEAD']).split('\0').filter(Boolean).map((l) => {
    const [meta, ruta] = l.split('\t');
    const [modo, , blob] = meta.split(' ');
    return { modo, blob, ruta };
  });
  const ficheros = entradas.map((e) => [e.ruta, execFileSync('git', ['cat-file', 'blob', e.blob], { cwd: RAIZ })]);
  const problemas = revisarContenido(ficheros.map(([r, b]) => [r, b.toString('utf8')]));
  if (problemas.length) throw new Error(`No se publica: contenido prohibido\n${problemas.join('\n')}`);

  const destino = mkdtempSync(join(tmpdir(), 'enjambre-publico-'));
  git(['clone', '--quiet', `https://github.com/${PUBLICO}.git`, destino]);
  for (const nombre of readdirSync(destino)) if (nombre !== '.git') rmSync(join(destino, nombre), { recursive: true, force: true });
  for (const [ruta, bytes] of ficheros) {
    mkdirSync(dirname(join(destino, ruta)), { recursive: true });
    writeFileSync(join(destino, ruta), bytes);
  }
  const etiqueta = etiquetaDe(ficheros.find(([r]) => r === 'plugins/enjambre/.claude-plugin/plugin.json')[1].toString('utf8'));
  git(['add', '-A'], destino);
  if (!git(['status', '--porcelain'], destino).trim()) {
    console.log('El repositorio público ya está al día.');
    if (!prueba) etiquetar(destino, etiqueta);
    return;
  }
  git(['-c', `user.name=${AUTOR.nombre}`, '-c', `user.email=${AUTOR.correo}`, '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '-m', `chore: sync from private repository (${sha})`], destino);
  if (prueba) {
    console.log(`Prueba: commit preparado en ${destino}; no se ha hecho push.`);
    return;
  }
  git(['push', '--quiet', 'origin', 'HEAD:main'], destino);
  console.log(`Publicado ${sha} en https://github.com/${PUBLICO}`);
  etiquetar(destino, etiqueta);
}

function etiquetar(destino, etiqueta) {
  const remota = git(['ls-remote', '--tags', 'origin', `refs/tags/${etiqueta}`], destino).trim().split(/\s/)[0];
  const actual = git(['rev-parse', 'HEAD'], destino).trim();
  if (remota === actual) return console.log(`Etiqueta ${etiqueta} ya apunta a esta versión (${actual}).`);
  if (remota) return console.log(`Aviso: ${etiqueta} ya existe en otro commit. Sube la versión en plugin.json y vuelve a publicar para que los proyectos la reciban.`);
  git(['tag', etiqueta], destino);
  git(['push', '--quiet', 'origin', `refs/tags/${etiqueta}`], destino);
  console.log(`Etiqueta ${etiqueta} creada en ${actual}.`);
  console.log(`Para llevar esta versión a un proyecto (los workflows se fijan por SHA, no por etiqueta):`);
  console.log(`  gh variable set ENJAMBRE_VERSION -R AlvaroM99/<repo> --body ${actual}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    principal();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
