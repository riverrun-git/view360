// In shell: export DEBUG="view360:index:* riverrun-turntable:*"
const debug = require("debug")("view360:index");
const riverrun = require("riverrun-server");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const process = require("process");
const spawn = require('child_process').spawn;
const chokidar = require("chokidar");
const path = require("path");
const app = riverrun.app;
const os = require('os');

const CPU_COUNT = os.cpus().length;
debug(`Running on ${CPU_COUNT} CPUs`);

const HOME_DIRECTORY = os.homedir();
debug(`HOME DIRECTORY: ${HOME_DIRECTORY}`);
const CAPTURE_DIRECTORY = HOME_DIRECTORY+"/Pictures/Capture/";
debug(`CAPTURE DIRECTORY: ${CAPTURE_DIRECTORY}`);
const WORKING_DIRECTORY = HOME_DIRECTORY+"/Turntable/";
debug(`IMAGE DIRECTORY: ${WORKING_DIRECTORY}`);
const TMP_DIRECTORY = HOME_DIRECTORY+"/tmp/";
const CAPTURE_IMAGE_PATTERN = /^capt\d{4}\.jpg$/;
const PREVIEW_IMAGE_PATTERN = /^capture_preview.jpg$/;
const IMAGE_PATTERN = /^(image|IMG)_\d{4}\.(jpg|JPG)$/;
const CROPPED_IMAGE_PATTERN = /^(image|IMG)_\d{4}_crop\.(jpg|JPG)$/;
let PROJECT_DIRECTORY = null;
let PROJECT = null;

function cleanupPreviewFiles() {
  debug("Do the preview cleanup");
  fs.readdir(WORKING_DIRECTORY, function (err, files) {
    debug("Working directory read");
    //handling error
    if (err) {
      debug("Unable to return directory " + err);
      return;
    }
    let files_deleted = 0;
    //listing all files using forEach
    files.forEach(function (file) {
      // Delete all image files
      if (file.match(PREVIEW_IMAGE_PATTERN)) {
        debug(`Deleting preview ${file}`);
        try {
          fs.unlinkSync(WORKING_DIRECTORY + file);
          //file removed
          files_deleted += 1;
        } catch (err) {
          return;
        }
      }
    });
    debug(`Deleted ${files_deleted} preview files.`);
  });
}
cleanupPreviewFiles();
const camera = require("./camera");
camera.on("directory", (directory) => {
  debug("on directory change");
});
camera.setCaptureDirectory(CAPTURE_DIRECTORY);
camera.monitorBatteryLevel();

camera.on("model", (model) => {
  debug("on new camera model");
  messaging360.publishCameraModel(model);
});
camera.on("battery", (level) => {
  debug("on battery "+level);
  messaging360.publishCameraBatteryLevel(level);
});
let previewActive = false;

const turntable = require("riverrun-turntable");
const TURNTABLE = turntable.TURNTABLE;
turntable.on("*", (event, data) => {
  //debug(`EVENT: ${event} DATA: ${data ? data.toString() : data}`);
});
turntable.on("connect", () => {
  debug("Connected to turntable");
  messaging360.publishTurntableModel("Connected");
});
turntable.on("ok", () => {
  debug("Turntable says OK");
  messaging360.publishTurntableOK();
});
turntable.on("error", (number, message) => {
  debug(`Turntable ERROR ${number}: ${message}`);
});
let beat = 0;
turntable.on("heartbeat", () => {
  // wait for a couple of heartbeats
  debug("Heartbeat");
  beat += 1;
  if (beat === 2) {
    turntable.mute();
    turntable.model();
    //turntable.command("CT+GETEBC();");
    //turntable.command("CT+GETFWV();");
    //turntable.command("CT+GETTBSPEED();");
    //turntable.command("CT+GETTBCONFIG();");
  }
  if (beat > 5) {
    turntable.on("heartbeat", undefined);
  }
});
turntable.on("command", (command) => {
  debug(`Turntable command ${command}`);
  messaging360.publishTurntableCommand(command);
});
turntable.on("event", (event) => {
  debug(`Turntable event ${event}`);
  messaging360.publishTurntableEvent(event);
  if (event === "TB_END") {
    // turntable has stopped. Next action
  }
});
turntable.on("model", (model) => {
  debug(`Turntable PN: ${model}`);
  messaging360.publishTurntableModel(model);
});

const silence = () => {
  turntable.command()
}
const start_shooting_deprecated = () => {
  debug("GO!");
  //turntable.shoot(true, true);
  camera.takePicture();
}

const projectDirectories = new Set();

const workingImageFiles = new Set();

const watchForWorkingFiles = () => {
  // Initialize watcher.
  const cameraFileWatcher = chokidar.watch(WORKING_DIRECTORY, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: false,
    depth: 0
  });
  cameraFileWatcher.on('add', file_path => {
    debug(`Working file ${file_path} has been added`);
    // publish file name
    const filename = path.basename(file_path);
    if (filename.match(IMAGE_PATTERN)) {
      workingImageFiles.add(filename);
      messaging360.publishCameraImages(Array.from(workingImageFiles.values()));
    } else if (filename.match(PREVIEW_IMAGE_PATTERN)) {
      debug("NEW PREVIEW IMAGE");
      messaging360.publishCameraPreview(filename);
    } else {
      debug(`... but ${filename} it is no match for ${IMAGE_PATTERN} or ${PREVIEW_IMAGE_PATTERN}`);
    }
  }).on('change', file_path =>  {
    debug(`File ${file_path} has been changed`);
    const filename = path.basename(file_path);
    if (filename.match(PREVIEW_IMAGE_PATTERN)) {
      debug("UPDATED PREVIEW IMAGE");
      messaging360.publishCameraPreview(filename);
      setTimeout(() => {
        if (previewActive) {
          camera.takePreview();
        } else {
          messaging360.publishCameraPreview("");
        }
      }, 1000);
    } else {
      debug(`... but ${filename} it is no match for ${PREVIEW_IMAGE_PATTERN}`);
    }
  }).on('unlink', file_path => { 
    debug(`File ${file_path} has been removed`);
    const filename = path.basename(file_path);
    if (filename.match(IMAGE_PATTERN)) {
      debug("File is image.. delete from list");
      workingImageFiles.delete(filename);
      debug("Publish");
      messaging360.publishCameraImages(Array.from(workingImageFiles.values()));
      debug("Done");
    }
  }).on('addDir', dir_path => {
    debug(`Directory ${dir_path} has been added`);
    // publish dir name
    if (dir_path !== WORKING_DIRECTORY) {
      const dirname = path.basename(dir_path);
      projectDirectories.add(dirname);
      //projectDirectories.sort();
      messaging360.publishProjectDirectories(Array.from(projectDirectories.values()));
    }
  }).on('unlinkDir', dir_path => {
    debug(`Directory ${dir_path} has been removed`);
    const dirname = path.basename(dir_path);
    projectDirectories.delete(dirname);
    messaging360.publishProjectDirectories(Array.from(projectDirectories.values()));
  });
}

const watchForCapturedFiles = () => {
  // Initialize watcher.
  const cameraFileWatcher = chokidar.watch(CAPTURE_DIRECTORY, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: false,
    depth: 0
  });
  debug(`WATCHING ${CAPTURE_DIRECTORY}`);
  cameraFileWatcher.on('add', file_path => {
    debug(`File ${file_path} has been added`);
    // publish file name
    const filename = path.basename(file_path);
    if (filename.match(CAPTURE_IMAGE_PATTERN)) {
      try {
        const imagesSoFar = workingImageFiles.size;
        const nextImageNumber = ("0000"+(imagesSoFar+1)).slice(-4);
        const newFileName = WORKING_DIRECTORY+"image_"+nextImageNumber+".jpg";
        debug(`CAPTURED ${filename} - MOVE IT TO ${newFileName}`);
        fs.rename(file_path,newFileName, (err) => {
          debug("RENAME done");
        });
      } catch (err) {
        debug("EXCEPTION ",err);
      }
    } else if (filename.match(PREVIEW_IMAGE_PATTERN)) {
      const newFileName = WORKING_DIRECTORY+filename;
      debug(`PREVIEW ${filename} - MOVE IT TO ${newFileName}`);
      fs.rename(file_path, newFileName, (err) => {
        debug("RENAME done.");
      });
    } else {
      debug(`What is ${filename}?`);
    }
  }).on('unlink', file_path => { 
    debug(`File ${file_path} has been removed`);
    const filename = path.basename(file_path);
    if (filename.match(CAPTURE_IMAGE_PATTERN)) {
      debug(`DELETED ${filename}`);
    }
  })
}

let projectFiles = new Set();
let projectFileWatcher = null;
const watchForProjectFiles = () => {
  if (projectFileWatcher) {
    projectFileWatcher.close();
  }
  // Initialize watcher.
  projectFileWatcher = chokidar.watch(PROJECT_DIRECTORY, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: false,
    depth: 0
  });
  projectFileWatcher.on('add', file_path => {
    debug(`Project file ${file_path} has been added`);
    // publish file name
    const filename = path.basename(file_path);
    if (filename.match(IMAGE_PATTERN)) {
      projectFiles.add(`/${PROJECT}/${filename}`);
      messaging360.publishProjectImages(Array.from(projectFiles.values()));
    }
  }).on('unlink', file_path => { 
    debug(`Project file ${file_path} has been removed`);
    const filename = path.basename(file_path);
    if (filename.match(IMAGE_PATTERN)) {
      debug("File is image.. delete from list");
      projectFiles.delete(`/${PROJECT}/${filename}`);
      //debug("Publish");
      messaging360.publishProjectImages(Array.from(projectFiles.values()));
      //debug("Done");
    }
  });
}


riverrun.socketServer.use((socket, next) => {
  debug(`New socket connection ${socket.id}`);
  socket.use((packet, next) => {
    debug(`Packet for socket ${socket.id}`);
    if (packet[0] === "dong") {
      socket.emit("fail", "Don't dong");
    }
    next();
  });
  next();
});
// Two static directories - first for icons
app.use(express.static("./public"));
// second for generated images
app.use(express.static(`${WORKING_DIRECTORY}`));
app.set("view engine", "ejs");
const route360 = require("./routes/360");
app.use("/360/", route360);

const messaging360 = require("./messaging/messaging360");
messaging360.setTurntable(turntable);
messaging360.registerMethod("cleanup", cleanupMethod);
messaging360.registerMethod("select_project", selectProjectMethod);
messaging360.registerMethod("preview", previewMethod);
messaging360.registerMethod("shoot", shootMethod);
messaging360.registerMethod("rotate", rotateMethod);
messaging360.registerMethod("combine_images", combineImagesMethod);
messaging360.registerMethod("crop_images", cropImagesMethod);
messaging360.registerMethod("enhance_image", enhanceImageMethod);
messaging360.registerMethod("enhance_all_images", enhanceAllImagesMethod);
messaging360.registerMethod("copy_images", copyImagesMethod);

function cleanupMethod({name}) {
  cleanupPreviewFiles();
  debug(`CLEANUP method`);
  return new Promise((resolve, reject) => {
    debug("Do the cleanup first");
    fs.readdir(WORKING_DIRECTORY, function (err, files) {
      debug("Image directory read");
      //handling error
      if (err) {
        debug("No scan " + err);
        reject('Unable to scan directory: ' + err);
      }
      let files_deleted = 0;
      //listing all files using forEach
      files.forEach(function (file) {
        // Delete all image files
        if (file.match(IMAGE_PATTERN)) {
          debug(`Deleting ${file}`);
          try {
            fs.unlinkSync(WORKING_DIRECTORY + file);
            //file removed
            files_deleted += 1;
          } catch (err) {
            reject(err);
          }
        }
      });
      resolve(`Deleted ${files_deleted} files.`);
    });
  });
}
function selectProjectMethod({name}) {
  debug(`SELECT PROJECT method`);
  return new Promise((resolve, reject) => {
    // Try to create a folder for the new project
    PROJECT = name;
    PROJECT_DIRECTORY = `${WORKING_DIRECTORY}${name}/`;
    debug(`New project directory: ${PROJECT_DIRECTORY}`);
    projectFiles = new Set();
    if (!name) {
      messaging360.publishProjectImages(Array.from(projectFiles.values()));
      resolve({name: name});
    } else if (fs.existsSync(PROJECT_DIRECTORY) === false) {
      reject(`Directory ${PROJECT_DIRECTORY} does not exist.`);
    } else {
      watchForProjectFiles();
      resolve({name: name});
    }
  });
}
function shootMethod() {
  debug(`SHOOT method`);
  return new Promise((resolve, reject) => {
    debug("PROMISED");
    if (camera != null) {
      camera.takePicture();
      resolve(`Camera taking picture`);
    } else {
      debug("Camera is NULL");
      reject(`Camera is null`);
    }
  });
};

function previewMethod({active}) {
  debug(`PREVIEW method active: ${active}`);
  previewActive = active;
  return new Promise((resolve, reject) => {
    debug("PROMISED");
    if (camera != null) {
      if (previewActive) {
        camera.takePreview();
        resolve(`Camera taking preview`);
      } else {
        resolve(`Turning off preview mode`);
      }
    } else {
      debug("Camera is NULL");
      reject(`Camera is null`);
    }
  });
};

function rotateMethod({ direction, angle }) {
  debug(`ROTATE method Direction ${direction}, anngle ${angle} ${turntable}`);
  return new Promise((resolve, reject) => {
    if (turntable != null) {
      debug("Turntable is SET");
      turntable.turn(direction, angle);
      resolve(`Turn table ${direction} angle ${angle}`);
    } else {
      debug("Turntable is NULL");
      reject(`Turntable is null`);
    }
  })
}

function combineImagesMethod({number,invert}) {
  debug(`COMBINE method ${typeof number} ${number} invert-${invert}`);
  return new Promise((resolve, reject) => {
    try {
      if (turntable != null) {
        debug(`Turntable is SET direcoriy is ${PROJECT_DIRECTORY}`);
        // Do the work - combine images
        const combined_file_name = `combined-${number}${invert?"-inverted":""}.jpg`
        // Does the file already exist?
        if (fs.existsSync(`${PROJECT_DIRECTORY}${combined_file_name}`) === true) {
          debug(`${PROJECT_DIRECTORY}${combined_file_name} exists`);
          resolve({ stage: "combined", cache: true, file: `${PROJECT}/${combined_file_name}` });
        } else {
          debug(`${PROJECT_DIRECTORY}${combined_file_name} does not exist`);
        const image_files = []
        fs.readdir(PROJECT_DIRECTORY, function (err, files) {
          //handling error
          if (err) {
            reject('Unable to scan directory: ' + err); $
          }
          //listing all files using forEach
          files.forEach(function (file) {
            if (file.match(IMAGE_PATTERN)) {
              image_files.push(file);
            }
          });
          image_files.sort();
          let one_picture_every = Math.floor(image_files.length / number);
          debug(`Pick one every ${one_picture_every} images`);
          // first make a combination picture of all the images
          const outputDirectory = PROJECT_DIRECTORY; // process.cwd() + "/public/output";
          let command = "convert";
          const args = [];
          args.push("-verbose");
          for (let index = 0; index < image_files.length; index++) {
            if (number === 0 || index % one_picture_every === 0) {
              args.push(image_files[index]);
            }
          }
          if (invert) {
            args.push("-negate");
          }
          args.push("-background"); args.push("white");
          args.push("-compose"); args.push("darken");
          args.push("-flatten");
          args.push(`${outputDirectory}${combined_file_name}`);
          debug(`SPAWN: ${command} ${args.join(' ')}`);
          const spawned = spawn(command, args, { cwd: PROJECT_DIRECTORY });
          spawned.stdout.setEncoding('utf8');
          spawned.stdout.on('data', function (data) {
            const str = data.toString()
            const lines = str.split(/(\r?\n)/g);
            debug(lines.join(""));
          });
          spawned.stderr.on('data', function (data) {
            const str = data.toString()
            const lines = str.split(/(\r?\n)/g);
            debug(lines.join(""));
          });

          spawned.on('close', function (code) {
            debug('process exit code ' + code);
            if (code === 0) {
              resolve({ stage: "combined", file: `${PROJECT}/${combined_file_name}` });
            } else {
              resolve("Combine " + code);
            }
          });
        });
        }
      } else {
        debug("Turntable is NULL");
        reject(`Turntable is null`);
      }
    } catch (err) {
      console.error(err);
      reject("Exception " + err);
    }
  });
}

function cropImagesMethod({crop_w, crop_h, crop_x, crop_y}) {
  return new Promise((resolve, reject) => {
    try {
      const image_files = []
      fs.readdir(PROJECT_DIRECTORY, function (err, files) {
        //handling error
        if (err) {
          reject('Unable to scan directory: ' + err); $
        }
        //listing all files using forEach
        for (let file of files) {
          if (file.match(IMAGE_PATTERN)) {
            image_files.push(file);
          }
        }
        image_files.sort();
        messaging360.publishCropProgress({done: 0, total: image_files.length, file: ""});
        files_cropped = 0;
        cropImages(image_files, crop_w, crop_h, crop_x, crop_y,image_files.length,resolve,reject);
      });
    } catch (err) {
      console.error(err);
      reject("Exception " + err);
    }
  });
}

function enhanceImageMethod({image, whitebalance_x, whitebalance_y,ref_colour, sharpen, contrast}) {
  return new Promise((resolve, reject) => {
    try {
      enhanceImage(image, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast);
    } catch (err) {
      console.error(err);
      reject("Exception " + err);
    }
  });
}

function enhanceAllImagesMethod({whitebalance_x, whitebalance_y,ref_colour, sharpen, contrast}) {
  return new Promise((resolve, reject) => {
    try {
      enhanceAllImages(whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast);
    } catch (err) {
      console.error(err);
      reject("Exception " + err);
    }
  });
}

function copyImagesMethod({project}) {
  return new Promise((resolve, reject) => {
    if (project !== PROJECT) {
      reject(`Project name mismatch ${PROJECT} !== ${project}`);
    } else {
      // copy the files from working directory to project directory
      let files_copied = 0;
      try {
        fs.readdir(WORKING_DIRECTORY, function (err, files) {
          //handling error
          if (err) {
            reject('Unable to scan directory: ' + err); $
          }
          for (let file of files) {
            if (file.match(IMAGE_PATTERN)) {
              // copy the file
              fs.copyFileSync(`${WORKING_DIRECTORY}${file}`, `${PROJECT_DIRECTORY}${file}`);
              files_copied += 1;
            }
          }
          resolve(`Copied ${files_copied} file${files_copied == 1 ? "":"s"} to ${project}`);
        });
      } catch (err) {
        console.error(err);
        reject("Exception " + err);
      }
    }
  });
}

let files_cropped = 0;
function cropImages(imageFiles, crop_w, crop_h, crop_x, crop_y, totalImages, resolve, reject) {
  const crop = `${crop_w}x${crop_h}+${crop_x}+${crop_y}`;
  if (imageFiles.length == 0) {
    // we're all done
    resolve(`Cropped! ${files_cropped} images to ${crop}`);
    return;
  }
  const imageFile = imageFiles.shift();
  let basename = path.basename(imageFile, '.JPG');
  basename = path.basename(basename, '.jpg');
  const cropped_file = `${basename}_crop.jpg`;
  debug(`Cropping ${basename} to ${crop}`);
  let command = "convert";
  let args = [];
  args.push("-crop"); args.push(crop);
  args.push(imageFile);
  args.push(cropped_file);
  debug(`SPAWN: ${command} ${args.join(' ')}`);
  const cropper = spawn(command , args, { cwd: PROJECT_DIRECTORY });
  cropper.stdout.on('data', (data) => {
    debug(`stdout: ${data}`);
  });
  cropper.stderr.on('data', (data) => {
    debug(`stderr: ${data}`);
  });
  cropper.on('close', (code) => {
    debug(`Cropped ${basename} exits with ${code}`);
    if (code !== 0) {
      reject(`${basename} falied to crop`);
      return;
    }
    files_cropped += 1;
    messaging360.publishCropProgress({done: files_cropped, total: totalImages, file: `/${path.basename(PROJECT_DIRECTORY)}/${cropped_file}`});
    cropImages(imageFiles, crop_w, crop_h, crop_x, crop_y, totalImages, resolve, reject);
  });
  debug(`Started processing ${basename}`);
}

function enhanceImage(image, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast) {
  const basename = path.basename(image);
  const enhanced_image = "enhanced.jpg";
  enhanceOneImage(basename,enhanced_image, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, (result_image) => {
      messaging360.publishEnhancedImageReady({image: `/${path.basename(PROJECT_DIRECTORY)}/${result_image}`});
  });
}
function enhanceOneImage(inputImage,outputImage, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, callback) {
  let command = "whitebalance";
  const balanced_image = "balanced.jpg";
  let args = [];
  args.push(`${whitebalance_x},${whitebalance_y}`);
  args.push("-r");
  args.push(ref_colour);
  args.push(inputImage);
  args.push(balanced_image);
  debug(`SPAWN: ${command} ${args.join(' ')}`);
  const balancer = spawn(command, args, { cwd: PROJECT_DIRECTORY });
  balancer.stdout.on('data', (data) => {
    debug(`stdout: ${data}`);
  });
  balancer.stderr.on('data', (data) => {
    debug(`stderr: ${data}`);
  });
  balancer.on('close', (code) => {
    debug(`Balanced ${inputImage} exits with ${code}`);
    if (code !== 0) {
      reject(`${inputImage} falied to balance`);
      return;
    }
    // now other enhancements
    command = "convert";
    args = [];
    if (sharpen === true) {
      args.push("-sharpen"); args.push("0x3");
    }
    if (contrast !== undefined) {
      const contrast_amount = parseInt(contrast, 10);
      if (contrast_amount !== 0) {
        let sign = Math.sign(contrast_amount);
        for (let count = Math.abs(contrast_amount); count > 0; count -= 1) {
          args.push((sign > 0 ? "-" : "+")+"contrast");
        }
      }
    }
    args.push(balanced_image);
    args.push(outputImage);
    debug(`SPAWN: ${command} ${args.join(' ')}`);
    const enhancer = spawn(command, args, { cwd: PROJECT_DIRECTORY });
    enhancer.stdout.on('data', (data) => {
      debug(`stdout: ${data}`);
    });
    enhancer.stderr.on('data', (data) => {
      debug(`stderr: ${data}`);
    });
    enhancer.on('close', (code) => {
      debug(`Enhanced ${balanced_image} exits with ${code}`);
      if (code !== 0) {
        reject(`${balanced_image} falied to enhance`);
        return;
      }
      callback(outputImage);
    });
  });
}

let files_enhanced;
function enhanceAllImages(whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast) {
  return new Promise((resolve, reject) => {
    try {
      const cropped_image_files = []
      fs.readdir(PROJECT_DIRECTORY, function (err, files) {
        //handling error
        if (err) {
          reject('Unable to scan directory: ' + err); $
        }
        //listing all files using forEach
        for (let file of files) {
          if (file.match(CROPPED_IMAGE_PATTERN)) {
            cropped_image_files.push(file);
          }
        }
        cropped_image_files.sort();
        messaging360.publishEnhanceProgress({done: 0, total: cropped_image_files.length, file: ""});
        files_enhanced = 0;
        enhanceImages(cropped_image_files, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, cropped_image_files.length, resolve, reject);
      });
    } catch (err) {
      console.error(err);
      reject("Exception " + err);
    }
  });
}

function enhanceImages(cropped_image_files, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, totalImages, resolve, reject) {
  if (cropped_image_files.length == 0) {
    // we're all done
    resolve(`Enhanced! ${files_enhanced} images`);
    return;
  }
  const imageFile = cropped_image_files.shift();
  enhanceOneImage(imageFile,"enhanced.jpg", whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, (enhancedImage) => {
    const webp_file = path.basename(imageFile,"_crop.jpg")+".webp";
    // last step - convert to webp
    command = "cwebp";
    args = [];
    args.push("-quiet"); args.push("-q"); args.push("50");
    args.push(enhancedImage);
    args.push("-o"); args.push(webp_file);
    const converter = spawn(command, args, { cwd: PROJECT_DIRECTORY });
    converter.stdout.on('data', (data) => {
      debug(`stdout: ${data}`);
    });
    converter.stderr.on('data', (data) => {
      debug(`stderr: ${data}`);
    });
    converter.on('close', (code) => {
      debug(`Converted ${enhancedImage} exits with ${code}`);
      if (code !== 0) {
        reject(`${enhancedImage} falied to convert`);
        return;
      }
      files_enhanced += 1;
      debug(`DONE ENHANCING ${imageFile} => ${enhancedImage} => ${webp_file}`);
//TODO Notify!
      messaging360.publishEnhanceProgress({done: files_enhanced, total: totalImages, file: `/${path.basename(PROJECT_DIRECTORY)}/${webp_file}`});
      enhanceImages(cropped_image_files, whitebalance_x, whitebalance_y, ref_colour, sharpen, contrast, totalImages, resolve, reject);
    });
  });
}

watchForWorkingFiles();
watchForCapturedFiles();
turntable.connect();
debug("READY");
