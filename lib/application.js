const { requireModule } = require('./base'),
      Utils = require('./utils'),
      janap = require('janap'),
      path = require('path'),
      fs = require('fs');

const { definePropertyRW, definePropertyRO, sizeOf, noe, instanceOf, prettify } = Utils;

(function(root) {
  class Application {
    constructor(_opts) {
      var opts = Object.assign({
        appName: 'xoumz-app',
        plugins: []
      }, _opts || {}, { application: this });

      if (!(opts.plugins instanceof Array))
        opts.plugins = [opts.plugins];

      opts.processArguments = janap.parse(opts.argv || process.argv);

      definePropertyRW(this, 'status', 1);
      definePropertyRO(this, '_modules', {});
      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_schemaEngine', null);
      definePropertyRW(this, '_connectorEngine', null);
      definePropertyRW(this, '_migrationEngine', null);
      definePropertyRW(this, 'config', null);

      this.requireModule = this.requireModule.bind(this);

      const Logger = this.requireModule('./logger');
      const Schema = this.requireModule('./schema');
      const Connectors = this.requireModule('./connectors');
      const Models = this.requireModule('./models');
      const Migration = this.requireModule('./migration');
      const QueryEngine = this.requireModule('./query-engine');

      Object.assign(this, Schema, Connectors, Migration, QueryEngine, {
        Logger,
        Utils,
        Models
      });

      if (sizeOf(opts.plugins)) {
        for (var i = 0, il = opts.plugins.length; i < il; i++) {
          var plugin = opts.plugins[i],
              thisModule = this.requireModule(plugin);

          Object.assign(this, thisModule);
        }
      }
    }

    requireModule(...args) {
      return requireModule.call(this.options, ...args);
    }

    async loadAppConfig() {
      if (this.config)
        return this.config;

      var opts = this.options;
      if (noe(opts.configPath))
        opts.configPath = './config.json';

      var appConfigPath = (opts.configPath.charAt(0) === '/' || opts.configPath.charAt(0) === path.sep) ? opts.configPath : path.resolve(path.dirname(require.main.filename), opts.configPath),
          config = {};

      opts.configPath = appConfigPath;

      try {
        config = require(appConfigPath);
      } catch (e) {
        this.Logger.warn(`Unable to load app config: ${appConfigPath}`);
      }

      definePropertyRW(this, 'config', config);
      return config;
    }

    onExitApplication(status) {
      this.status = 0;
      process.exit(status);
    }

    async onShutdown() {
      var connectorEngine = this.getConnectorEngine();
      await connectorEngine.onShutdown();
    }

    async onInit(app, schemaEngine, connectorEngine) {
      throw new Error('Application must implement an onInit method');
    }

    async stop() {
      await this.onShutdown();
    }

    async start() {
      try {
        var config = await this.loadAppConfig(),
            schemaEngine = this.getSchemaEngine(),
            connectorEngine = this.getConnectorEngine();

        await connectorEngine.onInit();
        await schemaEngine.onInit();

        this.onInit(this, this.getSchemaEngine(), this.getConnectorEngine());
        await schemaEngine.start();

        var migrationEngine = this.getMigrationEngine();
        await migrationEngine.onInit();
        await this.onStartupCheck();
      } catch (e) {
        this.Logger.error(e);
        this.onExitApplication(1);
      }
    }

    getSchemaEngine() {
      if (this._schemaEngine)
        return this._schemaEngine;

      var SchemaEngineClass = this.wrapClass(this.SchemaEngine);
      this._schemaEngine = new SchemaEngineClass(this.options.schema);

      return this._schemaEngine;
    }

    getConnectorEngine() {
      if (this._connectorEngine)
        return this._connectorEngine;

      var ConnectorEngineClass = this.wrapClass(this.ConnectorEngine);
      this._connectorEngine = new ConnectorEngineClass(this.options.connectors);

      return this._connectorEngine;
    }

    getMigrationEngine() {
      if (this._migrationEngine)
        return this._migrationEngine;

      var MigrationEngineClass = this.wrapClass(this.MigrationEngine);
      this._migrationEngine = new MigrationEngineClass(this.options.migration);

      return this._migrationEngine;
    }

    async onStartupCheck() {
      var opts = this.options,
          args = opts.processArguments,
          schemaEngine = this.getSchemaEngine(),
          connectorEngine = this.getConnectorEngine(),
          migrationEngine = this.getMigrationEngine();

      if (args.hasOwnProperty('create-migration')) {
        try {
          var migrationName = args['create-migration'];
          if (noe(migrationName))
            throw new Error('Migration must have a name');

          await migrationEngine.createNew(migrationName);
          process.exit(0);
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }
      }

      var lastMigrationRanAt = await this.onPersistLoad('lastMigrationRunTime'),
          pendingMigrations = await migrationEngine.getPendingMigrations(lastMigrationRanAt),
          reports = await connectorEngine.validateSchema(schemaEngine),
          needsAutoMigration = [];

      if (args.hasOwnProperty('auto-migrate')) {
        var generatedReports = [],
            migrateContext = args['auto-migrate'];

        for (var i = 0, il = reports.length; i < il; i++) {
          var report = reports[i];
          if (!report || report.valid)
            continue;

          var connector = report.connector,
              connectorContext = connector.getContext();

          if (!noe(migrateContext) && instanceOf(migrateContext, 'string') && connectorContext !== migrateContext)
            continue;

          generatedReports.push(report.generateMigration());
        }

        try {
          await migrationEngine.createNew('auto-schema-migration', () => generatedReports.join('\n\n'));
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }

        process.exit(0);
        return;
      } else if (args.hasOwnProperty('run-migrations') && args['run-migrations']) {
        var migrationName = args['run-migrations'];

        try {
          if (!noe(migrationName) && instanceOf(migrationName, 'string'))
            await migrationEngine.executeMigration(migrationName);
          else
            await migrationEngine.executeMigrations(pendingMigrations);
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }

        process.exit(0);
        return;
      } else if (sizeOf(pendingMigrations)) {
        this.Logger.error(`There are migrations pending, please run them before continuing by executing the following command: node ${require.main.filename} --run-migrations`);
        process.exit(1);
        return;
      }

      for (var i = 0, il = reports.length; i < il; i++) {
        var report = reports[i];
        if (report && !report.valid) {
          this.Logger.info(report.getReportLog());
          needsAutoMigration.push(report);
        }
      }

      if (needsAutoMigration.length)
        this.Logger.info(`To try and fix these issues generate an auto-migration for this connection by running the command: ${process.argv[0]} ${process.argv[1]} --auto-migrate${(needsAutoMigration.length === 1) ? `=${report.connector.getContext()}` : ''}`);
    }

    async onPersistSave(key, data) {
      var opts = this.options,
          config = this.config,
          appConfigPath = opts.configPath,
          isJS = appConfigPath.match(/\.js$/i);

      this.Utils.setProp(config, `${opts.appName}-cache.${key}`, data);
      var configJSON = JSON.stringify(config, undefined, 2);

      return new Promise((resolve, reject) => {
        fs.writeFile(appConfigPath, (isJS) ? `module.exports = ${configJSON};\n` : configJSON, (err) => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        });
      });
    }

    async onPersistLoad(key, defaultValue) {
      var opts = this.options,
          config = await this.loadAppConfig();
      return this.Utils.getProp(config, `${opts.appName}-cache.${key}`, defaultValue);
    }

    injectApplicationHelpers(instance) {
      if (instance && !(instance.getApplication instanceof Function))
        instance.getApplication = () => this;

      return instance;
    }

    wrapClass(Klass) {
      var opts = this.options;
      var wrappedKlass = class GenericWrappedClass extends Klass {
        constructor(...args) {
          super(...args);
        }

        getApplication() {
          return opts.application;
        }
      };

      // Copy over static methods
      var keys = Object.keys(Klass);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        wrappedKlass[key] = Klass[key];
      }

      return wrappedKlass;
    }

    getSchemaType(typeName) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getSchemaType(typeName);
    }

    getModelType(...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getModelType(...args);
    }

    getConnectors(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnectors(filter);
    }

    getConnector(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnector(filter);
    }

    async create(modelType, ...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.create(modelType, ...args);
    }

    async save(models, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          connectors = this.getConnectors({ writable: true }),
          opts = _opts || {},
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i];
        promises.push(schemaEngine.save(connector, models, opts));
      }

      return Promise.all(promises);
    }

    query(modelType, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          opts = _opts || {},
          connector = this.getConnector({ readable: true, primary: true });

      if (!connector)
        throw new Error('No readable connector found');

      return schemaEngine.query(connector, modelType, opts);
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
