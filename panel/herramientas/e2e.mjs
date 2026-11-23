// Prueba e2e de Hive, el panel en vivo (ADR 0015), con datos sintéticos y sin tocar GitHub ni Cloudflare:
// GitHub falso en :8791, `wrangler dev` en :8790 (nunca el 8787 de lobby) y Chrome con Playwright.
// Recorre todas las vistas: login, conciliación, dos agentes en paralelo en dos repos con su paso en vivo y su
// registro, bandeja, puerta 1 (aprobar el plan), etiquetas, crear y comentar una issue, revisión entera de un PR
// (diff, aprobar, fusionar atado al SHA y borrar la rama), marcar listo un borrador, actividad, investigador, y que
// sin firma o sin sesión no se entra.
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
const foto = async (pagina, sufijo) => { if (captura) await pagina.screenshot({ path: captura.replace(/\.png$/, `-${sufijo}.png`) }); };

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
let pagina;
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
  pagina = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  const erroresConsola = [];
  pagina.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()); });
  pagina.on('pageerror', (e) => erroresConsola.push(String(e)));
  const ir = async (vista) => { await pagina.locator(`.nav-item[href="#${vista}"]`).click(); await pagina.waitForFunction((v) => location.hash === `#${v}`, vista); };
  const cerrar = () => pagina.locator('#cerrar-cajon').click();
  const toast = (texto) => pagina.locator('.toast', { hasText: texto }).first().waitFor({ timeout: 10000 });

  // Login y conexión.
  await pagina.goto(PANEL);
  await pagina.getByRole('link', { name: 'Entrar con GitHub' }).click();
  await pagina.getByText('AlvaroM99', { exact: true }).waitFor({ timeout: 15000 });
  comprobar(true, 'login con GitHub (falso) y sesión del propietario');
  await pagina.locator('.pulso.vivo').waitFor({ timeout: 15000 });
  comprobar(true, 'WebSocket en vivo');

  // Conciliación inicial: issues y PR de los dos repos.
  await ir('issues');
  await pagina.getByText('Exportar tareas a CSV').first().waitFor({ timeout: 20000 });
  await pagina.getByText('La CI no ejecuta api').first().waitFor({ timeout: 20000 });
  comprobar(true, 'conciliación inicial: issues de los dos repos en el tablero');
  await ir('prs');
  await pagina.locator('.pr').nth(1).waitFor({ timeout: 10000 });
  comprobar(await pagina.locator('.pr').count() === 2, 'dos PR abiertos (uno por repo)');
  comprobar(await pagina.locator('.pr', { hasText: '#40' }).getByText('revisor: APROBAR').count() === 1, 'veredicto del revisor leído de los comentarios');

  // Dos agentes en paralelo en dos repos.
  await ir('vivo');
  const pasos = (n) => ['Set up job', 'Checkout', 'Plugin', 'Ejecutar agente', 'Subir transcripción'].map((nombre, i) => ({ number: i + 1, name: nombre, status: i < n ? 'completed' : i === n ? 'in_progress' : 'queued', conclusion: i < n ? 'success' : null }));
  await gh.arrancarAgente('AlvaroM99/lobby', { id: 45228152501, workflow: 'enjambre-planificar', job: 'planificar', titulo: 'Atajos de teclado', pasos: pasos(1) });
  await gh.arrancarAgente('AlvaroM99/finance_tracker', { id: 45228152601, workflow: 'enjambre-revisar', job: 'revisor', titulo: 'ci: run the api tests', evento: 'workflow_dispatch', pasos: pasos(3) });
  const jefe = pagina.locator('.agente[data-agente="jefe-proyecto"]');
  await jefe.waitFor({ timeout: 10000 });
  await pagina.locator('.agente[data-agente="revisor"]').waitFor({ timeout: 10000 });
  comprobar(await pagina.locator('.agente').count() === 2, 'dos agentes trabajando a la vez en dos repos');
  comprobar((await pagina.locator('.kpi').first().textContent()).startsWith('2'), 'el contador de agentes trabajando dice 2');
  comprobar((await jefe.textContent()).includes('#32 Atajos de teclado'), 'el jefe de proyecto aparece sobre su issue (#32)');
  comprobar((await jefe.textContent()).includes('paso 2/5: Checkout'), 'paso actual del job (por webhook)');
  gh.avanzarPaso('AlvaroM99/lobby', 45228152501);
  await pagina.locator('.agente[data-agente="jefe-proyecto"]', { hasText: 'paso 3/5: Plugin' }).waitFor({ timeout: 25000 });
  comprobar(true, 'paso en vivo por consulta de la API');
  await foto(pagina, 'vivo');

  // Cajón de la ejecución: pasos y registro del job.
  await jefe.getByRole('button', { name: 'Pasos y registro' }).click();
  await pagina.locator('.cajon .pasos li.ahora', { hasText: 'Plugin' }).waitFor({ timeout: 10000 });
  // GitHub solo da el registro cuando el job termina (finance_tracker#17): mientras corre no se ofrece.
  comprobar(await pagina.locator('.cajon .job-detalle', { hasText: 'registro al terminar' }).count() === 1, 'mientras el job corre, el registro se anuncia para cuando termine');
  await pagina.getByRole('button', { name: 'Cancelar' }).click();
  await toast('Cancelación pedida');
  comprobar(gh.registro.some((r) => r.accion === 'cancel' && r.id === 45228152501), 'cancelar una ejecución desde el panel');
  await cerrar();

  await gh.terminarAgente('AlvaroM99/lobby', 45228152501);
  await jefe.waitFor({ state: 'detached', timeout: 10000 });
  const fila = pagina.locator('.recientes li', { hasText: 'Atajos de teclado' });
  comprobar(await fila.count() === 1, 'al terminar pasa a «terminado en las últimas 2 horas»');
  await fila.getByRole('button', { name: 'Pasos y registro' }).click();
  await pagina.getByRole('button', { name: 'Ver registro' }).click();
  await pagina.locator('.registro', { hasText: 'Leyendo el plan de #32' }).waitFor({ timeout: 10000 });
  comprobar(!(await pagina.locator('.registro').textContent()).includes('2026-11-23T'), 'registro del job terminado en el panel, sin marcas de tiempo');
  await cerrar();

  // Puerta 1 desde la bandeja: el plan llega, se lee y se aprueba sin ir a GitHub.
  await gh.publicarPlan('AlvaroM99/lobby', 32);
  await ir('bandeja');
  const itemPlan = pagina.locator('.bandeja li[data-tipo="aprobar-plan"]', { hasText: 'Atajos de teclado' });
  await itemPlan.waitFor({ timeout: 10000 });
  comprobar(await pagina.locator('.nav-item[href="#bandeja"] .globo').count() === 1, 'la bandeja muestra cuántas cosas esperan');
  await itemPlan.getByRole('button', { name: 'Leer y aprobar' }).click();
  await pagina.locator('.cajon .comentario.plan').waitFor({ timeout: 10000 });
  comprobar((await pagina.locator('.cajon .comentario.plan').textContent()).includes('Añadir los atajos'), 'el plan se lee en el panel, marcado como el que se aprueba');
  comprobar(await pagina.locator('.cajon .comentario.plan .md-tabla td').count() >= 2, 'las tablas del plan se ven como tabla');
  await pagina.getByRole('button', { name: 'Aprobar plan e implementar' }).click();
  await pagina.getByRole('button', { name: 'Confirmar: implementar' }).click();
  await toast('arranca el implementador');
  comprobar(gh.registro.some((r) => r.accion === 'poner' && r.numero === 32 && r.labels[0] === 'enjambre:implementar'), 'aprobar el plan pone enjambre:implementar (puerta 1)');
  await foto(pagina, 'issue');
  comprobar(!/\bnull\b/.test(await pagina.locator('.cajon-cuerpo').textContent()), 'el cajón no pinta huecos como «null»');

  // Comentar en la issue desde el panel.
  await pagina.locator('.cajon textarea[aria-label="Comentario"]').fill('Adelante con el plan');
  // En los repos reales llegan avisos cada pocos segundos: lo escrito no se puede perder al repintar.
  await gh.arrancarAgente('AlvaroM99/finance_tracker', { id: 45228152701, workflow: 'enjambre-analizar', job: 'analizar', titulo: 'La CI no ejecuta api', pasos: pasos(0) });
  await espera(800);
  comprobar(await pagina.locator('.cajon textarea[aria-label="Comentario"]').inputValue() === 'Adelante con el plan', 'lo que escribes no se borra cuando llega un aviso en vivo');
  await pagina.getByRole('button', { name: 'Publicar comentario' }).click();
  await toast('Comentario publicado');
  comprobar(gh.registro.some((r) => r.accion === 'comentar' && r.numero === 32 && r.cuerpo.body === 'Adelante con el plan'), 'comentario publicado en la issue');
  await cerrar();

  // Etiquetas desde el tablero.
  await ir('issues');
  const tarjeta = pagina.locator('.issue', { hasText: 'Modo oscuro en el calendario' });
  await tarjeta.getByRole('button', { name: '+ etiqueta' }).click();
  await tarjeta.locator('select').selectOption('enjambre:planificar');
  comprobar((await tarjeta.locator('.pista').textContent()).includes('arranca un agente'), 'aviso: la etiqueta arranca un agente');
  comprobar(await tarjeta.locator('option[value="enjambre:en-curso"]').count() === 0, 'en-curso no se ofrece a mano');
  await tarjeta.getByRole('button', { name: 'Poner' }).click();
  await pagina.locator('.columna[data-columna="planificar"] .issue', { hasText: 'Modo oscuro' }).waitFor({ timeout: 10000 });
  comprobar(gh.registro.some((r) => r.accion === 'poner' && r.numero === 31 && r.labels[0] === 'enjambre:planificar'), 'etiqueta puesta y la issue cambia de columna');
  await pagina.locator('.issue', { hasText: 'Modo oscuro' }).getByRole('button', { name: 'Quitar enjambre:propuesta' }).click();
  await toast('Quitada');
  comprobar(gh.registro.some((r) => r.accion === 'quitar' && r.etiqueta === 'enjambre:propuesta'), 'etiqueta quitada');

  // Crear una issue y pedir el plan a la vez.
  await pagina.locator('#nueva-issue').click();
  await pagina.locator('#nueva-repo').selectOption('AlvaroM99/lobby');
  await pagina.locator('#nueva-titulo').fill('Buscar tareas por texto');
  await pagina.locator('#nueva-cuerpo').fill('Un buscador en la lista de tareas.');
  await pagina.locator('.formulario .etiqueta.seleccionable', { hasText: 'bug' }).locator('input').check();
  await pagina.getByRole('button', { name: 'Crear issue' }).click();
  await toast('Creada #');
  const creada = gh.registro.find((r) => r.accion === 'crear');
  comprobar(creada?.cuerpo.title === 'Buscar tareas por texto' && creada.cuerpo.labels?.[0] === 'bug', 'issue creada con su etiqueta');
  comprobar(gh.registro.some((r) => r.accion === 'poner' && r.numero === creada?.numero && r.labels[0] === 'enjambre:planificar'), 'y con el plan pedido al jefe de proyecto');
  await pagina.locator('#cajon-titulo', { hasText: 'Buscar tareas por texto' }).waitFor({ timeout: 10000 });
  comprobar(true, 'al crearla se abre su cajón');
  await pagina.getByRole('button', { name: 'Cerrar como descartada' }).click();
  await toast('cerrada como descartada');
  comprobar(gh.registro.some((r) => r.accion === 'estado-issue' && r.cuerpo.state_reason === 'not_planned'), 'cerrar una issue desde el panel');
  await cerrar();

  // Revisión entera de un PR: diff, conversación, aprobar, fusionar y borrar la rama.
  await ir('prs');
  await pagina.locator('.pr', { hasText: '#40' }).getByRole('button', { name: 'Revisar' }).click();
  await pagina.locator('.cajon').getByText('Añade la exportación a CSV').waitFor({ timeout: 10000 });
  await pagina.getByRole('tab', { name: /Ficheros/ }).click();
  comprobar(await pagina.locator('.diff .a').count() === 3, 'diff del PR visible');
  await pagina.locator('.cajon textarea[aria-label="Comentario de la revisión"]').fill('Visto en Hive');
  await pagina.getByRole('button', { name: 'Aprobar' }).click();
  await pagina.getByRole('button', { name: 'Ya aprobado' }).waitFor({ timeout: 10000 });
  const aprobacion = gh.registro.find((r) => r.accion === 'resena' && r.cuerpo.event === 'APPROVE');
  comprobar(aprobacion?.cuerpo.commit_id === gh.SHA_A, 'aprobación APPROVE sobre el commit visto');
  await pagina.getByRole('button', { name: 'Fusionar…' }).click();
  await foto(pagina, 'pr');
  await pagina.getByRole('button', { name: 'Confirmar fusión de #40' }).click();
  await pagina.locator('.cajon .est', { hasText: 'fusionado' }).first().waitFor({ timeout: 10000 });
  const fusion = gh.registro.find((r) => r.accion === 'fusionar');
  comprobar(fusion?.cuerpo.sha === gh.SHA_A && fusion.cuerpo.merge_method === 'squash', 'fusión squash atada al SHA');
  comprobar(gh.registro.some((r) => r.accion === 'borrar-rama' && r.rama === 'enjambre/30-exportar-csv'), 'la rama se borra al fusionar');
  await cerrar();
  await pagina.locator('.pr', { hasText: '#40' }).waitFor({ state: 'detached', timeout: 10000 });
  comprobar(true, 'el PR fusionado sale de la lista por el webhook');

  // Borrador: no se fusiona, pero se puede marcar listo.
  await pagina.locator('.pr', { hasText: '#25' }).getByRole('button', { name: 'Revisar' }).click();
  await pagina.locator('.cajon').getByText('Closes #16').waitFor({ timeout: 10000 });
  comprobar(await pagina.getByRole('button', { name: 'Fusionar…' }).isDisabled(), 'un borrador no se puede fusionar');
  await pagina.getByRole('button', { name: 'Marcar listo' }).click();
  await toast('listo para revisión');
  comprobar(gh.registro.some((r) => r.accion === 'graphql' && r.variables.id === 'PR_25'), 'marcar listo un borrador (GraphQL)');
  await cerrar();

  // Actividad y repos.
  await ir('actividad');
  await pagina.locator('.tabla tr[data-agente="jefe-proyecto"]').first().waitFor({ timeout: 10000 });
  comprobar(await pagina.locator('.cronologia li', { hasText: 'fusionó #40' }).count() === 1, 'la cronología cuenta la fusión');
  await pagina.locator('#busqueda').fill('fusionó');
  comprobar(await pagina.locator('.cronologia li').count() === 1, 'la búsqueda filtra la cronología');
  await pagina.locator('#busqueda').fill('');
  await ir('repos');
  const tarjetaRepo = pagina.locator('.repo', { hasText: 'AlvaroM99/lobby' });
  await tarjetaRepo.locator('summary').click();
  await tarjetaRepo.locator('input').fill('src/');
  await tarjetaRepo.getByRole('button', { name: 'Investigar' }).click();
  await toast('Investigador lanzado');
  comprobar(gh.registro.some((r) => r.accion === 'dispatch' && r.workflow === 'enjambre-investigar.yml' && r.cuerpo.inputs.alcance === 'src/'), 'lanzar al investigador desde el panel');
  comprobar(await pagina.locator('a', { hasText: 'Añadir o quitar repos de la app' }).count() === 1, 'enlace para añadir repos a la app');

  // Tema y móvil.
  await ir('vivo');
  await pagina.locator('#tema').click();
  comprobar(await pagina.evaluate(() => Boolean(document.documentElement.dataset.theme)), 'cambiar el tema claro u oscuro');
  if (captura) await pagina.screenshot({ path: captura, fullPage: true });
  await pagina.setViewportSize({ width: 390, height: 844 });
  await foto(pagina, 'movil');
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  comprobar(ancho <= 390, `sin scroll horizontal en móvil (${ancho}px)`);
  comprobar(erroresConsola.length === 0, `sin errores en la consola${erroresConsola.length ? `: ${erroresConsola.join(' | ')}` : ''}`);
} catch (e) {
  if (pagina && captura) await pagina.screenshot({ path: captura.replace(/.png$/, '-fallo.png') }).catch(() => {});
  fallos++;
  console.error('✖', e.message.split('\n').slice(0, 6).join('\n'));
  console.error(salida.slice(-1200));
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
