const { DWC_MTLS_HEADERS, MTLS_ERROR_REASON } = require("../../lib/constants");
const { extractCertHeaders, createDwcMtlsValidator, createDwcMtlsConfig } = require("../../lib/auth/dwc-mtls");

const CERT_CHAIN = `-----BEGIN CERTIFICATE-----
MIICqDCCAZACCQDLACU6DqEbSTANBgkqhkiG9w0BAQsFADAXMRUwEwYDVQQDDAxU
cnVzdGVkIFJvb3QwHhcNMjYxMDIxMDYzMjQyWhcNMzYxMDE4MDYzMjQyWjAVMRMw
EQYDVQQDDApEd0MgQ2xpZW50MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAnT1iU4VqNHYcjq2kb5qvJ6ezv2uIL6yBoJ4K+6C7iMRhy8tsGePuFKOnWPht
83cIMwJRpgJbZGI2W6Lv3MM3OPOY/WgzFNZNEUtW5lsd6QQ4B+/5vDiUxjcX+lw+
3BvJ0N93o1HYiESvwE00j7W1/T8vf6FIUQ+Qvee/fyL+ZuZ4xDyUXm50oNYWTbGb
M9WFtPoryoiTu7jsas5wJsRCHKHbRekWK8miEqgu2V3uEzPOVCS1fBSDA7Hn4sUh
/KnsMv7rAJ/YheW/u5VqS48SR5HSDOjv77hwEI11weGlcZPvaCz/aUQjhgkKhmL/
Z2UkmdQj61xyoAyP+x2l1UTv5wIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCrZ7uG
yW8p7Io/8hifiEhfEi2+bDDVhbF2ge6vlqDdLy/eq2cO+9m8JOut1OkmWIjIyd6R
S7VBY1olljXe/hjeei1DMK5qRVR2X+8HQ6QQLseDvNc7A1nx0HctX2almjNhkesR
fOC226HpMVj39YVA0SjKzndApmp8Tp6NCulSlgsqHbUDxj+tet6zISAXE4TNPIMD
x53BjL6n3+zCqNVulBAR+pNPRO1b9kgl5J6otpQ63VCbx9tQoDz81PVsEZCoa9Up
A2VMU2kUrqY+B5k0h3XOODrUA2G3ClLEHmOOqvHInJf4KeXOGaHcxS38m13SoU8z
Knj/d6stCcN5qh9X
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICqjCCAZICCQC78DNIk6Y8hzANBgkqhkiG9w0BAQsFADAXMRUwEwYDVQQDDAxU
cnVzdGVkIFJvb3QwHhcNMjYxMDIxMDYzMjQyWhcNMzYxMDE4MDYzMjQyWjAXMRUw
EwYDVQQDDAxUcnVzdGVkIFJvb3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQDHgUQPeuM7mcmui1vNvZ+6odabc2zJwz/DA9dkEHeUZlRiQiC1TyR9AXT3
GnjFHsCuGMYcV3o8ghAy/k7q6OdQJ3r+WCWYEXvDKfHpJMfNDoVTUUoHaQHAwEzF
VKegU8gmWqPAtSQIS2RuPM0cL3EjJNQ1F3fniMO/gFADX3mZKFVg3QnsHtL42M9w
JYRe/35xx2WNlszacStxlYf0qfAPTYUXsrGejbutcGlc2hvSMC0xVUwaFGBRCfTb
ULgLlT2rtaICw0jHemXE6Hmfl347V3INEMelPt3C1/6MiQDcijh1uRV055fKBPxo
Pc6lBCqEw0dfy/6ooOOQf59R5bC5AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAHIu
bm2ynNieaCo+tbS29/u5JKkutDMPUM/AtnpWJ8I5oG6wSmkpdtvbULfAocsZELIl
CZKm5V3lDAZY6hcwHimp6yIJdo+ehzWFM913OAHVow8jKGPsKim7oJDy4b1U4wHc
q6diYB5osiahM9uzL2hXFgIfAz1HIdLb8ncwZWeUqkdlHXSJgp8s0UPUYRFTD6V9
2IXCX5o6UFgMxuuEpARXQC6UgQZpZBDMcWA/atlsyRQZ1PVuQd56xPTwCypofkcx
ajndFnBR9dJs79tJYtYqajVBbKNzp6mwKb/iiWHJ7YDnA7BQ0GlBnM+4Qk1MTm3D
gvylCzaagEMkzxpDtLA=
-----END CERTIFICATE-----
`;

describe("DwC mTLS validation", () => {
    const request = {
        headers: {
            [DWC_MTLS_HEADERS.DFCC.toLowerCase()]: `Cert="${encodeURIComponent(CERT_CHAIN)}"`,
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
                [DWC_MTLS_HEADERS.DFCC.toLowerCase()]: [Buffer.from(CERT_CHAIN).toString("base64")],
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
