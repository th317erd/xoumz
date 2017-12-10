module.exports = function(root, requireModule) {
  const { definePropertyRW, instanceOf, noe, getProp, setProp, sizeOf, pluralOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const queryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');
  const { ModelType } = requireModule('./schema');

  class BaseSQLConnector extends BaseConnector {
    async exec(queryStr, values) {
      throw new Error(`SQL connector doesn't implement "exec" method`);
    }

    async execAll(queries, _opts) {
      throw new Error(`SQL connector doesn't implement "execAll" method`);
    }

    getDefaultDBStorageEngine() {
      throw new Error(`SQL connector doesn't implement "getDefaultDBStorageEngine" method`);
    }

    getDefaultStringMaxLength() {
      return 255;
    }

    getDefaultCharset() {
      return 'utf8';
    }

    getDefaultCollate() {
      throw new Error(`SQL connector doesn't implement "getDefaultCollate" method`);
    }

    async migrate(schemaEngine, _opts) {
      var opts = _opts || {},
          tables = await this.getSchema();

      Logger.debug(`Migrating ${this.getContext()} connector!`);
      
      await Promise.all(schemaEngine.iterateModelSchemas(async (modelType, typeName) => {
        var tableName = this.getTableNameFromModelType(schemaEngine, modelType),
            table = tables[tableName];

        if (!table) {
          var queries = this.generateTableUpdateQueries(schemaEngine, tableName, modelType, { ...opts, create: true });
          
          try {
            var results = await this.execAll(queries);
            console.log('Query results: ', results);
          } catch (e) {
            Logger.error(e);
          }

          return true;
        }
      }));
    }

    getSQLSchemaColumns() {
      throw new Error(`SQL connector doesn't implement "getSQLSchemaColumns" method`);
    }

    getSQLSchemaColumnKeys() {
      throw new Error(`SQL connector doesn't implement "getSQLSchemaColumnKeys" method`);
    }

    getSchemaTypeFromRow(row) {
      var obj = {},
          schemaColumns = this.getSQLSchemaColumns(),
          schemaColumnKeys = this.getSQLSchemaColumnKeys();

      for (var i = 0, il = schemaColumnKeys.length; i < il; i++) {
        var key = schemaColumnKeys[i],
            rowKey = schemaColumns[key],
            val = row[rowKey];

        if (key === 'column.nullable') {
          key = 'column.notNull';
          val = (('' + val).match(/^n/i)) ? true : false;
        } else if (key === 'column.key') {
          if (('' + val).match(/pri/i)) {
            key = 'column.primaryKey';
            val = true;
          } else {
            key = null;
          }
        } else if (key === 'column.type') {
          val = this.databaseTypeNameToSchemaTypeName(val);
        }

        if (!key)
          continue;
        
        setProp(obj, key, val);
      }

      return obj;
    }

    async getRawDatabaseSchema() {
      throw new Error(`SQL connector doesn't implement "getRawDatabaseSchema" method`);
    }

    async query(schema, params, _opts) {
      var opts = _opts || {},
          finalOptions = [],
          filterOps = [],
          modelType = this.introspectSchemaType(schema, queryUtils.paramsToRawObject(params), opts);

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not query data: unkown or invalid schema type`);
        
      var tableName = this.getTableNameFromModelType(schema, modelType);
      if (noe(tableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      queryUtils.iterateQueryParams(modelType, params, (param, key, modelType, opts) => {
        if (!modelType.hasField(key))
          Logger.warn(`Query field ${key} specified by ${modelType.getTypeName()} model schema doesn't have a field named ${key}`);

        filterOps.push(param);
      }, opts);

      console.log('Would query: ', tableName, filterOps);
    }

    async write(schema, data, _opts) {
      if (!data || !instanceOf(data, 'object') || !sizeOf(data))
        return;

      var opts = _opts || {},
          modelType = this.introspectSchemaType(schema, data, opts);
          
      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not write data: unkown of invalid schema type`);

      var tableName = this.getTableNameFromModelType(schema, modelType);

      console.log('Would write to connector: ', tableName, data);
    }
  }

  Object.assign(root, {
    BaseSQLConnector
  });
};
