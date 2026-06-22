const { trace } = require("@opentelemetry/api");
const { ATTR_HTTP_ROUTE } = require("@opentelemetry/semantic-conventions");

const ORD_PATH_PREFIXES = ["/ord/v1", "/.well-known/open-resource-discovery"];

const isOrdPath = (path) =>
    ORD_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));

function setHttpRouteOnRootSpan(req, res, next) {
    if (!isOrdPath(req.path)) return next();

    const rootSpan = trace.getActiveSpan();
    if (!rootSpan) return next();

    res.on("finish", () => {
        const matchedRoute = req.route?.path;
        if (matchedRoute) rootSpan.setAttribute(ATTR_HTTP_ROUTE, matchedRoute);
    });
    next();
}

module.exports = { setHttpRouteOnRootSpan };
