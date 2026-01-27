[![REUSE status](https://api.reuse.software/badge/github.com/cap-js/ord)](https://api.reuse.software/info/github.com/cap-js/ord)

# CDS Plugin for ORD

## About this project

This plugin adds support for the [Open Resource Discovery](https://open-resource-discovery.github.io/specification/) (ORD) protocol for CAP based applications.
When you add the ORD plugin, your application gains a single entry point, which allows to discover and gather machine-readable information or metadata about the application.
You can use this information to construct a static metadata catalog or to perform a detailed runtime inspection of your actual system instances / system landscapes.

For more information, have a look at the [Open Resource Discovery](https://open-resource-discovery.github.io/specification/) page.

> ⚠ By installing this plugin, the metadata describing your CAP application will be made openly accessible. If you want to secure your CAP application's metadata, configure `basic` authentication by setting the environment variables or updating the `.cdsrc.json` file. The plugin prioritizes environment variables, then checks `.cdsrc.json`. If neither is configured, metadata remains publicly accessible.

## Requirements and Setup

### Installation

```sh
npm install @cap-js/ord
```

> Note: `@cap-js/openapi` and `@cap-js/asyncapi` packages have been migrated from peerDependencies to dependencies in `package.json`. As a result, using globally installed packages may lead to conflicts. If conflicts arises do `npm uninstall -g @cap-js/openapi @cap-js/asyncapi` and then `npm install` in your project directory.

### Authentication

The ORD Plugin supports multiple authentication strategies that can be configured through environment variables or `.cdsrc.json`. Authentication types are automatically detected based on the presence of their configuration - no explicit `types` array is needed.

**Supported Authentication Methods:**

- **Open**: No authentication (default when no other auth is configured)
- **Basic**: HTTP Basic Authentication with bcrypt-hashed passwords
- **CF mTLS**: Cloud Foundry mutual TLS authentication

**Multiple Authentication Strategies**: You can configure multiple authentication methods simultaneously (e.g., both `basic` and `cf-mtls`). The plugin implements an Express-like middleware pattern that tries each configured strategy in order until one succeeds.

> Note: When any secure authentication method is configured, open authentication is automatically disabled to ensure security. The ORD document will reflect all active authentication strategies.

#### Open

The `open` authentication type is the default and bypasses authentication checks. It is automatically used when no other authentication is configured.

#### Basic Authentication

Configure Basic Authentication using environment variables or `.cdsrc.json`:

**Option 1: Environment Variable**

```bash
BASIC_AUTH='{"admin":"$2y$05$..."}'
```

**Option 2: Configuration File**

Add to your `.cdsrc.json`:

```json
{
    "cds": {
        "ord": {
            "authentication": {
                "basic": {
                    "credentials": {
                        "admin": "$2y$05$..."
                    }
                }
            }
        }
    }
}
```

To generate bcrypt hashes, use the [htpasswd](https://httpd.apache.org/docs/2.4/programs/htpasswd.html) utility:

```bash
htpasswd -Bnb <user> <password>
```

This will output something like `admin:$2y$05$...` - use only the hash part (starting with `$2y$`) in your `BASIC_AUTH` JSON.

> [!IMPORTANT]
> Make sure to use strong passwords and handle the BASIC_AUTH environment variable securely. Never commit real credentials or .env files to version control.

<details>
<summary>Using htpasswd in your environment</summary>

- **Platform independent**:

    > Prerequisite is to have [NodeJS](https://nodejs.org/en) installed on the machine.

    ```bash
    npm install -g htpasswd
    ```

    After installing package globally, command `htpasswd` should be available in the Terminal.

- **macOS**:

    Installation of any additional packages is not required. Utility `htpasswd` is available in Terminal by default.

- **Linux**:

    Install apache2-utils package:

    ```bash
    # Debian/Ubuntu
    sudo apt-get install apache2-utils

    # RHEL/CentOS
    sudo yum install httpd-tools
    ```

</details>

#### CF mTLS Authentication

Configure Cloud Foundry mutual TLS authentication for SAP BTP Cloud Foundry environments.

**Production Configuration with UCL (Recommended)**

For SAP UCL (Unified Customer Landscape) integration, enable mTLS in `.cdsrc.json` and configure UCL endpoints via environment variable:

```json
{
    "ord": {
        "authentication": {
            "cfMtls": true
        }
    }
}
```

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "configEndpoints": ["https://your-ucl-endpoint/v1/info"],
  "rootCaDn": ["CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE"]
}'
```

**Production Configuration with Custom Certificates**

For custom certificates without UCL:

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "certs": [{"issuer": "CN=My CA,O=MyOrg", "subject": "CN=my-service,O=MyOrg"}],
  "rootCaDn": ["CN=My Root CA,O=MyOrg"]
}'
```

**Development Configuration**

For local development, configure the full mTLS settings directly in `.cdsrc.json`:

```json
{
    "ord": {
        "authentication": {
            "cfMtls": {
                "certs": [
                    {
                        "issuer": "CN=Test CA,O=MyOrg,C=DE",
                        "subject": "CN=test-client,O=MyOrg,C=DE"
                    }
                ],
                "rootCaDn": ["CN=Test Root CA,O=MyOrg,C=DE"]
            }
        }
    }
}
```

> **Note:** For detailed CF mTLS configuration options, see the [documentation](./docs/ord.md#cf-mtls-authentication).

#### Multiple Authentication Strategies

You can configure multiple authentication methods simultaneously to support different client types. Authentication types are detected automatically based on configuration presence:

**Configuration in `.cdsrc.json`:**

```json
{
  "cds": {
    "ord": {
      "authentication": {
        "basic": {
          "credentials": {
            "admin": "$2y$05$..."
          }
        },
        "cfMtls": {
          "certs": [...],
          "rootCaDn": [...]
        }
      }
    }
  }
}
```

**How it works:**

- Authentication types are detected based on what you configure (no `types` array needed)
- The plugin tries each configured authentication strategy in order
- The first strategy that successfully authenticates the request is used
- If a request includes Basic auth headers, Basic authentication is attempted
- If a request includes mTLS certificate headers, CF mTLS authentication is attempted
- The ORD document automatically includes all configured authentication methods in its `accessStrategies`

**Example scenarios:**

- **Basic + CF mTLS**: Supports both API clients using Basic auth and services using mTLS certificates
- **Basic only**: Only clients with valid Basic auth credentials can access
- **CF mTLS only**: Only clients with trusted certificates can access

### Usage

#### Programmatic API

```js
const cds = require("@sap/cds");
require("@cap-js/ord");
```

```js
const csn = cds.context?.model || cds.model;
const ord = cds.compile.to.ord(csn);
```

#### Command Line

Build all ord related documents, including ordDocument and services resources files:

```sh
cds build --for ord

# By default, it will be generated in /gen/ord dir, e.g.:
# done > wrote output to:
#    gen/ord/ord-document.json
#    gen/ord/sap.sample:apiResource:AdminService:v1/AdminService.edmx
#    gen/ord/sap.sample:apiResource:AdminService:v1/AdminService.oas3.json
```

Only compile ord document:

```sh
cds compile <path to srv folder> --to ord [-o] [destinationFilePath]
```

<img width="1300" alt="Sample Application Demo" style="border-radius:0.5rem;" src="./asset/etc/ordCLI.png">

#### ORD Endpoints

1. Run `cds watch` in the application's root.
2. Check the following relative paths for ORD information - `/.well-known/open-resource-discovery` , `/ord/v1/documents/ord-document`.

<img width="1300" alt="Sample Application Demo" style="border-radius:0.5rem;" src="./asset/etc/ordEndpoint.gif">

### Customizing ORD Document

You can find more information, such as how to customize the ORD Document, in this [document](./docs/ord.md).

## How to setup dev environment and run xmpl locally

1. **Install dependency**
    ```sh
    npm i
    ```
2. **Run xmpl application**

    ```sh
    cd xmpl/

    # watch xmpl application
    cds watch

    # build resources files
    cds build --for ord
    ```

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js/ord/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure

If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/cap-js/ord/issues/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

At the current state, the plugin will expose static metadata with open access.
This means that the CAP resources are described and documented openly, but it does not imply that the resources themselves can be accessed.

If you have a need to protect your metadata, please refrain from installing this plugin until we support metadata protection.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/cap-js/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2024 SAP SE or an SAP affiliate company and cds-plugin-for-ord contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js/<your-project>).

hi
