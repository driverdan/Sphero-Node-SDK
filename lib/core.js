// NodeJS Sphero SDK

module.exports = function (Sphero) {

  Sphero.prototype.ping = function(cb) {
    var options = {
      device: this.devices.core,
      command: 0x01
    };
    if (cb) {
      options.success = function() {
        cb();
      };
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
      };
    }
    this.send(options);
    return this;
  };
  
  Sphero.prototype.setDeviceName = function(name, cb) {
    if (typeof(name) === "string") {
      name = name.split("");
    }
    var options = {
      device: this.devices.core,
      command: 0x10,
      data: name
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
      };
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

  Sphero.prototype.getPowerState = function(cb) {
    var options = {
      device: this.device.core,
      command: 0x20
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

  Sphero.prototype.setPowerNotification = function(flag, cb) {
    var options = {
      device: this.device.core,
      command: 0x21,
      success: cb,
      data: [flag]
    };
    this.send(options);
    return this;
  };
  
  Sphero.prototype.sleep = function(time, macro, orbBasic, cb) {
    var options = {
      device: this.device.core,
      command: 0x22,
      success: cb,
      data: [time/256, time%256, macro, orbBasic]
    };
    this.send(options);
    return this;
  };
  
  Sphero.prototype.getVoltageTripPoints = function(cb) {
    var options = {
      device: this.device.core,
      command: 0x23
    };
    if (cb) {
      var self = this;
      options.success = function(packet) {
        cb(packet[5]*256 + packet[6], packet[7]*256 + packet[8]);
      };
    }
    this.send(options);
    return this;
  };

  Sphero.prototype.setVoltageTripPoints = function(vLow, vCrit, cb) {
    var options = {
      device: this.device.core,
      command: 0x24,
      success: cb,
      data: [vLow/256, vLow%256, vCrit/256, vCrit%256]
    };
    this.send(options);
    return this;
  };

  Sphero.prototype.setInactivityTimeout = function(time, cb) {
    var options = {
      device: this.device.core,
      command: 0x25,
      success: cb,
      data: [time/256, time%256]
    };
    this.send(options);
    return this;
  };

  Sphero.prototype.jumpToBootloader = function(cb) {
    var options = {
      device: this.device.core,
      command: 0x30,
      success: cb
    };
    this.send(options);
    return this;
  };

  return Sphero;
};
