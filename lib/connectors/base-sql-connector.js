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

    queryToSQLQueryString(modelType, query) {
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

    tableToNamedFields(schemaEngine, tableName, modelType) {
      var context = this.getContext(),
          namedFields = [],
          typeName = modelType.getTypeName();

      modelType.iterateFields((field, fieldName, index, flags) => {
        if (!(flags & ModelType.FLAGS.PRIMITIVE))
          return;

        var contextField = field.getProp('field', { context });
        namedFields.push(`${tableName}.${contextField} as ${this.escape(`${typeName}:${fieldName}`)}`);
      }, { virtual: false, primitive: true });

      return namedFields.join(',');
    }

    getRawModelDataFromRows() {
      throw new Error(`Connector [${this.context}] doesn't implement "getRawModelDataFromRows" method`);
    }

    async readPrimaryModels(schemaEngine, modelType, query, _opts) {
      var primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);
      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var querySQLWhere = this.queryToSQLQueryString(modelType, query),
          querySQL = `SELECT ${this.tableToNamedFields(schemaEngine, primaryTableName, modelType)} FROM ${primaryTableName} WHERE ${querySQLWhere}`;

      try {
        console.log('QUERY: ', querySQL);
        var result = await this.exec(querySQL),
            models = this.getRawModelDataFromRows(schemaEngine, result);

        return models;
      } catch (e) {
        Logger.error(e);
        return [];
      }
    }

    async readSecondaryModels(schemaEngine, modelType, primaryIDs, _opts) {
      var primaryTypeName = modelType.getTypeName(),
          primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var context = this.getContext(),
          primaryKeyFieldName = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field', { context }),
          primaryIDList = primaryIDs.map((id) => this.escape(id)).join(','),
          subTypeNames = modelType.getChildTypeNames({ target: true }).filter((name) => {
            if (name === primaryTypeName)
              return false;

            if (name.match(/(OwnerField|OwnerID|OwnerType)/))
              return false;

            return true;
          }),
          subTypes = subTypeNames.map((typeName) => {
            var subModelType = schemaEngine.getModelType(typeName);
            if (!(subModelType instanceof ModelType))
              throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid schema type`);

            var thisTableName = this.getTableNameFromModelType(schemaEngine, subModelType);
            if (noe(thisTableName))
              throw new Error(`${subModelType.getTypeName()} model doesn't specify a valid database table / bucket`);

            return {
              typeName,
              modelType: subModelType,
              tableName: thisTableName
            };
          }),
          querySQL = `SELECT ${subTypes.map((type) => {
            var { tableName } = type;
            return `${tableName}.*`;
          }).join(',')} FROM ${primaryTableName}\n${subTypes.map((type) => {
            var { tableName } = type;
            return `  LEFT OUTER JOIN ${tableName} ON (${tableName}.ownerType=${this.escape(primaryTypeName)} AND ${tableName}.ownerID=${primaryTableName}.${primaryKeyFieldName})`;
          }).join('\n')}\nWHERE (${primaryTableName}.id IN (${primaryIDList}))`;

      // try {
      //   var rawData = await this.exec(querySQL),
      //       models = this.getRawModelDataFromRows(schemaEngine, result);

      //   console.log(models);
      // } catch (e) {
      //   Logger.error(e);
      //   return [];
      // }
    }

    async query(schemaEngine, query, _opts) {
      var opts = _opts || {},
          modelType = query.getModelType();

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid schema type`);

      var primaryModels = await this.readPrimaryModels(schemaEngine, modelType, query, opts),
          primaryKeyFieldName = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field'),
          ids = primaryModels.map((model) => model[primaryKeyFieldName]);

      if (noe(ids))
        return [];

      var secondaryRows = await this.readSecondaryModels(schemaEngine, modelType, ids, opts);
      console.log('SECONDARY ROWS: ', secondaryRows);
    }

    async writeRaw(schemaEngine, decomposedModel, _opts) {
      throw new Error(`Connector [${this.context}] doesn't implement "writeRaw" method`);
    }

    async write(schemaEngine, data, _opts) {
      if (!data || !instanceOf(data, 'object') || !sizeOf(data))
        return;

      var opts = _opts || {},
          modelType = this.introspectSchemaType(schemaEngine, data, opts);

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not write data: unknown of invalid schema type`);

      var items = data.decompose();
      var promises = items.map((item) => this.writeRaw(schemaEngine, item, opts));

      return Promise.all(promises);
    }
  }

  Object.assign(root, {
    BaseSQLConnector
  });
};
