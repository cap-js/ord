const { CF_MTLS_HEADERS } = require("../lib/constants");

module.exports = {
    pinLastUpdateForStableTest: (ord, lastUpdate = "2026-05-04T13:45:01+01:00") => {
        [
            ...(ord.apiResources || []), //
            ...(ord.eventResources || []), //
            ...(ord.consumptionBundles || []), //
        ].forEach((element) => {
            element.lastUpdate = lastUpdate;
        });

        return ord;
    },
    /**
     * Build mock mTLS headers as sent by CF gorouter
     * Includes XFCC headers indicating proxy verification
     */
    createMtlsHeaders: (issuer, subject, rootCaDn) => {
        return {
            // XFCC headers indicating proxy has verified the certificate
            [CF_MTLS_HEADERS.XFCC]: "Hash=abc123;Subject=CN=test",
            [CF_MTLS_HEADERS.CLIENT]: "1",
            [CF_MTLS_HEADERS.CLIENT_VERIFY]: "0",
            // Certificate DN headers (corrected to match actual gorouter headers)
            [CF_MTLS_HEADERS.ISSUER]: Buffer.from(issuer).toString("base64"),
            [CF_MTLS_HEADERS.SUBJECT]: Buffer.from(subject).toString("base64"),
            [CF_MTLS_HEADERS.ROOT_CA]: Buffer.from(rootCaDn).toString("base64"),
        };
    },
};
