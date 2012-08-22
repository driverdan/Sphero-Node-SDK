// NodeJS Sphero SDK

export core = function ( Sphero ) {

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

	return Sphero;
};
