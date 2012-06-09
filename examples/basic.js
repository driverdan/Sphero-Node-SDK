// Test basic commands
var Sphero = require("../lib/sphero.js").Sphero;
var sphero = new Sphero();

sphero.send(sphero.devices.core, sphero.commands.ping, function(packet) {
  console.log("Ping packet", packet);
});
