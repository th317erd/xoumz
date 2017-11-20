import { definePropertyRW } from './utils';
import { Schema, SchemaTypes } from './schema';
import { BaseRecord } from './base-record';
import { ConnectorCollection } from './connectors';

(function(root) {
  class Application {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {}, { application: this });

      definePropertyRW(this, 'options', opts);

      if (!opts.baseRecordType)
        opts.baseRecordType = BaseRecord;

      if (!opts.schema)
        opts.schema = new Schema(opts);

      if (!opts.connectors)
        opts.connectors = new ConnectorCollection(opts);
    }
      
    async init(cb) {
      var opts = this.options,
          schema = opts.schema;

      await cb.call(this, schema, opts.connectors, opts.baseRecordType, this.options);
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
