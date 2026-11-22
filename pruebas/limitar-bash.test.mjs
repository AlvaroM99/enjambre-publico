// Pruebas del hook limitar-bash: lista blanca de Bash para los agentes que no escriben código (ADR 0004).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluar, POLITICAS, nombreAgente, quitarHeredocs } from '../plugins/enjambre/scripts/limitar-bash.mjs';

const SCRIPT = fileURLToPath(new URL('../plugins/enjambre/scripts/limitar-bash.mjs', import.meta.url));
const HOOKS = fileURLToPath(new URL('../plugins/enjambre/hooks/hooks.json', import.meta.url));
const bash = (agent_type, command) => ({ tool_name: 'Bash', agent_type, tool_input: { command }, cwd: '.' });

const REVISOR = 'enjambre:enjambre-revisor';

const PERMITIDOS = [
  [REVISOR, 'gh pr view 12 --comments'],
  [REVISOR, 'gh pr diff 12 | head -200'],
  [REVISOR, 'git log --oneline -10 2>/dev/null'],
  [REVISOR, 'git blame -L 10,30 src/worker.js'],
  [REVISOR, 'cd src && grep -rn "fetch(" . | wc -l'],
  [REVISOR, 'find . -name "*.test.mjs"'],
  [REVISOR, 'gh pr comment 12 --body "Veredicto: CAMBIOS; ver a > b"'],
  [REVISOR, "gh pr comment 12 --body-file - <<'EOF'\n## Revisión\n`npm test` > nada; rm -rf $(pwd)\nEOF"],
  [REVISOR, 'gh pr review 12 --request-changes --body-file -'],
  ['enjambre-revisor', 'git diff main...HEAD --stat'],
  ['enjambre:enjambre-jefe-proyecto', 'gh issue edit 7 --add-label enjambre:listo --remove-label enjambre:planificar'],
  ['enjambre:enjambre-jefe-proyecto', 'gh issue create --title "feat: export" --label enjambre:propuesta --body-file - <<EOF\ntexto\nEOF'],
  ['enjambre:enjambre-investigador', 'npm test && npm run check'],
  ['enjambre:enjambre-investigador', 'npx --no-install playwright test --reporter=line'],
  ['enjambre:enjambre-investigador', "gh issue create --title \"fix: x\" --label enjambre:propuesta --body-file - <<'EOF'\nPasos\nEOF"],
  ['enjambre:enjambre-seguridad', 'npm audit --omit=dev'],
  ['enjambre:enjambre-analista', 'gh issue view 4 --comments'],
  ['enjambre:enjambre-gobernanza', "git grep -nIE 'TODO|FIXME' | wc -l"],
  ['enjambre:enjambre-gobernanza', 'npm outdated'],
  ['enjambre:enjambre-coordinador', 'git worktree list && gh pr list --state open'],
  ['enjambre:enjambre-coordinador', 'gh issue edit 9 --add-label enjambre:en-curso'],
  // ADR 0013: falsos positivos reales de las transcripciones del 22-11-2026, ahora permitidos.
  ['enjambre:enjambre-analista', 'ls herramientas migrations; wc -l herramientas/prueba.mjs; sed -n 1,60p herramientas/prueba.mjs; grep -n "ocarina" herramientas/prueba.mjs | head -50'],
  ['enjambre:enjambre-analista', 'cat herramientas/humo.mjs | head -60; cat wrangler.toml; sed -n 1,80p herramientas/subir.mjs'],
  ['enjambre:enjambre-gobernanza', "sed -n 120,167p README.md"],
  ['enjambre:enjambre-gobernanza', "sed -E 's/=.*/=…/' .env.example"],
  ['enjambre:enjambre-gobernanza', "git grep -nIE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' -- . ':!package-lock.json' | sed -E 's/:[^:]*$//' | cut -c1-120"],
  ['enjambre:enjambre-gobernanza', "cd /home/runner/work/lobby/lobby; for f in .github/workflows/*.yml; do echo \"== $f\"; grep -nE 'uses:|permissions' $f; done"],
  ['enjambre:enjambre-investigador', 'printenv ALCANCE'],
  ['enjambre:enjambre-investigador', 'grep -n "aCSV" public/js/ui.js | head; sed -n 1,50p .github/workflows/enjambre-investigar.yml'],
  ['enjambre:enjambre-jefe-proyecto', "sed -n '200,230p' herramientas/prueba.mjs"],
  [REVISOR, "sed -n '$p' src/x.js"],
  [REVISOR, "sed -n '/export/p' src/x.js"],
  [REVISOR, "sed '5q' src/x.js"],
  [REVISOR, "sed -e 's|a|b|g' -e 's/c/d/2' src/x.js"],
  // Agentes sin política (sesión principal y agentes que escriben): este hook no los limita.
  [undefined, 'echo x > fichero.txt'],
  ['enjambre:enjambre-implementador', 'npm install && npm test > salida.txt'],
  ['Explore', 'ls -la'],
];

const BLOQUEADOS = [
  [REVISOR, 'echo x > fichero.txt', 'redireccion'],
  [REVISOR, 'cat a >> b', 'redireccion'],
  [REVISOR, 'cat "$(whoami)"', 'sustitucion'],
  [REVISOR, 'cat `whoami`', 'sustitucion'],
  [REVISOR, 'diff <(git show a) <(git show b)', 'sustitucion'],
  [REVISOR, 'gh pr comment 1 --body-file - <<EOF\n$(rm -rf src)\nEOF', 'sustitucion'],
  [REVISOR, 'git diff --output=parche.diff', 'escribe-fichero'],
  [REVISOR, 'sort -o salida.txt entrada.txt', 'escribe-fichero'],
  [REVISOR, 'rg --pre ./script.sh foo', 'escribe-fichero'],
  [REVISOR, 'find . -name "*.js" -delete', 'find-con-acciones'],
  [REVISOR, 'find . -exec rm {} +', 'find-con-acciones'],
  [REVISOR, 'npm test', 'fuera-de-lista'],
  [REVISOR, 'git commit -m x', 'fuera-de-lista'],
  [REVISOR, 'git push origin enjambre/1-x', 'fuera-de-lista'],
  [REVISOR, 'gh pr review 12 --approve', 'fuera-de-lista'],
  [REVISOR, 'gh pr merge 12', 'fuera-de-lista'],
  [REVISOR, 'git log | xargs rm', 'fuera-de-lista'],
  [REVISOR, 'git log; bash -c "touch x"', 'fuera-de-lista'],
  [REVISOR, 'FOO=1 git log', 'fuera-de-lista'],
  [REVISOR, 'node -e "require(\'fs\').writeFileSync(\'x\',\'\')"', 'fuera-de-lista'],
  [REVISOR, 'sed -i s/a/b/ src/x.js', 'sed-escritura'],
  // ADR 0013: sed que escribe o ejecuta sigue bloqueado.
  [REVISOR, "sed -n '1w copia.txt' src/x.js", 'sed-escritura'],
  [REVISOR, "sed 's/a/b/w salida.txt' src/x.js", 'sed-escritura'],
  [REVISOR, "sed 's/.*/id/e' src/x.js", 'sed-escritura'],
  [REVISOR, "sed -e '1r /etc/passwd' src/x.js", 'sed-escritura'],
  [REVISOR, 'sed --in-place=.bak s/a/b/ src/x.js', 'sed-escritura'],
  [REVISOR, 'sed -ni 1p src/x.js', 'sed-escritura'],
  [REVISOR, "sed -n '1p;w x' src/x.js", 'sed-escritura'],
  [REVISOR, 'for f in $(ls); do cat $f; done', 'sustitucion'],
  [REVISOR, 'for f in *.js; do rm $f; done', 'fuera-de-lista'],
  ['enjambre:enjambre-analista', 'printenv ALCANCE', 'fuera-de-lista'],
  ['enjambre:enjambre-investigador', 'printenv', 'fuera-de-lista'],
  ['enjambre:enjambre-investigador', 'printenv GH_TOKEN', 'fuera-de-lista'],
  // Los 4 bloqueos correctos de las transcripciones del 22-11-2026 siguen bloqueados.
  ['enjambre:enjambre-gobernanza', "git ls-files | xargs -d '\\n' wc -c 2>/dev/null | sort -n | tail -5", 'fuera-de-lista'],
  ['enjambre:enjambre-gobernanza', "ls -R .; cat SKILL.md; find . -name 'plantilla*' -exec echo {} \\;", 'find-con-acciones'],
  ['enjambre:enjambre-investigador', "cat > /tmp/x.mjs <<'EOF'\nEOF\nnode --input-type=module -e \"console.log(1)\"", 'redireccion'],
  [REVISOR, 'tee x.txt', 'fuera-de-lista'],
  [REVISOR, 'git log & touch x', 'fuera-de-lista'],
  ['enjambre:enjambre-jefe-proyecto', 'gh issue edit 7 --title "otro"', 'fuera-de-lista'],
  ['enjambre:enjambre-jefe-proyecto', 'gh issue close 7', 'fuera-de-lista'],
  ['enjambre:enjambre-investigador', 'npm install left-pad', 'fuera-de-lista'],
  ['enjambre:enjambre-seguridad', 'npm audit fix', 'fuera-de-lista'],
  ['enjambre:enjambre-analista', 'npx create-vite mi-app', 'fuera-de-lista'],
  ['enjambre:enjambre-analista', 'git clone https://github.com/x/y', 'fuera-de-lista'],
  ['enjambre:enjambre-gobernanza', 'git mv docs documentacion', 'fuera-de-lista'],
  ['enjambre:enjambre-gobernanza', 'rm -rf old', 'fuera-de-lista'],
  ['enjambre:enjambre-coordinador', 'gh pr merge 3', 'fuera-de-lista'],
  ['enjambre:enjambre-coordinador', 'git worktree add ../x', 'fuera-de-lista'],
];

for (const [agente, comando] of PERMITIDOS) {
  test(`limitar-bash permite a ${agente}: ${comando.split('\n')[0]}`, () => {
    assert.equal(evaluar(bash(agente, comando)), null);
  });
}
for (const [agente, comando, regla] of BLOQUEADOS) {
  test(`limitar-bash bloquea a ${agente} (${regla}): ${comando.split('\n')[0]}`, () => {
    assert.equal(evaluar(bash(agente, comando))?.nombre, regla);
  });
}

test('limitar-bash bloquea PowerShell en los agentes limitados', () => {
  assert.equal(evaluar({ tool_name: 'PowerShell', agent_type: REVISOR, tool_input: { command: 'Get-ChildItem' } })?.nombre, 'powershell');
});

test('nombreAgente acepta el nombre con y sin espacio de nombres, y solo el de enjambre', () => {
  assert.equal(nombreAgente('enjambre:enjambre-revisor'), 'enjambre-revisor');
  assert.equal(nombreAgente('enjambre-revisor'), 'enjambre-revisor');
  assert.equal(nombreAgente('otro:enjambre-revisor'), 'otro:enjambre-revisor');
  assert.equal(nombreAgente(undefined), '');
});

test('quitarHeredocs separa el cuerpo y conserva lo que bash expande', () => {
  const r = quitarHeredocs("gh issue comment 1 --body-file - <<'EOF'\n$(x)\nEOF\ngit log");
  assert.doesNotMatch(r.comandos, /\$\(x\)/);
  assert.doesNotMatch(r.expandible, /\$\(x\)/);
  assert.match(quitarHeredocs('cat <<EOF\n$(x)\nEOF').expandible, /\$\(x\)/);
});

test('todos los agentes de solo lectura tienen política en limitar-bash', () => {
  for (const nombre of ['enjambre-coordinador', 'enjambre-analista', 'enjambre-jefe-proyecto', 'enjambre-revisor',
    'enjambre-seguridad', 'enjambre-investigador', 'enjambre-gobernanza']) {
    assert.ok(POLITICAS[nombre], nombre);
  }
});

test('hooks.json registra limitar-bash en Bash y PowerShell, fallando cerrado', () => {
  const grupos = JSON.parse(readFileSync(HOOKS, 'utf8')).hooks.PreToolUse;
  const grupo = grupos.find((g) => g.hooks.some((h) => h.args?.some((a) => a.endsWith('limitar-bash.mjs'))));
  assert.ok(grupo, 'limitar-bash no está registrado');
  assert.match(grupo.matcher, /\bBash\b/);
  assert.match(grupo.matcher, /\bPowerShell\b/);
  assert.equal(grupo.hooks.find((h) => h.args.some((a) => a.endsWith('limitar-bash.mjs'))).onFailure, 'block');
});

function ejecutar(entrada) {
  return spawnSync(process.execPath, [SCRIPT], { input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada), encoding: 'utf8' });
}

test('el hook limitar-bash sale con 2 y explica el motivo al bloquear', () => {
  const r = ejecutar(bash(REVISOR, 'echo x > y'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /limitar-bash/);
  assert.match(r.stderr, /enjambre-revisor/);
});
test('el hook limitar-bash sale con 0 al permitir y falla cerrado con entrada rota', () => {
  assert.equal(ejecutar(bash(REVISOR, 'git status')).status, 0);
  assert.equal(ejecutar('no es json').status, 2);
});
