# OTel Demo for `@cap-js/ord`

This demo proves the new OpenTelemetry instrumentation works end-to-end without
the plugin ever initializing the OTel SDK itself — the host CAP app does that
via [`@cap-js/telemetry`](https://github.com/cap-js/telemetry).

## What was added

| Where | What |
| --- | --- |
| `lib/telemetry.js` | Tiny wrapper around `@opentelemetry/api`. Exposes `tracer`, `meter`, `counters`, `histograms`, `withSpan`, `withSpanSync`. **No SDK init.** |
| `lib/ord.js` | Wraps the document-generation function in span `ord.document.generate`, plus a counter `ord.documents.generated` and histogram `ord.document.generation.duration`. |
| `lib/services/ord-service.js` | Wraps the `/.well-known/open-resource-discovery`, `/ord/v1/documents/ord-document` and `/ord/v1/...` handlers in spans `ord.well_known.serve`, `ord.document.serve`, `ord.metadata.serve`. Each path bumps `ord.metadata.requests`. |
| `package.json` | Adds `@opentelemetry/api ^1.9.0` to `dependencies`. **API only — never the SDK.** |
| `xmpl/package.json` | Adds `@cap-js/telemetry ^1.6.0` (this is the SDK side, lives in the host app, not the plugin). |
| `xmpl/.cdsrc.json` | New `requires.telemetry.kind = "telemetry-to-console"` so spans/metrics print to stdout. |
| `xmpl/manifest.yml` | Minimal `cf push` manifest, three exporter blocks ready to uncomment. |

---

## Run locally

```bash
# from the repo root
cd /home/d072944/work/ord
npm install                 # picks up @opentelemetry/api + workspace deps
cd xmpl
npx cds-serve
```

In another terminal:

```bash
curl -s http://localhost:4004/.well-known/open-resource-discovery | jq '.'
curl -s http://localhost:4004/ord/v1/documents/ord-document | jq '.openResourceDiscovery'
```

Expected console output (snipped from a real run):

```
[telemetry] - elapsed times:
   0.00 →  37.06 =  37.06 ms  GET /.well-known/open-resource-discovery
   3.00 →  29.81 =  26.81 ms    ord.document.generate
[telemetry] - elapsed times:
   0.00 →   3.20 =   3.20 ms  GET /ord/v1/documents/ord-document
```

The HTTP span is added by `@cap-js/telemetry`'s auto-instrumentation; the
`ord.document.generate` child span is from this plugin. Same `trace_id`,
correct parent-child relationship — exactly what TG48 requires.

---

## Run on Cloud Foundry (your test space)

Three things to know before you push:

1. **Plugin is unchanged for CF** — only `xmpl/` is the deployable.
2. **Pick an exporter via env var** — defaults to console (no service binding
   needed). Cloud Logging / Dynatrace require binding the corresponding
   service instance.
3. **Routes** — edit `xmpl/manifest.yml` to fit your CF region + space.

### Step-by-step

```bash
cd /home/d072944/work/ord/xmpl

# Sanity build
npm install
npx cds build --production

# Edit manifest: pick exporter, set route domain
$EDITOR manifest.yml

# Push
cf push -f manifest.yml
```

### Exporter switch (one env var)

The manifest has the three blocks pre-staged:

| Goal | Set | Bind service |
| --- | --- | --- |
| See traces in app logs (cheapest) | `CDS_REQUIRES_TELEMETRY_KIND=telemetry-to-console` | — |
| Send to SAP Cloud Logging | `CDS_REQUIRES_TELEMETRY_KIND=telemetry-to-cloud-logging` | a `cloud-logging` instance with `ingest_otlp.enabled=true` |
| Send to Dynatrace | `CDS_REQUIRES_TELEMETRY_KIND=telemetry-to-dynatrace` | a Dynatrace managed instance with token scopes `openTelemetryTrace.ingest` + `metrics.ingest` |

Reference: [`@cap-js/telemetry` README — Predefined Kinds](https://github.com/cap-js/telemetry#predefined-kinds).

### Verify on CF

```bash
# Hit the endpoints
APP=https://capire-ord-sample-<random>.cfapps.<region>.hana.ondemand.com
curl -s $APP/.well-known/open-resource-discovery | jq '.'
curl -s $APP/ord/v1/documents/ord-document       | jq '.'

# Tail logs — for `telemetry-to-console`, spans appear here
cf logs capire-ord-sample --recent | grep -E "ord\.|telemetry"
```

For Cloud Logging or Dynatrace, jump to the bound backend's UI and search by
`service.name=@capire/ord-sample` (auto-derived from `xmpl/package.json`).

---

## Disable

```bash
NO_TELEMETRY=true npx cds-serve
# or set NO_TELEMETRY=true in manifest.yml env
```

Both `@cap-js/telemetry` and our wrappers in `lib/telemetry.js` honour this.

---

## Open questions to confirm with Anton / Priyanka before merge

1. Span/attribute namespacing — should `ord.*` follow the SAP-extended
   semantic conventions in [`CPA/telemetry-semantic-conventions`](https://github.tools.sap/CPA/telemetry-semantic-conventions)?
2. Metric naming — `ord.documents.generated` etc. We followed OTel naming
   conventions, but no formal SAP review yet.
3. Java side (`cap-java/cds-feature-ord`) — equivalent in Java once Martin
   Lakov has migrated the code.
4. Coexistence with Dynatrace OneAgent on BTP — `@cap-js/telemetry` already
   has detection logic; we inherit it for free since we never start an SDK.
