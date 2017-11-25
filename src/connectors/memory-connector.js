module.exports = function(root, requireModule) {
  const { definePropertyRW, instanceOf, noe, getProp, sizeOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const queryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');
  const { ModelSchema } = requireModule('./schema');

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

    getTable(modelSchema) {
      var tableField = modelSchema.getFieldProp('_table', 'value', 'memory');
      return (tableField) ? tableField : 'default';
    }

    introspectModelType(schema, data, _opts) {
      var opts = _opts || {};
      return schema.introspectModelType(data, opts);
    }

    async query(schema, params, _opts) {
      var opts = _opts || {},
          finalOptions = [],
          filterOps = [],
          modelSchema = this.introspectModelType(schema, queryUtils.paramsToRawObject(params), opts);

      if (!(modelSchema instanceof ModelSchema))
        throw new Error(`Connector (${this.context}) error: Can not query data: unkown model type`);
        
      var tableName = this.getTable(modelSchema);

      if (noe(tableName))
        throw new Error(`${modelSchema.getTypeName()} model doesn't specify a valid database table / bucket`);

      queryUtils.iterateQueryParams(modelSchema, params, (param, key, modelSchema, opts) => {
        if (!modelSchema.hasField(key))
          Logger.warn(`Query field ${key} specified by ${modelSchema.getTypeName()} model schema doesn't have a field named ${key}`);

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

    async write(schema, data, _opts) {
      if (!data || !instanceOf(data, 'object') || !sizeOf(data))
        return;

      var opts = _opts || {},
          modelSchema = this.introspectModelType(schema, data, opts);
          
      if (!(modelSchema instanceof ModelSchema))
        throw new Error(`Connector (${this.context}) error: Can not write data: unkown model type`);

      var tableName = this.getTable(modelSchema),
          table = this.tables[tableName];

      if (!table)
        table = this.tables[tableName] = [];
      
      console.log('Writing type: ', modelSchema.getTypeName());
      table.push(data);
    }
  }

  Object.assign(root, {
    MemoryConnector
  });
};
