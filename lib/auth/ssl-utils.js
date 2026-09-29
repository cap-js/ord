const { pki } = require("node-forge");

function issuer(cert) {
    return pki
        .certificateFromPem(cert)
        .issuer.attributes.map(({ shortName, value }) => `${shortName}=${value}`)
        .join(", ");
}

function subject(cert) {
    return pki
        .certificateFromPem(cert)
        .subject.attributes.map((attr) => [attr.shortName, attr.value].join("="))
        .join(", ");
}

function unchain(chained) {
    return chained.split(/(?<=-----END CERTIFICATE-----)/).filter((part) => part.trim() !== "");
}

/**
 * Decodes a base64 value and rejects malformed input. Node's base64 decoder is
 * permissive, so a canonical round-trip check is required before using decoded
 * certificate data for authentication.
 *
 * @param {string} value - Base64-encoded value
 * @returns {string} UTF-8 decoded value
 * @throws {Error} If the value is not valid base64
 */
function decodeBase64(value) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error("Invalid base64 value");
    }

    const decoded = Buffer.from(value, "base64");
    const inputWithoutPadding = value.replace(/=+$/, "");
    const decodedWithoutPadding = decoded.toString("base64").replace(/=+$/, "");

    if (decoded.length === 0 || inputWithoutPadding !== decodedWithoutPadding) {
        throw new Error("Invalid base64 value");
    }

    return decoded.toString("utf-8");
}

/**
 * Tokenizes a Distinguished Name (DN) string into components.
 * Supports both comma-separated and slash-separated formats.
 *
 * Examples:
 *   "CN=test, O=SAP SE, C=DE" (comma-separated)
 *   → ["CN=test", "O=SAP SE", "C=DE"]
 *
 *   "/CN=test/O=SAP SE/C=DE" (slash-separated, e.g., from UCL)
 *   → ["CN=test", "O=SAP SE", "C=DE"]
 *
 * @param {string} dn - DN-style string
 * @returns {string[]} Array of DN tokens
 */
function tokenizeDn(dn) {
    const dnStr = String(dn);
    // Remove leading slash if present
    const cleanDn = dnStr.startsWith("/") ? dnStr.substring(1) : dnStr;
    const separator = dnStr.startsWith("/") ? "/" : ",";

    return cleanDn
        .split(separator)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

/**
 * Compares two arrays of DN tokens in an order-insensitive way while retaining
 * token multiplicity, as a DN may contain the same attribute more than once.
 *
 * @param {string[]} tokens1 - First array of DN tokens
 * @param {string[]} tokens2 - Second array of DN tokens
 * @returns {boolean} True if tokens match
 */
function dnTokensMatch(tokens1, tokens2) {
    if (tokens1.length !== tokens2.length) {
        return false;
    }

    const tokenCounts = new Map();

    for (const token of tokens1) {
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    for (const token of tokens2) {
        const count = tokenCounts.get(token);

        if (!count) {
            return false;
        }

        if (count === 1) {
            tokenCounts.delete(token);
        } else {
            tokenCounts.set(token, count - 1);
        }
    }

    return tokenCounts.size === 0;
}

module.exports = {
    issuer,
    subject,
    unchain,
    decodeBase64,
    tokenizeDn,
    dnTokensMatch,
};
