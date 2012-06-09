// Test basic commands
var Sphero = require("../lib/sphero.js").Sphero;
var sphero = new Sphero();

// Raw commands

sphero.send({
  device: sphero.devices.core,
  command: sphero.commands.ping,
  success: function(packet) {
    console.log("Raw ping", packet);
  }
});
console.log("Sent raw ping");

sphero.send({
  device: sphero.devices.core,
  command: sphero.commands.version,
  success: function(packet) {
    console.log("Raw version", packet);
  }
});
console.log("Sent raw version");

// Simple commands
sphero.ping(function(data) {
  console.log("ping", data);
})
.getVersioning(function(data) {
  console.log("getVersioning", data)
});
