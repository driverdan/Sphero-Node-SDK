#!/usr/bin/env node
/**
 * Creates virtual serial ports in /tmp for each Sphero port and holds the
 * bluetooth ones open. This is helpful for avoiding connection errors and
 * interference from iOS devices when connecting multiple Spheros. 
 *
 * Requires the 'socat' command-line tool to create the virtual serial ports.
 */
var spawn = require('child_process').spawn;
var extname = require('path').extname;

// where to store the virtual ports while running
var virtual_port_dir = '/tmp/';

// socat displays this when successfully connected
var success_str = 'starting data transfer loop';

// socat binary
//var socat = './testsocat.sh';
var socat = 'socat';

// terminal colors
red   = '\033[31m';
blue  = '\033[34m';
green  = '\033[32m';
reset = '\033[0m';

var paths = process.argv.slice(2);
var numPaths = paths.length;
if(paths.length === 0) {
  console.log('usage connectSpheros.js [sphero serial port paths]');
  process.exit(1);
}
console.log('Connecting ' + numPaths + ' paired Spheros');

var connectPort = function(index, path, callback) {
  var self;
  var virtual_port = virtual_port_dir + extname(path).slice(1);
  console.log('Starting connection to ' + path + ' at ' + virtual_port);

  // Run socat to connect virtual serial port to real one
  child = spawn(socat, [
    '-d','-d','-d', // Extra debugging
    'pty,link=' + virtual_port + ',raw,echo=0', // Create virtual serial port
    'file:' + path // Connect to Sphero serial port
    ]);

  child.on('exit', function() {
    if(index in activeStreams) {
      // We lost an active connection
      console.log(red + 'Connection lost for ' + path + reset);
    } else {
      console.log('Failed to connect to ' + path);
    }

    delete activeStreams[index];

    // Restart self
    children[self.index] = connectPort(index, path, callback);
  });

  var handleOutput = function(buffer) {
    var data = buffer.toString();
    //console.log(index + ' stdout: ' + data);

    if(data.search('starting data transfer loop') !== -1) {
      self.ready = true;

      console.log(self.path, ': stream is now active at ' + self.port);
      callback();

      activeStreams[index] = true;
      if(Object.keys(activeStreams).length === numPaths) {
        console.log('\n' + green + 'READY TO GO!!!' + reset + '\n');
      }
    }
  };
  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  self = {
    index: index,
    path: path,
    port: virtual_port,
    child: child,
    ready: false
  };
  return self;
};

var children = Object.create(null);
var activeStreams = Object.create(null);

// connect one at a time, waiting for callback
var i = 0;
var connectNext = function() {
  if(!paths.length) { return; }

  i = i + 1;
  var path = paths.shift();

  children[i] = connectPort(i, path, connectNext);
};
connectNext();

process.on('SIGINT', function() {
  process.exit();
});
process.on('exit', function() {
  for(var i=0; i<numPaths; i++) {
    console.log('Killing ' + i);
    children[i].child.kill();
  }
});

