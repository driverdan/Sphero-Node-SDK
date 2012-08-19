// NodeJS Sphero SDK

var SerialPort = require("serialport").SerialPort;

// Constant values

// Buffer positions for packet fields
var COMMAND_SOP1 = 0
  , COMMAND_SOP2 = 1
  , COMMAND_DID = 2
  , COMMAND_CID = 3
  , COMMAND_SEQ = 4
  , COMMAND_DLEN = 5
  // First data position
  , COMMAND_DATA = 6
  // CHK will be variable position if data is set
  , COMMAND_CHK = 6

  // Response packet fields
  , RESPONSE_SOP1 = 0
  , RESPONSE_SOP2 = 1
  , RESPONSE_MRSP = 2
  , RESPONSE_SEQ = 3
  , RESPONSE_DLEN = 4
  // First data position
  , RESPONSE_DATA = 5
  // CHK will be variable position if data is set
  , RESPONSE_CHK = 5

  // Async
  , RESPONSE_ID = 2
  , RESPONSE_DLEN_MSB = 3
  , RESPONSE_DLEN_LSB = 4

  // Message response codes
  , RSP_CODE_OK = 0x00
  , RSP_CODE_EGEN = 0x01
  , RSP_CODE_ECHKSUM = 0x02
  , RSP_CODE_EFRAG = 0x03
  , RSP_CODE_EBAD_CMD = 0x04
  , RSP_CODE_EUNSUPP = 0x05
  , RSP_CODE_EBAD_MSG = 0x06
  , RSP_CODE_EPARAM = 0x07
  , RSP_CODE_EEXEC = 0x08
  , RSP_CODE_EBAD_DID = 0x09
  , RSP_CODE_POWER_NOGOOD = 0x31
  , RSP_CODE_PAGE_ILLEGAL = 0x32
  , RSP_CODE_FLASH_FAIL = 0x33
  , RSP_CODE_MA_CORRUPT = 0x34
  , RSP_CODE_MSG_TIMEOUT = 0x35;

var Sphero = function(path) {
  var self = this;

  // Path to port Sphero is on
  path = path || "/dev/tty.Sphero";

  // Command sequence number
  this.seq = 0x00;

  // Stores call options for callbacks
  // Uses sequence ID to reference
  this.calls = {};

  // Data buffer to gather response
  // Byte sequence is
  // SOP1 - always 0xff
  // SOP2 - 0xff for acknowledgement, otherwise 0xfe
  // MRSP - message response
  // SEQ  - sequence number
  // DLEN - data length (0x01 if no data)
  // <data> - Optional data
  // CHK - Checksum
  this.buffer = new Buffer(0);

  // Device IDs
  this.devices = {
    core: 0x00,
    bootloader: 0x01,
    sphero: 0x02
  };

  // Open the port
  this.port = new SerialPort(path, {
    baudrate: 115200
  });

  // Handle response data
  // Merges and parses response data to form packets
  var processData = function(data) {
    // Create new buffer of saved data plus new data
    // Can be called without data to handle multiple results in a single packet
    if (data) {
      var tmpBuffer = new Buffer(self.buffer.length + data.length);
      self.buffer.copy(tmpBuffer);
      data.copy(tmpBuffer, self.buffer.length);
      self.buffer = tmpBuffer;
    }

    // Determine if we've completed a packet
    // Min packet is 6 (including SOP1 0xff packet)
    if (self.buffer.length >= 6) {
      var end;

      // Empty data
      if (self.buffer[RESPONSE_DLEN] == 0x01) {
        end = 6;
      } else if (self.buffer[RESPONSE_DLEN] <= self.buffer.length - 5) {
        // Buffer has data and is complete
        end = 5 + self.buffer[RESPONSE_DLEN];
      }

      // Create buffer for the full packet, remove it from buffered data
      if (end) {
        var packet = self.buffer.slice(0, end);
        self.buffer = self.buffer.slice(end);

        if(typeof self.calls[packet[RESPONSE_SEQ]] !== 'undefined') {
          // Do the callback
          if (packet[RESPONSE_MRSP] == RSP_CODE_OK) {
            // Success!
            if (self.calls[packet[RESPONSE_SEQ]].success) {
              self.calls[packet[RESPONSE_SEQ]].success(packet);
            }
          } else {
            // Error :(
            if (self.calls[packet[RESPONSE_SEQ]].error) {
              self.calls[packet[RESPONSE_SEQ]].error(packet);
            }
          }
        } else if (self.onHit && packet[RESPONSE_MRSP] == 0x07) {
          // Collision Detection Async Response
          packet = packet.slice(5, packet.length - 1);
          var object = {
            x: packet[0]*256 + packet[1],
            y: packet[2]*256 + packet[3],
            z: packet[4]*256 + packet[5],
            axis: ((packet[6]-1) && 'Y') || 'X',
            xMagnitude: packet[7]*256 + packet[8],
            yMagnitude: packet[9]*256 + packet[10],
            speed: packet[11],
            timeStamp: packet[12]*256*256*256 + packet[13]*256*256 + packet[14]*256 + packet[15]
          };
          self.onHit(object)
		} else {
          // Error :(
          if (self.calls[packet[RESPONSE_SEQ]].error) {
            self.calls[packet[RESPONSE_SEQ]].error(packet);
          }
        }
        // Remove the saved options, no longer needed
        delete self.calls[packet[RESPONSE_SEQ]];

        // If the remaining buffer is long enough to be a result process it
        if (self.buffer.length >= 6) {
          processData();
        }
      }
    }
  };
  this.port.on("data", processData);
};

// Send raw commands to Sphero
// options parameters:
// device, command, data, success, error
Sphero.prototype.send = function(options) {
  if (!options) {
    throw new Error("Options required");
  }
  if (typeof options.device === "undefined") {
    throw new Error("Device required");
  }
  if (typeof options.command === "undefined") {
    throw new Error("Command required");
  }

  if (typeof options.data === "undefined") {
    options.data = "";
  }

  // Determine length of data. Length is always data length + 1 (for checksum)
  var dataLength = options.data.length > 254 ? 0xFF : options.data.length + 0x01;

  // Construct the packet (minus checksum)
  var packet = [0xff, 0xff, options.device, options.command, this.seq, dataLength];

  // Calculate checksum
  // 1's complement of packet sum mod 256 per spec
  var checksum = options.device + options.command + this.seq + dataLength;

  if (options.data) {
    for (var i = 0, len = options.data.length; i < len; i++) {
      packet.push(options.data[i]);
      checksum += options.data[i];
    }
  }

  checksum = ~(checksum % 256);
  packet.push(checksum);

  // Save options for callbacks and such
  this.calls[this.seq] = options;

  this.port.write(packet);

  this.seq = (this.seq + 1) % 256;
};

// Returns new Buffer of result data (if any) out of a response packet buffer
Sphero.prototype.parseData = function(packet) {
  if (!packet || packet.length < 7) {
    return null;
  }
  var length = packet[RESPONSE_DLEN];
  // Use a new buffer that's safe to modify
  var result = new Buffer(length - 1);
  packet.copy(result, 0, RESPONSE_DLEN + 1, RESPONSE_DLEN + length);
  return result;
};

/**
 * These are the helper functions that make sending raw calls easy.
 */

Sphero.prototype.ping = function(cb) {
  var options = {
    device: this.devices.core,
    command: 0x01
  };
  if (cb) {
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.getVersioning = function(cb) {
  var options = {
    device: this.devices.core,
    command: 0x02
  };
  if (cb) {
    var self = this;
    options.success = function(packet) {
      cb(self.parseData(packet));
    }
  }
  this.send(options);
  return this;
};

// setDeviceName here

Sphero.prototype.getBluetoothInfo = function(cb) {
  var options = {
    device: this.devices.core,
    command: 0x11
  };
  if (cb) {
    var self = this;
    options.success = function(packet) {
      var data = self.parseData(packet);
      var name = data.slice(0, 15).toString();
      var id = data.slice(16).toString();
      cb(name, id);
    };
  }
  this.send(options);
  return this;
};

Sphero.prototype.setAutoReconnect = function(enable, time, cb) {
  // Allow user to pass callback without time for disabling
  if (typeof time === "function") {
    cb = time;
    time = 0;
  }
  if (enable && typeof time !== "number") {
    throw new Error("Reconnect time is required");
  }
  var options = {
    device: this.devices.core,
    command: 0x12,
    // Default time to 30 to be safe
    data: new Buffer([enable ? 0x01 : 0x00, time])
  };
  if (cb) {
    var self = this;
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.getAutoReconnect = function(cb) {
  var options = {
    device: this.devices.core,
    command: 0x13
  };
  if (cb) {
    var self = this;
    options.success = function(packet) {
      cb(self.parseData(packet));
    };
  }
  this.send(options);
  return this;
};

Sphero.prototype.disconnect = function() {
  this.port.close();
};

// Bunch of missing features go here

/**
 * Sphero commands
 */

Sphero.prototype.setHeading = function(heading, cb) {
  var data = new Buffer(2);
  data.writeInt16BE(heading, 0);
  var options = {
    device: this.devices.sphero,
    command: 0x01,
    data: data
  };
  if (cb) {
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.setStabilization = function(enable, cb) {
  var options = {
    device: this.devices.sphero,
    command: 0x02,
    data: enable ? 0x01 : 0x00
  };
  if (cb) {
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.setRotationRate = function(rate, cb) {
  var options = {
    device: this.devices.sphero,
    command: 0x03,
    data: rate
  };
  if (cb) {
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

// More missing functions here

Sphero.prototype.roll = function(speed, heading, timeout, cb) {
  var self = this;

  if (typeof timeout == "function") {
    cb = timeout;
    timeout = false;
  }

  var data = new Buffer(4);
  data[0] = speed;
  data.writeInt16BE(heading, 1);
  data[3] = 0x01;

  var options = {
    device: this.devices.sphero,
    command: 0x30,
    data: data
  };

  if (timeout) {
    options.success = function(packet) {
      setTimeout(function() {
        self.stop();
        if (cb) {
          cb();
        }
      }, timeout);
    };
  } else if (cb) {
    options.success = function(packet) {
      cb(packet);
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.stop = function(cb) {
  var options = {
    device: this.devices.sphero,
    command: 0x30,
    data: new Buffer([0x01, 0x00, 0x00, 0x00])
  };
  if (cb) {
    options.success = function() {
      cb();
    }
  }
  this.send(options);
  return this;
};

Sphero.prototype.setCollisionDetection = function (options, onHit) {
  options.device	= this.devices.sphero;
  options.command	= 0x12;
  options.success	= options.success	|| function() { return; },
  options.error		= options.error		|| function() { return; },
  options.data		= options.data		|| [0x01, 120, 120, 120, 120, 120];
  this.onHit = onHit || function() { return; };
  this.send(options);
  return this;
};

Sphero.prototype.setColor = function(red, green, blue, cb) {
  var options = {
    device: this.devices.sphero,
    command: 0x20,
    success: cb,
    data: [red, green, blue]
  };
  this.send(options);
  return this;
};

Sphero.prototype.setBlackLED = function(val, cb) {
  var options = {
    device: this.devices.sphero,
    command: 0x21,
    data: [255],
    success: function(packet) { 
      cb(packet);
    }
  };
  this.send(options);
  return this;
};

exports.Sphero = Sphero;
