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

  // Stores callbacks for specific commands
  // Uses sequence ID to reference callback
  this.callbacks = {};

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

  this.commands = {
    ping: 0x01,
    version: 0x02
  }

  // Open the port
  this.port = new SerialPort(path, {
    baudrate: 115200
  });

  // Handle response data
  // Merges and parses response data to form packets
  this.port.on("data", function(data) {
    // Create new buffer of saved data plus new data
    var tmpBuffer = new Buffer(self.buffer.length + data.length);
    self.buffer.copy(tmpBuffer);
    data.copy(tmpBuffer, self.buffer.length);
    self.buffer = tmpBuffer;

    // Determine if we've completed a packet
    // Min packet is 6 (including SOP1 0xff packet)
    if (self.buffer.length >= 6) {
      // Empty data
      if (self.buffer[RESPONSE_DLEN] == 0x01) {
        // Create buffer for the full packet, remove it from buffered data
        var packet = self.buffer.slice(0, 5);
        self.buffer = self.buffer.slice(6);

        // Do the callback
        if (self.callbacks[packet[RESPONSE_SEQ]]) {
          self.callbacks[packet[RESPONSE_SEQ]](packet);
          delete self.callbacks[packet[RESPONSE_SEQ]];
        }
      } else if (self.buffer[RESPONSE_DLEN] == self.buffer.length - 5) {
        // Buffer has data and is complete
      }
    }
  });
};

Sphero.prototype.send = function(device, command, data, callback) {
  // Allow passing a callback with no data
  if (typeof data === "function") {
    callback = data;
    data = "";
  } else if (!data) {
    data = "";
  }
  var dataLength = data.length > 254 ? 0xFF : data.length + 0x01;
  var packet = [0xff, 0xff, device, command, this.seq, dataLength];

  // Calculate checksum
  // 1's complement of packet sum mod 256 per spec
  var checksum = device + command + this.seq + dataLength;

  if (data) {
    packet.push(data);

    for (var i = 0, len = data.length; i < len; i++) {
      checksum += data[i];
    }
  }

  checksum = ~(checksum % 256);
  packet.push(checksum);

  // Save callback for when response is received
  if (callback) {
    this.callbacks[this.seq] = callback;
  }

  this.port.write(packet);
  this.seq++;
};

exports.Sphero = Sphero;
