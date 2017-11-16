import { BaseConnector } from './base-connector';
import queryUtils from './query-utils';

(function(root) {
  class MemoryConnector extends BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      if (!opts.context)
        opts.context = 'memory';

      super(opts);
    }

    async query(schemaType, params, _opts) {
      var opts = _opts || {};
      
      iterateQueryParams(schemaType, params, () => {
      }, opts);
    }

    async write(data, _opts) {
      var opts = _opts || {};
    }
  }

  Object.assign(root, {
    MemoryConnector
  });
})(module.exports);
