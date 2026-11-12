const net = require('net');
const ip = require('ip');

const comercios = new Map();

function validarUrlNotificacion(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch (e) {
    return { ok: false, error: 'url invalida' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'solo https' };
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost') {
    return { ok: false, error: 'destino interno' };
  }
    // Control compensatorio de la excepcion CVE-2024-29415 (Decision 2):
  // no se aceptan IP literales, asi ip.isPrivate no evalua datos del comercio.
  if (net.isIP(host)) {
    return { ok: false, error: 'ip literal no permitida' };
  }
  if (net.isIP(host) && ip.isPrivate(host)) {
    return { ok: false, error: 'destino interno' };
  }
  return { ok: true, url: url.toString() };
}

function registrarComercio(comercio, urlNotificacion) {
  const resultado = validarUrlNotificacion(urlNotificacion);
  if (!resultado.ok) return resultado;
  comercios.set(comercio, resultado.url);
  return { ok: true, comercio, url: resultado.url };
}

function urlDeComercio(comercio) {
  return comercios.get(comercio) || null;
}

module.exports = { validarUrlNotificacion, registrarComercio, urlDeComercio };
