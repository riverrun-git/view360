const debug = require("debug")("view360:messaging:messaging360");
const events = require("events");
const riverrun = require("riverrun-server");
const Subscriptions = riverrun.subscriptions;
const RemoteCalls = riverrun.remotecalls;

const TOPIC_TURNTABLE_MODEL = "turntable_model";
const TOPIC_TURNTABLE_COMMAND = "turntable_command";
const TOPIC_TURNTABLE_OK = "turntable_ok";
const TOPIC_TURNTABLE_EVENT = "turntable_event";
const TOPIC_CAMERA_IMAGES = "camera_images";
const TOPIC_CAMERA_PREVIEW = "camera_preview";
const TOPIC_PROJECT_IMAGES = "project_images";
const TOPIC_PROJECT_DIRECTORIES = "project_directories";
const TOPIC_CROP_PROGRESS = "crop_progress";
const TOPIC_ENHANCE_PROGRESS = "enhance_progress";
const TOPIC_CAMERA_MODEL = "camera_model";
const TOPIC_CAMERA_BATTERY = "camera_battery";
const TOPIC_ENHANCED_IMAGE_READY = "enhanced_image_ready";

let turntableModel = "Not connected";
let cameraModel = "No camera detected";
let cameraBatteryLevel = "___%";
//let turntable = null;
let previewImage = "";
let cameraImages = [];
let projectImages = [];
let projectDirectories = [];

function makePattern(topic) {
  return new RegExp(`^${topic}$`);
}
class Messaging360 extends events.EventEmitter {
  constructor() {
    super();
    let pattern = makePattern(TOPIC_TURNTABLE_MODEL);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.turntableModelPublisher);
    }
    pattern = makePattern(TOPIC_TURNTABLE_COMMAND);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.turntableCommandPublisher);
    }
    pattern = makePattern(TOPIC_TURNTABLE_OK);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.turntableOkPublisher);
    }
    pattern = makePattern(TOPIC_TURNTABLE_EVENT);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.turntableEventPublisher);
    }
    pattern = makePattern(TOPIC_CAMERA_IMAGES);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.cameraImagePublisher);
    }
    pattern = makePattern(TOPIC_CAMERA_PREVIEW);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.cameraPreviewPublisher);
    }
    pattern = makePattern(TOPIC_PROJECT_IMAGES);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.projectImagePublisher);
    }
    pattern = makePattern(TOPIC_PROJECT_DIRECTORIES);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.projectDirectoriesPublisher);
    }
    pattern = makePattern(TOPIC_CROP_PROGRESS);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.cropProgressPublisher);
    }
    pattern = makePattern(TOPIC_ENHANCE_PROGRESS);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.enhanceProgressPublisher);
    }
    pattern = makePattern(TOPIC_CAMERA_MODEL);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.cameraModelPublisher);
    }
    pattern = makePattern(TOPIC_CAMERA_BATTERY);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.cameraBatteryPublisher);
    }
    pattern = makePattern(TOPIC_ENHANCED_IMAGE_READY);
    if (!Subscriptions.getPatternPublisher(pattern)) {
      debug(`publish ${pattern}`);
      Subscriptions.publish(pattern, this.enhancedImageReadyPublisher);
    }
  };
  registerMethod(name, method) {
    RemoteCalls.registerMethod(name, method); 
  }

  turntableModelPublisher() {
    return new Promise((resolve, reject) => {
      resolve(turntableModel);
    });
  }
  cameraModelPublisher() {
    return new Promise((resolve, reject) => {
      resolve(cameraModel);
    });
  }
  cameraBatteryLevelPublisher() {
    return new Promise((resolve, reject) => {
      resolve(cameraBatteryLevel);
    });
  }
  turntableCommandPublisher() {
    return new Promise((resolve, reject) => {
      // we don't remember past commands. Just send empty string
      resolve("");
    });
  }
  turntableOkPublisher() {
    return new Promise((resolve, reject) => {
      // we don't remember past OKs. Just send empty string
      resolve("");
    });
  }
  turntableEventPublisher() {
    return new Promise((resolve, reject) => {
      // we don't remember past events. Just send empty string
      resolve("");
    });
  }
  cameraImagePublisher() {
    return new Promise((resolve, reject) => {
      //resolve(`Published ${cameraImages.length} images`);
      resolve(cameraImages);
    });
  }
  cameraPreviewPublisher() {
    return new Promise((resolve, reject) => {
      resolve(previewImage);
    });
  }
  projectImagePublisher() {
    return new Promise((resolve, reject) => {
      //resolve(`Published ${cameraImages.length} images`);
      resolve(projectImages);
    });
  }
  projectDirectoriesPublisher() {
    return new Promise((resolve, reject) => {
      resolve(projectDirectories);
    });
  }
  cropProgressPublisher () {
    return new Promise((resolve, reject) => {
      // we don't remember progress events. Just send empty string
      resolve({so_far: 0, total: 42});
    });    
  }
  enhanceProgressPublisher () {
    return new Promise((resolve, reject) => {
      // we don't remember progress events. Just send empty string
      resolve({so_far: 0, total: 42});
    });    
  }
  enhancedImageReadyPublisher() {
    return new Promise((resolve,reject) => {
      resolve("");
    });
  }
  publishTurntableModel(newModel) {
    debug(`NEW MODEL ${newModel}`);
    turntableModel = newModel;
    //const model = await this.turntableModelPublisher();
    Subscriptions.updateTopic(TOPIC_TURNTABLE_MODEL, newModel);
  }
  publishCameraModel(newModel) {
    debug(`New camera model ${newModel}`);
    cameraModel = newModel;
    Subscriptions.updateTopic(TOPIC_CAMERA_MODEL, newModel);
  }
  publishCameraBatteryLevel(level) {
    debug(`Update topic camera battery level ${level}`);
    cameraBatteryLevel = level;
    Subscriptions.updateTopic(TOPIC_CAMERA_BATTERY, cameraBatteryLevel);
  }
  publishTurntableCommand(newCommand) {
    Subscriptions.updateTopic(TOPIC_TURNTABLE_COMMAND, newCommand);
  }
  publishTurntableOK(newCommand) {
    Subscriptions.updateTopic(TOPIC_TURNTABLE_OK, "OK");
  }
  publishTurntableEvent(newEvent) {
    Subscriptions.updateTopic(TOPIC_TURNTABLE_EVENT, newEvent);
  }
  publishCameraImages(newImages) {
    cameraImages = newImages;
    Subscriptions.updateTopic(TOPIC_CAMERA_IMAGES, cameraImages);
  }
  publishCameraPreview(newImage) {
    previewImage = newImage;
    Subscriptions.updateTopic(TOPIC_CAMERA_PREVIEW, previewImage);
    debug(`PREVIEW ${previewImage} published.`);
  }
  publishProjectImages(newImages) {
    projectImages = newImages;
    Subscriptions.updateTopic(TOPIC_PROJECT_IMAGES, projectImages);
  }
  publishProjectDirectories(newDirectories) {
    projectDirectories = newDirectories;
    Subscriptions.updateTopic(TOPIC_PROJECT_DIRECTORIES, projectDirectories);
  }
  publishCropProgress(crop_progress) {
    Subscriptions.updateTopic(TOPIC_CROP_PROGRESS, crop_progress);
    debug(`Crop progress published: ${crop_progress}`);
  }
  publishEnhanceProgress(enhance_progress) {
    Subscriptions.updateTopic(TOPIC_ENHANCE_PROGRESS, enhance_progress);
    debug(`Enhance progress published: ${enhance_progress}`);
  }
  publishEnhancedImageReady(image) {
    Subscriptions.updateTopic(TOPIC_ENHANCED_IMAGE_READY,image);
    debug(`Enhanced image ready published: ${image}`);
  }

  setTurntable(newTurntable) {
    //turntable = newTurntable;
    //debug(`New turntable set ${turntable}`);
  }
}

const messaging360 = new Messaging360();

module.exports = messaging360;
module.exports.publishTurntableModel = messaging360.publishTurntableModel;
module.exports.publishTurntableCommand = messaging360.publishTurntableCommand;
module.exports.publishTurntableOK = messaging360.publishTurntableOK;
module.exports.publishTurntableEvent = messaging360.publishTurntableEvent;
module.exports.publishCameraImages = messaging360.publishCameraImages;
module.exports.publishProjectDirectories = messaging360.publishProjectDirectories;
module.exports.publishCropProgress = messaging360.publishCropProgress;
module.exports.publishEnhanceProgress = messaging360.publishEnhanceProgress;
module.exports.publishEnhancedImageReady = messaging360.publishEnhancedImageReady;
module.exports.setTurntable = messaging360.setTurntable;
module.exports.setImageDirectory = messaging360.setImageDirectory;
