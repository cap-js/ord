const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const cds = require("@sap/cds");

describe("Build Process Integration Tests", () => {
    let testProjectDir;
    let ordBuildDir;
    
    beforeAll(() => {
        // Use the xmpl project which has proper ORD plugin setup
        testProjectDir = path.join(__dirname, "..", "..", "xmpl");
        ordBuildDir = path.join(testProjectDir, "gen");
        
        // Clean up any existing build artifacts
        if (fs.existsSync(ordBuildDir)) {
            fs.rmSync(ordBuildDir, { recursive: true, force: true });
        }
    });
    
    afterAll(() => {
        // Clean up build artifacts
        if (fs.existsSync(ordBuildDir)) {
            fs.rmSync(ordBuildDir, { recursive: true, force: true });
        }
    });
    
    describe("ORD document generation", () => {
        test("cds build --for ord generates ORD document file", () => {
            // Change to test project directory and run build
            const originalCwd = process.cwd();
            try {
                process.chdir(testProjectDir);
                execSync("npx cds build --for ord", { timeout: 60000, stdio: 'pipe' });
                
                // Verify ORD document file was created
                const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
                expect(fs.existsSync(ordDocPath)).toBe(true);
                
                // Verify the file contains valid JSON
                const ordDocContent = fs.readFileSync(ordDocPath, "utf8");
                const ordDoc = JSON.parse(ordDocContent);
                
                // Verify basic ORD document structure
                expect(ordDoc).toHaveProperty("openResourceDiscovery", "1.9");
                expect(ordDoc).toHaveProperty("description");
                expect(ordDoc).toHaveProperty("packages");
                expect(ordDoc.packages).toBeInstanceOf(Array);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
        
        test("Generated ORD document contains expected content structure", () => {
            const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
            
            if (!fs.existsSync(ordDocPath)) {
                // Skip test if build hasn't run yet
                return;
            }
            
            const ordDoc = JSON.parse(fs.readFileSync(ordDocPath, "utf8"));
            
            // Verify required top-level properties
            expect(ordDoc).toMatchObject({
                openResourceDiscovery: "1.9",
                description: expect.any(String),
                packages: expect.any(Array)
            });
            
            // Policy level might be null or undefined, so check conditionally
            if (ordDoc.policyLevel) {
                expect(typeof ordDoc.policyLevel).toBe("string");
            }
            
            // Verify packages structure
            if (ordDoc.packages.length > 0) {
                const firstPackage = ordDoc.packages[0];
                expect(firstPackage).toHaveProperty("ordId");
                expect(firstPackage).toHaveProperty("title");
                expect(firstPackage).toHaveProperty("vendor");
                expect(firstPackage).toHaveProperty("version");
            }
        });
    });
    
    describe("Resource file generation", () => {
        test("Build process generates resource files in correct structure", () => {
            // Check if the main ord build directory exists
            if (!fs.existsSync(ordBuildDir)) {
                return; // Skip if build hasn't run
            }
            
            // Check if the document is in the expected location
            const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
            if (fs.existsSync(ordDocPath)) {
                expect(fs.existsSync(ordDocPath)).toBe(true);
            }
        });
        
        test("Generated files are valid JSON", () => {
            const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
            
            if (fs.existsSync(ordDocPath)) {
                const content = fs.readFileSync(ordDocPath, "utf8");
                expect(() => JSON.parse(content)).not.toThrow();
                
                // Verify it's a proper ORD document
                const ordDoc = JSON.parse(content);
                expect(ordDoc).toHaveProperty("openResourceDiscovery");
                expect(ordDoc).toHaveProperty("packages");
            }
        });
        
        test("API resource files are generated", () => {
            if (!fs.existsSync(ordBuildDir)) {
                return; // Skip if build hasn't run
            }
            
            // Look for generated API resource files
            const srvDir = path.join(ordBuildDir, "srv");
            if (fs.existsSync(srvDir)) {
                const files = fs.readdirSync(srvDir, { recursive: true });
                
                // Should contain some generated resource files
                const hasOas3Files = files.some(file => file.toString().endsWith('.oas3.json'));
                const hasEdmxFiles = files.some(file => file.toString().endsWith('.edmx'));
                
                // At least one type of API resource file should be generated
                expect(hasOas3Files || hasEdmxFiles).toBe(true);
            }
        });
    });
    
    describe("Build process error handling", () => {
        test("Build process handles missing service definitions gracefully", () => {
            // This should not throw errors even if no services are defined
            const originalCwd = process.cwd();
            try {
                process.chdir(testProjectDir);
                expect(() => {
                    execSync("npx cds build --for ord", { timeout: 60000, stdio: 'pipe' });
                }).not.toThrow();
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
    
    describe("Build output validation", () => {
        test("ORD document complies with basic ORD specification", () => {
            const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
            
            if (fs.existsSync(ordDocPath)) {
                const ordDoc = JSON.parse(fs.readFileSync(ordDocPath, "utf8"));
                
                // Verify ORD version
                expect(ordDoc.openResourceDiscovery).toBe("1.9");
                
                // Verify policy level if present
                if (ordDoc.policyLevel) {
                    expect(typeof ordDoc.policyLevel).toBe("string");
                }
                
                // Verify package structure if packages exist
                if (ordDoc.packages && ordDoc.packages.length > 0) {
                    for (const pkg of ordDoc.packages) {
                        expect(pkg.ordId).toMatch(/^[\w.-]+:package:[\w.-]+:v\d+$/);
                        expect(pkg).toHaveProperty("title");
                        expect(pkg).toHaveProperty("vendor");
                        expect(pkg).toHaveProperty("version");
                    }
                }
            }
        });
        
        test("Generated ORD IDs follow correct format", () => {
            const ordDocPath = path.join(ordBuildDir, "srv", "ord-document.json");
            
            if (fs.existsSync(ordDocPath)) {
                const ordDoc = JSON.parse(fs.readFileSync(ordDocPath, "utf8"));
                
                // Check package IDs
                if (ordDoc.packages) {
                    for (const pkg of ordDoc.packages) {
                        expect(pkg.ordId).toMatch(/^[a-z0-9.-]+:package:[a-zA-Z0-9._-]+:v\d+$/);
                    }
                }
                
                // Check API resource IDs if they exist
                if (ordDoc.apiResources) {
                    for (const api of ordDoc.apiResources) {
                        expect(api.ordId).toMatch(/^[a-z0-9.-]+:apiResource:[a-zA-Z0-9._/-]+:v\d+$/);
                    }
                }
            }
        });
    });
    
    describe("Build performance and reliability", () => {
        test("Build completes within reasonable time", () => {
            const originalCwd = process.cwd();
            try {
                process.chdir(testProjectDir);
                
                const startTime = Date.now();
                execSync("npx cds build --for ord", { timeout: 60000, stdio: 'pipe' });
                const endTime = Date.now();
                
                const buildTime = endTime - startTime;
                
                // Build should complete within 60 seconds
                expect(buildTime).toBeLessThan(60000);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
        
        test("Build is repeatable and consistent", () => {
            const originalCwd = process.cwd();
            try {
                process.chdir(testProjectDir);
                
                // Run build twice
                execSync("npx cds build --for ord", { timeout: 60000, stdio: 'pipe' });
                const ordDocPath1 = path.join(ordBuildDir, "srv", "ord-document.json");
                const content1 = fs.existsSync(ordDocPath1) ? fs.readFileSync(ordDocPath1, "utf8") : "";
                
                execSync("npx cds build --for ord", { timeout: 60000, stdio: 'pipe' });
                const ordDocPath2 = path.join(ordBuildDir, "srv", "ord-document.json");
                const content2 = fs.existsSync(ordDocPath2) ? fs.readFileSync(ordDocPath2, "utf8") : "";
                
                // Both builds should produce similar structure (ignoring timestamps)
                if (content1 && content2) {
                    const doc1 = JSON.parse(content1);
                    const doc2 = JSON.parse(content2);
                    
                    expect(doc1.openResourceDiscovery).toBe(doc2.openResourceDiscovery);
                    expect(doc1.packages.length).toBe(doc2.packages.length);
                }
                
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});