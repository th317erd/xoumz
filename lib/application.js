const { requireModule } = require('./base'),
      Utils = require('./utils'),
      janap = require('janap'),
      path = require('path'),
      fs = require('fs');

const { definePropertyRW, definePropertyRO, sizeOf, noe, instanceOf, prettify } = Utils;

const DEFAULT_ENGINES = [
  { name: 'schemaEngine', options: { configKey: 'schema' } },
  { name: 'connectorEngine', options: { configKey: 'connectors' } },
  { name: 'migrationEngine', options: { configKey: 'migration' } },
  { name: 'permissionEngine', options: { configKey: 'permissions' } },
  { name: 'httpServer', options: { altName: 'HTTPServer', configKey: 'http' } },
  { name: 'routeEngine', options: { requires: ['httpServer'], configKey: 'routes' } }
];

(function(root) {
  async function doEnginesAction(callbackName, eventName) {
    var modules = this.getEnginesInfo();

    for (var i = 0, il = modules.length; i < il; i++) {
      var thisEngine = modules[i];

      if (thisEngine[callbackName] instanceof Function && thisEngine[callbackName].call(this, thisEngine) === false) {
        thisEngine.instance = false;
        continue;
      }

      var instance = this.getEngine(thisEngine.name),
          extraCallable = (instance && thisEngine.name && thisEngine.name !== '*');

      if (extraCallable && instance.onInit instanceof Function && callbackName === 'startCallback')
        await instance.onInit();

      await this[thisEngine[eventName]].call(this, instance);

      if (extraCallable && instance.start instanceof Function && callbackName === 'startCallback')
        await instance.start();
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

      const Logger = this.requireModule('./logger');
      const Schema = this.requireModule('./schema');
      const Connectors = this.requireModule('./connectors');
      const Models = this.requireModule('./models');
      const Migration = this.requireModule('./migration');
      const QueryEngine = this.requireModule('./query-engine');
      const PermissionEngine = this.requireModule('./security/permission-engine');
      const HTTPServer = this.requireModule('./http/http-server');
      const RouteEngine = this.requireModule('./routes');
      const ContentType = this.requireModule('./content-type');

      Object.assign(this, Schema, Connectors, Migration, QueryEngine, PermissionEngine, HTTPServer, RouteEngine, ContentType, {
        Logger,
        Utils,
        Models,
        ModelBase: Models.ModelBase
      });

      var configPrefix = opts.appName;

      // Register myself as an engine (treated specially... this just helps with events)
      this.registerEngine({
        name: null,
        options: { configKey: configPrefix }
      });

      // Register all default engines
      DEFAULT_ENGINES.forEach((engine) => {
        this.registerEngine(engine);
      });

      // Load all plugins
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

    onExitApplication(status) {
      this.status = 0;
      process.exit(status);
    }

    async onShutdown() {
      var connectorEngine = this.getConnectorEngine();
      await connectorEngine.onShutdown();

      var server = this.getHTTPServer();
      if (server)
        await server.stop();

      this.Logger.info('Application shutdown successfully!');
    }

    async stop() {
      await this.onShutdown();
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

      var engineClass = (isApp) ? undefined : this[prettyName],
          eventName = `on${prettyName}Init`,
          beforeEventName = `onBefore${prettyName}Init`,
          afterEventName = `onAfter${prettyName}Init`;

      this._engines[name] = Object.assign({
        name,
        eventName,
        beforeEventName,
        afterEventName,
        engineClass,
        order: this._engineOrder++,
        configKey: (engineOptions.name) ? name : 'app',
        initCallback: dependsOnCallback,
        startCallback: dependsOnCallback,
        finalizeCallback: dependsOnCallback
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

    initEngines() {
      return doEnginesAction.call(this, 'initCallback', 'beforeEventName');
    }

    startEngines() {
      return doEnginesAction.call(this, 'startCallback', 'eventName');
    }

    finalizeEngines() {
      return doEnginesAction.call(this, 'finalizeCallback', 'afterEventName');
    }

    generateCRUDRoutesFromSchema(_prefix) {
      var prefix = _prefix,
          schemaEngine = this.getSchemaEngine(),
          routeEngine = this.getRouteEngine();

      if (!schemaEngine || !routeEngine)
        return;

      if (!prefix)
        prefix = '';

      schemaEngine.iterateModelSchemas((typeInfo, typeName) => {
        if (typeInfo.primitiveType)
          return;

        var modelType = typeInfo.modelType;
        routeEngine.registerRoute((Route) => {
          var matchingRE = new RegExp(`^${this.Utils.regExpEscape(prefix)}/(${this.Utils.regExpEscape(typeName.toLowerCase())})(?:/(.*))?`, 'i');
          return class SchemaGeneratedCRUDRoute extends Route {
            static match(url, request) {
              return ('' + url.pathname).match(matchingRE);
            }

            getModelType() {
              return modelType;
            }
          };
        }, this.CRUDRoute);
      }, true);
    }

    async onAfterRouteEngineInit() {
      this.generateCRUDRoutesFromSchema();
    }

    async start() {
      try {
        process.on('SIGINT', () => {
          this.stop();
        }).on('SIGTERM', () => {
          this.stop();
        });

        // Load app configuration (if any)
        this.config = await this.loadAppConfig();

        await this.initEngines();
        await this.startEngines();
        await this.finalizeEngines();
      } catch (e) {
        this.Logger.error(e);
        this.onExitApplication(1);
      }
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
      return this.getConnectors(filter)[0];
    }

    async create(modelType, ...args) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.create(modelType, ...args);
    }

    async save(models, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          opts = _opts || {},
          connectors = opts.connectors || opts.connector,
          promises = [];

      if (!connectors)
        connectors = this.getConnectors({ writable: true });

      if (connectors && !(connectors instanceof Array))
        connectors = [connectors];

      if (noe(connectors))
        throw new Error('No readable connector found');

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i];
        promises.push(schemaEngine.save(connector, models, opts));
      }

      var rets = await Promise.all(promises);

      return rets.reduce((finalRets, val) => {
        return finalRets.concat(val);
      }, [])
    }

    where(...args) {
      return this.query(...args);
    }

    query(modelType, _opts) {
      var schemaEngine = this.getSchemaEngine(),
          opts = _opts || {},
          connector = opts.connector;

      if (!connector)
        connector = this.getConnector({ readable: true, primary: true });

      if (!connector)
        throw new Error('No readable connector found');

      return schemaEngine.query(connector, modelType, opts);
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

    var eventName = `on${prettyName}Init`,
        beforeEventName = `onBefore${prettyName}Init`,
        afterEventName = `onAfter${prettyName}Init`,
        getterName = `get${prettyName}`;

    if (!(eventName in proto))
      proto[eventName] = async function() {};

    if (!(beforeEventName in proto))
      proto[beforeEventName] = async function() {};

    if (!(afterEventName in proto))
      proto[afterEventName] = async function() {};

    if (!(getterName in proto)) {
      proto[getterName] = function() {
        return this.getEngine(name);
      };
    }
  });

  Object.assign(root, {
    Application
  });
})(module.exports);
