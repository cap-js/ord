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
 * Compares two arrays of DN tokens in an order-insensitive way.
 * Uses Set-based comparison for efficiency.
 *
 * @param {string[]} tokens1 - First array of DN tokens
 * @param {string[]} tokens2 - Second array of DN tokens
 * @returns {boolean} True if tokens match
 */
function dnTokensMatch(tokens1, tokens2) {
    if (tokens1.length !== tokens2.length) {
        return false;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    if (set1.size !== set2.size) {
        return false;
    }

    for (const token of set1) {
        if (!set2.has(token)) {
            return false;
        }
    }

    return true;
}

module.exports = {
    issuer,
    subject,
    unchain,
    tokenizeDn,
    dnTokensMatch,
};
