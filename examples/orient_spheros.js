#!/usr/bin/env node
/**
 * Allows you to re-orient multiple spheros by temporarily disabling the
 * auto-stabilization and turning it back on again after a keypress.
 */
var Sphero = require("../lib/sphero.js").Sphero;

var paths = process.argv.slice(2);
if(paths.length === 0) {
  console.log('usage orientSpheros.js [paths to sphero ports]');
  process.exit(1);
}
console.log('Orienting ' + paths.length + ' paired Spheros');

var orient = function(path) {
  var sphero = new Sphero(path);
  var deviceName;

  sphero.getBluetoothInfo(function(name, id) {
    console.log("Device name is " + name + ' / ' + id);
    deviceName = name;
  })
  // Turn off stabilization
  .setStabilization(0x00, function() {
    console.log(deviceName + ': stabilization turned off');
  })
  // Turn on back led
  .setBlackLED(255, function() {
    console.log(deviceName + ': back LED on');
  })
  .setColor(0, 255, 0, function() {
    console.log(deviceName + ' : set color to green');
  })
  ;

  return sphero;
};

var numReset = 0;
var reset = function(sphero) {
  // Turn sphero to heading 0 so it reorients to the same place as the others
  sphero.setHeading(0, function() {

    // Turn on stabilization
    sphero.setStabilization(0x01, function() {
      console.log('Reset sphero ' + numReset);
      sphero.disconnect();

      numReset = numReset + 1;

      if(numReset === paths.length) {
        console.log("Finished orientation.");
        process.exit(0);
      }
    });
  });
};

var spheros = [];
paths.forEach(function(path) {
  spheros.push(orient(path));
});

console.log('Press any key to complete orientation. > ');
var stdin = process.openStdin();
stdin.once('data', function() {
  spheros.forEach(function(sphero) {
    reset(sphero);
  });
});

