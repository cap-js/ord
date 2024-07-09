[![REUSE status](https://api.reuse.software/badge/github.com/cap-js/cds-plugin-for-ord)](https://api.reuse.software/info/github.com/cap-js/cds-plugin-for-ord)

# CDS Plugin for ORD

## About this project

Open Resource Discovery [(ORD)](https://sap.github.io/open-resource-discovery/) is a protocol that allows applications and services to self-describe their exposed resources and capabilities. This plugin enables generation of ORD document for CAP based applications.

## Requirements and Setup

### Installation

```sh
npm install @cap-js/ord
```

### Usage

#### Programmatic API

```js
const cds = require('@sap/cds')
```

```js
const csn = await cds.load(cds.env.folders.srv)
const ord = cds.compile.to.ord(csn)
```

#### Command Line

```sh
cds compile <path to srv folder> --to ord [-o] [destinationFilePath]
```

<img width="1300" alt="Sample Application Demo" style="border-radius:0.5rem;" src="./asset/etc/ordCLI.png">

#### ORD Endpoints

1) Run `cds watch` in the application's root.
2) Check the following relative paths for ORD information - `/.well-known/open-resource-discovery` , `/open-resource-discovery/v1/documents/1`.


<img width="1300" alt="Sample Application Demo" style="border-radius:0.5rem;" src="./asset/etc/ordEndpoint.gif">

### Customizing ORD Document

You can find more information, such as how to customize the ORD Document, in this [document](ord.md).


## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js/ord/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure
If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/cap-js/ord/issues/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/cap-js/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2024 SAP SE or an SAP affiliate company and cds-plugin-for-ord contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js/<your-project>).