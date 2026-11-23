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
    // YAML inválido que GitHub rechaza sin ejecutar nada: un escalar entre comillas seguido de más texto.
    assert.doesNotMatch(activo, /^\s*(-\s*)?run:\s*"[^"\n]*"\s+\S/m, 'run: "…" seguido de texto; usa run: |');
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

test('el workflow de evaluaciones: solo a mano, solo el propietario y CLI fijada', () => {
  const { texto } = workflows.find((w) => w.nombre.endsWith('evals.yml'));
  const disparadores = texto.split(/^on:\n/m)[1].split(/^\S/m)[0];
  assert.deepEqual([...disparadores.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]), ['workflow_dispatch']);
  assert.match(texto, /github\.actor == github\.repository_owner/);
  assert.match(texto, /CLAUDE_CODE_VERSION: \d+\.\d+\.\d+/);
  assert.match(texto, /TAREA: \$\{\{ inputs\.tarea \}\}/, 'la entrada va por env, no dentro de run');
});

test('revisar: el job que mira ficheros sensibles puede leer el diff y falla cerrado', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-revisar.yml');
  const job = texto.split(/^ {2}sensible:\n/m)[1].split(/^ {2}\w[\w-]*:\n/m)[0];
  // gh pr diff necesita contents: read además de pull-requests: read (sin él, HTTP 403 en lobby#1, 22-11-2026).
  assert.match(job, /permissions:\n\s+contents: read\n\s+pull-requests: read/);
  assert.match(job, /if ! ficheros="\$\(gh pr diff "\$PR" --name-only\)"; then\n\s+echo "toca=si"/);
});

test('implementar: reserva WIP sin carreras y libera el hueco si el agente falla', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-implementar.yml');
  assert.match(texto, /--add-label enjambre:en-curso\n\s+en_curso=\$\(contar\)\n\s+if \[ "\$en_curso" -gt "\$WIP" \]/, 'vuelve a contar tras reservar');
  const liberar = texto.split(/^ {2}liberar:\n/m)[1];
  assert.ok(liberar, 'job liberar');
  assert.match(liberar, /needs\.implementar\.result != 'success'/);
  assert.match(liberar, /--remove-label enjambre:en-curso/);
});

test('revisar: revisor y seguridad pueden leer el issue enlazado', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-revisar.yml');
  assert.equal((texto.match(/contents: read\n\s+issues: read\n\s+pull-requests: write/g) ?? []).length, 2);
});

test('los workflows de agentes no dan por hecho un package-lock en la raíz', () => {
  // finance_tracker tiene el package.json en tracker/: con cache: npm o npm ci a secas, el job falla antes del agente.
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    assert.doesNotMatch(texto, /cache: npm/, nombre);
    assert.doesNotMatch(texto, /^\s*- run: npm ci\s*$/m, nombre);
  }
});

test('los workflows de agentes instalan el plugin fijado por SHA y fallan cerrados (M11)', () => {
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    const acciones = (texto.match(/uses: anthropics\/claude-code-action@/g) ?? []).length;
    assert.doesNotMatch(texto, /plugin_marketplaces: https:/, `${nombre}: el marketplace no puede seguir la rama main`);
    assert.equal((texto.match(/plugin_marketplaces: \$\{\{ runner\.temp \}\}\/enjambre-plugin/g) ?? []).length, acciones, nombre);
    // Las etiquetas se pueden mover: SHA completo en la variable y sin valor por defecto (revisiones de lobby#3).
    assert.equal((texto.match(/repository: AlvaroM99\/enjambre-publico\n\s+ref: \$\{\{ vars\.ENJAMBRE_VERSION \}\}\n/g) ?? []).length, acciones, nombre);
    assert.equal((texto.match(/grep -Eq '\^\[0-9a-f\]\{40\}\$'; then\n\s+echo "Falta ENJAMBRE_VERSION[^\n]*\n\s+exit 1/g) ?? []).length, acciones, `${nombre}: falla sin SHA`);
    assert.equal((texto.match(/mv \.enjambre-plugin "\$RUNNER_TEMP\/enjambre-plugin"/g) ?? []).length, acciones, `${nombre}: fuera del espacio de trabajo`);
  }
});

test('revisar: si el agente termina sin comentar, el workflow publica su respuesta final', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-revisar.yml');
  for (const job of ['revisor', 'seguridad']) {
    const bloque = texto.split(new RegExp(`^ {2}${job}:\n`, 'm'))[1].split(/^ {2}\w[\w-]*:\n/m)[0];
    assert.match(bloque, /- id: agente\n\s+uses: anthropics\/claude-code-action@/, job);
    assert.match(bloque, /Publicar el veredicto si el agente no lo hizo\n\s+if: always\(\) && steps\.agente\.outputs\.execution_file != ''/, job);
    assert.match(bloque, /FICHERO: \$\{\{ steps\.agente\.outputs\.execution_file \}\}/, `${job}: el fichero va por env`);
    assert.match(bloque, /"INICIO=\$\(date -u/, `${job}: solo cuentan comentarios de esta ejecución`);
  }
});

test('implementar: deja su respuesta en el issue y sin PR libera el hueco WIP', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-implementar.yml');
  const job = texto.split(/^ {2}implementar:\n/m)[1].split(/^ {2}liberar:\n/m)[0];
  assert.match(job, /- id: agente\n\s+uses: anthropics\/claude-code-action@/);
  assert.match(job, /Publicar el resumen del implementador en el issue\n\s+if: always\(\) && steps\.agente\.outputs\.execution_file != ''/);
  // Ramas enjambre/16-…, enjambre/16a-… (carril del plan) y enjambre/issue-16-… (finance_tracker#16 usó 16a, 23-11-2026).
  assert.match(job, /test\(\\"\^enjambre\/\(issue-\)\?\$ISSUE\[a-z\]\?-\\"\)\) \| \.headRefName" \| wc -l\)\n\s+if \[ "\$prs" -eq 0 \]; then/);
  const patron = /^enjambre\/(issue-)?16[a-z]?-/;
  assert.ok(['enjambre/16-ci', 'enjambre/16a-iguales', 'enjambre/issue-16-x'].every((r) => patron.test(r)));
  assert.ok(!['enjambre/160-x', 'enjambre/1-x', 'enjambre/16ab-x'].some((r) => patron.test(r)));
  assert.match(job, /Publicar el resumen del implementador en el issue\n[^\n]+\n[^\n]+\n\s+continue-on-error: true/, 'el resumen solo informa');
  assert.match(job, /github-actions\[bot\] o por el propietario/, 'solo vale el plan del bot o de Álvaro');
  assert.match(job, /«## Plan»/, 'el prompt señala el comentario del plan, no el último');
});

test('los workflows de agentes no añaden atribución a Claude en commits ni PR', () => {
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    const acciones = (texto.match(/uses: anthropics\/claude-code-action@/g) ?? []).length;
    const ajustes = texto.match(/settings: '(\{.*\})'/g) ?? [];
    assert.equal(ajustes.length, acciones, nombre);
    for (const a of ajustes) {
      assert.deepEqual(JSON.parse(a.slice(11, -1)).attribution, { commit: '', pr: '', sessionUrl: false }, nombre);
    }
  }
});

test('un job aparte retira las aprobaciones que no sean de Álvaro en todos los PR y falla cerrado (ADR 0011)', () => {
  for (const nombre of ['ci-cd/enjambre-revisar.yml', 'ci-cd/enjambre-implementar.yml']) {
    const { texto } = workflows.find((w) => w.nombre === nombre);
    const bloque = texto.split(/^ {2}aprobaciones:\n/m)[1];
    assert.ok(bloque, `${nombre}: job aprobaciones`);
    assert.match(bloque, /needs: \[[^\]]+\]\n\s+if: (>-\n\s+)?always\(\)/, nombre);
    assert.doesNotMatch(bloque, /needs\.[\w-]+\.result == 'success'/, `${nombre}: no depende de que otro job vaya bien`);
    assert.doesNotMatch(bloque, /actions\/checkout|claude-code-action/, `${nombre}: sin checkout ni agente`);
    assert.match(bloque, /permissions:\n\s+pull-requests: write\n\s+steps:/, `${nombre}: solo pull-requests`);
    assert.match(bloque, /set -euo pipefail/, `${nombre}: falla cerrado`);
    assert.match(bloque, /pulls\?state=open&per_page=100" --paginate/, `${nombre}: todos los PR abiertos, paginados`);
    assert.match(bloque, /\.state == "APPROVED" and \.user\.login != env\.PROPIETARIO/, `${nombre}: login por env, no interpolado`);
    assert.match(bloque, /\/dismissals/, nombre);
    assert.match(bloque, /if \[ "\$retiradas" -gt 0 \]; then exit 1; fi/, nombre);
    assert.doesNotMatch(texto.split(/^ {2}aprobaciones:\n/m)[0], /Retirar aprobaciones/, `${nombre}: nada en el job del agente`);
  }
});

// Jobs de un workflow como { nombre: texto }.
const jobsDe = (texto) => Object.fromEntries((texto.split(/^jobs:\n/m)[1] ?? '').split(/^(?= {2}[\w-]+:\n)/m)
  .filter((j) => /^ {2}[\w-]+:\n/.test(j)).map((j) => [j.match(/^ {2}([\w-]+):/)[1], j]));

test('implementar lanza la CI y la revisión sin pasar por Álvaro, con workflow_dispatch (ADR 0014)', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-implementar.yml');
  const job = jobsDe(texto)['pedir-revision'];
  assert.ok(job, 'falta el job pedir-revision');
  assert.match(job, /needs: implementar\n/);
  assert.match(job, /permissions:\n\s+actions: write\n\s+contents: write\n\s+pull-requests: write\n\s+statuses: write\n\s+steps:/, 'lanzar workflows, marcar listo y poner el estado del commit');
  // El PR llega listo para revisión aunque el agente lo abriera en borrador (Álvaro, 23-11-2026).
  assert.match(job, /isDraft --jq \.isDraft\)" = true \]; then\n\s+gh pr ready "\$pr"/);
  assert.match(job, /context="ci \(Enjambre\)"/, 'estado pendiente en el commit del PR');
  assert.doesNotMatch(job, /actions\/checkout|claude-code-action/, 'sin checkout ni agente');
  assert.match(job, /gh run list --commit "\$sha" --status action_required/, 'quita el aviso «Approve workflows to run»');
  assert.match(job, /gh workflow run ci\.yml --ref "\$rama"/);
  assert.match(job, /gh workflow run enjambre-revisar\.yml --ref "\$RAMA_PRINCIPAL" -f pr="\$pr"/, '--ref explícito: el token no puede leer la rama por defecto');
  assert.match(job, /RAMA_PRINCIPAL: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(texto, /no\s+#?\s*etiquetes el PR/, 'el prompt no pide etiquetar');
});

test('revisar admite workflow_dispatch solo del bot (ramas enjambre/) o de Álvaro, y revisa el commit del PR (ADR 0014)', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-revisar.yml');
  assert.match(texto, /^ {2}workflow_dispatch:\n\s+inputs:\n\s+pr:/m);
  const jobs = jobsDe(texto);
  const preparar = jobs.preparar;
  assert.ok(preparar, 'falta el job preparar');
  assert.match(preparar, /github\.actor == 'github-actions\[bot\]' \|\| github\.actor == github\.repository_owner/);
  assert.match(preparar, /github\.event\.sender\.login == github\.repository_owner/, 'la etiqueta, solo Álvaro');
  assert.match(preparar, /grep -Eq '\^\[0-9\]\+\$'/, 'número de PR validado');
  assert.match(preparar, /"\$repo" != "\$GH_REPO"/, 'solo PR de este repositorio');
  assert.match(preparar, /\[\[ "\$rama" != enjambre\/\* \]\]/, 'el bot solo para ramas enjambre/');
  assert.match(preparar, /permissions:\n\s+pull-requests: read\n/);
  for (const n of ['revisor', 'seguridad']) {
    assert.match(jobs[n], /needs: (preparar|\[preparar, sensible\])\n/, n);
    assert.match(jobs[n], /ref: \$\{\{ needs\.preparar\.outputs\.sha \}\}/, `${n}: checkout del commit del PR`);
    assert.doesNotMatch(jobs[n], /github\.event\.pull_request/, `${n}: el PR sale de preparar`);
  }
  assert.match(jobs.sensible, /needs: preparar\n/);
  for (const n of ['revisor', 'seguridad']) {
    assert.match(jobs[n], /allowed_bots: github-actions\[bot\]\n/, `${n}: la Action admite el bot que lanza la revisión`);
  }
  for (const { nombre, texto: w } of workflows) {
    assert.doesNotMatch(lineas(w).join('\n'), /allowed_bots:\s*['"]?\*/, `${nombre}: nunca allowed_bots '*'`);
    if (!/enjambre-revisar/.test(nombre)) assert.doesNotMatch(lineas(w).join('\n'), /allowed_bots:/, `${nombre}: solo revisar admite bots`);
  }
});

test('revisar marca el PR como listo solo con APROBAR y nunca aprueba ni fusiona (ADR 0011 y 0014)', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/enjambre-revisar.yml');
  const listo = jobsDe(texto).listo;
  assert.ok(listo, 'falta el job listo');
  assert.match(listo, /needs\.revisor\.result == 'success'/);
  assert.match(listo, /needs\.seguridad\.result == 'success' \|\| needs\.seguridad\.result == 'skipped'/);
  assert.match(listo, /\[ "\$revisor" != APROBAR \]/);
  assert.match(listo, /select\(\.user\.login == \\"github-actions\[bot\]\\"/, 'solo veredictos del bot');
  assert.match(listo, /= true \]; then gh pr ready "\$PR"; fi\n/, 'solo si aún es borrador, y sin || true: si falla, se ve');
  assert.match(listo, /permissions:\n\s+contents: write\n\s+pull-requests: write\n/, 'gh pr ready necesita contents: write');
  assert.match(listo, /requested_reviewers" -f "reviewers\[\]=\$PROPIETARIO"/);
  assert.doesNotMatch(listo, /actions\/checkout|claude-code-action/);
  assert.match(jobsDe(texto).aprobaciones, /needs: \[[^\]]*listo[^\]]*\]/, 'la guardia va después de listo');
  for (const { nombre, texto: t } of workflows) {
    assert.doesNotMatch(lineas(t).join('\n'), /gh pr merge|--approve\b|event=APPROVE/, `${nombre}: ningún workflow aprueba ni fusiona`);
  }
});

test('la CI lanzada por Enjambre publica su resultado como estado del commit (ADR 0014)', () => {
  const { texto } = workflows.find((w) => w.nombre === 'ci-cd/ci.yml');
  const job = jobsDe(texto)['estado-en-el-pr'];
  assert.ok(job, 'falta el job estado-en-el-pr');
  assert.match(job, /if: always\(\) && github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /permissions:\n\s+statuses: write\n\s+steps:/);
  assert.match(job, /context="ci \(Enjambre\)"/);
  assert.doesNotMatch(job, /actions\/checkout/);
});

test('todo job con agente y pull-requests: write va seguido del job aprobaciones (ADR 0011)', () => {
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    const jobs = (texto.split(/^jobs:\n/m)[1] ?? '').split(/^(?= {2}[\w-]+:\n)/m).filter((j) => /^ {2}[\w-]+:\n/.test(j));
    const conPermiso = jobs.filter((j) => /claude-code-action@/.test(j) && /pull-requests: write/.test(j)).map((j) => j.match(/^ {2}([\w-]+):/)[1]);
    if (!conPermiso.length) continue;
    const guardia = jobs.find((j) => j.startsWith('  aprobaciones:'));
    assert.ok(guardia, `${nombre}: falta el job aprobaciones`);
    const needs = guardia.match(/needs: \[([^\]]+)\]/)[1].split(',').map((s) => s.trim());
    for (const j of conPermiso) assert.ok(needs.includes(j), `${nombre}: aprobaciones no espera a ${j}`);
  }
});

test('todo agente deja rastro: transcripción como artefacto y respuesta publicada (ADR 0012)', () => {
  for (const { nombre, texto } of workflows.filter((w) => /enjambre-/.test(w.nombre))) {
    const agentes = (texto.match(/uses: anthropics\/claude-code-action@/g) ?? []).length;
    assert.equal((texto.match(/- id: agente\n\s+uses: anthropics\/claude-code-action@/g) ?? []).length, agentes, `${nombre}: id agente`);
    assert.equal((texto.match(/name: Guardar la transcripción del agente\n\s+if: always\(\) && steps\.agente\.outputs\.execution_file != ''\n\s+uses: actions\/upload-artifact@/g) ?? []).length, agentes, `${nombre}: transcripción`);
    assert.match(texto, /retention-days: 7/, nombre);
    assert.match(texto, /Publicar la respuesta si el agente no comentó|Abrir el informe si el agente no lo hizo|Publicar el veredicto si el agente no lo hizo|Publicar el resumen del implementador en el issue/, `${nombre}: respaldo de la respuesta`);
  }
});

test('QA y gobernanza buscan su informe por su propio título, no por «Informe» (ADR 0013)', () => {
  for (const nombre of ['ci-cd/enjambre-gobernanza.yml', 'ci-cd/enjambre-investigar.yml']) {
    const { texto } = workflows.find((w) => w.nombre === nombre);
    assert.doesNotMatch(texto, /startswith\("Informe"\)/, nombre);
    assert.match(texto, /TITULO: 'Informe de [^']+ de Enjambre'/, nombre);
    assert.match(texto, /startswith\(env\.TITULO\)/, nombre);
    assert.match(texto, /--title "\$TITULO \(/, nombre);
  }
});

test('revisar: revisor y seguridad tienen una lista estrecha de gh porque allowed_bots desactiva el modo auto (finance_tracker#26)', () => {
  const texto = readFileSync(join(RAIZ, 'plugins/enjambre/skills/ci-cd/workflows/enjambre-revisar.yml'), 'utf8');
  for (const agente of ['enjambre-revisor', 'enjambre-seguridad']) {
    const linea = texto.split('\n').find((l) => l.includes(`claude_args: --agent enjambre:${agente}`));
    assert.ok(linea, agente);
    const lista = /--allowedTools "([^"]+)"/.exec(linea)?.[1] ?? '';
    for (const necesario of ['Bash(gh pr view:*)', 'Bash(gh pr diff:*)', 'Bash(gh issue view:*)', 'Bash(gh pr comment:*)']) assert.ok(lista.includes(necesario), `${agente}: ${necesario}`);
    // Nada que apruebe, fusione, edite o llame a la API a mano.
    assert.doesNotMatch(lista, /merge|review|approve|edit|close|gh api|Bash\(\*\)|Bash\(gh:\*\)|Bash\(gh pr:\*\)/, agente);
    assert.ok(Number(/--max-turns (\d+)/.exec(linea)[1]) >= 20, `${agente}: turnos suficientes`);
  }
});

test('ci: estado-en-el-pr no hereda el working-directory del workflow (no hace checkout; finance_tracker#26)', () => {
  const texto = readFileSync(join(RAIZ, 'plugins/enjambre/skills/ci-cd/workflows/ci.yml'), 'utf8');
  const job = texto.slice(texto.indexOf('  estado-en-el-pr:'));
  assert.match(job, /defaults:\n\s+run:\n\s+working-directory: \$\{\{ github\.workspace \}\}/);
});

test('revisar: revisor y seguridad pueden leer checks y estados (gh pr view y gh pr checks; finance_tracker#27)', () => {
  const texto = readFileSync(join(RAIZ, 'plugins/enjambre/skills/ci-cd/workflows/enjambre-revisar.yml'), 'utf8');
  for (const job of ['revisor', 'seguridad']) {
    const bloque = jobsDe(texto)[job];
    assert.match(bloque, /permissions:\n\s+checks: read\n\s+contents: read\n\s+issues: read\n\s+pull-requests: write\n\s+statuses: read\n/, job);
  }
});
