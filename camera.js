const debug = require("debug")("view360:camera");
const events = require("events");
const os = require('os');
const spawn = require('child_process').spawn;

const HOME_DIRECTORY = os.homedir();
const GPHOTO2 = "gphoto2"


class Camera extends events.EventEmitter {
  constructor() {
    super();
    this.setCaptureDirectory(HOME_DIRECTORY+"/Pictures/");
    this.setModel("Not detected yet.");
    this.detectModel();
    this.setBatteryLevel("___%");
  };
  
  monitorBatteryLevel() {
    this.setBatteryLevel("unknown");
    this.checkBattery();
    // update battery level once a minute
    setInterval(this.checkBattery,60*1000);
  };
  setCaptureDirectory(newDirectory) {
    this.captureDirectory = newDirectory;
    debug(`captureDirectory: ${this.captureDirectory}`);
    this.emit("directory",newDirectory);
  };
  setBatteryLevel(level) {
    debug(`emit battery ${level}`);
    this.emit("battery", level);
  };

  getModel() {
    debug("Asked to get model");
    return this.model;
  };
  setModel(model) {
    this.model = model;
    debug(`New camera model "${model}"`);
    this.emit("model", model);
  };
  detectModel() {
    //debug(`spawn path: ${process.env.PATH}`);
    let instance = this;
    let detectedModel = "No camera detected.";
    const command = GPHOTO2;
    const workingDirectory = this.captureDirectory;
    const args = []; 
    args.push("--auto-detect");
    debug(`${command} ${JSON.stringify(args)}`);
    const spawned = spawn(command, args, { cwd: workingDirectory }).on("error", (err) => { throw err });
    spawned.stdout.setEncoding('utf8');
    spawned.stdout.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      for (let line of lines) {
        if (line.length > 3 && !line.startsWith("Model") && !line.startsWith("-----")) {
          const spaces = line.indexOf("   ");
          if (spaces < 0) {
            detectedModel = line;
          } else {
            detectedModel = line.substring(0,spaces);
          }
        }
      }
    });
    spawned.stderr.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      debug(lines.join("###"));
    });

    spawned.on('close', function (code) {
      debug('process exit code ' + code);
      instance.setModel(detectedModel);
    });

    return this.model;
  };
  takePreview() {
    const command = GPHOTO2;
    const workingDirectory = this.captureDirectory;
    const args = []; 
    args.push("--force-overwrite");
    args.push("--capture-preview");
    debug(`${command} ${JSON.stringify(args)}`);
    const spawned = spawn(command, args, { cwd: workingDirectory }).on("error", (err) => { throw err });
    spawned.stdout.setEncoding('utf8');
    spawned.stdout.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      for (let line of lines) {
        debug(line);
      }
    });
    spawned.stderr.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      debug(lines.join("###"));
    });

    spawned.on('close', function (code) {
      debug('process exit code ' + code);
      debug('Done taking preview');
    });
  };
  takePicture() {
    const command = GPHOTO2;
    const workingDirectory = this.captureDirectory;
    const args = []; 
    args.push("--force-overwrite");
    args.push("--capture-image-and-download");
    debug(`${command} ${JSON.stringify(args)}`);
    const spawned = spawn(command, args, { cwd: workingDirectory }).on("error", (err) => { throw err });
    spawned.stdout.setEncoding('utf8');
    spawned.stdout.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      for (let line of lines) {
        debug(line);
      }
    });
    spawned.stderr.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      debug(lines.join("###"));
    });

    spawned.on('close', function (code) {
      debug('process exit code ' + code);
      debug('Done taking picture');
    });
  };
  checkBattery() {
    let instance = this;
    const command = GPHOTO2;
    const workingDirectory = this.captureDirectory;
    const args = []; 
    let batteryLevel = "___%";
    args.push("--get-config");
    args.push("/main/status/batterylevel");
    debug(`${command} ${JSON.stringify(args)}`);
    const spawned = spawn(command, args, { cwd: workingDirectory }).on("error", (err) => { throw err });
    spawned.stdout.setEncoding('utf8');
    spawned.stdout.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      for (let line of lines) {
        if (line.startsWith("Current: ")) {
          batteryLevel = line.substring(9);
        }
      }
    });
    spawned.stderr.on('data', function (data) {
      const str = data.toString()
      const lines = str.split(/(\r?\n)/g);
      debug(lines.join("###"));
    });

    spawned.on('close', function (code) {
      //debug('process exit code ' + code);
      //debug('Done checking battery');
      camera.setBatteryLevel(batteryLevel);
    });
  }
}

const camera = new Camera();

module.exports = camera;
