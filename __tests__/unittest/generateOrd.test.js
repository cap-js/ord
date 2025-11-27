const { _loadAppFoundationConfig } = require("../../lib/generateOrd");
const cds = require("@sap/cds");
const path = require("path");
const fs = require("fs");

// Mock dependencies
jest.mock("@sap/cds");
jest.mock("fs");
jest.mock("../../lib/logger", () => ({
    Logger: {
        log: jest.fn(),
        error: jest.fn(),
    },
}));

// Mock js-yaml
const mockYamlLoad = jest.fn();
jest.mock("js-yaml", () => ({
    load: mockYamlLoad,
}));

describe("generateOrd - App Foundation Config Loading", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset cds.env
        cds.env = {};
        cds.root = "/test/project";
        cds.utils = {
            exists: jest.fn(),
        };
    });

    describe("_loadAppFoundationConfig", () => {
        it("should use default service.yaml when no config is provided", () => {
            // Arrange
            cds.utils.exists.mockReturnValue(true);
            fs.readFileSync.mockReturnValue("apiVersion: test");
            mockYamlLoad.mockReturnValue({ test: "data" });

            // Act
            const result = _loadAppFoundationConfig();

            // Assert
            expect(cds.utils.exists).toHaveBeenCalledWith(path.join("/test/project", "service.yaml"));
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join("/test/project", "service.yaml"), "utf8");
            expect(mockYamlLoad).toHaveBeenCalledWith("apiVersion: test");
            expect(result).toEqual({ test: "data" });
        });

        it("should use custom config file when appFoundationConfigFile is set", () => {
            // Arrange
            cds.env.ord = { appFoundationConfigFile: "custom/config.yaml" };
            cds.utils.exists.mockReturnValue(true);
            fs.readFileSync.mockReturnValue("apiVersion: custom");
            mockYamlLoad.mockReturnValue({ custom: "config" });

            // Act
            const result = _loadAppFoundationConfig();

            // Assert
            expect(cds.utils.exists).toHaveBeenCalledWith(path.join("/test/project", "custom/config.yaml"));
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join("/test/project", "custom/config.yaml"), "utf8");
            expect(mockYamlLoad).toHaveBeenCalledWith("apiVersion: custom");
            expect(result).toEqual({ custom: "config" });
        });

        it("should return null when config file does not exist", () => {
            // Arrange
            cds.utils.exists.mockReturnValue(false);

            // Act
            const result = _loadAppFoundationConfig();

            // Assert
            expect(cds.utils.exists).toHaveBeenCalledWith(path.join("/test/project", "service.yaml"));
            expect(fs.readFileSync).not.toHaveBeenCalled();
            expect(mockYamlLoad).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it("should return null and log error when YAML parsing fails", () => {
            // Arrange
            cds.utils.exists.mockReturnValue(true);
            fs.readFileSync.mockReturnValue("invalid: yaml: content");
            mockYamlLoad.mockImplementation(() => {
                throw new Error("YAML parsing error");
            });

            // Act
            const result = _loadAppFoundationConfig();

            // Assert
            expect(mockYamlLoad).toHaveBeenCalledWith("invalid: yaml: content");
            expect(result).toBeNull();
        });

        it("should return null when file reading fails", () => {
            // Arrange
            cds.utils.exists.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error("File read error");
            });

            // Act
            const result = _loadAppFoundationConfig();

            // Assert
            expect(fs.readFileSync).toHaveBeenCalled();
            expect(mockYamlLoad).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });
});
