[![REUSE status](https://api.reuse.software/badge/github.com/cap-js/ord)](https://api.reuse.software/info/github.com/cap-js/ord)

# CDS Plugin for ORD

## About this project

This plugin adds support for the [Open Resource Discovery](https://sap.github.io/open-resource-discovery/) (ORD) protocol for CAP based applications.
When you add the ORD plugin, your application gains a single entry point, which allows to discover and gather machine-readable information or metadata about the application.
You can use this information to construct a static metadata catalog or to perform a detailed runtime inspection of your actual system instances / system landscapes.

For more information, have a look at the [Open Resource Discovery](https://sap.github.io/open-resource-discovery/) page.

> ⚠ To secure your CAP application's metadata, configure `basic` authentication by setting the environment variables or updating the `.cdsrc.json` file. The plugin prioritizes environment variables, then checks `.cdsrc.json`. If neither is configured, metadata remains publicly accessible.
>

## Requirements and Setup

### Installation

```sh
npm install @cap-js/ord
```

### Authentication

To enforce authentication in the ORD Plugin, set the following environment variables:

* `ORD_AUTH_TYPE`: Specifies the authentication types.
* `BASIC_AUTH`: Contains credentials for `basic` authentication.

If `ORD_AUTH_TYPE` is not set, the application starts without authentication. This variable accepts `open` and `basic` (UCL-mTLS is also planned).
> Note: `open` cannot be combined with `basic` or any other (future) authentication types.

#### Open

The `open` authentication type bypasses authentication checks.

#### Basic

To use `basic` authentication, set `ORD_AUTH_TYPE` to `["basic"]` and provide credentials in `BASIC_AUTH`. Example:

```bash
BASIC_AUTH='{"user":"password"}'
```

Alternatively, configure authentication in `.cdsrc.json`:

```json
"authentication": {
    "types": ["basic"],
    "credentials": {
        "user": "password"
    }
}
```

### Usage

#### Programmatic API

```js
const cds = require("@sap/cds");
require("@cap-js/ord");
```

```js
const csn = await cds.load(cds.env.folders.srv);
const ord = cds.compile.to.ord(csn);
```

#### Command Line

```sh
cds compile <path to srv folder> --to ord [-o] [destinationFilePath]
```

<img width="1300" alt="Sample Application Demo" style="border-radius:0.5rem;" src="./asset/etc/ordCLI.png">

#### ORD Endpoints

1. Run `cds watch` in the application's root.
2. Check the following relative paths for ORD information - `/.well-known/open-resource-discovery` , `/open-resource-discovery/v1/documents/1`.

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
