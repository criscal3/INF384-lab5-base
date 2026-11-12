const test = require('node:test');
const assert = require('node:assert');
const { validarUrlNotificacion, registrarComercio, urlDeComercio } = require('../src/notificaciones');

test('acepta una url publica https', () => {
  assert.strictEqual(validarUrlNotificacion('https://comercio.example.com/pagos').ok, true);
});

test('rechaza http', () => {
  assert.strictEqual(validarUrlNotificacion('http://comercio.example.com/pagos').ok, false);
});

test('rechaza una direccion privada', () => {
  assert.strictEqual(validarUrlNotificacion('https://10.0.0.8/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://192.168.1.20/pagos').ok, false);
});

test('rechaza localhost', () => {
  assert.strictEqual(validarUrlNotificacion('https://localhost/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://127.0.0.1/pagos').ok, false);
});

test('registra la url del comercio', () => {
  const r = registrarComercio('bodega-lucha', 'https://bodega.example.com/aviso');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(urlDeComercio('bodega-lucha'), 'https://bodega.example.com/aviso');
});

test('rechaza ip literales publicas (control compensatorio CVE-2024-29415)', () => {
  assert.strictEqual(validarUrlNotificacion('https://8.8.8.8/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://[::ffff:7f00:1]/pagos').ok, false);
});