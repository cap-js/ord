# Reproducing the EDMX 500 bug (cap-js/ord#543, recurrence of #330)

## What is broken

On a multitenant app on BTP, importing the ORD document into API Hub sometimes fails with:

```
ODATA API: <ServiceName> does not contain EDMX File
```

The ORD document is generated fine and lists the `.edmx` link, but fetching that
exact `.edmx` URL sometimes returns **HTTP 500**:

```
No service definition matching <ServiceName> found in given model(s).
```

It is intermittent and cannot be reproduced locally.

## Why

The document and the `.edmx` are **two separate HTTP requests**. Each one resolves
the CDS model on its own (`resolveCdsModel` in `lib/services/ord-service.js`).

- Document request: resolves model A, lists `ServiceX.edmx`.
- `.edmx` request: resolves model B, runs `cds.compile(B).to.edmx({ service: "ServiceX" })`.
  If B does not contain `ServiceX`, it throws, and the handler returns HTTP 500
  (`ord-service.js`, ~line 46).

Locally A and B are always identical, so it always works. On BTP, when the model
comes from the dynamic `getCsn()` path (MTX / feature toggles / extensibility),
A and B can differ:

- Each app instance has its **own in-memory model cache** (see
  `@sap/cds-mtxs/srv/model-provider.js`); nothing is shared between instances.
- A feature toggle or extension can add a service that the base model does not have.
- So the instance that served the document may have `ServiceX`, while the instance
  that serves the `.edmx` does not → 500.

This started when `.edmx` serving switched from using the service's own model
(which always contains it) to re-resolving the model per request (#413), and got
worse when default toggles also started going through `getCsn` (#534).

## How to reproduce (deterministic)

Boots **two real server instances** whose models differ by one service
(`PremiumService` is present on instance A, missing on instance B). Then it fetches
the document from A (which lists `PremiumService.edmx`) and fetches that same URL
from B.

```bash
npm install
node repro-two-instance.cjs
```

Expected output:

```
[A] GET /ord/v1/documents/ord-document  -> 200; document lists PremiumService.edmx
[A] GET .../PremiumService.edmx  -> HTTP 200
[B] GET .../PremiumService.edmx  -> HTTP 500
        No service definition matching PremiumService found in given model(s).
```

Same URL: 200 on the instance that has the service, 500 on the one that does not.
That 500 is what API Hub reports as "does not contain EDMX File". No plugin code
is mocked.

There is also an in-process jest version:

```bash
npx jest __tests__/integration/edmx-drift.repro.test.js --testPathIgnorePatterns=/node_modules/ --forceExit
```

## Suggested fix

Do not let the `.edmx` request re-resolve the model independently. Either serve the
`.edmx` from a model guaranteed to contain the service (its pre-#413 behavior of
using the service's own model), or return 404 (not 500) when the service is absent
in the resolved model, or resolve the model once and reuse it for both the document
and the resource files so they can never disagree.

## Files added on this branch

- `repro-two-instance.cjs` — the two-instance reproduction.
- `__tests__/integration/edmx-drift.repro.test.js` — in-process jest reproduction.
- `__tests__/integration/integration-test-app/_repro_ext/premium-service.cds` —
  the service present only on instance A.
- `__tests__/integration/integration-test-app/.cdsrc.repro-a.json` /
  `.cdsrc.repro-b.json` — the two instance configs.
