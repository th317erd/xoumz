module.exports = function(root, requireModule) {
  const { definePropertyRW, instanceOf, noe, getProp } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const queryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');
  const Schema = requireModule('./schema');

  class MemoryConnector extends BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});
      if (!opts.context)
        opts.context = 'memory';

      super({ ...opts, read: true, write: true });

      definePropertyRW(this, 'tables', {});
    }

    getTableItems(table) {
      return this.tables[table] || [];
    }

    getTable(schema) {
      var tableField = schema.getFieldProp('_table', 'value', 'memory');
      return (tableField) ? tableField : 'default';
    }

    async query(schema, params, _opts) {
      var opts = _opts || {},
          finalOptions = [],
          filterOps = [];

      if (!schema || !(schema instanceof Schema.ModelSchema)) {
        console.log(schema);
        throw new Error('First argument to connector "query" must be a model schema');
      }
        
      var tableName = this.getTable(schema);

      if (noe(tableName))
        throw new Error(`${schema.getTypeName()} model doesn't specify a valid database table / bucket`);

      queryUtils.iterateQueryParams(schema, params, (param, key, schema, opts) => {
        if (!schema.hasField(key))
          Logger.warn(`Query field ${key} specified by ${schema.getTypeName()} model schema doesn't have a field named ${key}`);

        filterOps.push(param);
      }, opts);

      return this.getTableItems(tableName).filter((item) => {
        for (var i = 0, il = filterOps.length; i < il; i++) {
          var filterOp = filterOps[i],
              filteOpField = filterOp.field,
              filterOpValue = filterOp.value,
              filterOpArgs = filterOp.args,
              filterOpType = filterOp.type,
              fieldValue = getProp(item, filteOpField);

          if (filterOpType === 'EQ') {
            var isStrict = !!filterOpArgs[0],
                filterBy = filterOpValue;

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
          tableName = this.getTable(schema),
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
