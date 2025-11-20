# Architecture Refactoring: Common ORD Generation

## Overview

This document describes the refactoring that unified ORD document generation across different entry points (compile and build modes) to ensure feature parity between Java and Node.js CAP runtimes.

## Problem Statement

Previously, the plugin had two separate paths for ORD generation:

1. **`cds.compile.to.ord`** (used by Java): Called `ord()` function directly from `lib/ord.js`
2. **`cds build --for ord`** (used by Node.js): Called `ord()` AND added Integration Dependencies logic in `lib/build.js`

This created a disparity where Java applications couldn't access Integration Dependencies and other enhancements added to the build path.

## Solution

We extracted a common `generateOrd(csn, options)` function that contains ALL generation logic including:
- Base ORD document generation
- Integration Dependencies processing
- Custom ORD content enrichment
- Future enhancements (UCL, etc.)

Both entry points now use this central function, ensuring feature parity.

## Architecture

```
┌─────────────────────────────────────────┐
│   generateOrd(csn, options)             │
│   • Base ORD generation (ord.js)        │
│   • Integration Dependencies            │
│   • Custom ORD content enrichment       │
│   • All future enhancements             │
└─────────────────────────────────────────┘
           ▲                    ▲
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐
    │ compile.to  │      │  build.js  │
    │             │      │            │
    │ Java path   │      │ Node path  │
    │ mode:'compile'│     │ mode:'build'│
    └─────────────┘      └────────────┘
```

## Implementation Details

### New File: `lib/generateOrd.js`

Contains the central generation logic:

```javascript
function generateOrd(csn, options = {}) {
  const mode = options.mode || "compile";
  
  // Step 1: Generate base ORD document
  const ordDocument = ord(csn);
  
  // Step 2: Add Integration Dependencies if applicable
  if (mode === "build" || options.includeIntegrationDependencies) {
    // Load app.yaml and process Integration Dependencies
  }
  
  // Step 3: Future enhancements go here
  
  return ordDocument;
}
```

### Updated Files

#### `cds-plugin.js`
Changed the compile target registration to use `generateOrd`:

```javascript
function _lazyRegisterCompileTarget() {
    const { generateOrd } = require("./lib/generateOrd");
    const ordFunction = (csn) => generateOrd(csn, { mode: "compile" });
    Object.defineProperty(this, "ord", { value: ordFunction });
    return ordFunction;
}
```

#### `lib/build.js`
Simplified to delegate core generation to `generateOrd`:

```javascript
async build() {
    const model = await this.model();
    
    // Generate complete ORD document with all enrichments
    const ordDocument = generateOrd(model, { mode: "build" });
    
    // Build-specific tasks: post-process and write files
    const postProcessedOrdDocument = this.postProcess(ordDocument);
    
    // Write ORD document and resource files
    // ...
}
```

#### `lib/index.js`
Added `generateOrd` to exports:

```javascript
module.exports = {
    // ... existing exports
    generateOrd: require("./generateOrd.js").generateOrd,
};
```

## Benefits

### ✅ Feature Parity
- Java now gets Integration Dependencies automatically through `cds.compile.to.ord`
- Any future features added to `generateOrd` benefit both paths immediately

### ✅ Single Source of Truth
- Integration Dependencies logic lives in one place
- No code duplication between compile and build paths
- Easier maintenance and testing

### ✅ Backward Compatible
- Both entry points continue to work as before
- Existing code doesn't need changes
- All 213 existing tests pass

### ✅ Extensible
- Future features (UCL, additional enrichments) can be added to `generateOrd()` once
- Clear separation: core logic in `generateOrd`, build-specific tasks in `build.js`

### ✅ Flexible
- Compile mode can opt-in to features via options (e.g., `includeIntegrationDependencies: true`)
- Build mode automatically gets all features

## Usage Examples

### Java/Compile Path
```javascript
const cds = require('@sap/cds');

// Automatically uses generateOrd with mode: 'compile'
const ordDocument = cds.compile.to.ord(csn);
```

### Node.js Build Path
```bash
# Automatically uses generateOrd with mode: 'build'
cds build --for ord
```

### Programmatic with Options
```javascript
const { generateOrd } = require('@cap-js/ord');

// Compile mode with Integration Dependencies
const ordDoc = generateOrd(csn, { 
    mode: 'compile',
    includeIntegrationDependencies: true 
});
```

## Testing

Added comprehensive test coverage in `__tests__/unittest/generateOrd.test.js`:
- Tests for both compile and build modes
- Tests for Integration Dependencies handling
- Tests for app.yaml loading and parsing
- Error handling tests

All 213 tests pass, including 12 new tests for `generateOrd`.

## Migration Notes

### For Plugin Maintainers
- Add new features to `generateOrd()` in `lib/generateOrd.js`
- Build-specific file I/O stays in `lib/build.js`
- Both paths automatically get new features

### For Plugin Users
- No changes required
- Existing code continues to work
- Java applications now automatically get Integration Dependencies

## Future Considerations

The `generateOrd` function provides a clear extension point for future features:
- UCL (Unified Customer Landscape) support
- Additional metadata enrichments
- Custom transformation pipelines
- Performance optimizations

All these can be added once in `generateOrd` and both compile and build paths will benefit.
