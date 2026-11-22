// Pruebas del script que publica la instantánea pública (ADR 0006).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarContenido, AUTOR, etiquetaDe } from '../herramientas/publicar.mjs';

test('publicar detiene la publicación si hay correos personales, tokens o claves', () => {
  const problemas = revisarContenido([
    // Los ejemplos se construyen por partes para que este fichero no dispare el propio filtro al publicar.
    ['a.md', 'contacto: alguien@' + 'gmail.com'],
    ['b.txt', 'token ' + 'ghp' + '_abcdefghijklmnopqrstuvwxyz0123'],
    ['c.pem', '-----BEGIN RSA ' + 'PRIVATE KEY-----'],
    ['ok.md', 'sin nada raro; noreply@anthropic.com y 129555669+AlvaroM99@users.noreply.github.com'],
  ]);
  assert.deepEqual(problemas, ['a.md: correo personal', 'b.txt: token de GitHub', 'c.pem: clave privada']);
});

test('publicar firma con la dirección noreply de GitHub', () => {
  assert.match(AUTOR.correo, /@users\.noreply\.github\.com$/);
});

test('publicar: la etiqueta sale de la versión de plugin.json', () => {
  assert.equal(etiquetaDe('{"name":"enjambre","version":"0.2.0"}'), 'v0.2.0');
  assert.throws(() => etiquetaDe('{"version":"0.2"}'), /Versión no válida/);
  assert.throws(() => etiquetaDe('{}'), /Versión no válida/);
});
