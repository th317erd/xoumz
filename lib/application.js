const { requireModule } = require('./base'),
      Utils = require('./base/utils'),
      janap = require('janap'),
      path = require('path'),
      fs = require('fs');

const { definePropertyRW, sizeOf, noe, instanceOf, capitalize } = Utils;

const DEFAULT_ENGINES = [
  { name: 'schemaEngine', options: { configKey: 'schema' } },
  { name: 'connectorEngine', options: { configKey: 'connectors' } },
  { name: 'migrationEngine', options: { configKey: 'migration' } },
  { name: 'permissionEngine', options: { configKey: 'permissions' } },
  { name: 'httpServer', options: { altName: 'HTTPServer', configKey: 'http' } },
  { name: 'routeEngine', options: { requires: ['httpServer'], configKey: 'routes' } }
];

(function(root) {
  async function doEnginesAction(eventName) {
    var modules = this.getEnginesInfo();

    for (var i = 0, il = modules.length; i < il; i++) {
      var thisEngine = modules[i],
          engineName = (thisEngine.name && thisEngine.name !== '*') ? thisEngine.name : '';

      if (thisEngine.altName)
        engineName = thisEngine.altName;

      var instanceFuncName = `on${capitalize(eventName)}`,
          checkCallbackName = `${eventName}Check`;

      if (eventName.match(/shutdown/i) && !thisEngine.running)
        continue;

      if (thisEngine[checkCallbackName] instanceof Function && thisEngine[checkCallbackName].call(this, thisEngine) === false) {
        thisEngine.instance = false;
        continue;
      }

      var instance = this.getEngine(thisEngine.name),
          extraCallable = (instance && engineName);

      if (extraCallable && instance[instanceFuncName] instanceof Function) {
        //console.log('Calling: ', instanceFuncName);
        await instance[instanceFuncName].call(instance);
      }

      //console.log('Calling stuff: ', `on${capitalize(engineName)}${capitalize(eventName)}`);
      await this[`on${capitalize(engineName)}${capitalize(eventName)}`].call(this, instance);

      if (eventName === 'start')
        thisEngine.running = true;
    }
  }

  class Application {
    constructor(_opts) {
      var opts = Object.assign({
        appName: 'xoumz-app',
        plugins: []
      }, _opts || {}, { application: this });

      if (!(opts.plugins instanceof Array))
        opts.plugins = [opts.plugins];

      opts.processArguments = janap.parse(opts.argv || process.argv);

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'status', 1);
      definePropertyRW(this, '_modules', {});
      definePropertyRW(this, '_engineOrder', 0);
      definePropertyRW(this, '_engines', {});
      definePropertyRW(this, 'config', null);

      this.requireModule = this.requireModule.bind(this);

      // const Validation = this.requireModule('./base/validation');
      // const StreamUtils = this.requireModule('./base/stream-utils');
      // const Collections = this.requireModule('./base/collections');
      // const Logger = this.requireModule('./base/logger');
      // const Schema = this.requireModule('./schema');
      // const Connectors = this.requireModule('./connectors');
      // const Models = this.requireModule('./models');
      // const Migration = this.requireModule('./migration');
      // const QueryEngine = this.requireModule('./base/query-engine');
      // const PermissionEngine = this.requireModule('./security/permission-engine');
      // const HTTPServer = this.requireModule('./http/http-server');
      // const RouteEngine = this.requireModule('./routes');
      // const ContentType = this.requireModule('./content-type');

      // Object.assign(this, Schema, Connectors, Migration, QueryEngine, PermissionEngine, HTTPServer, RouteEngine, ContentType, Collections, {
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
      return requireModule.call(this.options, ...args);
    }

    engineDependsOn(_names) {
      var names = _names;
      if (!names)
        return (() => true);

      if (!(names instanceof Array))
        names = [names];

      return function(engine) {
        for (var i = 0, il = names.length; i < il; i++) {
          var name = names[i],
              thisEngine = this._engines[name];

          if (!thisEngine || !thisEngine.instance)
            return false;
        }

        return true;
      };
    }

    async loadAppConfig() {
      if (this.config)
        return this.config;

      var opts = this.options,
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

      definePropertyRW(this, 'config', config);

      return config;
    }

    getConfigValue(key, defaultValue) {
      return this.Utils.getProp(
        this.config,
        `${this.options.appName}.${key}`,
        this.Utils.getProp(this.config, key, defaultValue)
      );
    }

    async onPersistSave(key, data) {
      var opts = this.options,
          config = this.config,
          appConfigPath = opts.configPath,
          isJS = appConfigPath.match(/\.js$/i);

      this.Utils.setProp(config, `${opts.appName}-cache.${key}`, data);
      var configJSON = JSON.stringify(config, undefined, 2);

      await new Promise((resolve, reject) => {
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

    writeToStorage(...args) {
      return this.onPersistSave(...args);
    }

    readFromStorage(...args) {
      return this.onPersistLoad(...args);
    }

    getEngine(name) {
      if (!name || name === '*')
        return this;

      var thisEngine = this._engines[name];
      if (!thisEngine)
        throw new Error(`No such module: ${name}`);

      if (thisEngine.instance)
        return thisEngine.instance;

      if (thisEngine.instance !== undefined)
        return;

      var WrappedEngineClass = this.wrapClass(thisEngine.engineClass);
      var opts = this.getConfigValue(thisEngine.configKey),
          instance = (WrappedEngineClass.createInstance instanceof Function)
            ? WrappedEngineClass.createInstance(WrappedEngineClass, opts)
            : (new WrappedEngineClass(opts));

      thisEngine.instance = instance;

      return instance;
    }

    registerEngine(engineOptions) {
      var name = engineOptions.name,
          isApp = (!name),
          prettyName = (isApp) ? '' : this.Utils.capitalize(name),
          opts = engineOptions.options || {},
          requires = opts.requires,
          dependsOnCallback = this.engineDependsOn(requires);

      if (opts.altName)
        prettyName = opts.altName;

      if (!name)
        name = '*';

      var engineClass = (isApp) ? undefined : this[prettyName];

      this._engines[name] = Object.assign({
        name,
        engineClass,
        order: this._engineOrder++,
        configKey: (engineOptions.name) ? name : 'app',
        beforeStartCheck: dependsOnCallback,
        startCheck: dependsOnCallback,
        afterStartCheck: dependsOnCallback,
        beforeShutdownCheck: dependsOnCallback,
        shutdownCheck: dependsOnCallback,
        afterShutdownCheck: dependsOnCallback
      }, opts);
    }

    getEnginesInfo() {
      var keys = Object.keys(this._engines),
          modules = [];

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            thisEngine = this._engines[key];

        modules.push(thisEngine);
      }

      modules = modules.sort((a, b) => {
        var x = a.order,
            y = b.order;

        return (x == y) ? 0 : (x < y) ? -1 : 1;
      });

      return modules;
    }

    getEngineInfo(name) {
      return this._engines[name];
    }

    beforeStartEngines() {
      return doEnginesAction.call(this, 'beforeStart');
    }

    startEngines() {
      return doEnginesAction.call(this, 'start');
    }

    afterStartEngines() {
      return doEnginesAction.call(this, 'afterStart');
    }

    beforeShutdownEngines() {
      return doEnginesAction.call(this, 'beforeShutdown');
    }

    shutdownEngines() {
      return doEnginesAction.call(this, 'shutdown');
    }

    afterShutdownEngines() {
      return doEnginesAction.call(this, 'afterShutdown');
    }

    async onMigrationEngineAfterStart() {
      await this.onStartupCheck();
    }

    async onRouteEngineAfterStart() {
      var routeEngine = this.getRouteEngine();
      routeEngine.generateCRUDRoutesFromSchema();
    }

    async start() {
      try {
        // process.on('SIGINT', () => {
        //   this.stop();
        // }).on('SIGTERM', () => {
        //   this.stop();
        // });

        // Load app configuration (if any)
        this.config = await this.loadAppConfig();

        // await this.beforeStartEngines();
        // await this.startEngines();
        // await this.afterStartEngines();
      } catch (e) {
        this.Logger.error(e);
        await this.onPanic();
      }
    }

    async onPanic() {
      await this.stop();
      process.exit(1);
    }

    async stop() {
      if (!this.status)
        return;

      this.status = 0;

      // await this.beforeShutdownEngines();
      // await this.shutdownEngines();
      // await this.afterShutdownEngines();

      // this.Logger.info('Application shutdown successfully!');
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

        if (migrationName === true)
          migrationName = null;

        try {
          if (!noe(migrationName) && instanceOf(migrationName, 'string', 'number', 'boolean'))
            await migrationEngine.executeMigration(('' + migrationName));
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

    injectApplicationHelpers(instance) {
      if (instance && !(instance.getApplication instanceof Function))
        instance.getApplication = () => this;

      return instance;
    }

    wrapClass(Klass) {
      if ('getApplication' in Klass.prototype)
        return Klass;

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
      var keys = Object.getOwnPropertyNames(Klass);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        if (Function.hasOwnProperty(key))
          continue;

        wrappedKlass[key] = Klass[key];
      }

      return wrappedKlass;
    }

    getModelBaseClass() {
      return this.ModelBase;
    }

    getModelTypeClass() {
      return this.ModelType;
    }

    getSchemaTypeClass() {
      return this.SchemaType;
    }

    getConnectorClass() {
      return this.BaseConnector;
    }

    getQueryEngineClass() {
      return this.QueryEngine;
    }

    getSchemaType(typeName) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getSchemaType(typeName);
    }

    getModelType(data, _opts) {
      if (instanceOf(data, this.getModelTypeClass()))
        return data;

      if (instanceOf(data, this.getModelBaseClass()))
        return data.schema();

      var opts = _opts || {},
          schemaEngine = this.getSchemaEngine(opts);

      return schemaEngine.introspectModelType(data, opts);
    }

    getModelTypesFromQuery(mainQuery) {
      function loopQueryConditions(query, _currentModel) {
        var currentModel = _currentModel;

        query.iterateConditions((condition) => {
          if (instanceOf(condition, QueryEngine))
            return loopQueryConditions.call(this, condition, (condition.getFirstConditionFlags() & QueryEngineFlags.OR) ? undefined : currentModel);

          if (!currentModel || (condition.flags & QueryEngineFlags.OR)) {
            currentModel = {};
            models.push(currentModel);
          }

          currentModel[condition.field] = condition.value;
        });
      }

      var models = [],
          QueryEngine = this.getQueryEngineClass(),
          QueryEngineFlags = QueryEngine.FLAGS,
          finalModelTypes = {};

      loopQueryConditions.call(this, mainQuery);

      for (var i = 0, il = models.length; i < il; i++) {
        var model = models[i];
        if (noe(model))
          continue;

        var modelType = this.getModelType(model, { operation: 'query', model });
        if (modelType) {
          var typeName = modelType.getTypeName(),
              key = `${typeName}:${this.Utils.id(modelType.getSchemaEngine())}`;

          if (finalModelTypes.hasOwnProperty(key))
            continue;

          finalModelTypes[key] = modelType;
        }
      }

      return Object.keys(finalModelTypes).map((key) => finalModelTypes[key]);
    }

    getConnectors(_filter) {
      var filter = _filter || {},
          operation = filter.operation,
          connectorEngine = this.getConnectorEngine();

      if (operation === 'query')
        filter = { read: true, primary: true };

      return connectorEngine.getConnectors(filter);
    }

    getConnector(filter) {
      return this.getConnectors(filter)[0];
    }

    async operateOnModels(cb, _models, _opts) {
      var models = _models,
          opts = _opts || {},
          promises = [],
          ModelTypeClass = this.getModelTypeClass(),
          ConnectorBaseClass = this.getConnectorClass();

      if (!(models instanceof Array))
        models = [models];

      for (var i = 0, il = models.length; i < il; i++) {
        var model = models[i];
        if (!model)
          continue;

        var thisOpts = Object.assign({}, opts, {
              operation: 'write',
              model
            }),
            modelType = this.getModelType(model, thisOpts);

        if (!instanceOf(modelType, ModelTypeClass))
          throw new Error('Do not know how to save model. Unknown model type');

        thisOpts.modelType = modelType;
        var connector = this.getConnector(thisOpts);
        if (!instanceOf(connector, ConnectorBaseClass))
          throw new Error('Can not save model. Unable to find a suitable connector to save to');

        promises.push(cb.call(this, connector, model, thisOpts));
      }

      var rets = await Promise.all(promises);
      return rets.reduce((finalRets, val) => {
        return finalRets.concat(val);
      }, []);
    }

    async create(_data, _opts) {
      var data = _data || {},
          opts = _opts || {},
          modelType = opts.modelType;

      if (instanceOf(_opts, 'string', 'number', 'boolean')) {
        modelType = ('' + _opts);
        opts = {};
      }

      if (instanceOf(_data, 'string', 'number', 'boolean')) {
        modelType = ('' + _data);
        data = {};
      }

      var thisOpts = Object.assign({ operation: 'create', modelType, model: data }, opts),
          schemaEngine = this.getSchemaEngine(thisOpts);

      return await schemaEngine.create(modelType, data, thisOpts);
    }

    async save(_models, _opts) {
      return await this.operateOnModels((connector, model, opts) => connector.write(model, opts), _models, _opts);
    }

    async destroy(_models, _opts) {
      return await this.operateOnModels((connector, model, opts) => connector.destroy(model, opts), _models, _opts);
    }

    where(...args) {
      return this.query(...args);
    }

    query(_opts) {
      var opts = _opts || {};

      if (instanceOf(opts, 'string', 'number', 'boolean')) {
        opts = {
          modelType: this.getModelType(null, { modelType: opts, operation: 'query' })
        };
      }

      var QueryEngineClass = this.wrapClass(this.getQueryEngineClass());
      return new QueryEngineClass(opts);
    }
  }

  // Dynamically construct methods for engines
  var proto = Application.prototype;

  DEFAULT_ENGINES.concat({ name: null }).forEach((engine) => {
    var name = engine.name,
        prettyName = (name) ? Utils.capitalize(name) : '',
        opts = engine.options || {};

    if (opts.altName)
      prettyName = opts.altName;

    ['beforeStart', 'start', 'afterStart', 'beforeShutdown', 'shutdown', 'afterShutdown'].forEach((eventName) => {
      var engineEventName = `on${prettyName}${capitalize(eventName)}`,
          getterName = `get${prettyName}`;

      if (!(engineEventName in proto))
        proto[engineEventName] = async function() {};

      if (!(getterName in proto)) {
        proto[getterName] = function() {
          return this.getEngine(name);
        };
      }
    });
  });

  Object.assign(root, {
    Application
  });
})(module.exports);
