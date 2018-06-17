module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');
  const { Context } = requireModule('./base/context');

  const ENGINE_STATES = {
    INITIALIZED: 0x01,
    STARTED: 0x02,
    STOPPED: 0x04
  };

  const EngineBase = this.defineClass((ParentClass) => {
    return class EngineBase extends ParentClass {
      static name() {
        return '*';
      }

      static configKeyName() {
        return '*';
      }

      static initializationOrder() {
        return 1;
      }

      static shouldStart(app) {
        return true;
      }

      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});
        definePropertyRW(this, '_options', opts);
        definePropertyRW(this, '_state', 0);
      }

      getContext(...args) {
        return new Context({ name: ':engine' }, ...args);
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
    };
  }, undefined, {
    // Static properties
    STATES: ENGINE_STATES
  });

  root.export({
    EngineBase
  });
};
