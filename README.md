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

> Note: `@cap-js/openapi` and `@cap-js/asyncapi` packages have been migrated from peerDependencies to dependencies in `package.json`. As a result, using globally installed packages may lead to conflicts.  If conflicts arises do `npm uninstall -g @cap-js/openapi @cap-js/asyncapi` and then `npm install` in your project directory.

### Authentication

To enforce authentication in the ORD Plugin, set the following environment variables:

- `ORD_AUTH_TYPE`: Specifies the authentication types.
- `BASIC_AUTH`: Contains credentials for `basic` authentication.

If `ORD_AUTH_TYPE` is not set, the application starts without authentication. This variable accepts `open` and `basic` (UCL-mTLS is also planned).
> Note: `open` cannot be combined with `basic` or any other (future) authentication types.

#### Open

The `open` authentication type bypasses authentication checks.

#### Basic Authentication

The server supports Basic Authentication through an environment variable that contains a JSON string mapping usernames to bcrypt-hashed passwords:

```bash
BASIC_AUTH='{"admin":"***"}'
```

Alternatively, configure authentication in `.cdsrc.json`:

```json
"authentication": {
    "types": ["basic"],
    "credentials": {
        "admin": "***"
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
