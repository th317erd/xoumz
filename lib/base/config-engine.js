module.exports = function(root, requireModule) {
  const path = require('path');
  const fs = require('fs');
  const { noe, definePropertyRW, getProp, setProp } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const { Context } = requireModule('./base/context');

  const ConfigEngine = this.defineClass((EngineBase) => {
    return class ConfigEngine extends EngineBase {
      static name() {
        return 'config';
      }

      static configKeyName() {
        return '*';
      }

      static initializationOrder() {
        return 0;
      }

      constructor(_opts) {
        super(_opts);

        definePropertyRW(this, '_environment', this._options.environment || 'production');
        definePropertyRW(this, '_config', {});
      }

      getContext(...args) {
        return new Context({ name: 'config', group: 'engine' }, ...args);
      }

      getEnvironment() {
        return this._environment;
      }

      setEnvironment(environment) {
        this._environment = environment;
      }

      async initialize() {
        if (this.isInitialized())
          return;

        var opts = this._options,
            config = {};

        if (!noe(opts.configPath)) {
          try {
            var appConfigPath = (opts.configPath.charAt(0) === '/' || opts.configPath.charAt(0) === path.sep) ? opts.configPath : path.resolve(path.dirname(require.main.filename), opts.configPath);
            config = require(appConfigPath);
            opts.configPath = appConfigPath;
          } catch (e) {
            this.Logger.warn(`Unable to load app config: ${appConfigPath}`);
          }
        }

        definePropertyRW(this, '_config', config);
        definePropertyRW(this, '_saving', null);
      }

      getAppName() {
        if (noe(this._options.appName))
          return 'xoumz';

        return this._options.appName;
      }

      queConfigSave() {
        if (this._saving)
          return;

        this._saving = new Promise((resolve, reject) => {
          var opts = this._options,
              appConfigPath = opts.configPath,
              isJS = appConfigPath.match(/\.js$/i),
              configJSON = JSON.stringify(this._config, undefined, 2);

          fs.writeFile((isJS) ? appConfigPath.replace(/\.js$/i, '.json') : appConfigPath, configJSON, (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
            this._saving = null;
          });
        });

        return this._saving;
      }

      getConfigValue(key, defaultValue) {
        var appName = this.getAppName(),
            environment = this.getEnvironment(),
            version = this.getVersion(),
            value = getProp(this._config, `${environment}.${version}.${appName}_store.${key}`);

        if (value == null)
          value = getProp(this._config, `${environment}.${version}.${appName}.${key}`);

        if (value == null)
          value = getProp(this._config, `${environment}.${appName}.${key}`);

        return (value == null) ? defaultValue : value;
      }

      setConfigValue(key, data) {
        var appName = this.getAppName(),
            version = this.getVersion(),
            environment = this.getEnvironment();

        setProp(this._config, `${environment}.${version}.${appName}_store.${key}`, data);

        return this.queConfigSave();
      }
    };
  }, EngineBase);

  root.export({
    ConfigEngine
  });
};
