# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
The format is based on [Keep a Changelog](http://keepachangelog.com/).

## 1.3.9 (2025-09-02)

## What's Changed

- fix: If the visibility is private, do not create a group by @KegCoder
- feat: allow loading of additional attributes for packages

## New Contributors

- @KegCoder made their first contribution in https://github.com/cap-js/ord/pull/215

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.8...v1.3.9

## 1.3.8 (2025-09-01)

## What's Changed

- Feat: Setup Java sample
- Feat: setup java pipeline
- Fix: Support CommonJs

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.7...v1.3.8

## 1.3.7 (2025-08-19)

## What's Changed

- Feat: use bcryptjs

## 1.3.6 (2025-08-07)

## What's Changed

- Feat: add progressBar
- Feat: support exposedEntityTypes
- Feat: introducing defaultVisibility parameter in config
- Feat: skip ord service for java project

## New Contributors

- @SAPzer0 made their first contribution in https://github.com/cap-js/ord/pull/206

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.5...v1.3.6

## 1.3.5 (2025-07-17)

## What's Changed

- Block OpenResourceDiscoveryService in ord document

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.4...v1.3.5

## 1.3.4 (2025-07-09)

## What's Changed

- Adjust default values for vendor to "customer:vendor:Customer"
- Improved runtime of cmd `cds build --for ord`
- Alignment of publishing with SAP Open Resource Discovery (ORD) global repository strategy
- Fix: DP package assignment
- Fix: error of ORD-IDs with duplicate namespace components
- Fix: error of cmd `cds build --for ord`

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.4...v1.3.3

## 1.3.3 (2025-06-25)

## What's Changed

- Provide a better data product example
- Fix: eventResources and dataProduct annotation

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.2...v1.3.3

## 1.3.2 (2025-06-18)

## What's Changed

- Fix: set cds version to 8

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.1...v1.3.2

## 1.3.1 (2025-06-13)

### What's Changed

- Fix: stable dev environment and remove from calesi setup
- Feat: use relative path for resource definitions URL and compatible with windows
- Fix: no event or apiResources when build ord files

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.3.0...v1.3.1

## 1.3.0 (2025-05-20)

### What's Changed

- Improved handling of `apiResources`, `eventResources`, and `entityTypeMappings`
- Added support for metadata protection with Basic Auth
- Enabled multitenancy and extensibility
- Special handling for services of type `dataProduct`
- Enhanced support for Business Accelerator Hub
- Improved ORD document compilation and interop CSN generation
- Updated OpenAPI and AsyncAPI versions and dependencies
- Ensured REUSE compliance and updated license files
- Fixed issues related to resource filtering, default values, and endpoint display
- Updated contribution guide with Calesi setup steps
- Various code quality improvements and project maintenance

**Full Changelog**: https://github.com/cap-js/ord/compare/v1.2.0...v.1.3.0

## 1.2.0 (2024-11-18)

### What's Changed

- Version of ORD document generation
- API short description
- Default lastUpdate and consumptionBundles properties
- Filtering of resources based on visibility
- Added Unit tests
- Added logger

## 1.1.0 (2024-10-24)

### What's Changed

- Use package name for product ORD IDs
- ORD.md documentation update
- cds version upgrade to 8
- Omit the consumption bundles creation
- Add Unit tests
- Extend custom ORD content
- Extend @ORD.Extensions
- Custom ORD content update
- Disclaimer: metadata access is currently open access

**Full Changelog**: <https://github.com/cap-js/ord/compare/v1.0.3...v1.1.0>

## Version 1.0.3

### Fixed

- Bug fixes.

## Version 1.0.2

### Fixed

- Updating readme.

## Version 1.0.1

### Fixed

- Updating the entry point for the plugin.

## Version 1.0.0

### Added

- Initial release that enables generation of ORD document for CAP based applications.
