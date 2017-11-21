module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const queryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');

  class MemoryConnector extends BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      if (!opts.context)
        opts.context = 'memory';

      super(opts);

      definePropertyRW(this, 'tables', {});
    }

    getTableItems(table) {
      return this.tables[table] || [];
    }

    async query(schemaType, params, _opts) {
      var opts = _opts || {},
          finalOptions = [],
          filterOps = [];

      if (!schemaType || !(schemaType.schema instanceof Function))
        throw new Error('First argument to connector "query" must be a model type');
        
      var schema = schemaType.schema(),
          tableName = schema.getTable();

      if (noe(tableName))
        throw new Error(`${schema.getTypeName()} model doesn't specify a valid database table / bucket`);

      iterateQueryParams(schemaType, params, (param, key, schemaType, opts) => {
        if (!schema.hasField(key))
          Logger.warn(`Query field ${key} specified by ${schema.getTypeName()} model schema doesn't have a field named ${key}`);

        filterOps.push({ param, field: key });
      }, opts);

      return getTableItems(tableName).filter((item) => {
        for (var i = 0, il = filterOps.length; i < il; i++) {
          var filterOp = filterOps[i],
              filterOpArgs = filterOp.value,
              type = filterOp.type,
              fieldValue = U.get(item, filterOp.field);

          if (type === 'EQ') {
            var isStrict = !!filterOpArgs[1],
                filterBy = filterOpArgs[0];

            if (!isStrict) {
              filterBy = ('' + filterBy).toLowerCase();
              fieldValue = ('' + fieldValue).toLowerCase();
            }

            if (filterBy !== fieldValue)
              return false;
          }
        }

        return true;
      });
    }

    async write(data, _opts) {
      var opts = _opts || {};

      if (!data || !(data.schema instanceof Function))
        throw new Error('Trying to write an unknown model type to connector');
        
      var schema = data.schema(),
          tableName = schema.getTable(),
          table = this.tables[tableName];

      if (!table)
        table = this.tables[tableName] = [];
      
      table.push(data);
    }
  }

  Object.assign(root, {
    MemoryConnector
  });
};
