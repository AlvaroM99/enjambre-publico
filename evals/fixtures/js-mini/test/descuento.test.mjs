import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarDescuento } from '../src/descuento.mjs';

test('un 20 % de descuento sobre 50 € deja 40 €', () => {
  assert.equal(aplicarDescuento(50, 20), 40);
});
