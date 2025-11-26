# Project Brief: CAP-JS ORD Plugin

## Project Identity

**Name:** `@cap-js/ord`
**Version:** 1.3.14
**Type:** CAP Framework Plugin
**Repository:** https://github.com/cap-js/ord
**License:** Apache-2.0

## Core Purpose

This plugin adds support for the [Open Resource Discovery (ORD)](https://open-resource-discovery.github.io/specification/) protocol to SAP Cloud Application Programming (CAP) applications. It provides a standardized way to discover and gather machine-readable metadata about CAP applications, enabling construction of static metadata catalogs and detailed runtime inspection of system instances.

## Key Objectives

1. **ORD Adoption**: Generate ORD documents that fully comply with the ORD specification and ease the adoption of the ORD standard for the application developers
2. **Dual Access Patterns**: Support both static file generation and runtime API access
3. **CAP Integration**: Seamlessly integrate with CAP's compiler and build system
4. **Metadata Security**: Provide authentication mechanisms to protect application metadata
5. **Customization**: Allow extensive customization of the ORD document through annotations and configuration files, so that CAP application developers can tailor the generated metadata to their specific needs.

## Target Users

- **CAP Developers**: Building applications that need to expose their metadata to static service catalogs like **Business Accelerator Hub** or runtime environments (UCL) including all tenant specific extensions.

## Success Criteria

- Generate valid ORD documents for any CAP application
- Support major ORD resource types (APIs, Events, Entity Types, Integration Dependencies)
- Provide secure metadata access with configurable authentication
- Enable comprehensive customization without breaking ORD compliance
- Maintain backward compatibility across CAP framework versions

## Project Scope

**In Scope:**

- ORD document generation from CAP CSN models
- REST API endpoints following ORD specification
- Basic authentication with bcrypt password hashing
- Custom ORD content integration
- Build system integration for static file generation
- Support for both Node.js and Java CAP runtimes

**Out of Scope:**

- Non-CAP application support
- ORD document validation beyond basic structure
- Runtime modification of generated ORD documents
- Support for Node.js versions outside the 18-22 range

## Key Constraints

- Must comply with ORD specification v1.12 requirements
- Must integrate with existing CAP framework patterns
- Must maintain performance for large CAP applications
- Must support both development and production environments
- Must handle sensitive metadata appropriately
- Must support Node.js versions 18-22
- Must maintain backward compatibility across versions
