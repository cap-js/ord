# ORD XMPL

This guide explains how to run ORD xmpl.

## How to Deploy

1. **Clone the repository under calesi project**

    ```sh
    # under /calesi/plugins/
    git clone https://github.com/cap-js/ord.git
    cd /ord/xmpl
    ```

2. **Install dependencies**

    ```sh
    npm install
    ```

    3. **Run the plugin locally**

        - Use the following command to start the service in development mode:
            ```sh
            cds w
            ```
        - This runs the Node.js-based XMPL plugin using CAP (SAP Cloud Application Programming Model).

    4. **Configure the plugin**
        - Edit `config.json` in the `xmpl` directory to match your environment and requirements.
