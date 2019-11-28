const Boat = {
    CMD_FORWARD : 'forward',
    CMD_BACK : 'back',
    CMD_LEFT : 'left',
    CMD_RIGHT : 'right',
    CMD_STOP : 'stop',
    CMD_NOP : 'nop',

    DIR_FORWARD : 0b1010,
    DIR_BACK : 0b0101,
    DIR_LEFT : 0b0110,
    DIR_RIGHT : 0b1001,

    MOTOR1LN1 : 0b1000,
    MOTOR1LN2 : 0b0100,
    MOTOR2LN3 : 0b0010,
    MOTOR2LN4 : 0b0001,

    MAX_SPEED : 250000,

    state : {
        command_counter : 0, // number of received command
        motor_direction : this.DIR_FORWARD, // current boar direction
        motor_speed : 0,    // current motor speed
        acc_degree_z : 0,   // last calculated rotation acc
        gps : {             // current GPS coordinates
            lat : null,
            lon : null
        }
    },

    accZBuffer : [],        // needed to calculate the rotation acc
    port : null,

    enA : null,
    ln1 : null,
    ln2 : null,

    enB : null,
    ln3 : null,
    ln4 : null,

    target : {
        new_degree : 0,             // degrees
        current_degree : 0,
        travel_time : 0,            // milliseconds
        current_travel_time : 0
    },

    resetTarget : function() {
        this.target.new_degree = 0;
        this.target.current_degree = 0;
        this.target.travel_time = 0;
        this.target.current_travel_time = 0;
    },

    resetState : function() {
        this.state.motor_direction = this.DIR_FORWARD;
        this.state.motor_speed = 0;
    },

    init : function() {
        setInterval(()=>{this.validateTarget();}, 10); // validate, if target criteria has been meet
        setInterval(()=>{this.processState();}, 10); // set actuator according to state
        setInterval(()=>{this.timerUpdate();}, 100); // timer for forward/back
        setInterval(()=>{this.rotationUpdate();}, 100); // check acc z rotation
        const SerialPort = require('serialport');
        this.port = new SerialPort('/dev/ttyAMA0', {baudRate:9600});
        const Readline = require('@serialport/parser-readline');
        const parser = new Readline();

        const GPS = require('gps');
        const gps = new GPS;

        gps.on('data', (data) => {
            console.log(this.state);
            console.log(this.target);
            this.state.gps.lat =  gps.state.lat || null;

            this.state.gps.lon = gps.state.lon || null;
        });

        this.port.pipe(parser);

        parser.on('data', (line) => {
            gps.update(line);
        });

        const Gpio = require('pigpio').Gpio;

        this.enA = new Gpio(12, {mode:Gpio.OUTPUT});
        this.ln1 = new Gpio(17, {mode:Gpio.OUTPUT});
        this.ln2 = new Gpio(27, {mode:Gpio.OUTPUT});

        this.enB = new Gpio(13, {mode:Gpio.OUTPUT});
        this.ln3 = new Gpio(24, {mode:Gpio.OUTPUT});
        this.ln4 = new Gpio(23, {mode:Gpio.OUTPUT});
    },

    onMessage : async function(message, /*connection*/ cb) {
        try {
            let command = JSON.parse(message);
            this.state.command_counter++;
            this.parseCommand(command);
        } catch(e) {
            console.log(e);
        }
        // always replay with current state
        return cb(JSON.stringify(this.state));
    },

    parseCommand : async function(command) {
        switch(command.op) {
            case this.CMD_NOP :
                break;
            case this.CMD_STOP :
                this.resetTarget();
                this.resetState();
                break;
            case this.CMD_LEFT :
                this.resetTarget();
                this.target.new_degree = -command.value;
                this.state.motor_direction = this.DIR_LEFT;
                this.state.motor_speed = this.MAX_SPEED;
                break;
            case this.CMD_RIGHT :
                this.resetTarget();
                this.target.new_degree = command.value;
                this.state.motor_direction = this.DIR_RIGHT;
                this.state.motor_speed = this.MAX_SPEED;
                break;
            case this.CMD_FORWARD :
                this.resetTarget();
                this.target.travel_time = command.value;
                this.state.motor_direction = this.DIR_FORWARD;
                this.state.motor_speed = this.MAX_SPEED;
                break;
            case this.CMD_BACK :
                this.resetTarget();
                this.target.travel_time = command.value;
                this.state.motor_direction = this.DIR_BACK;
                this.state.motor_speed = this.MAX_SPEED;
                break;
        }
    },

    validateTarget : async function() {
        if((this.target.current_travel_time >= this.target.travel_time) // FORWARD / BACK
            || (0 > this.target.new_degree && (this.target.current_degree >= this.target.new_degree)) //LEFT
            || (0 < this.target.new_degree && (this.target.current_degree <= this.target.new_degree))) // RIGHT
        {
            this.resetTarget();
            this.resetState();
        }
    },

    processState : async function () {
        this.setMotor(this.state.motor_direction, this.state.motor_speed);
    },

    /*
    Actuators
     */

    setMotor : function(matrix, speed) {
        // set speed for Motor 1 and 2
        this.enA.hardwarePwmWrite(1000000, speed);
        this.enB.hardwarePwmWrite(1000000, speed);

        this.ln1.digitalWrite((matrix & this.MOTOR1LN1) ? 1 : 0);
        this.ln2.digitalWrite((matrix & this.MOTOR1LN2) ? 1 : 0);
        this.ln3.digitalWrite((matrix & this.MOTOR2LN3) ? 1 : 0);
        this.ln4.digitalWrite((matrix & this.MOTOR2LN4) ? 1 : 0);
    },

    /*
    Sensors
     */

    timerUpdate : async function() {
        this.target.current_travel_time = this.target.current_travel_time + 100;
    },

    rotationUpdate : async function() {
        this.accZUpdate(false, [0,0,15]);
        //mpu.getRotation(accZUpdate);
    },

    accZUpdate : async function (err, data) {
        const deg = data[2]/131;
        this.accZBuffer.push(parseInt(deg));
        if(10 === this.accZBuffer.length) { // 10 = 1s/100ms from rotation update
            const sum = this.accZBuffer.reduce(function(a, b) { return a + b; });
            this.state.acc_degree_z = sum/10;
            this.target.current_degree = this.target.current_degree + this.state.acc_degree_z;
            this.accZBuffer = [];
        }
    }
}

module.exports = Boat;