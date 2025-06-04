# How to local run xmpl for dev

1. **Clone the monorepo**

    ```sh
    git clone https://github.com/cap-js/calesi.git
    ```

2. **Add a Pugin inside /plugins**

    ```sh
    cd plugins
    git clone https://github.com/cap-js/ord.git
    ```

3. **Add ord/xmpl to workspaces**

    ```json
    #/calesi/package.json
    "workspaces": [
        "incidents-app",
        "plugins/*",
        "plugins/ord/xmpl/"
    ],
    ```

4. **Install dependency**
    ```sh
    # in root folder /calesi
    npm i
    ```
5. **Run xmpl application**

    ```sh
    # in /calesi/plugins/ord/xmpl
    cds watch

    # build resources files
    cds build --for ord
    ```
