// Test basic commands
var Sphero = require("../lib/sphero.js").Sphero;
var sphero = new Sphero();

// Helper commands (can be chained)
sphero.ping(function() {
  console.log("ping");
})
.roll(255, 0, 500, function() {
  sphero.roll(255, 90, 500);
});
