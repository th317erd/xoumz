import { requireModule as baseRequireModule } from './base';
import janap from 'janap';

(function(root) {
  class Application {
    constructor(_opts) {
      var opts = Object.assign({ plugins: [] }, _opts || {}, { application: this });
      if (!(opts.plugins instanceof Array))
        opts.plugins = [opts.plugins];

      const requireModule = baseRequireModule.bind(opts);
      Object.defineProperty(this, '_modules', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: {}
      });

      Object.defineProperty(this, '_moduleUUIDCounter', {
        writable: true,
        enumerable: false,
        configurable: false,
        value: 1
      });

      Object.defineProperty(this, 'requireModule', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: requireModule
      });

      const Logger = requireModule('./logger');
      const Utils = requireModule('./utils');
      const Schema = requireModule('./schema');
      const SchemaTypes = requireModule('./schema/schema-types');
      const ConnectorCollection = requireModule('./connectors');
      const QueryUtils = requireModule('./connectors/query-utils');
      const Models = requireModule('./models');
      const Migrations = requireModule('./migration');

      Object.assign(this, {
        Logger,
        Utils,
        Schema,
        SchemaTypes,
        ConnectorCollection,
        QueryUtils,
        Models
      }, Migrations);

      if (Utils.sizeOf(opts.plugins)) {
        for (var i = 0, il = opts.plugins.length; i < il; i++) {
          var plugin = opts.plugins[i],
              thisModule = this.requireModule(plugin);
          
          Object.assign(this, thisModule);
        }
      }

      opts.appArguments = janap.parse(opts.argv || process.argv);
      Utils.definePropertyRW(this, 'options', opts);
    }
      
    async init(cb) {
      var opts = this.options,
          schema = opts.schema,
          migrationEngine = opts.migrationEngine;

      if (!opts.schema) {
        var schemaClass = this.wrapClass(this.Schema.Schema);
        schema = opts.schema = new schemaClass(opts);
      } else {
        this.injectApplicationHelpers(opts.schema);
      }

      if (!opts.connectors)
        opts.connectors = new (this.wrapClass(this.ConnectorCollection.ConnectorCollection))(opts);
      else
        this.injectApplicationHelpers(opts.connectors);

      if (!opts.migrationEngine)
        migrationEngine = opts.migrationEngine = new (this.wrapClass(this.MigrationEngine))(opts);
      else
        this.injectApplicationHelpers(opts.migrationEngine);

      try {
        await cb.call(this, this, schema, opts.connectors, this.wrapClass(schema.getBaseRecordType()), this.options);
        await schema.initialize();

        await this.sanityCheck();
      } catch (e) {
        this.Logger.error(e);
        throw e;
      }
    }

    async sanityCheck() {
      var opts = this.options,
          args = opts.appArguments,
          migrationEngine = opts.migrationEngine;

      if (args.hasOwnProperty('create-migration')) {
        try {
          var migrationName = args['create-migration'];
          if (this.Utils.noe(migrationName))
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
      } else if (this.Utils.sizeOf(pendingMigrations)) {
        this.Logger.error(`There are migrations pending, please run them before continuing by executing the following command: node ${require.main.filename} --run-migrations`);
        process.exit(1);
      }
    }

    injectApplicationHelpers(instance) {
      if (!(instance.getApplication instanceof Function)) {
        instance.getApplication = () => this;
      }
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

    getSchema() {
      return this.options.schema;
    }

    getSchemaType(...args) {
      var schema = this.getSchema();
      return schema.getSchemaType(...args);
    }

    getModelSchema(...args) {
      var schema = this.getSchema();
      return schema.getModelSchema(...args);
    }

    getConnectors(filter) {
      return this.options.connectors.getConnectors(filter);
    }

    getConnector(filter) {
      return this.options.connectors.getConnector(filter);
    }

    async createType(modelType, ...args) {
      var schema = this.getSchema();
      debugger;
      return schema.createType(modelType, ...args);
    }

    async saveType(model, _opts) {
      var schema = this.getSchema(),
          connectors = this.getConnectors({ writable: true }),
          opts = _opts || {},
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i];
        promises.push(schema.saveType(connector, model, opts));
      }

      return Promise.all(promises);
    }

    async loadType(params, _opts) {
      var schema = this.getSchema(),
          opts = _opts || {},
          connector = this.getConnector({ readable: true, primary: true });

      if (!connector)
        throw new Error('No readable connector found');

      return schema.loadType(connector, params, opts);
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
