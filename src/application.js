import { definePropertyRW } from './utils';
import { Schema, SchemaTypes } from './schema';
import { BaseRecord } from './base-record';

(function(root) {
  class Application {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);

      if (!opts.baseRecordType)
        opts.baseRecordType = BaseRecord;

      if (!opts.schema)
        opts.schema = new Schema(opts.baseRecordType); 
    }
      
    async init(cb) {
      var opts = this.options,
          schema = opts.schema;

      await cb.call(this, schema, opts.baseRecordType, this.options);
      await schema.initialize();
    }

    getSchema() {
      return this.options.schema;
    }
  }

  Object.assign(root, {
    Application
  });
})(module.exports);
