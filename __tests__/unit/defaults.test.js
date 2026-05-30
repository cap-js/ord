jest.mock("fs", () => {
    return {
        readFileSync: () => JSON.stringify({ version: "1.0.0" }),
    };
});

jest.mock("../../lib/common/slice", () => {
    return {
        slice: jest.fn((x) => [x]),
    };
});

const path = require("path");
const cds = require("@sap/cds");

const defaults = require("../../lib/defaults");
const { DOCUMENT_PERSPECTIVES, ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const { slice } = require("../../lib/common/slice");

describe("defaults", () => {
    describe("$schema", () => {
        it("should return default value", () => {
            expect(defaults.$schema).toMatchSnapshot();
        });
    });

    describe("openResourceDiscovery", () => {
        it("should return default value", () => {
            const packageJson = require(path.join(__dirname, "..", "..", "package.json"));

            expect(defaults.openResourceDiscovery).toMatchSnapshot();
            expect(
                packageJson.devDependencies["@open-resource-discovery/specification"].startsWith(
                    defaults.openResourceDiscovery,
                ),
            ).toBe(true);
        });
    });

    describe("policyLevels", () => {
        it("should return default value", () => {
            expect(defaults.policyLevels).toMatchSnapshot();
        });
    });

    describe("description", () => {
        it("should return default value", () => {
            expect(defaults.description).toMatchSnapshot();
        });
    });

    describe("groupTypeId", () => {
        it("should return default value", () => {
            expect(defaults.groupTypeId).toMatchSnapshot();
        });
    });

    describe("baseTemplate", () => {
        beforeEach(() => {
            slice.mockClear();
        });

        it("should return correct value when no tenant is given and toggles & extensions are disabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = false;
            const model = { $schema: defaults.$schema };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(1);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when tenant is not given and only toggles are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = false;
            const model = { $schema: defaults.$schema };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(1);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when tenant is not given and only extensions are enabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = true;
            const model = { $schema: defaults.$schema };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(1);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when no tenant is given and toggles & extensions are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = true;
            const model = { $schema: defaults.$schema };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(1);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when tenant is given and only toggles are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = false;
            const model = { $schema: defaults.$schema };
            const tenantModel = { openResourceDiscovery: defaults.openResourceDiscovery };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model, tenantModel)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(2);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
            expect(slice.mock.calls[1][0]).toBe(tenantModel);
            expect(slice.mock.calls[1][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when tenant is given and extensions are enabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = true;
            const model = { $schema: defaults.$schema };
            const tenantModel = { openResourceDiscovery: defaults.openResourceDiscovery };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model, tenantModel)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(2);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
            expect(slice.mock.calls[1][0]).toBe(tenantModel);
            expect(slice.mock.calls[1][1]).toBe(defaults.sizeLimit);
        });

        it("should return correct value when tenant is given and toggles & extensions are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = true;
            const model = { $schema: defaults.$schema };
            const tenantModel = { openResourceDiscovery: defaults.openResourceDiscovery };
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };

            expect(defaults.baseTemplate(authConfig, model, tenantModel)).toMatchSnapshot();
            expect(slice.mock.calls).toHaveLength(2);
            expect(slice.mock.calls[0][0]).toBe(model);
            expect(slice.mock.calls[0][1]).toBe(defaults.sizeLimit);
            expect(slice.mock.calls[1][0]).toBe(tenantModel);
            expect(slice.mock.calls[1][1]).toBe(defaults.sizeLimit);
        });
    });

    describe("adjustForPerspective", () => {
        it("should return correct value when system-instance-perspective is given", () => {
            expect(
                defaults.adjustForPerspective(
                    {
                        apiResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.oas3.json",
                                    },
                                ],
                            },
                        ],
                        eventResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.asyncapi2.json",
                                    },
                                ],
                            },
                        ],
                    },
                    DOCUMENT_PERSPECTIVES.SystemInstance,
                ),
            ).toMatchSnapshot();
        });

        it("should return correct value when system-instance-version is given", () => {
            cds.env.ord = { describedSystemVersion: { version: "1.0" } };

            expect(
                defaults.adjustForPerspective(
                    {
                        apiResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.oas3.json",
                                    },
                                ],
                            },
                        ],
                        eventResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.asyncapi2.json",
                                    },
                                ],
                            },
                        ],
                    },
                    DOCUMENT_PERSPECTIVES.SystemVersion,
                ),
            ).toMatchSnapshot();
        });
    });
});
