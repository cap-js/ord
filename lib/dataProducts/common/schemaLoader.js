const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const cache = new Map(); // key -> { schema, source }

function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const token = process.env.DP_SCHEMA_TOKEN || process.env.GITHUB_TOKEN;
    const headers = {};
    if (token) headers['Authorization'] = `token ${token}`;
    // Optional custom CA certificate support
    let agent;
    try {
      const caPath = process.env.DP_SCHEMA_CACERT || process.env.NODE_EXTRA_CA_CERTS;
      if (caPath && fs.existsSync(caPath)) {
        const ca = fs.readFileSync(caPath);
        agent = new https.Agent({ ca });
      }
    } catch (_) { /* ignore CA errors, proceed without custom CA */ }

    const req = https.get({
      protocol: u.protocol,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers,
      agent,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
  });
}

async function loadSchemaWithFallback(key, url, localPath) {
  if (cache.has(key)) return cache.get(key);
  try {
    const remote = await fetchJson(url, 5000);
    try { fs.writeFileSync(localPath, JSON.stringify(remote, null, 2), 'utf8'); } catch (_) {}
    const res = { schema: remote, source: 'remote' };
    cache.set(key, res);
    return res;
  } catch (_) {
    const raw = fs.readFileSync(localPath, 'utf8');
    const res = { schema: JSON.parse(raw), source: 'local' };
    cache.set(key, res);
    return res;
  }
}

module.exports = {
  loadSchemaWithFallback,
};
