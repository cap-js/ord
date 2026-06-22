/**
 * OpenTelemetry instrumentation primitives for @cap-js/ord.
 *
 * Follows the OTel "instrumented library" guidelines
 * (https://opentelemetry.io/docs/specs/otel/library-guidelines/):
 *  - depends ONLY on @opentelemetry/api and @opentelemetry/semantic-conventions
 *  - never initializes a TracerProvider / MeterProvider itself
 *  - emits no-op telemetry when no SDK is registered by the host app
 *
 * The expectation is that the host CAP application installs @cap-js/telemetry
 * (or any other OTel SDK setup), which registers global providers and the
 * `@opentelemetry/instrumentation-http` instrumentation. Our spans then become
 * INTERNAL children of the HTTP root span automatically.
 *
 * Disabling: the host's switch (e.g. NO_TELEMETRY in @cap-js/telemetry) prevents
 * the SDK from being registered, after which OTel API calls are no-ops with
 * negligible overhead. We do not duplicate the switch here.
 */

const { trace, metrics, SpanStatusCode } = require("@opentelemetry/api");
const {
    ATTR_HTTP_REQUEST_METHOD,
    ATTR_HTTP_RESPONSE_STATUS_CODE,
    ATTR_HTTP_ROUTE,
    ATTR_ERROR_TYPE,
} = require("@opentelemetry/semantic-conventions");
const pkg = require("../package.json");

const tracer = trace.getTracer(pkg.name, pkg.version);
const meter = metrics.getMeter(pkg.name, pkg.version);

// --- Pre-declared instruments ------------------------------------------------
// Names follow OTel naming conventions (lower.snake_case, dot separators, no
// pluralization, no `_total` suffix).

const requests = meter.createCounter("ord.requests", {
    description: "Number of HTTP requests served by @cap-js/ord endpoints",
});

const documentGenerationDuration = meter.createHistogram("ord.document.generation.duration", {
    unit: "ms",
    description: "Wall-clock duration of a single ORD document generation",
});

// --- Span wrapper ------------------------------------------------------------

/**
 * Run a function inside an active INTERNAL span. Supports both sync return
 * values and Promises transparently (sniffs the return).
 *
 * Status semantics follow the OTel spec:
 *  - success: status left UNSET (the spec discourages explicit OK)
 *  - throw:   recordException + setStatus(ERROR) + error.type, then rethrow
 *
 * Trusts the OTel API contract: `tracer.startActiveSpan` always invokes the
 * callback with a non-null Span — no SDK means a no-op span, not undefined.
 */
function withSpan(name, attributes, fn) {
    return tracer.startActiveSpan(name, { attributes }, (span) => {
        const finish = (err) => {
            if (err) {
                span.recordException(err);
                span.setAttribute(ATTR_ERROR_TYPE, err.name || "Error");
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            }
            span.end();
        };
        try {
            const result = fn(span);
            if (result && typeof result.then === "function") {
                return result.then(
                    (value) => {
                        finish();
                        return value;
                    },
                    (err) => {
                        finish(err);
                        throw err;
                    },
                );
            }
            finish();
            return result;
        } catch (err) {
            finish(err);
            throw err;
        }
    });
}

// --- HTTP request counter ----------------------------------------------------

/**
 * Express middleware that records the `ord.requests` counter when the response
 * finishes — captures the real status code (incl. 400/404/500), not a hardcoded
 * value. Span-level HTTP attributes are left to `@opentelemetry/instrumentation-http`,
 * which the host's @cap-js/telemetry registers and which already conforms to
 * the HTTP server semantic conventions.
 */
function recordRequest(req, res, next) {
    res.on("finish", () => {
        requests.add(1, {
            [ATTR_HTTP_ROUTE]: req.route?.path ?? req.baseUrl + req.path,
            [ATTR_HTTP_REQUEST_METHOD]: req.method,
            [ATTR_HTTP_RESPONSE_STATUS_CODE]: res.statusCode,
        });
    });
    next();
}

module.exports = {
    tracer,
    meter,
    withSpan,
    recordRequest,
    documentGenerationDuration,
};
