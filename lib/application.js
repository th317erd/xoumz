(function(root) {
  const { requireModule } = require('./base/base'),
        janap = require('janap');

  const APP_STATES = {
    INITIALIZED: 0x01,
    STARTED: 0x02,
    STOPPED: 0x04
  };

  class Application {
    constructor(_opts) {
      var opts = Object.assign({
        appName: 'xoumz-app',
        plugins: []
      }, _opts || {}, { application: this });

      if (!(opts.plugins instanceof Array))
        opts.plugins = [opts.plugins];

      opts.processArguments = janap.parse(opts.argv || process.argv);

      Object.defineProperty(this, '_options', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: opts
      });

      Object.defineProperty(this, '_status', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: 0
      });

      Object.defineProperty(this, '_modules', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
      });

      Object.defineProperty(this, '_engineOrder', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: 0
      });

      Object.defineProperty(this, '_engines', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
      });

      this.requireModule = this.requireModule.bind(this);

      const Base = this.requireModule('./base');
      const Schema = this.requireModule('./schema');
      const Routes = this.requireModule('./routes');
      const Security = this.requireModule('./security');
      const Models = this.requireModule('./models');

      Object.assign(this, Base, {
        Schema,
        Routes,
        Security,
        Models
      });

      // const Validation = this.requireModule('./base/validation');
      // const StreamUtils = this.requireModule('./base/stream-utils');
      // const Collections = this.requireModule('./base/collections');
      // const Logger = this.requireModule('./base/logger');

      // const Connectors = this.requireModule('./connectors');
      // const Models = this.requireModule('./models');
      // const Migration = this.requireModule('./migration');
      // const QueryBuilder = this.requireModule('./base/query-engine');
      // const PermissionEngine = this.requireModule('./security/permission-engine');
      // const HTTPEngine = this.requireModule('./http/http-engine');
      // const RouteEngine = this.requireModule('./routes');
      // const ContentType = this.requireModule('./content-type');

      // Object.assign(this, Schema, Connectors, Migration, QueryBuilder, PermissionEngine, HTTPEngine, RouteEngine, ContentType, Collections, {
      //   Validation,
      //   StreamUtils,
      //   Logger,
      //   Utils,
      //   Models,
      //   ModelBase: Models.ModelBase
      // });

      // var configPrefix = opts.appName;

      // // Register myself as an engine (treated specially... this just helps with events)
      // this.registerEngine({
      //   name: null,
      //   options: { configKey: configPrefix }
      // });

      // // Register all default engines
      // DEFAULT_ENGINES.forEach((engine) => {
      //   this.registerEngine(engine);
      // });

      // // Load all plugins
      // if (sizeOf(opts.plugins)) {
      //   for (var i = 0, il = opts.plugins.length; i < il; i++) {
      //     var plugin = opts.plugins[i],
      //         thisModule = this.requireModule(plugin);

      //     Object.assign(this, thisModule);
      //   }
      // }
    }

    requireModule(...args) {
      return requireModule.call(this._options, ...args);
    }

    injectApplicationHelpers(instance) {
      if (instance && typeof instance.getApplication !== 'function')
        instance.getApplication = () => this;

      return instance;
    }

    wrapClass(Klass) {
      if ('getApplication' in Klass.prototype)
        return Klass;

      var opts = this._options;
      var wrappedKlass = class GenericWrappedClass extends Klass {
        constructor(...args) {
          super(...args);
        }

        getApplication() {
          return opts.application;
        }
      };

      // Copy over static methods
      var keys = Object.getOwnPropertyNames(Klass);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        if (Function.hasOwnProperty(key))
          continue;

        wrappedKlass[key] = Klass[key];
      }

      return wrappedKlass;
    }

    getEngine(name, _opts) {
      var thisEngine = this._engines[name];

      if (!thisEngine || !thisEngine.engine)
        throw new Error(`No such engine: ${name}`);

      return thisEngine.engine;
    }

    getEngines() {
      var engines = [];
      for (var engineInfo of this._engines.values())
        engines.push(engineInfo);

      return engines.sort((a, b) => {
        var x = a.order,
            y = b.order;

        return (x == y) ? 0 : (x < y) ? -1 : 1;
      });
    }

    async createEngine(EngineClass, ...args) {
      var engine = new EngineClass(...args);

      await engine.initialize();
      await engine.start();

      return engine;
    }

    async registerEngine(engine, _name) {
      var name = _name || engine.name();

      this._engines[name] = {
        name,
        engine,
        order: engine.initializationOrder()
      };

      if (this._state & APP_STATES.INITIALIZED && !(this._state & APP_STATES.STOPPED) && !engine.isInitialized())
        await engine.initialize();

      if (this._state & APP_STATES.STARTED && !(this._state & APP_STATES.STOPPED) && !engine.isStarted())
        await engine.start();

      return engine;
    }

    async registerEngines(engines) {
      var promises = [];
      for (var [ name, engine ] of engines.entries())
        promises.push(this.registerEngine(engine, (engines instanceof Array) ? undefined : name));

      return await Promise.all(promises);
    }

    async initialize() {
      const defaultEngines = {
        [this.ConfigEngine.name()]: () => {
          return new this.ConfigEngine(this._options);
        },
        [this.Security.PermissionEngine.name()]: () => {
          return new this.Security.PermissionEngine(this._options);
        },
        [this.Schema.SchemaEngine.name()]: () => {
          return new this.Schema.SchemaEngine({
            Session: this.Models.Session,
            User: this.Models.User
          });
        }
      };

      var promises = [];
      for (var [ name, engineCreator ] of defaultEngines.entries()) {
        if (!this._engines[name])
          promises.push(this.registerEngine(engineCreator(), name));
      }

      if (promises.length)
        await Promise.all(promises);
    }

    async enginesAction(action) {
      for (var engineInfo of this.getEngines().values()) {
        var engine = engineInfo.engine;
        if (!engine)
          continue;

        try {
          if (action === 'initialize' && !engine.isInitialized())
            await engine.initialize();
          else if (action === 'start' && !engine.isStarted())
            await engine.start();
          else if (action === 'stop' && !engine.isStopped())
            await engine.stop();
        } catch (e) {
          var verb = ({ 'initialize': 'initializing', 'start': 'starting', 'stop': 'stopping' })[action];
          this.Logger.error(`Error while ${verb} engine ${engineInfo.name}: `, e);
        }
      }
    }

    async start() {
      try {
        // process.on('SIGINT', () => {
        //   this.stop();
        // }).on('SIGTERM', () => {
        //   this.stop();
        // });

        await this.initialize();
        await this.enginesAction('initialize');
        this._state |= APP_STATES.INITIALIZED;

        await this.enginesAction('start');
        this._state |= APP_STATES.STARTED;
      } catch (e) {
        debugger;
        this.Logger.error(e);
        await this.onPanic();
      }
    }

    async onPanic() {
      await this.stop();
      process.exit(1);
    }

    async stop() {
      if (this._status & APP_STATES.STOPPED)
        return;

      this._state |= APP_STATES.STOPPED;
      await this.enginesAction('stop');

      this.Logger.info('Application shutdown successfully!');
    }

    async onStartupCheck() {
      var opts = this._options,
          args = opts.processArguments,
          schemaEngine = this.getSchemaEngine(),
          connectorEngine = this.getConnectorEngine(),
          migrationEngine = this.getMigrationEngine();

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

          if (!this.Utils.noe(migrateContext) && this.Utils.instanceOf(migrateContext, 'string') && connectorContext !== migrateContext)
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

        if (migrationName === true)
          migrationName = null;

        try {
          if (!this.Utils.noe(migrationName) && this.Utils.instanceOf(migrationName, 'string', 'number', 'boolean'))
            await migrationEngine.executeMigration(('' + migrationName));
          else
            await migrationEngine.executeMigrations(pendingMigrations);
        } catch (e) {
          this.Logger.error(e);
          process.exit(1);
        }

        process.exit(0);
        return;
      } else if (this.Utils.sizeOf(pendingMigrations)) {
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

    // getSchemaType(typeName) {
    //   var schemaEngine = this.getSchemaEngine();
    //   return schemaEngine.getSchemaType(typeName);
    // }

    // getModelType(data, _opts) {
    //   if (instanceOf(data, this.getModelTypeClass()))
    //     return data;

    //   if (instanceOf(data, this.getModelBaseClass()))
    //     return data.schema();

    //   var opts = _opts || {},
    //       schemaEngine = this.getSchemaEngine(opts);

    //   return schemaEngine.introspectModelType(data, opts);
    // }

    // getModelTypesFromQuery(mainQuery) {
    //   function loopQueryConditions(query, _currentModel) {
    //     var currentModel = _currentModel;

    //     query.iterateConditions((condition) => {
    //       if (instanceOf(condition, QueryBuilder))
    //         return loopQueryConditions.call(this, condition, (condition.getFirstConditionFlags() & QueryEngineFlags.OR) ? undefined : currentModel);

    //       if (!currentModel || (condition.flags & QueryEngineFlags.OR)) {
    //         currentModel = {};
    //         models.push(currentModel);
    //       }

    //       currentModel[condition.field] = condition.value;
    //     });
    //   }

    //   var models = [],
    //       QueryBuilder = this.getQueryEngineClass(),
    //       QueryEngineFlags = QueryBuilder.FLAGS,
    //       finalModelTypes = {};

    //   loopQueryConditions.call(this, mainQuery);

    //   for (var i = 0, il = models.length; i < il; i++) {
    //     var model = models[i];
    //     if (noe(model))
    //       continue;

    //     var modelType = this.getModelType(model, { operation: 'query', model });
    //     if (modelType) {
    //       var typeName = modelType.getTypeName(),
    //           key = `${typeName}:${this.Utils.id(modelType.getSchemaEngine())}`;

    //       if (finalModelTypes.hasOwnProperty(key))
    //         continue;

    //       finalModelTypes[key] = modelType;
    //     }
    //   }

    //   return Object.keys(finalModelTypes).map((key) => finalModelTypes[key]);
    // }

    // getConnectors(_filter) {
    //   var filter = _filter || {},
    //       operation = filter.operation,
    //       connectorEngine = this.getConnectorEngine();

    //   if (operation === 'query')
    //     filter = { read: true, primary: true };

    //   return connectorEngine.getConnectors(filter);
    // }

    // getConnector(filter) {
    //   return this.getConnectors(filter)[0];
    // }

    // async operateOnModels(cb, _models, _opts) {
    //   var models = _models,
    //       opts = _opts || {},
    //       promises = [],
    //       ModelTypeClass = this.getModelTypeClass(),
    //       ConnectorBaseClass = this.getConnectorClass();

    //   if (!(models instanceof Array))
    //     models = [models];

    //   for (var i = 0, il = models.length; i < il; i++) {
    //     var model = models[i];
    //     if (!model)
    //       continue;

    //     var thisOpts = Object.assign({}, opts, {
    //           operation: 'write',
    //           model
    //         }),
    //         modelType = this.getModelType(model, thisOpts);

    //     if (!instanceOf(modelType, ModelTypeClass))
    //       throw new Error('Do not know how to save model. Unknown model type');

    //     thisOpts.modelType = modelType;
    //     var connector = this.getConnector(thisOpts);
    //     if (!instanceOf(connector, ConnectorBaseClass))
    //       throw new Error('Can not save model. Unable to find a suitable connector to save to');

    //     promises.push(cb.call(this, connector, model, thisOpts));
    //   }

    //   var rets = await Promise.all(promises);
    //   return rets.reduce((finalRets, val) => {
    //     return finalRets.concat(val);
    //   }, []);
    // }

    // async create(_data, _opts) {
    //   var data = _data || {},
    //       opts = _opts || {},
    //       modelType = opts.modelType;

    //   if (instanceOf(_opts, 'string', 'number', 'boolean')) {
    //     modelType = ('' + _opts);
    //     opts = {};
    //   }

    //   if (instanceOf(_data, 'string', 'number', 'boolean')) {
    //     modelType = ('' + _data);
    //     data = {};
    //   }

    //   var thisOpts = Object.assign({ operation: 'create', modelType, model: data }, opts),
    //       schemaEngine = this.getSchemaEngine(thisOpts);

    //   return await schemaEngine.create(modelType, data, thisOpts);
    // }

    // async save(_models, _opts) {
    //   return await this.operateOnModels((connector, model, opts) => connector.write(model, opts), _models, _opts);
    // }

    // async destroy(_models, _opts) {
    //   return await this.operateOnModels((connector, model, opts) => connector.destroy(model, opts), _models, _opts);
    // }

    // where(...args) {
    //   return this.query(...args);
    // }

    // query(_opts) {
    //   var opts = _opts || {};

    //   if (instanceOf(opts, 'string', 'number', 'boolean')) {
    //     opts = {
    //       modelType: this.getModelType(null, { modelType: opts, operation: 'query' })
    //     };
    //   }

    //   var QueryEngineClass = this.wrapClass(this.getQueryEngineClass());
    //   return new QueryEngineClass(opts);
    // }
  }

  // Static properties
  Object.assign(Application, {
    STATES: APP_STATES
  });

  Object.assign(root, {
    Application
  });
})(module.exports);
