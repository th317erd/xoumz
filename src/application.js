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
        schema = opts.schema = new this.Schema.Schema(opts);

      if (!opts.connectors)
        opts.connectors = new this.ConnectorCollection.ConnectorCollection(opts);

      opts.baseRecordType = this.wrapClass(opts.baseRecordType);

      await cb.call(this, this, schema, opts.connectors, opts.baseRecordType, this.options);
      await schema.initialize();
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

    getTypeSchema(_schemaType, ...args) {
      var schemaType = _schemaType;
      if (schemaType instanceof this.Schema.ModelSchema)
        return schemaType;

      if (schemaType instanceof this.options.baseRecordType)
        return schemaType.schema();

      var schema = this.getSchema(...args),
          schemaType = schema.getModelSchema(('' + schemaType));

      if (!schemaType)
        throw new Error(`Unknown schema type ${_schemaType}`);

      return schemaType;
    }

    getConnectors(filter) {
      return this.options.connectors.getConnectors(filter);
    }

    getConnector(filter) {
      return this.options.connectors.getConnector(filter);
    }

    createType(typeName, ...args) {
      var schema = this.getSchema();
      return schema.createType(typeName, ...args);
    }

    async saveType(_schemaType, model, _opts) {
      var schemaType = this.getTypeSchema(_schemaType),
          connectors = this.getConnectors({ writable: true }),
          opts = _opts || {},
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i];
        promises.push(connector.write(model, opts));
      }

      return await Promise.all(promises);
    }

    async loadType(_schemaType, params, _opts) {
      var schemaType = this.getTypeSchema(_schemaType),
          opts = _opts || {},
          connector = this.getConnector({ readable: true, primary: true });

      if (!connector)
        throw new Error('No readable connector found');

      return await connector.query(schemaType, params, opts);
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
