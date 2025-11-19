/**
 * UCL mTLS Subject Validation Module
 * 
 * This module provides pure Node.js utilities for validating client certificate subjects
 * in the context of UCL (Unified Customer Landscape) mTLS authentication.
 * 
 * IMPORTANT SECURITY CONTEXT:
 * - This module assumes TLS termination and certificate chain validation is handled
 *   by the front proxy (e.g., Cloud Foundry gorouter or API Gateway)
 * - It ONLY validates the client certificate Subject string against a whitelist
 * - It does NOT perform cryptographic validation, certificate chain verification,
 *   or issuer validation - those are the proxy's responsibility
 * 
 * This is intentionally framework-agnostic and has zero dependencies.
 */

/**
 * Extracts a DN-style subject string from a client certificate header.
 *
 * In CF/BTP environments, X-Forwarded-Client-Cert (XFCC) might look like:
 *   Hash=...,Subject="CN=..., O=SAP SE,...",URI=...,Issuer="..."
 *
 * In other setups, the header might already be the raw DN:
 *   CN=..., O=SAP SE, L=Walldorf, C=DE
 *
 * This helper handles both formats:
 * - If it finds `Subject="..."` or `Subject=...`, extracts that segment
 * - Otherwise assumes the whole header value is the DN
 *
 * @param {string | string[] | undefined} headerValue - The header value to parse
 * @returns {string | null} DN-style subject string or null if not found
 */
function extractSubjectFromHeader(headerValue) {
    if (headerValue == null) return null;

    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const value = String(raw).trim();
    if (!value) return null;

    // Try to match XFCC-style Subject segment: Subject="...,..."
    // Examples:
    //   Subject="CN=foo, O=SAP SE, C=DE"
    //   Subject=CN=foo, O=SAP SE, C=DE
    // First try with quotes
    let subjectMatch = value.match(/Subject="([^"]+)"/i);
    if (subjectMatch && subjectMatch[1]) {
        return subjectMatch[1].trim();
    }
    
    // Then try without quotes (match until next comma-separated key=value pair or end)
    subjectMatch = value.match(/Subject=([^,]+(?:,[^=,]+=[^,]+)*?)(?:,\w+=|$)/i);
    if (subjectMatch && subjectMatch[1]) {
        return subjectMatch[1].trim();
    }

    // Fallback: treat the whole value as DN
    return value;
}

/**
 * Normalizes an X.509 DN subject into a set of "key=value" tokens,
 * splitting by comma and trimming whitespace.
 *
 * This implements the UCL mTLS specification's recommendation for
 * order-insensitive Subject comparison.
 *
 * Example:
 *   "CN=foo, O=SAP SE, C=DE"
 *   → Set { "CN=foo", "O=SAP SE", "C=DE" }
 *
 * The order of tokens is intentionally ignored.
 *
 * @param {string} subject - DN-style subject string
 * @returns {Set<string>} Set of normalized DN tokens
 */
function normalizeSubject(subject) {
    return new Set(
        String(subject)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
    );
}

/**
 * Compares two DN-style subject strings in an order-insensitive way.
 *
 * This matches the recommendation in the UCL / sap:cmp-mtls:v1 specification:
 * - Splits each by comma `,`
 * - Trims whitespace from each part
 * - Compares the resulting sets for exact equality
 *
 * @param {string} actual - The actual subject from the certificate
 * @param {string} expected - The expected subject from configuration
 * @returns {boolean} True if subjects are equivalent
 */
function subjectsEqual(actual, expected) {
    const a = normalizeSubject(actual);
    const b = normalizeSubject(expected);

    if (a.size !== b.size) return false;
    for (const token of a) {
        if (!b.has(token)) return false;
    }
    return true;
}

/**
 * Creates a validator function that checks whether a request contains
 * a client certificate subject matching ANY of the expected subjects.
 *
 * This is pure Node.js, framework-agnostic. It expects a request object
 * with a headers property:
 *
 *   { headers: { 'x-forwarded-client-cert': '...' } }
 *
 * @param {Object} options - Configuration options
 * @param {string[]} options.expectedSubjects - List of allowed UCL subjects (DN-style)
 * @param {string} [options.headerName='x-forwarded-client-cert'] - Header to read certificate info from
 * @returns {Function} Validator function that accepts a request and returns validation result
 * @throws {Error} If expectedSubjects is not a non-empty array
 */
function createUclMtlsValidator({ expectedSubjects, headerName = "x-forwarded-client-cert" }) {
    if (!Array.isArray(expectedSubjects) || expectedSubjects.length === 0) {
        throw new Error("createUclMtlsValidator: expectedSubjects must be a non-empty array");
    }

    const headerKey = headerName.toLowerCase();
    const normalizedExpected = expectedSubjects.filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 0);

    if (normalizedExpected.length === 0) {
        throw new Error("createUclMtlsValidator: expectedSubjects contains only empty values");
    }

    /**
     * Validates a request for UCL mTLS authentication
     * @param {Object} req - Request object with headers property
     * @returns {Object} Validation result with ok, reason, and optional subject
     */
    return function validateRequest(req) {
        if (!req || !req.headers) {
            return { ok: false, reason: "NO_HEADERS" };
        }

        // Node.js/Express lowercases all header keys
        const headerValue = req.headers[headerKey] ?? req.headers[headerName] ?? undefined;

        if (headerValue == null) {
            return { ok: false, reason: "HEADER_MISSING" };
        }

        const subject = extractSubjectFromHeader(headerValue);
        if (!subject) {
            return { ok: false, reason: "SUBJECT_MISSING" };
        }

        const match = normalizedExpected.some((expected) => subjectsEqual(subject, expected));
        if (!match) {
            return { ok: false, reason: "SUBJECT_MISMATCH", subject };
        }

        return { ok: true, subject };
    };
}

module.exports = {
    extractSubjectFromHeader,
    normalizeSubject,
    subjectsEqual,
    createUclMtlsValidator,
};
