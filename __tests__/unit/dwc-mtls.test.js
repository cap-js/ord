const path = require("path");
const fs = require("fs");

const { DWC_MTLS_HEADERS, MTLS_ERROR_REASON } = require("../../lib/constants");
const { extractCertHeaders, createDwcMtlsValidator, createDwcMtlsConfig } = require("../../lib/auth/dwc-mtls");

describe("DwC mTLS validation", () => {
    const leafPem = fs.readFileSync(path.join(__dirname, "fixtures/dwc-leaf.pem"), "utf8");
    const caPem = fs.readFileSync(path.join(__dirname, "fixtures/dwc-ca.pem"), "utf8");
    const chain = `${leafPem}${caPem}`;
    const request = {
        headers: {
            [DWC_MTLS_HEADERS.DFCC.toLowerCase()]: `Cert="${encodeURIComponent(chain)}"`,
        },
    };

    it("extracts the leaf and root DNs from an Envoy certificate chain", () => {
        expect(extractCertHeaders(request)).toEqual({
            issuer: "CN=Trusted Root",
            subject: "CN=DwC Client",
            rootCaDn: "CN=Trusted Root",
        });
    });

    it("extracts a base64-encoded PEM certificate chain", () => {
        const base64Request = {
            headers: {
                [DWC_MTLS_HEADERS.DFCC.toLowerCase()]: [Buffer.from(chain).toString("base64")],
            },
        };

        expect(extractCertHeaders(base64Request)).toMatchObject({
            issuer: "CN=Trusted Root",
            subject: "CN=DwC Client",
            rootCaDn: "CN=Trusted Root",
        });
    });

    it("accepts a chain whose certificate pair and root CA are trusted", () => {
        const validate = createDwcMtlsValidator({
            trustedCertPairs: [{ issuer: "CN=Trusted Root", subject: "CN=DwC Client" }],
            trustedRootCaDns: ["CN=Trusted Root"],
        });

        expect(validate(request)).toMatchObject({ ok: true });
    });

    it("rejects a request without the DwC forwarded-certificate header", () => {
        const validate = createDwcMtlsValidator({
            trustedCertPairs: [{ issuer: "CN=Trusted Root", subject: "CN=DwC Client" }],
            trustedRootCaDns: ["CN=Trusted Root"],
        });

        expect(validate({ headers: {} })).toEqual({
            ok: false,
            reason: MTLS_ERROR_REASON.XFCC_VERIFICATION_FAILED,
        });
    });

    it.each([[[{ issuer: "", subject: "CN=DwC Client" }]], [[{ issuer: "CN=Trusted Root" }]], [[null]]])(
        "rejects malformed trusted certificate pairs: %p",
        (trustedCertPairs) => {
            expect(() =>
                createDwcMtlsValidator({
                    trustedCertPairs,
                    trustedRootCaDns: ["CN=Trusted Root"],
                }),
            ).toThrow("Each trusted certificate must provide a non-empty issuer and subject");
        },
    );

    it("rejects malformed trusted root CA DNs", () => {
        expect(() =>
            createDwcMtlsValidator({
                trustedCertPairs: [{ issuer: "CN=Trusted Root", subject: "CN=DwC Client" }],
                trustedRootCaDns: [""],
            }),
        ).toThrow("Each trusted root CA DN must be a non-empty string");
    });
});

describe("DwC mTLS configuration", () => {
    const Logger = { error: jest.fn(), info: jest.fn() };

    afterEach(() => {
        delete process.env.DWC_MTLS_TRUSTED_CERTS;
        jest.clearAllMocks();
    });

    it("creates a validator from inline DwC configuration", async () => {
        const config = await createDwcMtlsConfig(
            {
                env: {
                    ord: {
                        authentication: {
                            dwcMtls: {
                                certs: [{ issuer: "CN=Trusted Root", subject: "CN=DwC Client" }],
                                rootCaDn: ["CN=Trusted Root"],
                            },
                        },
                    },
                },
            },
            Logger,
        );

        expect(config.error).toBeUndefined();
        expect(config.mtlsValidator).toEqual(expect.any(Function));
    });

    it("requires the environment configuration when DwC mTLS is enabled for production", async () => {
        const config = await createDwcMtlsConfig({ env: { ord: { authentication: { dwcMtls: true } } } }, Logger);

        expect(config).toEqual({
            error: "DWC_MTLS_TRUSTED_CERTS environment variable required when dwcMtls is set to true",
        });
    });
});
