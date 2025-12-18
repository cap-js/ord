# Testing Rules and Standards

## Core Testing Principles

### 1. Never Mock Production Code

- **Rule**: Do NOT mock the actual production code being tested
- **Rationale**: Mocking production code defeats the purpose of testing and creates false confidence
- **What to mock**: External dependencies, APIs, databases, file systems, third-party libraries
- **What NOT to mock**: The code under test, internal functions being validated
- **Example**:

    ```javascript
    // ❌ BAD - Mocking the function we're testing
    jest.mock("../lib/myFunction");

    // ✅ GOOD - Mocking external dependencies
    jest.mock("axios");
    jest.mock("../lib/externalService");
    ```

### 2. No Try-Catch in Unit Tests

- **Rule**: Do NOT add try-catch blocks in unit tests
- **Rationale**: Test frameworks handle exceptions properly; try-catch masks test failures
- **Approach**: Let tests fail naturally and use proper assertions
- **Example**:

    ```javascript
    // ❌ BAD
    test("should throw error", () => {
        try {
            dangerousFunction();
            fail("Should have thrown");
        } catch (e) {
            expect(e.message).toBe("Error");
        }
    });

    // ✅ GOOD
    test("should throw error", () => {
        expect(() => dangerousFunction()).toThrow("Error");
    });
    ```

### 3. Snapshot Updates Require Justification

- **Rule**: NEVER update snapshots without providing:
    1. **What changed**: Specific code changes that caused the snapshot diff
    2. **Why it changed**: The reason for the modification
    3. **Root Cause Analysis (RCA)**: Understanding of the impact
- **Process**:
    1. Review the snapshot diff carefully
    2. Identify which code changes caused the diff
    3. Verify the changes are intentional and correct
    4. Document the reason before updating
    5. Only then run `npm test -- -u` or equivalent
- **Example Documentation**:
    ```
    Snapshot Update Justification:
    - Changed: Modified the ORD document structure in lib/ord.js
    - Reason: Added new 'extensible' property to API resources per ORD spec v1.9
    - RCA: The extensible field is now required by the specification
    - Impact: All API resource snapshots now include this field
    - Verified: Manual inspection confirms correct structure
    ```

### 4. Clean Code and Best Practices

- **Follow established patterns**: Maintain consistency with existing test structure
- **Reuse existing functions**: Before creating new test helpers or utilities, check if similar functionality already exists in the codebase. Prefer reusing and enhancing existing functions over creating duplicates.
- **Use constants over magic values**: Define constants for repeated values, especially:
    - Test data values (IDs, names, URLs)
    - Expected status codes
    - Configuration values
    - Timeout values

    ```javascript
    // ❌ BAD - Magic values scattered throughout tests
    test('should authenticate user', () => {
      const response = await login('test@example.com', 'password123');
      expect(response.status).toBe(200);
    });

    // ✅ GOOD - Constants defined and reused
    const TEST_USER_EMAIL = 'test@example.com';
    const TEST_USER_PASSWORD = 'password123';
    const HTTP_STATUS_OK = 200;

    test('should authenticate user', () => {
      const response = await login(TEST_USER_EMAIL, TEST_USER_PASSWORD);
      expect(response.status).toBe(HTTP_STATUS_OK);
    });
    ```

- **Descriptive test names**: Use clear, behavior-focused descriptions

    ```javascript
    // ✅ GOOD
    test("should return 401 when authentication token is missing", () => {});

    // ❌ BAD
    test("auth test", () => {});
    ```

- **Arrange-Act-Assert (AAA) pattern**: Structure tests clearly

    ```javascript
    test("should calculate total correctly", () => {
        // Arrange
        const items = [{ price: 10 }, { price: 20 }];

        // Act
        const total = calculateTotal(items);

        // Assert
        expect(total).toBe(30);
    });
    ```

- **One assertion per test** (when practical): Focus tests on single behaviors
- **Avoid test interdependence**: Each test should run independently
- **Clean up after tests**: Use `afterEach` or `afterAll` for cleanup
- **Use meaningful test data**: Avoid magic numbers and unclear values

## Additional Testing Standards

### Test Organization

- Group related tests using `describe` blocks
- Use `beforeEach` for common setup
- Keep tests focused and concise
- Maintain test readability over cleverness

### Test Coverage

- Aim for meaningful coverage, not just high percentages
- Test edge cases and error conditions
- Test both happy paths and failure scenarios
- Prioritize critical business logic

### Integration Tests

- Use real implementations where possible
- Mock only external systems (databases, APIs, etc.)
- Test realistic scenarios and workflows
- Verify system behavior end-to-end
