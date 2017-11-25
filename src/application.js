import { requireModule as baseRequireModule } from './base';

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
      const BaseRecord = requireModule('./base-record');
      const ConnectorCollection = requireModule('./connectors');
      const QueryUtils = requireModule('./connectors/query-utils');

      Object.assign(this, {
        Logger,
        Utils,
        Schema,
        SchemaTypes,
        BaseRecord,
        ConnectorCollection,
        QueryUtils
      });

      Utils.definePropertyRW(this, 'options', opts);
    }
      
    async init(cb) {
      var opts = this.options,
          schema = opts.schema;

      if (!opts.baseRecordType)
        opts.baseRecordType = this.BaseRecord.BaseRecord;

      if (!opts.schema)
        schema = opts.schema = new (this.wrapClass(this.Schema.Schema))(opts);
      else
        this.injectApplicationHelpers(opts.schema);

      if (!opts.connectors)
        opts.connectors = new (this.wrapClass(this.ConnectorCollection.ConnectorCollection))(opts);
      else
        this.injectApplicationHelpers(opts.connectors);

      opts.baseRecordType = this.wrapClass(opts.baseRecordType);

      await cb.call(this, this, schema, opts.connectors, opts.baseRecordType, this.options);
      await schema.initialize();
    }

    injectApplicationHelpers(instance) {
      if (!(instance.getApplication instanceof Function)) {
        instance.getApplication = () => this;
      }
    }

    wrapClass(Klass) {
      var opts = this.options;
      return class GenericWrappedClass extends Klass {
        getApplication() {
          return opts.application;
        }
      };
    }

    getSchema() {
      return this.options.schema;
    }

    getTypeSchema(_modelType, ...args) {
      var modelType = _modelType;
      if (modelType instanceof this.Schema.ModelSchema)
        return modelType;

      if (modelType instanceof this.options.baseRecordType)
        return modelType.schema();

      var schema = this.getSchema(...args),
          modelType = schema.getModelSchema(('' + modelType));

      if (!modelType)
        throw new Error(`Unknown schema type ${_modelType}`);

      return modelType;
    }

    getConnectors(filter) {
      return this.options.connectors.getConnectors(filter);
    }

    getConnector(filter) {
      return this.options.connectors.getConnector(filter);
    }

    async createType(modelType, ...args) {
      var schema = this.getSchema();
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
