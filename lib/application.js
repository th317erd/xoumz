import { requireModule as baseRequireModule } from './base';
import Utils, { definePropertyRW, definePropertyRO, sizeOf, noe, instanceOf } from './utils';
import janap from 'janap';
import path from 'path';
import fs from 'fs';
import moment from 'moment';

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

      Object.assign(this, Schema, Connectors, Migration, {
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
      return baseRequireModule.call(this.options, ...args);
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

    logValidationReport(report) {
      var autoMigrate = false;

      this.Logger.error(`Error: ${report.connector.getContext()} failed schema validation: `);

      if (report.errors && report.errors.length)
        this.Logger.error(`\tErrors: ${report.errors.join(', ')}`);

      if (report.stale && report.stale.length) {
        autoMigrate = true;
        this.Logger.error(`\tStale: ${report.stale.join(', ')}`);
      }

      if (report.missing && report.missing.length) {
        autoMigrate = true;
        this.Logger.error(`\tMissing: ${report.missing.join(', ')}`);
      }

      if (autoMigrate) {
        this.Logger.info(`To try and fix these issues run an auto-migration for this connection by running the command: ${process.argv[0]} ${process.argv[1]} --auto-migrate=${report.connector.getContext()}`);
      }
    }

    async onStartupCheck() {
      var opts = this.options,
          args = opts.processArguments,
          schemeEngine = this.getSchemaEngine(),
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
          migrationsRan = false;
      
      if (args.hasOwnProperty('auto-migrate')) {
        var migrateContext = args['auto-migrate'];
        await Promise.all(connectorEngine.iterateConnectors(async (connector) => {
          if (instanceOf(migrateContext, 'string') && !noe(migrateContext) && connector.getContext() !== migrateContext)
            return;

          migrationsRan = true;
          try {
            await connector.migrate(schemeEngine);
          } catch (e) {
            console.error('ERROR!', e);
            this.Logger.error(e);
            process.exit(1);  
          }
        }));
      }

      if (args.hasOwnProperty('run-migrations') && args['run-migrations']) {
        try {
          await migrationEngine.executeMigrations(pendingMigrations);
          await this.onPersistSave('lastMigrationRunTime', moment().valueOf());
          migrationsRan = true;
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }
      } else if (sizeOf(pendingMigrations)) {
        this.Logger.error(`There are migrations pending, please run them before continuing by executing the following command: node ${require.main.filename} --run-migrations`);
        process.exit(1);
      }

      if (migrationsRan) {
        process.exit(0);
        return;
      }
      
      var reports = await connectorEngine.validateSchema(schemeEngine);
      for (var i = 0, il = reports.length; i < il; i++) {
        var report = reports[i];
        /*if (!report.valid)
          this.logValidationReport(report);

        if (report.warnings && report.warnings.length)
          this.Logger.warn(`\nWarnings: ${report.warnings.join(', ')}`);*/
      }
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

    getSchemaType(...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getSchemaType(...args);
    }

    getModelSchema(...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getModelSchema(...args);
    }

    getConnectors(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnectors(filter);
    }

    getConnector(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnector(filter);
    }

    async createType(modelType, ...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.createType(modelType, ...args);
    }

    async saveType(model, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          connectors = this.getConnectors({ writable: true }),
          opts = _opts || {},
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i];
        promises.push(schemaEngine.saveType(connector, model, opts));
      }

      return Promise.all(promises);
    }

    async loadType(params, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          opts = _opts || {},
          connector = this.getConnector({ readable: true, primary: true });

      if (!connector)
        throw new Error('No readable connector found');

      return schemaEngine.loadType(connector, params, opts);
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
