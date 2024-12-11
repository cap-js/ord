const cds = require('@sap/cds')

// class OrdService extends cds.ApplicationService {
//   /** Registering custom event handlers */
//   init() {
//     this.on('GET', '*', console.log('hi'))
//     return super.init()
//   }

// }


module.exports = cds.service.impl(async function () {
    if (this instanceof cds.ApplicationService) {
        //iterate over this.model.definitions and for all kind as service do this.on and listen
        for (const [key, value] of Object.entries(this.model.definitions)) {
            if (value.kind === "service") {
                value.on("READ", '*', async (req) => {
                    console.log("READ");
                    console.log(req);
                    return [
                        { id: 1, name: "Order 1", status: "Pending" },
                        { id: 2, name: "Order 2", status: "Completed" },
                    ];
                });
            }
        }
    }



});


// module.exports = { OrdService }
