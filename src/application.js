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
      const BaseRecord = requireModule('./base-record');
      const ConnectorCollection = requireModule('./connectors');

      Object.assign(this, {
        Logger,
        Utils,
        Schema,
        BaseRecord,
        ConnectorCollection
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

      await cb.call(this, this, schema, opts.connectors, opts.baseRecordType, this.options);
      await schema.initialize();
    }

    getSchema() {
      return this.options.schema;
    }

    getTypeSchema(typeName, ...args) {
      var schema = this.getSchema(...args);
      return schema.getType(typeName);
    }

    createType(typeName, ...args) {
      var schema = this.getSchema();
      return schema.createType(typeName, ...args);
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
