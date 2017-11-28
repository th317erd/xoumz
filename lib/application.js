import { requireModule as baseRequireModule } from './base';
import Utils, { definePropertyRW, definePropertyRO, sizeOf, noe } from './utils';
import janap from 'janap';

(function(root) {
  class Application {
    constructor(_opts) {
      var opts = Object.assign({ plugins: [] }, _opts || {}, { application: this });
      if (!(opts.plugins instanceof Array))
        opts.plugins = [opts.plugins];

      opts.processArguments = janap.parse(opts.argv || process.argv);

      definePropertyRO(this, '_modules', {});
      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_schemaEngine', null);
      definePropertyRW(this, '_connectorEngine', null);
      definePropertyRW(this, '_migrationEngine', null);

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

    onExitApplication(status) {
      process.exit(status);
    }

    async onInit(app, schemaEngine, connectorEngine) {
      throw new Error('Application must implement an onInit method');
    }
      
    async start() {
      try {
        var schemaEngine = this.getSchemaEngine(),
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

      var pendingMigrations = await migrationEngine.getPendingMigrations();
      if (args.hasOwnProperty('run-migrations') && args['run-migrations']) {
        try {
          await migrationEngine.executeMigrations(pendingMigrations);
          process.exit(0);
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }
      } else if (sizeOf(pendingMigrations)) {
        this.Logger.error(`There are migrations pending, please run them before continuing by executing the following command: node ${require.main.filename} --run-migrations`);
        process.exit(1);
      }
    }

    injectApplicationHelpers(instance) {
      if (instance && !(instance.getApplication instanceof Function))
        instance.getApplication = () => this;
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
