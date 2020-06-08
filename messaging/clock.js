const debug = require("debug")("app:messaging:clock");
const events = require("events");
const riverrun = require("riverrun-server");
const Subscriptions = riverrun.subscriptions;
const RemoteCalls = riverrun.remotecalls;
const moment = require("moment");

class Clock extends events.EventEmitter {
  constructor(interval) {
    super();
    this.interval = interval;
    this.pattern = /^time$/;
    this.topic = "time";
    this. ONE_SECOND = 1000;
    this.ONE_MINUTE = 60 * this.ONE_SECOND;
    this.ONE_HOUR = 60 * this.ONE_MINUTE;
    //RemoteCalls.registerMethod("timezone", this.timeZoneMethod);
  };
  

  getTopicInvalid() {
    return this.topic;
  }
  isValidTimeString(time) {
    return /[0-2][0-9]:[0-5][0-9]:[0-5][0-9]/.test(time);
  }
  timeUntilNextInterval(now, interval)  {
    debug("Time now: "+now);
    const timeSinceLastInterval = now % interval;
    debug("Time since last interval "+timeSinceLastInterval);
    let time = interval - timeSinceLastInterval;
    if (time < interval / 15) {
      time += interval;
    }
    debug("Wait time: " + time);
    return time;
  };
  publisher() {
    return new Promise((resolve, reject) => {
      debug("calling clock publisher");
      // do a bit of rounding up, so that 00:00:59.999 shows up as 00:01:00
      let time = moment().add(500, "milliseconds").format("HH:mm:ss");
      resolve(time);
    });
  };
  // publish the time every so often
  async run(interval) {
    debug(`Clock interval is ${interval}`);
    if (interval <= 0) {
      // stop the clock and unpublish
      Subscriptions.unpublish(this.pattern);
      return null;
    } else {
      // are we publishing yet?
      if (!Subscriptions.getPatternPublisher(this.pattern)) {
        debug("publish");
        Subscriptions.publish(this.pattern, this.publisher);
      }
      debug("update");
      const time = await this.publisher();
      Subscriptions.updateTopic("time", time);
      // schedule next run
      const now = new Date().getTime();
      const waitTime = this.timeUntilNextInterval(now, interval);
      setTimeout(() => { this.run(interval); }, waitTime);
      return time;
    }
  };
  timeZoneMethod() { 
    return new Promise((resolve, reject) => {
      resolve(Intl.DateTimeFormat().resolvedOptions().timeZone);
    });
  };
}

const clock = new Clock();

module.exports = clock;