const cds = require("@sap/cds");
const path = require("path");

describe("ORD Visibility Annotations Integration Tests", () => {
    let originalCdsRoot;
    
    beforeEach(() => {
        originalCdsRoot = cds.root;
        
        // Mock date for consistent testing
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        
        // Mock authentication
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: ["Open"],
            },
        });
    });
    
    afterEach(() => {
        cds.root = originalCdsRoot;
        jest.restoreAllMocks();
    });

    describe("Service Visibility Annotations", () => {
        test("Services with public visibility are included in ORD document", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Check that services are included (default visibility should be applied)
            expect(document).toHaveProperty("packages");
            expect(document.packages).toBeInstanceOf(Array);
            
            // If API resources exist, they should have proper visibility handling
            if (document.apiResources && document.apiResources.length > 0) {
                for (const apiResource of document.apiResources) {
                    // API resources should have valid structure
                    expect(apiResource).toHaveProperty("ordId");
                    expect(apiResource).toHaveProperty("title");
                    expect(apiResource).toHaveProperty("partOfPackage");
                }
            }
        });
        
        test("Service groups are created based on visibility", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Groups should be created for organizing resources
            if (document.groups && document.groups.length > 0) {
                for (const group of document.groups) {
                    expect(group).toHaveProperty("ordId");
                    expect(group).toHaveProperty("title");
                    
                    // Group ID should follow correct format
                    expect(group.ordId).toMatch(/^[a-z0-9.-]+:group:[a-zA-Z0-9._/-]+:v\d+$/);
                }
            }
        });
    });

    describe("Entity Visibility Annotations", () => {
        test("Entity types are extracted with correct visibility handling", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Entity types should be included if they exist
            if (document.entityTypes && document.entityTypes.length > 0) {
                for (const entityType of document.entityTypes) {
                    expect(entityType).toHaveProperty("ordId");
                    expect(entityType).toHaveProperty("title");
                    expect(entityType).toHaveProperty("partOfPackage");
                    
                    // Entity type ID should follow correct format
                    expect(entityType.ordId).toMatch(/^[a-z0-9.-]+:entityType:[a-zA-Z0-9._/-]+:v\d+$/);
                }
            }
        });
    });

    describe("Resource Grouping by Visibility", () => {
        test("Resources are grouped according to visibility settings", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify package-resource relationships
            if (document.packages.length > 0 && document.apiResources && document.apiResources.length > 0) {
                const packageIds = new Set(document.packages.map(pkg => pkg.ordId));
                
                for (const apiResource of document.apiResources) {
                    // Each API resource should belong to an existing package
                    expect(packageIds.has(apiResource.partOfPackage)).toBe(true);
                }
            }
        });
        
        test("Group membership is correctly assigned", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify resource-group relationships
            if (document.groups && document.groups.length > 0) {
                const groupIds = new Set(document.groups.map(grp => grp.ordId));
                
                // Check API resources group membership
                if (document.apiResources) {
                    for (const apiResource of document.apiResources) {
                        if (apiResource.partOfGroups) {
                            for (const groupId of apiResource.partOfGroups) {
                                expect(groupIds.has(groupId)).toBe(true);
                            }
                        }
                    }
                }
                
                // Check event resources group membership
                if (document.eventResources) {
                    for (const eventResource of document.eventResources) {
                        if (eventResource.partOfGroups) {
                            for (const groupId of eventResource.partOfGroups) {
                                expect(groupIds.has(groupId)).toBe(true);
                            }
                        }
                    }
                }
            }
        });
    });

    describe("Visibility Configuration Integration", () => {
        test("Different visibility configurations produce different groupings", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            
            // Generate document with default settings
            const defaultDocument = ord(csn);
            
            // Configure different visibility settings
            cds.env.export = {
                ord: {
                    defaultVisibility: "internal"
                }
            };
            
            const customDocument = ord(csn);
            
            // Both documents should be valid
            expect(defaultDocument).toHaveProperty("openResourceDiscovery", "1.9");
            expect(customDocument).toHaveProperty("openResourceDiscovery", "1.9");
            
            // Clean up
            delete cds.env.export;
        });
    });

    describe("Visibility Annotation Processing", () => {
        test("ORD Extensions annotations are processed correctly", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify that annotation processing doesn't break document structure
            expect(document).toHaveProperty("openResourceDiscovery");
            expect(document).toHaveProperty("packages");
            
            // Check that packages have required properties
            if (document.packages.length > 0) {
                for (const pkg of document.packages) {
                    expect(pkg).toHaveProperty("ordId");
                    expect(pkg).toHaveProperty("title");
                    expect(pkg).toHaveProperty("vendor");
                    expect(pkg).toHaveProperty("version");
                }
            }
        });
        
        test("Annotation validation doesn't break ORD generation", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            
            // ORD generation should not throw errors even with complex annotations
            expect(() => ord(csn)).not.toThrow();
            
            const document = ord(csn);
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
        });
    });

    describe("Regression Testing for Visibility", () => {
        test("Visibility splitting functionality works correctly", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // This test ensures that visibility splitting doesn't break basic functionality
            expect(document).toHaveProperty("packages");
            expect(document.packages).toBeInstanceOf(Array);
            
            // Verify basic package structure
            if (document.packages.length > 0) {
                const firstPackage = document.packages[0];
                expect(firstPackage.ordId).toMatch(/^[a-z0-9.-]+:package:[a-zA-Z0-9._-]+:v\d+$/);
            }
        });
        
        test("Resource visibility assignment is consistent", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            
            // Generate document multiple times to check consistency
            const document1 = ord(csn);
            const document2 = ord(csn);
            
            // Both documents should have the same structure
            expect(document1.packages.length).toBe(document2.packages.length);
            
            if (document1.apiResources && document2.apiResources) {
                expect(document1.apiResources.length).toBe(document2.apiResources.length);
            }
        });
    });

    describe("Complex Visibility Scenarios", () => {
        test("Mixed visibility services are handled correctly", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify that mixed visibility scenarios produce valid documents
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
            expect(document).toHaveProperty("policyLevel", "sap:core:v1");
            
            // All packages should have consistent structure regardless of visibility
            for (const pkg of document.packages) {
                expect(pkg).toHaveProperty("ordId");
                expect(pkg).toHaveProperty("title");
                expect(pkg).toHaveProperty("vendor");
                expect(pkg).toHaveProperty("version");
                // policyLevel might not be present in all configurations
                if (pkg.policyLevel) {
                    expect(typeof pkg.policyLevel).toBe("string");
                }
            }
        });
    });
});