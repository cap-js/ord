/**
 * Non-invasive OpenTelemetry hookup for @cap-js/ord.
 *
 * Design goal: business code in `lib/ord.js` / `lib/services/ord-service.js`
 * must not import anything from here. All instrumentation is attached from a
 * single `cds.on('bootstrap')` hook in `cds-plugin.js`.
 *
 * Following the OTel instrumented-library guidelines
 * (https://opentelemetry.io/docs/specs/otel/library-guidelines/):
 *  - depend ONLY on @opentelemetry/api + @opentelemetry/semantic-conventions
 *  - never initialize a TracerProvider / MeterProvider here
 *  - emit no-op telemetry when the host app has not registered an SDK
 *
 * The expectation is that the host installs @cap-js/telemetry, which
 * registers `@opentelemetry/instrumentation-http`. That gives us a fully
 * spec-conformant HTTP server span for free; we only add an `ord.request.duration`
 * histogram (whose `_count` aggregation doubles as request rate) keyed by the
 * standard HTTP semantic attributes.
 */

const { metrics } = require("@opentelemetry/api");
const {
    ATTR_HTTP_REQUEST_METHOD,
    ATTR_HTTP_RESPONSE_STATUS_CODE,
    ATTR_HTTP_ROUTE,
} = require("@opentelemetry/semantic-conventions");
const pkg = require("../package.json");

const meter = metrics.getMeter(pkg.name, pkg.version);

const requestDuration = meter.createHistogram("ord.request.duration", {
    unit: "ms",
    description: "Duration of HTTP requests served by @cap-js/ord endpoints",
});

/**
 * Express middleware: time the request and record one observation on
 * `ord.request.duration` when the response finishes. Status code is read from
 * `res.statusCode` so 4xx / 5xx are captured faithfully.
 */
function ordTelemetryMiddleware(req, res, next) {
    // Only observe ORD plugin routes; skip everything else.
    if (!req.path.startsWith("/ord/v1") && !req.path.startsWith("/.well-known/open-resource-discovery")) {
        return next();
    }
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        requestDuration.record(ms, {
            [ATTR_HTTP_ROUTE]: req.route?.path ?? req.baseUrl + req.path,
            [ATTR_HTTP_REQUEST_METHOD]: req.method,
            [ATTR_HTTP_RESPONSE_STATUS_CODE]: res.statusCode,
        });
    });
    next();
}

module.exports = { ordTelemetryMiddleware };
