const socketClient = require('socket.io-client');
const riverrun = require("riverrun-server");
const clock = require("../../messaging/clock");
const subscriptions = riverrun.subscriptions;

let socket;
let webServer = riverrun.webServer;
let webServerPort = webServer.address().port;
let socketServer = riverrun.socketServer;

const interval = 1000; // ms
/**
 * Setup WS & HTTP servers
 */
beforeAll((done) => {
  done();
});

/**
 *  Cleanup WS & HTTP servers
 */
afterAll((done) => {
  socketServer.close();
  webServer.destroy(() => {
    done();
  });
});

/**
 * Run before each test
 */
beforeEach((done) => {
  subscriptions.init();
  const url = `http://127.0.01:${webServerPort}`;
  socket = socketClient.connect(url, {
    'reconnection delay': 0,
    'reopen delay': 0,
    'force new connection': true
    //transports: ['websocket'],
  });
  socket.on('connect', () => {
    done();
  });
});

/**
 * Run after each test
 */
afterEach((done) => {
  // Cleanup
  if (socket.connected) {
    socket.disconnect();
  }
  clock.run(-1);
  done();
});

describe('messaging.clock', () => {
  it("should give one hours as 3600000 ms", (done) => {
    expect(clock.ONE_HOUR).toBe(60*60*1000);
    done();
  });
  it("should return the correct local timezone", (done) => {
    const zone = clock.timeZoneMethod().then(zone => {
      expect(zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
      done();
    });
  });
  it("should have a time publisher when run", async (done) => {
    await clock.run(interval);
    expect(subscriptions.isTopicPublished(clock.getTopic())).toBe(true);
    done();
  });
  it("should return a time string when clock is run", async (done) => {
    const initial = await clock.run(interval);
    expect(initial).toBeDefined();
    expect(subscriptions.isTopicPublished(clock.getTopic())).toBe(true);
    setTimeout(() => {
      socket.on("update", data => {
        expect(clock.isValidTimeString(data.value)).toBe(true);
        done();
      },4*interval);
      socket.emit("subscribe" , {topic: clock.getTopic()});
    });
  });
  it('should adjust wait time if too small', (done) => {
    let interval = 1000;
    for (let now = 4*interval; now <= 6* interval; now+= interval/100) {
      const wait = clock.timeUntilNextInterval(now, 1000);
      expect((now + wait) % interval).toBe(0);
      expect(wait > interval/15).toBe(true);
    }
    done();
  });
  it('should communicate with waiting for socket.io handshakes', (done) => {
    // Emit sth from Client do Server
    socket.emit('example', 'some messages');
    // Use timeout to wait for socket.io server handshakes
    setTimeout(() => {
      // Put your server side expect() here
      done();
    }, 50);
  });
});