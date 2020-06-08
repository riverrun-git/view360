// Vaguely inspired by http://cssdeck.com/labs/ze8jtaqe

// A proper modulo function
function modulo(n, m) {
  return ((n % m) + m) % m;
}

function calculate360ImageSize(width, height, maxWidth, maxHeight) {
  if (width > maxWidth) {
    height /= width/maxWidth;
    width = maxWidth; 
  }
  if (height > maxHeight) {
    width /= height/maxHeight;
    height = maxHeight;
  }
  return {width: Math.round(width), height: Math.round(height)};
}
function displayName(imageName) {
  let display = imageName;
  const ignoreFrom = display.indexOf("?");
  if (ignoreFrom > 0) {
    display = display.substring(0,ignoreFrom);
  }
  return display;
}
const ICON_MARGIN = 10;

class View360 {

  constructor(canvasId, options, imageList, start, end,step) {
    this.canvas = document.getElementById(canvasId);
    this.context = this.canvas.getContext("2d");
    if (Array.isArray(imageList)) {
      this.imageList = imageList;
    } else {
      this.imageList = this.makeImageList(imageList,start, end, step===undefined?1:step);
    }
    this.images = [];
    this.imagesLoaded = 0;
    this.currentFrame = 0;
    this.totalFrames = this.imageList.length;
    this.maxImageWidth = 0;
    this.maxImageHeight = 0;
    this.maxCanvasWidth = options.max_width ? options.max_width : this.canvas.width;
    this.maxCanvasHeight = options.max_height ? options.max_height : this.canvas.height;
    this.normalCanvasWidth = this.maxCanvasWidth;
    this.normalCanvasHeight = this.maxCanvasHeight;
    this.dragging = false;
    this.mouse_inside = false;
    this.fullscreen = false;
    this.icon360 = new Image();
    //this.icon360.src = "/icons/360.png";
    this.icon360.src = "/icons/3d_rotation.png";
    this.iconFullscreen = new Image();
    this.iconFullscreen.src = "/icons/fullscreen.png";
    this.iconFullscreenExit = new Image();
    this.iconFullscreenExit.src = "/icons/fullscreen_exit.png";
    this.currentIcon = undefined;
    this.showFilename = options.showFilename;
    this.onClick = options.onClick;
    this.onImageLoaded = options.onImageLoaded;
    this.onAllLoaded = options.onAllLoaded;
    this.onRotate = options.onRotate;
    // zoom === 0.0: fully zoomed out, zoom === 1.0: fully zoomed in
    this.zoom = 0.0; 
    // centre coordinates of the zoom - in image coordinates
    this.zoomX = 42;
    this.zoomY = 42;
    this.initialSpin = 1;
    this.setup();
  }
  notSupported() {
    console.error("Not supported");
  }
  setup() {
    console.log("setting up canvas");
    this.loadNextImage();
  }
  interpol(start,end,x) {
    return start + (end-start)*x;
  }
  makeImageList(imageList,start,end,step) {
    console.log(`Loop ${start} ${end} ${step}`);
    const list = [];
    for (let index=start; index!=end+step; index+=step) {
      let replaced = imageList.replace(/#+/g, (match) => {
        let number = ""+index;
        while (number.length < match.length) {
          number = "0"+number;
        }
        return number;
      });
      list.push(replaced);
    }
    return list;
  }
  loadNextImage() {
    const image = new Image();
    image.src = this.imageList[this.imagesLoaded];
    image.onload = () => {
      this.imageLoaded();
    }
    this.images[this.imagesLoaded] = image; 
  }
  imageLoaded() {
    const imageWidth = this.images[this.imagesLoaded].width;
    this.maxImageWidth = Math.max(this.maxImageWidth, imageWidth);
    const imageHeight = this.images[this.imagesLoaded].height;
    this.maxImageHeight = Math.max(this.maxImageHeight, imageHeight);
    // adjust size of canvas if necessary
    const adjusted = calculate360ImageSize(this.maxImageWidth, this.maxImageHeight, this.maxCanvasWidth, this.maxCanvasHeight);
    const canvasWidth = Math.min(this.maxImageWidth, this.maxCanvasWidth);
    if (this.canvas.width !== adjusted.width) {
      console.log(`Adjust canvas width to ${adjusted.width}`);
      this.canvas.width = adjusted.width;
      this.normalCanvasWidth = adjusted.width;
    }
    if (this.canvas.height !== adjusted.height) {
      console.log(`Adjust canvas height to ${adjusted.height}`);
      this.canvas.height = adjusted.height;
      this.normalCanvasHeight = adjusted.height;
    }
    this.zoomX = imageWidth / 2;
    this.zoomY = imageHeight / 2;
    this.drawCurrentFrame();
    this.drawProgress(this.currentFrame, this.totalFrames);
    this.imagesLoaded += 1;
    if (this.onImageLoaded) {
      this.onImageLoaded(this.imagesLoaded);
    }
    this.currentFrame += 1;
    if (this.imagesLoaded === this.totalFrames) {
      this.allImagesLoaded();
    } else {
      this.loadNextImage();
    }
  }
  drawCurrentFrame(zoomX=this.zoomX,zoomY=this.zoomY,zoom=this.zoom) {
    const image = this.images[this.currentFrame];
    const canvas = this.canvas;
    this.context.fillStyle = "white";
    this.context.fillRect(0,0,canvas.width,canvas.height);
    if (zoom === 0.0) {
      const adjusted = calculate360ImageSize(image.width,image.height,canvas.width,canvas.height);
      let width = adjusted.width;
      let height = adjusted.height;
      // centre the image in the canvas
      let x = 0;
      let y = 0;
      if (width < canvas.width) {
        x = (canvas.width - width)/2;
      }
      if (height < canvas.height) {
        y = (canvas.height - height)/2;
      }
      this.context.drawImage(image,x,y,width,height);
    } else { // zoom
      // determine where to draw the image
      // first we determine how big the image will be painted
      let width = this.interpol(canvas.width, image.width, zoom);
      let height = this.interpol(canvas.height, image.height, zoom);
      // next we determine where it will be painted
      let x = -zoomX*(width/image.width) + canvas.width/2;
      let y = -zoomY*(height/image.height) + canvas.height/2;
      this.context.drawImage(image,x,y,width,height);
    }
    // draw icon if required
    if (this.currentIcon !== undefined) {
      const icon = this.currentIcon;
      const iconWidth = icon.width;
      const iconHeight = icon.height;
      const x = ICON_MARGIN;
      const y = ICON_MARGIN;
      this.context.drawImage(icon,x,y,iconWidth,iconHeight);
    }
    // display filename if required
    if (this.showFilename) {
      this.context.fillStyle = "black";
      this.context.font = "15px Arial";
      this.context.textAlign = "right";
      let imageName = displayName(this.imageList[this.currentFrame]);
      this.context.fillText(imageName,this.canvas.width - 20, 20);
    }
  }
  drawProgress(current, max) {
    const angle = (ratio) => {
      return ratio*2*Math.PI - Math.PI/2;
    };
    const progress = current / max;
    const canvas = this.canvas;
    const context = this.context;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    let x = width / 2;
    let y = height / 2;
    let innerRadius = 0; // non-zero values not working. Fix if needed
    let outerRadius = Math.max(width,height);
    context.beginPath();
    context.arc(x, y, outerRadius, angle(progress), angle(1.0), false); // Outer: CCW
    context.arc(x, y, innerRadius, angle(progress), angle(1.0), true); // Inner: CW
    context.closePath();
    context.fillStyle = `rgba(0,0,0,0.2)`;
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "black";
    context.stroke();
  }
  notifyRotate() {
    if (this.onRotate) {
      this.onRotate(this.currentFrame,displayName(this.imageList[this.currentFrame]));
    }
  }
  allImagesLoaded() {
    console.log("All images loaded");
    this.currentFrame = 0;
    this.drawCurrentFrame();
    this.notifyRotate();
    this.setupNavigation();
    this.currentIcon = this.icon360;
    this.drawCurrentFrame();
    if (this.onAllLoaded) {
      this.onAllLoaded();
    }
  }
  setZoomCentre(event,image) {
    let x, y;
    if (event !== null) {
      const rect = event.target.getBoundingClientRect();
      x = event.clientX - rect.left; //x position within the element.
      y = event.clientY - rect.top;  //y position within the element.
    } else {
      x = this.canvas.width / 2;
      y = this.canvas.height / 2;
    }
    // Calculate image coordinates of where we clicked
    this.zoomX = x / this.canvas.width * image.width;
    this.zoomY = y / this.canvas.height * image.height;
    this.zoomCenterRangeCheck();
  }
  zoomCenterRangeCheck() {
    if (this.zoomX < this.canvas.width/2) {
      this.zoomX = this.canvas.width/2;
    }
    if (this.zoomX > this.images[this.currentFrame].width - this.canvas.width/2) {
      this.zoomX = this.images[this.currentFrame].width - this.canvas.width/2;
    }
    if (this.zoomY < this.canvas.height/2) {
      this.zoomY = this.canvas.height/2;
    }
    if (this.zoomY > this.images[this.currentFrame].height - this.canvas.height/2) {
      this.zoomY = this.images[this.currentFrame].height - this.canvas.height/2;
    }
  }
  mouseOverIcon = (event) => {
    if (this.currentIcon !== undefined) {
      const icon = this.currentIcon;
      const canvas = this.canvas;
      const boundingRect = canvas.getBoundingClientRect();
      const eventX = event.clientX-boundingRect.left;
      const eventY = event.clientY-boundingRect.top;
      if (eventX > ICON_MARGIN &&
        eventX < ICON_MARGIN + icon.width &&
        eventY > ICON_MARGIN &&
        eventY < ICON_MARGIN + icon.height) { 
        return true;
      }
    }
    return false;
  }
  setMousePointer = (event) => {
    const canvas = this.canvas;
    if (this.mouseOverIcon(event)) {
      canvas.style.cursor = "pointer";
    } else if (this.onClick) {
      canvas.style.cursor = "crosshair";
    } else if (this.zoom === 0.0) {
      canvas.style.cursor = "zoom-in";
    } else {
      canvas.style.cursor = "zoom-out";
    }
  }
  setupNavigation() {
    const canvas = this.canvas;
    let startX = 0;
    let startY = 0;
    canvas.onmouseenter = (event) => {
      this.setMousePointer(event);
      this.mouse_inside = true;
      this.drawCurrentFrame();
      this.currentIcon = this.fullscreen ? this.iconFullscreenExit : this.iconFullscreen;
      canvas.onmousemove = this.setMousePointer;
      this.drawCurrentFrame();
    };
    canvas.onmouseleave = (event) => {
      canvas.style.cursor = "default";
      canvas.onmousemove = null;
      this.dragging = false;
      this.mouse_inside = false;
      this.currentIcon = this.icon360;
      this.drawCurrentFrame();
    }
    canvas.onmousedown = (event) => {
      this.initialSpin = 0;
      canvas.style.cursor = this.zoom ? "move" : "ew-resize";
      startX = event.clientX;
      startY = event.clientY;
      canvas.onmousemove = (event) => {
        event = event || window.event;
        let button = event.which === 1 ? "left" : (event.which ===2 ? "middle" : "right");
        if (this.zoom === 0.0 || button === "middle") {
          const moved = event.clientX - startX;
          if (Math.abs(moved) > 5) {
            this.dragging = true;
            this.currentFrame = modulo(this.currentFrame + Math.sign(moved), this.totalFrames);
            startX = event.clientX;
            this.drawCurrentFrame();
            this.notifyRotate();
          }
        } else { // zoom
          this.dragging = true;
          const movedX = event.clientX - startX;
          const movedY = event.clientY - startY;
          this.zoomX -= movedX;
          this.zoomY -= movedY;
          this.zoomCenterRangeCheck();
          this.drawCurrentFrame();
          startX = event.clientX;
          startY = event.clientY;
        }
      }
      canvas.onwheel = (event) => {
        this.currentFrame = modulo(this.currentFrame + Math.sign(event.deltaY), this.totalFrames);
        this.drawCurrentFrame();
        this.notifyRotate();
        return false;
      }
    }
    canvas.onmouseup = (event)  => {
      this.setMousePointer(event);
      canvas.onmousemove = this.setMousePointer;;
      if (this.zoom === 1.0) {
        const movedX = event.clientX - startX;
        const movedY = event.clientY - startY;
        //this.zoomX -= movedX;
        //this.zoomY -= movedY;
        this.drawCurrentFrame();
      }
    }
    canvas.onclick = (event) => {
      // did the user click on the fullscreen icon?
      const canvas = this.canvas;
      const boundingRect = canvas.getBoundingClientRect();
      const clickX = event.clientX-boundingRect.left;
      const clickY = event.clientY-boundingRect.top;
      const icon = this.fullscreen ? this.iconFullscreenExit : this.iconFullscreen;
      const article = document.getElementsByTagName("article")[0];
      if (this.mouseOverIcon(event)) {
        this.fullscreen = ! this.fullscreen;
        if (this.fullscreen) {
          canvas.width=window.innerWidth;
          canvas.height=window.innerHeight;
          canvas.style.left = 0;
          canvas.style.top = 0;
          canvas.style.position = "fixed";
          canvas.style.margin = 0;
        } else {
          canvas.width = this.normalCanvasWidth;
          canvas.height = this.normalCanvasHeight;
          canvas.style.position = "";
          canvas.style.margin = "";
        }
        this.currentIcon = this.fullscreen ? this.iconFullscreenExit : this.iconFullscreen;
        this.drawCurrentFrame();
      } else {
        if (this.dragging === false && this.onClick) {
          // Calculate image coordinates of where we clicked
          const image = this.images[this.currentFrame];
          const x = clickX / this.canvas.width * image.width;
          const y = clickY / this.canvas.height * image.height;
          this.onClick(x,y);
        } else if (this.dragging === false) {
          const zoomX = this.zoomX;
          const zoomY = this.zoomY;
          if (this.zoom === 0.0) {
            // Enter zoom mode
            this.zoom = 1.0;
            this.setZoomCentre(event,this.images[this.currentFrame]);
            this.performZoom(zoomX, this.zoomX, zoomY, this.zoomY, 0.0, 1.0);
          } else {
            // Leave zoom mode
            this.zoom = 0.0;
            this.setZoomCentre(null, this.images[this.currentFrame]);
            this.performZoom(zoomX, this.zoomX, zoomY, this.zoomY, 1.0, 0.0);
          }
        } else {
          this.dragging = false;
        }
        this.setMousePointer(event);
      }
    }
  }
  removeNavigation() {
    const canvas = this.canvas;
    canvas.onmouseenter = null;
    canvas.onmousemove = null;
    canvas.onmouseleave = null;
    canvas.onmousedown = null;
    canvas.onmouseup = null;
    canvas.onclick = click;
  }

  performZoom(startX, endX, startY, endY, startZoom, endZoom) {
    const steps = 10;
    let step = 0;
    const timer = setInterval(() => {
      if (step < steps) {
        let x = 1/steps*step;
        let zoomX = this.interpol(startX,endX,x);
        let zoomY = this.interpol(startY,endY,x);
        let zoom = this.interpol(startZoom,endZoom,x);
        this.drawCurrentFrame(zoomX,zoomY,zoom);
        step += 1;
      } else {
        this.drawCurrentFrame();
        clearInterval(timer);
      }
    },25);
  }
  spin() {
    const timer = setInterval(() => {
      if (this.initialSpin > 0) {
        this.currentFrame = modulo(this.currentFrame + 1, this.totalFrames);
        if (this.currentFrame === 0) {
          this.initialSpin -= 1;
        }
        this.drawCurrentFrame();
      } else {
        clearInterval(timer);
      }
    }, 100);
  }
}
