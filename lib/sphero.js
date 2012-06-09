// NodeJS Sphero SDK

var SerialPort = require("serialport").SerialPort;

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
    // Min packet is 6 (including 0xff packet)
    if (self.buffer.length >= 6) {
      // Empty data
      if (self.buffer[4] == 0x01) {
        // Create buffer for the full packet, remove it from buffered data
        var packet = self.buffer.slice(0, 5);
        self.buffer = self.buffer.slice(6);

        // Do the callback
        if (self.callbacks[packet[3]]) {
          self.callbacks[packet[3]](packet);
          delete self.callbacks[packet[3]];
        }
      } else {
        // Check if data is completed
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
