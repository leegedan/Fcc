let _id = 0;
const newId = () => ++_id;
const generateUid = () => Math.random().toString(32).substr(-10);
const isPromise = (o) =>
  !!o &&
  (typeof o === "object" || typeof o === "function") &&
  typeof o.then === "function";

/**
 * 消息过滤
 * @param {*} message 
 * @returns 
 */
const pure = (message) => {
  if (!message.data) {
    return false;
  }
  if (typeof message.data !== "object") {
    return false;
  } else {
    // 标识
    return "_cc_" in message.data;
  }
};

const postMessage = (win, data) => {
  data["_cc_"] = "_";
  win.postMessage(data, "*");
};

class CEvent {
  constructor() {
    this.listeners = {};
  }
  on(type, callback) {
    this.listeners[type] = callback;
  }
  remove(type) {
    if (this.has(type)) {
      this.listeners[type] = undefined;
    }
  }
  emit(type, parm) {
    if (this.has(type)) {
      return this.listeners[type](parm);
    }
  }
  has(type) {
    return typeof this.listeners[type] !== "undefined";
  }
}

class Box {
  constructor(events) {
    this.id = generateUid();
    this.events = events;
    this.chocolates = [];
    this.callbacks = {};
  }
  /**
   * 登记iframe
   * @param {*} fid 
   * @param {*} source 
   */
  add(fid, source) {
    const has = this.chocolates.find((choc) => choc.fid === fid);
    if (!has) {
      this.chocolates.push({ fid, source });
    }
  }
  /**
   * 移除iframe
   */
  sync() {
    this.chocolates = this.chocolates.filter((choc) => choc.source.parent);
  }
  /**
   * 广播
   * @param {*} data 
   */
  broadcast(data) {
    data.fid = data.fid || this.id;
    this.chocolates.forEach((choc) => {
      if (data.fid !== choc.fid) {
        postMessage(choc.source, data);
      }
    });
  }
  /**
   * 接收消息
   * @param {*} data 
   * @param {*} source 
   */
  receive(data, source) {
    const { name, fid, msgId, target, payload } = data;
    if (name === "ready") {
      this.add(fid, source);
    } else {
      if (msgId) {
        // reply
        if (target) {
          if (target === this.id) {
            if (this.callbacks[msgId]) {
              this.callbacks[msgId].resolve(payload);
              delete this.callbacks[msgId];
            } else {
              // error
            }
          } else {
            this.send(data);
          }
        } else {
          const ret = this.fire(data);
          if (ret === "__NULL__") {
            this.broadcast(data);
          } else {
            if (isPromise(ret)) {
              ret.then((val) => {
                data.payload = val;
                this.send(data);
              });
            } else {
              if (typeof ret === "function") {
                throw new Error(
                  `Fcc-${this.id}: [${name}]事件异常，postMessage不允许提交函数哦。`
                );
              } else {
                data.payload = ret;
                this.send(data);
              }
            }
          }
        }
      } else {
        this.fire(data);
        this.broadcast(data);
      }
    }
  }
  /**
   * 发消息
   * @param {*} data 
   */
  send(data) {
    data.target = data.target || data.fid;
    data.fid = data.fid || this.id;

    const choc = this.chocolates.find((el) => el.fid === data.target);
    if (choc) {
      postMessage(choc.source, data);
    } else {
      //
    }
  }
  /**
   * 发消息，记得回
   * @param {*} data 
   * @returns 
   */
  mailTo(data) {
    const msgId = newId();
    data.fid = this.id;
    data.msgId = msgId;

    return new Promise((resolve, reject) => {
      this.callbacks[msgId] = { resolve, reject };
      this.broadcast(data);
    });
  }
  /**
   * 触发事件
   * @param {*} data 
   * @returns 
   */
  fire(data) {
    if (this.events.has(data.name)) {
      return this.events.emit(data.name, data.payload);
    }

    return "__NULL__";
  }
}

class Chocolate {
  constructor(events) {
    this.events = events;
    this.id = generateUid();
    this.box = this.getTopWin();
    this.callbacks = {};
    this.notify({ name: "ready" });
  }
  /**
   * 通知中心
   * @param {*} data 
   */
  notify(data) {
    data.fid = this.id;
    postMessage(this.box, data);
  }
  /**
   * 获取top window
   * @returns 
   */
  getTopWin() {
    let win = window;
    while ((win = win.parent)) {
      if (win === win.parent) {
        break;
      }
    }
    return win;
  }
  /**
   * 广播
   * @param {*} data 
   */
  broadcast(data) {
    this.notify(data);
  }
  /**
   * 接收消息
   * @param {*} data 
   */
  receive(data) {
    const { name, msgId, target, payload } = data;

    if (msgId) {
      if (target) {
        if (target === this.id) {
          if (this.callbacks[msgId]) {
            this.callbacks[msgId].resolve(payload);
            delete this.callbacks[msgId];
          }
        }
      } else {
        const ret = this.fire(data);
        if (ret === "__NULL__") {
          //
        } else {
          if (isPromise(ret)) {
            ret.then((val) => {
              data.payload = val;
              this.send(data);
            });
          } else {
            if (typeof ret === "function") {
              throw new Error(
                `Fcc-${this.id}: [${name}]事件异常，postMessage不允许提交函数哦。`
              );
            } else {
              data.payload = ret;
              this.send(data);
            }
          }
        }
      }
    } else {
      this.fire(data);
    }
  }
  /**
   * 发消息
   * @param {*} data 
   */
  send(data) {
    data.target = data.fid;
    this.notify(data);
  }
  /**
   * 发消息，记得回
   * @param {*} data 
   * @returns 
   */
  mailTo(data) {
    const msgId = newId();
    data.msgId = msgId;

    return new Promise((resolve, reject) => {
      this.callbacks[msgId] = { resolve, reject };
      this.notify(data);
    });
  }
  /**
   * 触发事件
   * @param {*} data 
   * @returns 
   */
  fire(data) {
    if (this.events.has(data.name)) {
      return this.events.emit(data.name, data.payload);
    }

    return "__NULL__";
  }
}

class Fcc {
  constructor() {
    this.events = new CEvent();
    this.cos = null;
    this._init();
  }
  emit(name, parm) {
    return this.cos.broadcast({
      name,
      payload: parm,
    });
  }
  call(name, parm) {
    return this.cos.mailTo({
      name,
      payload: parm,
    });
  }
  on(type, callback) {
    this.events.on(type, callback);
    return this;
  }
  off(type) {
    this.events.remove(type);
    return this;
  }

  _listen(win) {
    win.addEventListener("message", (e) => {
      if (pure(e)) {
        this.cos.receive(e.data, e.source);
      }
    });
  }
  _init() {
    const win = window;
    if (win === win.parent) {
      this.cos = new Box(this.events);
    } else {
      this.cos = new Chocolate(this.events);
    }

    this._listen(win);
  }
}

export default new Fcc();
