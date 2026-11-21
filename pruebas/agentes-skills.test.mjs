// Pruebas de los agentes, skills y plantillas de Enjambre (historias S9–S13 y ADR 0003).
// Comprueban el frontmatter (campos obligatorios y válidos), los permisos del revisor y del jefe,
// y que las plantillas copiadas dentro de las skills no se desvían de plantillas/.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const PLUGIN = join(RAIZ, 'plugins', 'enjambre');
const AGENTES = join(PLUGIN, 'agents');
const SKILLS = join(PLUGIN, 'skills');
const PLANTILLAS = join(RAIZ, 'plantillas');

// Frontmatter YAML sencillo: `clave: valor`, listas con `  - elemento` y comentarios `#`.
// Falla si encuentra algo que no sabe leer, para no dar por bueno un frontmatter roto.
export function leerFrontmatter(texto) {
  const m = texto.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error('sin bloque de frontmatter');
  const datos = {};
  let lista = null;
  for (const linea of m[1].split('\n')) {
    if (!linea.trim() || linea.trimStart().startsWith('#')) continue;
    const elemento = linea.match(/^\s+-\s+(.+)$/);
    if (elemento) {
      if (!lista) throw new Error(`elemento de lista sin clave: ${linea}`);
      lista.push(elemento[1].trim());
      continue;
    }
    const par = linea.match(/^([A-Za-z][\w-]*):(?:\s+(.*))?$/);
    if (!par) throw new Error(`línea no reconocida: ${linea}`);
    const [, clave, valor = ''] = par;
    if (clave in datos) throw new Error(`clave repetida: ${clave}`);
    if (valor === '') {
      lista = datos[clave] = [];
    } else {
      lista = null;
      if (/:\s/.test(valor) && !/^["']/.test(valor)) throw new Error(`«: » sin comillas en ${clave}`);
      datos[clave] = valor.replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  return { datos, cuerpo: texto.slice(m[0].length) };
}

const comoLista = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean));

// ---------- agentes ----------

const AGENTES_MVP = ['enjambre-coordinador', 'enjambre-analista', 'enjambre-jefe-proyecto', 'enjambre-implementador',
  'enjambre-plataforma', 'enjambre-revisor', 'enjambre-seguridad', 'enjambre-verificador', 'enjambre-investigador',
  'enjambre-gobernanza'];
const SOLO_LECTURA = ['enjambre-coordinador', 'enjambre-analista', 'enjambre-jefe-proyecto', 'enjambre-revisor',
  'enjambre-investigador', 'enjambre-seguridad', 'enjambre-gobernanza'];
// Escriben código: cada instancia en su worktree para poder trabajar en paralelo (ADR 0003).
const ESCRITORES = ['enjambre-implementador', 'enjambre-plataforma'];
// Opus confirmado en el plan Pro (ADR 0003): solo para planificar y revisar.
const CON_OPUS = ['enjambre-jefe-proyecto', 'enjambre-revisor'];
const HERRAMIENTAS_DE_ESCRITURA = ['Edit', 'Write', 'NotebookEdit'];
// https://code.claude.com/docs/en/sub-agents (tabla «Frontmatter reference»).
const CAMPOS_AGENTE = new Set(['name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode', 'maxTurns',
  'autoCompactWindow', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'omitClaudeMd', 'effort', 'isolation',
  'color', 'initialPrompt', 'experimental']);
// Misma página: un plugin no puede usarlos («These fields are ignored when loading agents from a plugin»).
const CAMPOS_IGNORADOS_EN_PLUGIN = ['hooks', 'mcpServers', 'permissionMode', 'initialPrompt'];
const MODELOS = new Set(['sonnet', 'opus', 'haiku', 'fable', 'inherit']);

const agente = (nombre) => leerFrontmatter(readFileSync(join(AGENTES, `${nombre}.md`), 'utf8'));
const skillsDisponibles = readdirSync(SKILLS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test('existen exactamente los 10 agentes de Enjambre', () => {
  const ficheros = readdirSync(AGENTES).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual(ficheros, [...AGENTES_MVP].sort());
});

for (const nombre of AGENTES_MVP) {
  test(`agente ${nombre}: frontmatter válido`, () => {
    const { datos, cuerpo } = agente(nombre);
    assert.equal(datos.name, nombre, 'name debe coincidir con el fichero');
    assert.ok(!datos.name.includes(':'), 'name no puede contener «:»');
    assert.ok(datos.description?.length >= 50, 'description obligatoria y útil para delegar');
    assert.ok(!/[<>]/.test(datos.description), 'description sin < ni >');
    for (const clave of Object.keys(datos)) assert.ok(CAMPOS_AGENTE.has(clave), `campo desconocido: ${clave}`);
    for (const clave of CAMPOS_IGNORADOS_EN_PLUGIN) assert.ok(!(clave in datos), `${clave} se ignora en agentes de plugin`);
    assert.ok(MODELOS.has(datos.model), `modelo no válido: ${datos.model}`);
    assert.match(datos.maxTurns ?? '', /^[1-9]\d*$/, 'maxTurns entero positivo');
    assert.ok(Number(datos.maxTurns) <= 30, 'maxTurns bajo (ADR 0001, límites de Pro)');
    assert.ok(comoLista(datos.tools).length > 0, 'tools explícito: sin él hereda todas las herramientas');
    assert.ok(cuerpo.trim().length > 200, 'prompt de sistema presente');
  });

  test(`agente ${nombre}: precarga reglas-enjambre y solo skills que existen`, () => {
    const skills = comoLista(agente(nombre).datos.skills);
    assert.ok(skills.includes('enjambre:reglas-enjambre'));
    for (const s of skills) {
      assert.match(s, /^enjambre:[a-z0-9-]+$/, `skill con espacio de nombres del plugin: ${s}`);
      assert.ok(skillsDisponibles.includes(s.slice('enjambre:'.length)), `skill inexistente: ${s}`);
    }
  });
}

for (const nombre of SOLO_LECTURA) {
  test(`agente ${nombre}: sin herramientas de escritura`, () => {
    const { datos } = agente(nombre);
    const tools = comoLista(datos.tools);
    const prohibidas = comoLista(datos.disallowedTools);
    for (const h of HERRAMIENTAS_DE_ESCRITURA) {
      assert.ok(!tools.some((t) => t === h || t.startsWith(`${h}(`)), `${h} no puede estar en tools`);
      assert.ok(prohibidas.includes(h), `${h} debe estar en disallowedTools`);
    }
    // `memory` activa Read, Write y Edit automáticamente (docs de subagentes).
    assert.ok(!('memory' in datos), 'memory daría Write/Edit al agente');
  });
}

for (const nombre of ESCRITORES) {
  test(`agente ${nombre}: trabaja aislado en un worktree`, () => {
    assert.equal(agente(nombre).datos.isolation, 'worktree');
  });
}

test('solo el jefe de proyecto y el revisor usan Opus', () => {
  for (const nombre of AGENTES_MVP) {
    assert.equal(agente(nombre).datos.model, CON_OPUS.includes(nombre) ? 'opus' : 'sonnet', nombre);
  }
});

test('investigador, seguridad y gobernanza abren propuestas, no historias listas', () => {
  for (const nombre of ['enjambre-investigador', 'enjambre-seguridad', 'enjambre-gobernanza']) {
    const { cuerpo } = agente(nombre);
    assert.ok(cuerpo.includes('enjambre:propuesta'), nombre);
  }
});

test('solo el analista navega por internet (regla de dos: lee web, no escribe código)', () => {
  for (const nombre of AGENTES_MVP) {
    const web = comoLista(agente(nombre).datos.tools).some((t) => t === 'WebSearch' || t === 'WebFetch');
    assert.equal(web, nombre === 'enjambre-analista', nombre);
  }
});

test('el coordinador solo puede lanzar agentes de Enjambre (y Explore) y no escribe', () => {
  const { datos, cuerpo } = agente('enjambre-coordinador');
  const lanzables = [...datos.tools.matchAll(/enjambre:(enjambre-[a-z-]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(lanzables, AGENTES_MVP.filter((a) => a !== 'enjambre-coordinador').sort());
  for (const puerta of ['Puerta 1', 'Puerta 2', 'Máximo **2 ciclos**']) assert.ok(cuerpo.includes(puerta), puerta);
});

test('el revisor emite un veredicto APROBAR | CAMBIOS | BLOQUEAR con fichero:línea y severidad', () => {
  const { cuerpo } = agente('enjambre-revisor');
  for (const t of ['APROBAR', 'CAMBIOS', 'BLOQUEAR', 'Fichero:línea', 'Severidad']) assert.ok(cuerpo.includes(t), t);
});

test('el verificador informa PASA/FALLA y no despliega', () => {
  const { cuerpo } = agente('enjambre-verificador');
  for (const t of ['PASA', 'FALLA', 'Desplegar']) assert.ok(cuerpo.includes(t), t);
});

// ---------- skills ----------

const SKILLS_MVP = ['reglas-enjambre', 'planificar', 'git-enjambre', 'pruebas', 'documentar', 'verificar-e2e',
  'arnes-claude-code', 'tomar-decisiones', 'pedir-detalles', 'referencias-estandar', 'ci-cd', 'investigar-estado-del-arte',
  'gobernanza'];

test('existen exactamente las skills de Enjambre', () => {
  assert.deepEqual([...skillsDisponibles].sort(), [...SKILLS_MVP].sort());
});
// https://code.claude.com/docs/en/skills (tabla «Frontmatter reference»).
const CAMPOS_SKILL = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation',
  'user-invocable', 'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks',
  'paths', 'shell', 'metadata', 'license', 'compatibility']);

for (const nombre of SKILLS_MVP) {
  test(`skill ${nombre}: SKILL.md válido`, () => {
    const ruta = join(SKILLS, nombre, 'SKILL.md');
    assert.ok(existsSync(ruta), 'falta SKILL.md');
    const texto = readFileSync(ruta, 'utf8');
    const { datos, cuerpo } = leerFrontmatter(texto);
    assert.equal(datos.name, nombre, 'name debe coincidir con la carpeta');
    assert.match(datos.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(datos.description?.length >= 50 && datos.description.length <= 1536, 'description entre 50 y 1536 caracteres');
    assert.ok(!/[<>]/.test(datos.description), 'description sin < ni >');
    for (const clave of Object.keys(datos)) assert.ok(CAMPOS_SKILL.has(clave), `campo desconocido: ${clave}`);
    // Las skills con disable-model-invocation no se pueden precargar en subagentes.
    assert.notEqual(datos['disable-model-invocation'], 'true');
    assert.ok(texto.split('\n').length < 500, 'SKILL.md por debajo de 500 líneas');
    assert.ok(cuerpo.trim().length > 200);
  });
}

// ---------- plantillas ----------

const COPIAS = [
  ['plan.md', 'planificar/plantilla-plan.md'],
  ['adr.md', 'planificar/plantilla-adr.md'],
  ['pr.md', 'git-enjambre/plantilla-pr.md'],
  ['informe-qa.md', 'verificar-e2e/plantilla-informe-qa.md'],
  ['investigacion.md', 'investigar-estado-del-arte/plantilla-investigacion.md'],
  ['gobernanza.md', 'gobernanza/plantilla-gobernanza.md'],
];

for (const [original, copia] of COPIAS) {
  test(`plantilla ${original}: la copia de la skill (${copia}) es idéntica`, () => {
    assert.equal(readFileSync(join(SKILLS, copia), 'utf8'), readFileSync(join(PLANTILLAS, original), 'utf8'));
  });
}

test('plantilla de PR con las secciones acordadas', () => {
  const pr = readFileSync(join(PLANTILLAS, 'pr.md'), 'utf8');
  for (const s of ['## Resumen', '## Issue', '## Cómo se probó', '## Riesgos', 'definición de hecho', '## Coste IA']) {
    assert.ok(pr.includes(s), `falta «${s}»`);
  }
});

test('plantilla de plan con criterios Dado/Cuando/Entonces, ficheros, pruebas, riesgos y estimación', () => {
  const plan = readFileSync(join(PLANTILLAS, 'plan.md'), 'utf8');
  for (const s of ['**Dado**', '**cuando**', '**entonces**', '### Ficheros afectados', '### Pruebas', '### Riesgos', '**Estimación:**']) {
    assert.ok(plan.includes(s), `falta «${s}»`);
  }
});

// ---------- el propio lector ----------

test('leerFrontmatter rechaza frontmatter roto', () => {
  assert.throws(() => leerFrontmatter('sin frontmatter'));
  assert.throws(() => leerFrontmatter('---\nname: x\ndescription: a: b\n---\n'));
  assert.throws(() => leerFrontmatter('---\nname: x\nname: y\n---\n'));
  assert.deepEqual(leerFrontmatter('---\nname: x\nskills:\n  - a\n  - b\n# nota\nmodel: sonnet\n---\ncuerpo').datos,
    { name: 'x', skills: ['a', 'b'], model: 'sonnet' });
});
