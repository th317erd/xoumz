module.exports = function(root, requireModule) {
  const { instanceOf, noe, setProp, sizeOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const Logger = requireModule('./logger');
  const { ModelType } = requireModule('./schema');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { QueryEngine } = requireModule('./query-engine');

  class BaseSQLConnector extends BaseConnector {
    escape(...args) {
      throw new Error('SQL connector doesn\'t implement "escape" method');
    }

    async exec(queryStr, values) {
      throw new Error('SQL connector doesn\'t implement "exec" method');
    }

    async execAll(queries, _opts) {
      throw new Error('SQL connector doesn\'t implement "execAll" method');
    }

    getDefaultDBStorageEngine() {
      throw new Error('SQL connector doesn\'t implement "getDefaultDBStorageEngine" method');
    }

    getDefaultStringMaxLength() {
      return 255;
    }

    getDefaultCharset() {
      return 'utf8';
    }

    getDefaultCollate() {
      throw new Error('SQL connector doesn\'t implement "getDefaultCollate" method');
    }

    async migrate(schemaEngine, _opts) {
      var opts = _opts || {},
          tables = await this.getSchema();

      Logger.debug(`Migrating ${this.getContext()} connector!`);

      await Promise.all(schemaEngine.iterateModelSchemas(async (modelType, typeName) => {
        var tableName = this.getTableNameFromModelType(schemaEngine, modelType),
            table = tables[typeName];

        var queries = this.generateTableUpdateQueries(schemaEngine, tableName, modelType, { ...opts, create: noe(table) });
        await this.execAll(queries);
      }));
    }

    async dropColumn(schemaEngine, modelType, schemaType) {
      var tableName = (modelType instanceof ModelType) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType,
          columnName = (schemaType instanceof SchemaType) ? schemaType.getProp('field', this.getContext()) : schemaType;

      if (noe(tableName))
        throw new Error('Can not drop column, unknown table name');

      if (noe(columnName))
        throw new Error(`Can not drop column, unknown column name (for table ${tableName})`);

      var queries = this.generateDropColumnQueries(tableName, columnName);
      await this.execAll(queries);
    }

    getSQLSchemaColumns() {
      throw new Error('SQL connector doesn\'t implement "getSQLSchemaColumns" method');
    }

    getSQLSchemaColumnKeys() {
      throw new Error('SQL connector doesn\'t implement "getSQLSchemaColumnKeys" method');
    }

    getSchemaTypeFromRow(row) {
      var obj = {},
          schemaColumns = this.getSQLSchemaColumns(),
          schemaColumnKeys = this.getSQLSchemaColumnKeys(),
          fieldName = schemaColumns['column.field'];

      for (var i = 0, il = schemaColumnKeys.length; i < il; i++) {
        var key = schemaColumnKeys[i],
            rowKey = schemaColumns[key],
            val = row[rowKey];

        if (key === 'column.nullable') {
          key = 'column.notNull';
          val = !!(('' + val).match(/^n/i));
        } else if (key === 'column.key') {
          if (('' + val).match(/pri/i)) {
            key = 'column.primaryKey';
            val = true;
          } else {
            key = null;
          }
        } else if (key === 'column.type') {
          val = this.databaseTypeNameToSchemaTypeName(val, fieldName);
        }

        if (!key)
          continue;

        setProp(obj, key, val);
      }

      return obj;
    }

    async getRawDatabaseSchema() {
      throw new Error('SQL connector doesn\'t implement "getRawDatabaseSchema" method');
    }

    queryConditionalToString(query) {
      function greaterLessThen(invert) {
        var op = [];
        if (flags & QueryEngine.FLAGS.NOT) {
          op.push((!invert) ? '<' : '>');
          if (!(flags & QueryEngine.FLAGS.EQUAL))
            op.push('=');
        } else {
          op.push((!invert) ? '>' : '<');
          if (flags & QueryEngine.FLAGS.EQUAL)
            op.push('=');
        }

        return `${field}${op.join('')}${this.escape(value)}`;
      }

      var { flags, field, value } = query;

      if (flags & QueryEngine.FLAGS.CONTAINS) {
        return `${field} ${(flags & QueryEngine.FLAGS.NOT) ? 'NOT ' : ''}IN (${value.map((v) => this.escape(v)).join(',')})`;
      } else if (flags & QueryEngine.FLAGS.GREATER) {
        return greaterLessThen.call(this, false);
      } else if (flags & QueryEngine.FLAGS.SMALLER) {
        return greaterLessThen.call(this, true);
      } else if (flags & QueryEngine.FLAGS.EQUAL) {
        if (flags & QueryEngine.FLAGS.FUZZY) {
          if (!value)
            throw new Error('Value can not be NULL for LIKE condition');

          return `${field} LIKE ${this.escape(value.replace(/[*?]/g, function(m) {
            return (m === '*') ? '%' : '_';
          }))}`;
        } else {
          var val = this.escape(value),
              isNull = (value === undefined || value === null),
              op = '';

          if (flags & QueryEngine.FLAGS.NOT) {
            if (isNull)
              op = 'IS NOT';
            else
              op = '!=';
          } else {
            if (isNull)
              op = 'IS';
            else
              op = '=';
          }

          return `${field}${op}${val}`;
        }
      }
    }

    queryEngineToQueryString(modelType, query) {
      function queryToString(query) {
        var queryStr = [];

        query.iterateConditions((query) => {
          if (query instanceof QueryEngine) {
            if (queryStr.length) {
              var flags = query.getFirstConditionFlags();
              queryStr.push((flags & QueryEngine.FLAGS.OR) ? ' OR ' : ' AND ');
            }

            queryStr.push(`(${queryToString.call(this, query)})`);
          } else {
            if (queryStr.length)
              queryStr.push((query.flags & QueryEngine.FLAGS.OR) ? ' OR ' : ' AND ');

            queryStr.push(this.queryConditionalToString.call(this, query));
          }
        });

        return queryStr.join('');
      }

      return `ownerID IS NULL AND (${queryToString.call(this, query)})`;
    }

    async query(modelType, query, opts) {
      console.log('Query: ', this.queryEngineToQueryString(modelType, query));

      // var opts = _opts || {},
      //     filterOps = [],
      //     modelType = this.introspectSchemaType(schema, queryUtils.paramsToRawObject(params), opts);

      // if (!(modelType instanceof ModelType))
      //   throw new Error(`Connector (${this.context}) error: Can not query data: unkown or invalid schema type`);

      // var tableName = this.getTableNameFromModelType(schema, modelType);
      // if (noe(tableName))
      //   throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      // queryUtils.iterateQueryParams(modelType, params, (param, key, modelType, opts) => {
      //   if (!modelType.hasField(key))
      //     Logger.warn(`Query field ${key} specified by ${modelType.getTypeName()} model schema doesn't have a field named ${key}`);

      //   filterOps.push(param);
      // }, opts);

      // console.log('Would query: ', tableName, filterOps);
    }

    async writeRaw(schema, decomposedModel, _opts) {
      throw new Error(`Connector [${this.context}] doesn't implement "writeRaw" method`);
    }

    async write(schema, data, _opts) {
      if (!data || !instanceOf(data, 'object') || !sizeOf(data))
        return;

      var opts = _opts || {},
          modelType = this.introspectSchemaType(schema, data, opts);

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not write data: unkown of invalid schema type`);

      var items = data.decompose();
      var promises = items.map((item) => this.writeRaw(schema, item, opts));

      return Promise.all(promises);
    }
  }

  Object.assign(root, {
    BaseSQLConnector
  });
};
