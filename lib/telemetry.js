/**
 * Non-invasive OpenTelemetry hookup for @cap-js/ord.
 *
 * The host CAP application is expected to install @cap-js/telemetry, which
 * registers @opentelemetry/instrumentation-http. That auto-instrumentation
 * produces:
 *  - the HTTP server root span (method, status_code, url.*, ...)
 *  - the `http.server.request.duration` histogram
 *
 * What it does NOT produce is the `http.route` attribute, because the http
 * module has no idea how express matched the URL. Without `http.route`, every
 * ORD request (e.g. /ord/v1/<unique-ordId>/<service>) becomes its own metric
 * time series — a high-cardinality footgun and the reason backends can't
 * aggregate "all calls to /ord/v1/:ordId/:service".
 *
 * The single responsibility of this module is to fill that gap: read
 * `req.route.path` (express's matched route template) when the response
 * finishes, and stamp it onto the active HTTP root span. instrumentation-http
 * picks the attribute up on its own `res.on('close')` handler and copies it
 * into both the metric labels and the span name.
 *
 * Strictly follows the OTel instrumented-library guidelines: depends only on
 * @opentelemetry/api + @opentelemetry/semantic-conventions, never touches the
 * SDK, no-op when no SDK is registered (the API contract guarantees this).
 */

const { trace } = require("@opentelemetry/api");
const { ATTR_HTTP_ROUTE } = require("@opentelemetry/semantic-conventions");

const ORD_PATH_PREFIXES = ["/ord/v1", "/.well-known/open-resource-discovery"];

function ordHttpRouteAttribute(req, res, next) {
    if (!ORD_PATH_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/") || req.path.startsWith(p))) {
        return next();
    }
    // Capture the root span reference now, while the OTel async context is
    // still alive. We do NOT call trace.getActiveSpan() from inside the
    // 'finish' listener because some host async hooks lose the context there.
    const span = trace.getActiveSpan();
    if (!span) return next();

    res.on("finish", () => {
        // express attaches the matched Route to req.route by the time the
        // route handler runs, so it is set well before response finish.
        const route = req.route?.path;
        if (route) span.setAttribute(ATTR_HTTP_ROUTE, route);
    });
    next();
}

module.exports = { ordHttpRouteAttribute };
