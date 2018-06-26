module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const { Context } = requireModule('./base/context');

  const VersionEngine = this.defineClass((EngineBase) => {
    return class VersionEngine extends EngineBase {
      static name() {
        return 'version';
      }

      static configKeyName() {
        return 'version';
      }

      static initializationOrder() {
        return 1;
      }

      static shouldStart(app) {
        return (app.getMasterApplication() === app);
      }

      constructor(_opts) {
        var opts = _opts || {};

        super(opts);

        definePropertyRW(this, '_options', opts);
        definePropertyRW(this, '_versions', {});
      }

      isValidVersion(version) {
        if (this._versions.hasOwnProperty(version))
          return new Error(`Version ${version} already defined in VersionEngine`);
      }

      getContext(...args) {
        return new Context({ name: 'version', group: 'engine' }, ...args);
      }

      async initialize() {
        if (this.isInitialized())
          return;
      }

      async start(...args) {
        if (this.isStarted())
          return;

        await super.start(...args);

        this.addApplication(this.getApplication());
      }

      getApplicationVersions() {
        var masterApplication = this.getMasterApplication(),
            masterVersion = masterApplication.getVersion(),
            versions = this._versions,
            keys = Object.keys(versions).sort((a, b) => {
              if (a === masterVersion && b === masterVersion)
                return 0;

              if (a === masterVersion)
                return -1;

              if (b === masterVersion)
                return 1;

              return (a == b) ? 0 : (a < b) ? 1 : -1;
            });

        return keys;
      }

      getMostRecentVersion() {
        var versions = this.getApplicationVersions();
        return versions[versions.length - 1];
      }

      getApplications() {
        var versions = this._versions,
            versionKeys = this.getApplicationVersions();

        return versionKeys.map((version) => versions[version]);
      }

      getVersionedApplication(version) {
        return this._versions[version];
      }

      addApplication(app) {
        var version = app.getVersion(),
            error = this.isValidVersion(version);

        if (error)
          throw error;

        this._versions[version] = app;
      }
    };
  }, EngineBase);

  root.export({
    VersionEngine
  });
};
