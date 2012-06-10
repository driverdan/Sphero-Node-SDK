// Test basic commands
var Sphero = require("../lib/sphero.js").Sphero;
var sphero = new Sphero();

// Raw command example
sphero.send({
  device: sphero.devices.core,
  command: 0x01,
  success: function(packet) {
    console.log("Raw ping", packet);
  }
});
console.log("Sent raw ping");

// Helper commands (can be chained)
sphero.ping(function() {
  console.log("ping");
})
.getVersioning(function(data) {
  console.log("getVersioning", data);
})
.getBluetoothInfo(function(name, id) {
  console.log("getBluetoothInfo", name, id);
})
.setAutoReconnect(true, 5, function() {
  console.log("setAutoReconnect true 5 seconds");
})
.getAutoReconnect(function(data) {
  console.log("getAutoReconnect", data);
})
// disable auto reconnect
.setAutoReconnect(false, function() {
  console.log("disabled setAutoReconnect");
});
