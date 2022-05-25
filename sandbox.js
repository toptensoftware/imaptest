let Utils = require('./lib/Utils.js')

let str = "Brad Robinson(Primary Account) <brad@toptensoftware.com>,brad@rocketskeleton.com";

console.log(Utils.split_address_list(str));