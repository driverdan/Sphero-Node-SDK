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
        // Remove the saved options, no longer needed
        delete self.calls[packet[RESPONSE_SEQ]];

        // If the remaining buffer is long enough to be a result process it
        if (self.buffer.length >= 6) {
          processData();
        }
      }
    }
  }
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
    packet.push(options.data);

    for (var i = 0, len = options.data.length; i < len; i++) {
      checksum += options.data[i];
    }
  }

  checksum = ~(checksum % 256);
  packet.push(checksum);

  // Save options for callbacks and such
  this.calls[this.seq] = options;

  this.port.write(packet);
  this.seq++;
};

// Returns new Buffer of result data (if any) out of a response packet buffer
Sphero.prototype.parseData = function(packet) {
  if (!packet || packet.length < 7) {
    return null;
  }
  var length = packet[RESPONSE_DLEN] - 1;
  // Use a new buffer that's safe to modify
  var result = new Buffer(length);
  packet.copy(result, 0, RESPONSE_DLEN + 1, length);
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

// setDeviceName

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

exports.Sphero = Sphero;
