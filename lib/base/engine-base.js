module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');

  const ENGINE_STATES = {
    INITIALIZED: 0x01,
    STARTED: 0x02,
    STOPPED: 0x04
  };

  class EngineBase {
    static name() {
      return '*';
    }

    static configKeyName() {
      return '*';
    }

    static initializationOrder() {
      return 1;
    }

    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      definePropertyRW(this, '_options', opts);
      definePropertyRW(this, '_state', 0);
    }

    name() {
      return this.constructor.name();
    }

    configKeyName() {
      return this.constructor.configKeyName();
    }

    initializationOrder() {
      return this.constructor.initializationOrder();
    }

    isInitialized() {
      return this._state & ENGINE_STATES.INITIALIZED;
    }

    isStarted() {
      return this._state & ENGINE_STATES.STARTED;
    }

    isStopped() {
      return this._state & ENGINE_STATES.STOPPED;
    }

    getConfig() {
      var app = this.getApplication();
      if (!app)
        return {};

      var configEngine = app.getEngine('config');
      if (!configEngine)
        return {};

      return configEngine.getConfigValue(this.name(), {});
    }

    async initialize() {
      if (this.isInitialized())
        return;

      this._state |= ENGINE_STATES.INITIALIZED;

      var config = this.getConfig();
      definePropertyRW(this, '_options', Object.assign({}, config, this._options || {}));
    }

    async start() {
      if (this.isStarted())
        return;

      this._state |= ENGINE_STATES.STARTED;
    }

    async stop() {
      if (this.isStopped())
        return;

      this._state |= ENGINE_STATES.STOPPED;
    }
  }

  // Static properties
  Object.assign(EngineBase, {
    STATES: ENGINE_STATES
  });

  root.export({
    EngineBase
  });
};
