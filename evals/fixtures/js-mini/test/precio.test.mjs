import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioConIva } from '../src/precio.mjs';

test('100 € con el IVA general son 121 €', () => {
  assert.equal(precioConIva(100), 121);
});

test('el tipo reducido del 10 % también funciona', () => {
  assert.equal(precioConIva(50, 0.1), 55);
});
