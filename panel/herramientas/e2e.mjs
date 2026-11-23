// Prueba e2e del panel (ADR 0015) con datos sintéticos y sin tocar GitHub ni Cloudflare:
// GitHub falso en :8791, `wrangler dev` en :8790 (nunca el 8787 de lobby) y Chrome con Playwright.
// Comprueba: login, conciliación inicial, dos agentes en paralelo en dos repos, paso en vivo, etiqueta,
// aprobación y fusión atada al SHA, y que sin firma o sin sesión no se entra.
//
// Uso: cd panel && npm run e2e [-- --captura ruta.png]
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
import { crearGithubFalso } from './github-falso.mjs';

const PANEL = 'http://localhost:8790';
const SECRETO = randomBytes(16).toString('hex');
const captura = process.argv.includes('--captura') ? process.argv[process.argv.indexOf('--captura') + 1] : null;
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
let fallos = 0;
const comprobar = (cond, texto) => { console.log(`${cond ? '✔' : '✖'} ${texto}`); if (!cond) fallos++; };

try {
  await fetch(PANEL + '/');
  console.error('✖ Ya hay algo escuchando en el puerto 8790: páralo antes de la prueba.');
  process.exit(1);
} catch { /* libre */ }

const gh = crearGithubFalso({ puerto: 8791, panel: PANEL, secretoWebhook: SECRETO });
await gh.iniciar();

const persistencia = mkdtempSync(join(tmpdir(), 'panel-e2e-'));
const vars = {
  GITHUB_API: 'http://localhost:8791', GITHUB_WEB: 'http://localhost:8791', GITHUB_CLIENT_ID: 'Iv1.e2e',
  GITHUB_CLIENT_SECRET: 'secreto-e2e', WEBHOOK_SECRET: SECRETO, CLAVE_SESION: randomBytes(32).toString('base64'), PROPIETARIOS: 'AlvaroM99',
};
const args = ['wrangler', 'dev', '--port', '8790', '--ip', 'localhost', '--persist-to', persistencia, '--show-interactive-dev-session=false',
  ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])];
const wrangler = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
let salida = '';
wrangler.stdout.on('data', (d) => { salida += d; });
wrangler.stderr.on('data', (d) => { salida += d; });

async function listo() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(PANEL + '/')).ok) return true;
    } catch { /* arrancando */ }
    await espera(1000);
  }
  return false;
}

let nav;
try {
  if (!(await listo())) throw new Error(`wrangler dev no arrancó:\n${salida.slice(-2000)}`);

  // Seguridad desde fuera del navegador.
  const sinFirma = await fetch(`${PANEL}/webhook`, { method: 'POST', body: '{}', headers: { 'x-github-event': 'ping', 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) } });
  comprobar(sinFirma.status === 401, 'webhook con firma falsa → 401');
  const sinSesion = await fetch(`${PANEL}/api/fusionar`, { method: 'POST', body: '{}', headers: { origin: PANEL } });
  comprobar(sinSesion.status === 401, 'fusionar sin sesión → 401');
  const cabeceras = (await fetch(PANEL + '/')).headers;
  comprobar(/script-src 'self'/.test(cabeceras.get('content-security-policy') ?? ''), 'la página sale con CSP');

  nav = await chromium.launch({ channel: 'chrome' });
  const pagina = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  const erroresConsola = [];
  pagina.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()); });
  pagina.on('pageerror', (e) => erroresConsola.push(String(e)));

  await pagina.goto(PANEL);
  await pagina.getByRole('link', { name: 'Entrar con GitHub' }).click();
  await pagina.getByText('AlvaroM99', { exact: true }).waitFor({ timeout: 15000 });
  comprobar(true, 'login con GitHub (falso) y sesión del propietario');

  await pagina.locator('.pulso.vivo').waitFor({ timeout: 15000 });
  comprobar(true, 'WebSocket en vivo');

  await pagina.getByText('Exportar tareas a CSV').first().waitFor({ timeout: 20000 });
  await pagina.getByText('La CI no ejecuta api').first().waitFor({ timeout: 20000 });
  comprobar(true, 'conciliación inicial: issues de los dos repos');
  comprobar(await pagina.locator('.pr').count() === 2, 'dos PR abiertos (uno por repo)');
  comprobar(await pagina.locator('.pr', { hasText: '#40' }).getByText('revisor: APROBAR').count() === 1, 'veredicto del revisor leído de los comentarios');

  // Dos agentes en paralelo en dos repos.
  const pasos = (n) => ['Set up job', 'Checkout', 'Plugin', 'Ejecutar agente', 'Subir transcripción'].map((nombre, i) => ({ number: i + 1, name: nombre, status: i < n ? 'completed' : i === n ? 'in_progress' : 'queued', conclusion: i < n ? 'success' : null }));
  await gh.arrancarAgente('AlvaroM99/lobby', { id: 501, workflow: 'enjambre-planificar', job: 'planificar', titulo: 'Atajos de teclado', pasos: pasos(1) });
  await gh.arrancarAgente('AlvaroM99/finance_tracker', { id: 601, workflow: 'enjambre-revisar', job: 'revisor', titulo: 'ci: run the api tests', evento: 'workflow_dispatch', pasos: pasos(3) });
  await pagina.locator('.agente[data-agente="jefe-proyecto"]').waitFor({ timeout: 10000 });
  await pagina.locator('.agente[data-agente="revisor"]').waitFor({ timeout: 10000 });
  comprobar(await pagina.locator('.agente').count() === 2, 'dos agentes trabajando a la vez en dos repos');
  const tarjetaJefe = pagina.locator('.agente[data-agente="jefe-proyecto"]');
  comprobar((await tarjetaJefe.textContent()).includes('#32 Atajos de teclado'), 'el jefe de proyecto aparece sobre su issue (#32)');
  comprobar((await tarjetaJefe.textContent()).includes('paso 2/5: Checkout'), 'paso actual del job (por webhook)');
  comprobar(await pagina.locator('.issue', { hasText: 'Atajos de teclado' }).locator('.en-marcha').count() === 1, 'la issue del tablero marca al agente trabajando');

  // Paso siguiente sin webhook: lo trae la consulta de jobs (cada 10 s).
  gh.avanzarPaso('AlvaroM99/lobby', 501);
  await pagina.locator('.agente[data-agente="jefe-proyecto"]', { hasText: 'paso 3/5: Plugin' }).waitFor({ timeout: 25000 });
  comprobar(true, 'paso en vivo por consulta de la API');

  await gh.terminarAgente('AlvaroM99/lobby', 501);
  await pagina.locator('.agente[data-agente="jefe-proyecto"]').waitFor({ state: 'detached', timeout: 10000 });
  comprobar(await pagina.locator('.recientes li', { hasText: 'Atajos de teclado' }).count() === 1, 'al terminar pasa a «terminado en las últimas 2 horas»');

  // Puerta 1 desde el panel: el plan llega, se lee en el cajón de la issue y se aprueba sin ir a GitHub.
  await gh.publicarPlan('AlvaroM99/lobby', 32);
  const avisoPlan = pagina.locator('.issue', { hasText: 'Atajos de teclado' }).getByRole('button', { name: 'Plan listo: revísalo y apruébalo' });
  await avisoPlan.waitFor({ timeout: 10000 });
  comprobar(true, 'la issue avisa «plan listo» en cuanto el jefe publica el plan');
  await avisoPlan.click();
  await pagina.locator('.cajon .comentario.plan').waitFor({ timeout: 10000 });
  comprobar((await pagina.locator('.cajon .comentario.plan').textContent()).includes('Añadir los atajos'), 'el plan se lee en el panel, marcado como el que se aprueba');
  await pagina.getByRole('button', { name: 'Aprobar plan e implementar' }).click();
  await pagina.getByRole('button', { name: 'Confirmar: implementar' }).click();
  await pagina.locator('.toast', { hasText: 'arranca el implementador' }).waitFor({ timeout: 10000 });
  comprobar(gh.registro.some((r) => r.accion === 'poner' && r.numero === 32 && r.labels[0] === 'enjambre:implementar'), 'aprobar el plan pone enjambre:implementar en GitHub (puerta 1)');
  if (captura) await pagina.screenshot({ path: captura.replace(/\.png$/, '-issue.png') });
  comprobar(!/\bnull\b/.test(await pagina.locator('.cajon-cuerpo').textContent()), 'el cajón no pinta huecos como «null»');
  comprobar(await pagina.getByRole('button', { name: 'Confirmar: implementar' }).count() === 0, 'la confirmación se cierra al aprobar');
  await pagina.getByRole('button', { name: 'Cerrar' }).click();

  // Etiqueta desde el tablero.
  const tarjeta = pagina.locator('.issue', { hasText: 'Modo oscuro en el calendario' });
  await tarjeta.getByRole('button', { name: '+ etiqueta' }).click();
  await tarjeta.locator('select').selectOption('enjambre:planificar');
  comprobar((await tarjeta.locator('.pista').textContent()).includes('arranca un agente'), 'aviso: la etiqueta arranca un agente');
  await tarjeta.getByRole('button', { name: 'Poner' }).click();
  // La columna por su título exacto: «planificar» también sale en el desplegable de etiquetas.
  const columna = (titulo) => pagina.locator('.columna').filter({ has: pagina.locator('h3 span').getByText(titulo, { exact: true }) });
  await columna('Plan').locator('.issue', { hasText: 'Modo oscuro' }).waitFor({ timeout: 10000 });
  comprobar(gh.registro.some((r) => r.accion === 'poner' && r.numero === 31 && r.labels[0] === 'enjambre:planificar'), 'etiqueta puesta en GitHub y la issue cambia de columna');

  await pagina.locator('.issue', { hasText: 'Modo oscuro' }).getByRole('button', { name: 'Quitar enjambre:propuesta' }).click();
  await espera(1500);
  comprobar(gh.registro.some((r) => r.accion === 'quitar' && r.etiqueta === 'enjambre:propuesta'), 'etiqueta quitada');

  // Revisar, aprobar y fusionar el PR de lobby.
  await pagina.locator('.pr', { hasText: '#40' }).getByRole('button', { name: 'Revisar' }).click();
  await pagina.locator('.cajon').getByText('Añade la exportación a CSV').waitFor({ timeout: 10000 });
  await pagina.locator('.cajon summary', { hasText: 'src/exportar.js' }).click();
  comprobar(await pagina.locator('.diff .a').count() === 3, 'diff del PR visible');
  await pagina.locator('.cajon textarea').fill('Visto en el panel');
  await pagina.getByRole('button', { name: 'Aprobar' }).click();
  await pagina.getByRole('button', { name: 'Ya aprobado' }).waitFor({ timeout: 10000 });
  const aprobacion = gh.registro.find((r) => r.accion === 'aprobar');
  comprobar(aprobacion?.cuerpo.event === 'APPROVE' && aprobacion.cuerpo.commit_id === gh.SHA_A, 'aprobación APPROVE sobre el commit visto');

  await pagina.getByRole('button', { name: 'Fusionar…' }).click();
  if (captura) await pagina.screenshot({ path: captura.replace(/\.png$/, '-cajon.png') });
  await pagina.getByRole('button', { name: 'Confirmar fusión de #40' }).click();
  await pagina.locator('.cajon .est', { hasText: 'fusionado' }).waitFor({ timeout: 10000 });
  const fusion = gh.registro.find((r) => r.accion === 'fusionar');
  comprobar(fusion?.cuerpo.sha === gh.SHA_A && fusion.cuerpo.merge_method === 'squash', 'fusión squash atada al SHA');
  await pagina.getByRole('button', { name: 'Cerrar' }).click();
  await pagina.locator('.pr', { hasText: '#40' }).waitFor({ state: 'detached', timeout: 10000 });
  comprobar(true, 'el PR fusionado sale de «PR abiertos» por el webhook');
  comprobar(await pagina.locator('.cronologia li', { hasText: 'fusionó #40' }).count() === 1, 'la cronología cuenta la fusión');

  // El borrador no se puede fusionar.
  await pagina.locator('.pr', { hasText: '#25' }).getByRole('button', { name: 'Revisar' }).click();
  await pagina.locator('.cajon').getByText('Closes #16').waitFor({ timeout: 10000 });
  comprobar(await pagina.getByRole('button', { name: 'Fusionar…' }).isDisabled(), 'un borrador no se puede fusionar');
  await pagina.getByRole('button', { name: 'Cerrar' }).click();

  if (captura) {
    await pagina.screenshot({ path: captura, fullPage: true });
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.screenshot({ path: captura.replace(/\.png$/, '-movil.png'), fullPage: true });
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  }
  comprobar(erroresConsola.length === 0, `sin errores en la consola${erroresConsola.length ? `: ${erroresConsola.join(' | ')}` : ''}`);
} catch (e) {
  fallos++;
  console.error('✖', e.message);
  console.error(salida.slice(-1500));
} finally {
  await nav?.close();
  await gh.parar();
  // En Windows hay que matar el árbol (npx → node → workerd) antes que el padre, o workerd se queda con el puerto.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(wrangler.pid), '/t', '/f'], { stdio: 'ignore' });
  else wrangler.kill();
  await espera(1000);
  try {
    rmSync(persistencia, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    console.log(`(no se pudo borrar ${persistencia}; workerd aún lo tenía abierto)`);
  }
}
console.log(fallos ? `\n${fallos} comprobaciones fallidas` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
