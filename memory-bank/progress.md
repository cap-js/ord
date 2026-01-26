# Progress: CAP-JS ORD Plugin

## Current Status

**Version**: 1.4.2 (January 2026)
**Status**: Stable, Production Ready
**Test Coverage**: 357 tests (356 passed, 1 skipped)

## What Works

### Core Features
- ORD document generation from CAP CSN models
- Static file generation via `cds build --for ord`
- Runtime API endpoints (`/.well-known/open-resource-discovery`)
- OpenAPI, AsyncAPI, EDMX, and CSN resource definition generation
- Interop CSN generation with proper i18n handling

### Authentication
- Open access mode
- Basic authentication with bcrypt password hashing
- CF mTLS authentication support
- Module-level caching for reliable configuration

### Customization
- `.cdsrc.json` configuration
- `@ORD.Extensions` annotations
- Custom ORD content files
- Visibility controls (public/internal)
- Data product annotations (dual support)

### Platform Support
- Node.js versions 18-22
- Java CAP runtime support
- ORD specification v1.12 compliance

## What's Left to Build

### Pending Features
- Spring Boot 4 support (waiting for CAP Java framework update)
- Enhanced UCL-mTLS enterprise scenarios
- Performance optimizations for very large CAP applications

### Known Limitations
- Node.js version limited to 18-22 (v23+ not yet tested)
- CAP Java only supports Spring Boot 3.x (not 4.x)

## Known Issues

### Open GitHub Issues
- **Issue #101**: Assets in repo - evaluated and determined no action needed (assets not in npm package)

### Technical Debt
- Monitor Renovate PRs for incompatible major upgrades (e.g., Spring Boot 4)

## Evolution of Project Decisions

### January 2026
- **Spring Boot 4**: Decided to reject upgrade until CAP Java supports it
- **Issue #101**: Confirmed assets don't need migration - not included in npm package

### December 2025
- **Test Refactoring**: Created test helper utilities to eliminate duplicate mock configurations
- **Authentication Architecture**: Removed `types` property, auto-parse from `accessStrategies`

### November 2025
- **v1.3.14**: Removed "localized" associations from interop CSN
- **Trusted Publishing**: Enabled provenance for supply chain security

### September-October 2025
- **Interop CSN**: Implemented comprehensive interop CSN generation
- **Data Products**: Added dual annotation support
- **Version Suffixes**: Implemented clean ORD ID generation for versioned services

## Recent Releases

| Version | Date | Key Changes |
|---------|------|-------------|
| 1.4.2 | Jan 2026 | Latest stable release |
| 1.3.14 | Nov 2025 | Interop CSN enhancement, trusted publishing |
| 1.3.13 | Nov 2025 | Access strategy migration, Node.js v22 |
| 1.3.12 | Oct 2025 | Interop CSN i18n fix |
| 1.3.11 | Oct 2025 | Interop CSN production, Java auth fix |
| 1.3.10 | Sep 2025 | Dual annotation support, version suffix handling |
