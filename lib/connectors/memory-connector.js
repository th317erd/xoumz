module.exports = function(root, requireModule) {
  const { definePropertyRW, instanceOf, sizeOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const { ModelType } = requireModule('./schema');

  // TODO: Needs help

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

    getTable(modelType) {
      var tableField = super.getTable(modelType);
      return (tableField) ? tableField : 'default';
    }

    introspectModelType(schemaEngine, data, _opts) {
      var opts = _opts || {};
      return schemaEngine.introspectModelType(data, opts);
    }

    async query(query, _opts) {
      // var opts = _opts || {},
      //     filterOps = [],
      //     modelType = this.introspectModelType(schemaEngine, queryUtils.paramsToRawObject(params), opts);

      // if (!(modelType instanceof ModelType))
      //   throw new Error(`Connector (${this.context}) error: Can not query data: unkown or invalid schema type`);

      // var tableName = this.getTable(modelType);

      // if (noe(tableName))
      //   throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      // queryUtils.iterateQueryParams(modelType, params, (param, key, modelType, opts) => {
      //   if (!modelType.hasField(key))
      //     Logger.warn(`Query field ${key} specified by ${modelType.getTypeName()} model schema doesn't have a field named ${key}`);

      //   filterOps.push(param);
      // }, opts);

      // return this.getTableItems(tableName).filter((item) => {
      //   for (var i = 0, il = filterOps.length; i < il; i++) {
      //     var filterOp = filterOps[i],
      //         filteOpField = filterOp.field,
      //         filterOpValue = filterOp.value,
      //         filterOpArgs = filterOp.args,
      //         filterOpType = filterOp.type,
      //         fieldValue = getProp(item, filteOpField);

      //     if (filterOpType === 'EQ') {
      //       var isStrict = !!filterOpArgs[0],
      //           filterBy = filterOpValue;

      //       if (!isStrict) {
      //         filterBy = ('' + filterBy).toLowerCase();
      //         fieldValue = ('' + fieldValue).toLowerCase();
      //       }

      //       if (filterBy !== fieldValue)
      //         return false;
      //     }
      //   }

      //   return true;
      // });
    }

    async write(data, _opts) {
      if (!data || !instanceOf(data, 'object') || !sizeOf(data))
        return;

      var schemaEngine = this.getApplication().getSchemaEngine(this.getContext()),
          opts = _opts || {},
          modelType = this.introspectModelType(schemaEngine, data, opts);

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not write data: unkown of invalid schema type`);

      var tableName = this.getTable(modelType),
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
