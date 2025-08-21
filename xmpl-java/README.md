# Java CAP Sample with ORD Plugin

This is a sample reference project demonstrating how to use the SAP Cloud Application Programming Model (CAP) with Java and integrate the ord-plugin for Open Resource Discovery (ORD).

## Structure

- `db/` - Data model definitions (CDS)
- `srv/` - Service definitions (CDS)
- `ord/` - ORD plugin configuration
- `package.json` - Node.js dependencies for CAP and ord-plugin

## How to use

1. Install dependencies:
    ```bash
    npm install
    ```
2. Run the CAP server:
    ```bash
    cds run
    ```

> **Note:** For Java service implementation, generate Java sources from CDS using `cds build` and implement handlers in Java (see CAP Java documentation). This sample provides the structure and configuration for ORD integration.
