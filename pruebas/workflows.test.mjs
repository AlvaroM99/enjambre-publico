// Pruebas de las reglas de seguridad de los workflows de GitHub Actions (skill ci-cd, ADR 0005).
// Revisa las plantillas de la skill y los workflows del propio repo sin dependencias: busca patrones en el texto.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const CARPETAS = [join(RAIZ, 'plugins', 'enjambre', 'skills', 'ci-cd', 'workflows'), join(RAIZ, '.github', 'workflows')];

const workflows = CARPETAS.filter(existsSync).flatMap((dir) =>
  readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ nombre: `${dir.includes('.github') ? '.github' : 'ci-cd'}/${f}`, texto: readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n') })));

// Líneas sin comentarios (para no contar lo que está comentado).
const lineas = (texto) => texto.split('\n').filter((l) => !/^\s*#/.test(l));

test('hay plantillas de workflows y CI propia', () => {
  const nombres = workflows.map((w) => w.nombre);
  for (const n of ['ci-cd/ci.yml', 'ci-cd/enjambre-planificar.yml', 'ci-cd/enjambre-implementar.yml', 'ci-cd/enjambre-revisar.yml',
    'ci-cd/enjambre-investigar.yml', 'ci-cd/produccion.yml', '.github/ci.yml']) {
    assert.ok(nombres.includes(n), `falta ${n}`);
  }
});

for (const { nombre, texto } of workflows) {
  test(`workflow ${nombre}: Actions fijadas por SHA con versión comentada`, () => {
    for (const l of lineas(texto)) {
      const m = l.match(/^\s*-?\s*uses:\s*(\S+)(.*)$/);
      if (!m || m[1].startsWith('./')) continue;
      assert.match(m[1], /^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}$/, `sin SHA: ${l.trim()}`);
      assert.match(m[2], /#\s*v\d/, `sin versión comentada: ${l.trim()}`);
    }
  });

  test(`workflow ${nombre}: permisos por defecto de solo lectura`, () => {
    assert.match(texto, /^permissions:\n\s+contents: read\n(?!\s+\w+: write)/m, 'permissions de nivel superior = contents: read');
  });

  test(`workflow ${nombre}: concurrency y timeout en cada job`, () => {
    assert.match(texto, /^concurrency:/m);
    const jobs = texto.split(/^jobs:\n/m)[1] ?? '';
    const nombresJobs = [...jobs.matchAll(/^ {2}([\w-]+):\n/gm)].map((m) => m[1]);
    assert.ok(nombresJobs.length > 0);
    const timeouts = (jobs.match(/^ {4}timeout-minutes:\s*\d+/gm) ?? []).length;
    assert.equal(timeouts, nombresJobs.length, 'cada job con timeout-minutes');
  });

  test(`workflow ${nombre}: sin disparadores peligrosos ni texto de usuarios en run`, () => {
    const activo = lineas(texto).join('\n');
    assert.doesNotMatch(activo, /pull_request_target|workflow_run/);
    assert.doesNotMatch(activo, /run:.*\$\{\{\s*github\.event\.(issue|pull_request|comment)\.(title|body)/);
    assert.doesNotMatch(activo, /echo .*\$\{\{\s*secrets\./);
  });
}

test('los workflows de agentes solo los dispara el propietario', () => {
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    assert.match(texto, /(sender\.login|github\.actor) == github\.repository_owner/, nombre);
    assert.match(texto, /claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/, nombre);
  }
});

test('producción: solo manual, propietario, main y confirmación escrita', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/produccion.yml');
  const disparadores = texto.split(/^on:\n/m)[1].split(/^\S/m)[0];
  assert.deepEqual([...disparadores.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]), ['workflow_dispatch']);
  assert.match(texto, /github\.actor == github\.repository_owner/);
  assert.match(texto, /inputs\.confirmar == 'DESPLEGAR'/);
  assert.match(texto, /github\.ref == 'refs\/heads\/main'/);
});

test('implementar comprueba el límite WIP antes de lanzar al agente', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-implementar.yml');
  assert.match(texto, /vars\.ENJAMBRE_WIP/);
  assert.match(texto, /needs: limite-wip/);
});
