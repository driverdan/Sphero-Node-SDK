#!/usr/bin/env node
var Sphero = require("../lib/sphero.js").Sphero;

var run = function(sphero) {

  sphero.getBluetoothInfo(function(name, id) {
    console.log("Device name is " + name + ' / ' + id);
  })
  .setAutoReconnect(false, 5, function() {
    console.log("Turned off auto reconnect");
  })
  .send({
    device: sphero.devices.core,
    command: 0x25,
    data: new Buffer([0xFF, 0xFF]),
    success: function(packet) {
      console.log("Set timeout to 65535 seconds");
      sphero.disconnect();
      process.exit(0);
    }
  });
};


var sphero;
if(process.argv.length === 2) {
  sphero = new Sphero();
}
else if(process.argv.length === 3) {
  sphero = new Sphero(process.argv[2]);
} else {
  console.log('usage: setup_sphero.js [path to sphero port]');
  process.exit(1);
}

run(sphero);
