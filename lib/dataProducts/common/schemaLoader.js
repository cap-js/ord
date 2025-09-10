const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

// Cache configuration
const MAX_CACHE_SIZE = 10; // Maximum number of schemas to cache
const CACHE_TTL_MS = 3600000; // 1 hour TTL for cached schemas

// LRU cache implementation with TTL support
class SchemaCache {
    constructor(maxSize = MAX_CACHE_SIZE, ttlMs = CACHE_TTL_MS) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.cache = new Map(); // key -> { schema, source, timestamp, lastAccessed }
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if entry has expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs ) {
            this.cache.delete(key);
            return null;
        }

        // Update last accessed time for LRU
        entry.lastAccessed = now;
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return { schema: entry.schema, source: entry.source };
    }

    set(key, value) {
        const now = Date.now();

        // If cache is at max size, remove least recently used
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            // Find and remove the least recently used entry
            let lruKey = null;
            let lruTime = Infinity;

            for (const [k, v] of this.cache.entries()) {
                if (v.lastAccessed < lruTime) {
                    lruTime = v.lastAccessed;
                    lruKey = k;
                }
            }

            if (lruKey) {
                this.cache.delete(lruKey);
            }
        }

        this.cache.set(key, {
            ...value,
            timestamp: now,
            lastAccessed: now
        });
    }

    has(key) {
        const entry = this.get(key);
        return entry !== null;
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

const cache = new SchemaCache();

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

function loadLocalSchema(localPath) {
  const raw = fs.readFileSync(localPath, 'utf8');
  return JSON.parse(raw);
}

async function loadSchemaWithFallback(key, url, localPath) {
  // Check cache first
  const cached = cache.get(key);
  if (cached) return cached;

  let schema;
  let source = 'remote';

  try {
    // Try remote fetch first
    schema = await fetchJson(url, 5000);

    // Try to update local copy for future fallback
    try {
      fs.writeFileSync(localPath, JSON.stringify(schema, null, 2), 'utf8');
    } catch (writeError) {
      // Log write error but don't fail - remote fetch succeeded
      console.warn(`Failed to update local schema cache at ${localPath}: ${writeError.message}`);
    }
  } catch (fetchError) {
    // Remote fetch failed, try local fallback
    try {
      schema = loadLocalSchema(localPath);
      source = 'local';
    } catch (localError) {
      // Both remote and local failed
      throw new Error(`Failed to load schema '${key}': Remote error: ${fetchError.message}, Local error: ${localError.message}`);
    }
  }

  const res = { schema, source };
  cache.set(key, res);
  return res;
}

module.exports = {
  loadSchemaWithFallback,
};
