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
  [REVISOR, 'sed -i s/a/b/ src/x.js', 'fuera-de-lista'],
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
