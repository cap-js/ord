# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Version 1.1.0

### Added

-   Extended `@ORD.Extensions` functionality, all service level information can be added or overwritten.
-   Defined `customOrdContentFile` in `.cdsrc.json`, custom ord content can be added, enhanced, patched and customized.
-   Added unittest and integration test.
-   Added Github actions CI/CD validating PR with running tests.
-   Added disclaimer that metadata access is currently open access.

### Fixed

-   Fixed `undefined` bug.
-   Fixed event resources generation.
-   Fixed global variable using.
-   Fixed using fully-qualified names from `.definitions` instead of namespace.
-   Fixed using appName as package name in the `apiResources.partOfPackage`.
-   Fixed generation of consumption bundles.

### Changed

-   Refactored and optimized functions.
-   Adjusted name pattern and functions.

## Version 1.0.3

### Fixed

-   Bug fixes.

## Version 1.0.2

### Fixed

-   Updating readme.

## Version 1.0.1

### Fixed

-   Updating the entry point for the plugin.

## Version 1.0.0

### Added

-   Initial release that enables generation of ORD document for CAP based applications.
