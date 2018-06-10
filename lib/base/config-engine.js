module.exports = function(root, requireModule) {
  const path = require('path');
  const fs = require('fs');
  const { noe, definePropertyRW, getProp, setProp } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');

  const ConfigEngine = this.defineClass((ParentClass) => {
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
        definePropertyRW(this, '_config', {});
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
        if (!this._saving)
          return;

        this._saving = new Promise((resolve, reject) => {
          var opts = this._options,
              appConfigPath = opts.configPath,
              isJS = appConfigPath.match(/\.js$/i),
              configJSON = JSON.stringify(this._config, undefined, 2);

          fs.writeFile(appConfigPath, (isJS) ? `module.exports = ${configJSON};\n` : configJSON, (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          });
        });
      }

      getConfigValue(key, defaultValue) {
        var appName = this.getAppName(),
            value = getProp(this._config, `${appName}_cache.${key}`);

        if (value === undefined || value === null)
          value = getProp(this._config, `${appName}.${key}`);

        return (value === undefined || value === null) ? defaultValue : value;
      }

      setConfigValue(key, data) {
        var appName = this.getAppName();

        setProp(this._config, `${appName}_cache.${key}`, data);

        this.queConfigSave();
      }
    };
  }, EngineBase);

  root.export({
    ConfigEngine
  });
};
