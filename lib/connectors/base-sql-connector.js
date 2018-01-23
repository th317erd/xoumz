const SQLString = require('sqlstring');

module.exports = function(root, requireModule) {
  const { instanceOf, noe, setProp, getProp, sizeOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const Logger = requireModule('./logger');
  const { ModelType } = requireModule('./schema');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { QueryEngine } = requireModule('./query-engine');

  class BaseSQLConnector extends BaseConnector {
    escape(...args) {
      return args.map((arg) => SQLString.escape('' + arg)).join('');
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

      var schemaTypes = schemaEngine.iterateModelSchemas((modelType, typeName) => {
        return { modelType, typeName };
      });

      for (var i = 0, il = schemaTypes.length; i < il; i++) {
        var { modelType, typeName } = schemaTypes[i],
            typeInfo = schemaEngine.getTypeInfo(typeName),
            primitiveType = typeInfo.primitiveType;

        if (primitiveType && (new primitiveType(schemaEngine, modelType)).getProp('ownable', this.context) === false)
          continue;

        var tableName = this.getTableNameFromModelType(schemaEngine, modelType),
            table = tables[typeName];

        var queries = this.generateTableUpdateQueries(schemaEngine, modelType, {
          name: tableName,
          columns: table
        }, Object.assign({}, opts, { create: noe(table) }));

        console.log('Should execute: ', this.getContext());
        await this.execAll(queries, { tableOperation: true });
      }
    }

    modelTypeToSQLType(field) {
      var context = this.getContext(),
          parts = [];

      if (!field)
        return '';

      var primitiveTypeName = field.getProp('primitive', this.context);
      if (!primitiveTypeName)
        return '';

      if (primitiveTypeName === 'Integer') {
        parts.push('INT');
      } else if (primitiveTypeName === 'Decimal') {
        parts.push('DOUBLE');
      } else if (primitiveTypeName === 'String') {
        var max = field.getProp('max', context);
        if (!max)
          max = this.getDefaultStringMaxLength();

        parts.push('VARCHAR');
        parts.push(`(${max})`);
      } else if (primitiveTypeName === 'Date') {
        parts.push('DATETIME');
      } else if (primitiveTypeName === 'Boolean') {
        parts.push('TINYINT(1)');
      }

      return parts.join('');
    }

    generateFieldDefinitionQuery(field) {
      var query = [],
          fieldName = field.getProp('field', this.getContext());

      query.push(`${fieldName} ${this.modelTypeToSQLType(field)}`);

      var flags = this.modelTypeToSQLTypeFlags(field);
      if (!noe(flags)) {
        query.push(' ');
        query.push(flags);
      }

      return query.join('');
    }

    async dropColumn(schemaEngine, modelType, schemaType) {
      var tableName = (modelType instanceof ModelType) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType,
          columnName = (schemaType instanceof SchemaType) ? schemaType.getProp('field', this.getContext()) : schemaType;

      if (noe(tableName))
        throw new Error('Can not drop column, unknown table name');

      if (noe(columnName))
        throw new Error(`Can not drop column, unknown column name (for table ${tableName})`);

      var queries = this.generateDropColumnQueries(schemaEngine, modelType, tableName, columnName);
      await this.execAll(queries);
    }

    async addColumn(schemaEngine, modelType, schemaType) {
      var tableName = (modelType instanceof ModelType) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType;

      if (noe(tableName))
        throw new Error('Can not drop column, unknown table name');

      var queries = this.generateAddColumnQueries(schemaEngine, modelType, tableName, schemaType);
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
            val = (rowKey instanceof Function) ? rowKey.call(this, row) : row[rowKey];

        if (key === 'column.nullable') {
          key = 'column.notNull';
          val = !!(('' + val).match(/^(0|n|f)/i));
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

      var ownerIDFieldName = modelType.getFieldProp(modelType.getOwnerTypeField(), 'field');
      return `${queryToString.call(this, query)}`;
    }

    tableToNamedFields(schemaEngine, tableName, modelType) {
      var context = this.getContext(),
          namedFields = [],
          typeName = modelType.getTypeName();

      modelType.iterateFields((field, fieldName, index, flags) => {
        var contextField = field.getProp('field', { context });
        namedFields.push(`${tableName}.${contextField} as ${this.escape(`${typeName}:${fieldName}`)}`);
      }, { virtual: false, primitive: true });

      return namedFields.join(',');
    }

    getRowsFromQueryResult(schemaEngine, result) {
      throw new Error(`Connector [${this.context}] doesn't implement "getRowsFromQueryResult" method`);
    }

    getRawModelDataFromRows(schemaEngine, rows) {
      if (noe(rows))
        return [];

      var modelTypeMap = {},
          context = this.getContext(),
          finalRows = [];

      for (var i = 0, il = rows.length; i < il; i++) {
        var row = rows[i],
            columns = Object.keys(row);

        for (var j = 0, jl = columns.length; j < jl; j++) {
          var column = columns[j],
              columnName,
              typeName;

          column.replace(/^([^:]+):(.*)$/g, function(m, tn, col) {
            typeName = tn;
            columnName = col;
          });

          var modelEntry = modelTypeMap[typeName];
          if (!modelEntry) {
            var modelType = schemaEngine.getModelType(typeName);
            if (!(modelType instanceof ModelType))
              throw new Error(`Connector (${this.context}) error: Can not read data: unknown or invalid schema type: ${typeName}`);

            var primaryKey = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field');
            if (!primaryKey)
              throw new Error(`Connector (${this.context}) error: Can not read data: primary key for type ${typeName} is unknown or invalid`);

            modelEntry = modelTypeMap[typeName] = { modelType, primaryKey, modelData: {} };
          }

          var { modelData, modelType, primaryKey } = modelEntry,
              contextField = modelType.getField(columnName, context);

          if (!contextField)
            continue;

          var fieldName = contextField.getProp('field'),
              currentValue = row[column];

          if (primaryKey === fieldName) {
            var modelID = modelData[fieldName];
            if (currentValue !== modelData[fieldName] && !noe(modelID)) {
              // Did we hit a new value?
              finalRows.push({ modelType, primaryKey, value: modelData, modelID });
              modelData = modelEntry.modelData = {};
            }

            if (noe(currentValue)) {
              // Row data is empty for this model
              continue;
            }
          }

          modelData[fieldName] = currentValue;
        }
      }

      // Wrap up any stragglers
      var keys = Object.keys(modelTypeMap);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            modelEntry = modelTypeMap[key],
            { modelData, modelType, primaryKey } = modelEntry,
            modelID = modelData[primaryKey];

        if (!noe(modelID))
          finalRows.push({ modelType, primaryKey, value: modelData, modelID });
      }

      return finalRows;
    }

    getDecomposedModelInfo(decomposedModel) {
      var { modelType, primaryKey, value, modelID } = decomposedModel;

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not acquire decomposed model data: unknown or invalid schema type`);

      if (noe(value))
        throw new Error(`Connector (${this.context}) error: Invalid decomposed model data`);

      if (primaryKey && modelID)
        return decomposedModel;

      if (!primaryKey) {
        primaryKey = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field');
        decomposedModel.primaryKey = primaryKey;
      }

      if (!modelID) {
        modelID = value[primaryKey];
        decomposedModel.modelID = modelID;
      }

      return decomposedModel;
    }

    stitchDecomposedModels(schemaEngine, decomposedModels, _opts) {
      if (noe(decomposedModels))
        return [];

      var opts = _opts || {},
          modelMap = {},
          finalModels = [];

      // Generate a map of all models
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { value, modelID } = this.getDecomposedModelInfo(decomposedModel);

        modelMap[modelID] = value;
      }

      // Stitch models together
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { modelType, value, modelID } = this.getDecomposedModelInfo(decomposedModel);

        if (!modelType.retrieveOwnerIDValue(value)) {
          finalModels.push(value);
          continue;
        }

        var parentID = modelType.retrieveOwnerIDValue(value),
            parentModel = modelMap[parentID],
            parentField = modelType.retrieveOwnerFieldValue(value);

        if (!parentModel)
          throw new Error(`Connector (${this.context}) error: Can not stitch model "${modelID}" of type ${modelType.getTypeName()}: Parent not found`);

        if (noe(parentField))
          throw new Error(`Connector (${this.context}) error: Can not stitch model "${modelID}" of type ${modelType.getTypeName()}: Parent field not found`);

        var list = getProp(parentModel, parentField, []),
            ownerFieldName = modelType.getOwnerFieldName();

        if (!noe(ownerFieldName))
          value[ownerFieldName] = parentModel;

        list.push(value);
        setProp(parentModel, parentField, list);
      }

      return finalModels;
    }

    // TODO: Update to read ids and not restrict to primary models
    async readPrimaryModels(schemaEngine, modelType, query, _opts) {
      var primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);
      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var opts = _opts || {},
          querySQLWhere = this.queryToSQLQueryString(modelType, query),
          querySQL = `SELECT ${this.tableToNamedFields(schemaEngine, primaryTableName, modelType)} FROM ${primaryTableName} WHERE ${querySQLWhere}`;

      try {
        //console.log('QUERY: ', querySQL);
        var result = await this.exec(querySQL),
            rows = this.getRowsFromQueryResult(schemaEngine, result),
            decomposedModels = this.getRawModelDataFromRows(schemaEngine, rows);

        if (noe(decomposedModels))
          return [];

        // Get ids of primary models
        var ids = decomposedModels.map((decomposedModel) => {
              var { modelID } = this.getDecomposedModelInfo(decomposedModel);
              return modelID;
            }),
            // Load child models
            secondaryModels = await this.readSecondaryModels(schemaEngine, modelType, ids, opts);

        //console.log('Secondary models: ', secondaryModels);
        // Stitch all models together
        var stitchedModels = this.stitchDecomposedModels(schemaEngine, decomposedModels.concat(secondaryModels), opts);
        return stitchedModels.map((decomposedModel) => {
          return modelType.instantiate(decomposedModel);
        });
      } catch (e) {
        Logger.error(e);
        return [];
      }
    }

    //
    async readSecondaryModelCollection(schemaEngine, modelType, decomposedModels, _opts) {
      if (noe(decomposedModels))
        return [];

      var opts = _opts || {},
          modelTypeMap = {};

      decomposedModels.forEach((decomposedModel) => {
        var { modelType, primaryKey, modelID } = this.getDecomposedModelInfo(decomposedModel),
            typeName = modelType.getTypeName();

        var modelEntry = modelTypeMap[typeName];
        if (!modelEntry)
          modelEntry = modelTypeMap[typeName] = { primaryKey, modelType, ids: [] };

        modelEntry.ids.push(modelID);
      });

      var allModels = await Promise.all(Object.keys(modelTypeMap).map((typeName) => {
        var modelEntry = modelTypeMap[typeName];
        return this.readSecondaryModels(schemaEngine, modelEntry.modelType, modelEntry.ids, opts);
      }));

      return [].concat(...allModels);
    }

    async readSecondaryModels(schemaEngine, modelType, primaryIDs, _opts) {
      if (noe(primaryIDs))
        return [];

      var primaryTypeName = modelType.getTypeName(),
          primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var opts = _opts || {},
          modelMap = opts.modelMap || {},
          primaryIDList = primaryIDs.filter((id) => !modelMap.hasOwnProperty(id)).map((id) => {
            modelMap[id] = id;
            return this.escape(id);
          }).join(',');

      if (noe(primaryIDList))
        return [];

      var context = this.getContext(),
          primaryKeyFieldName = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field', { context }),
          ownerIDFieldName = modelType.getFieldProp(modelType.getOwnerIDField(), 'field', { context }),
          ownerTypeFieldName = modelType.getFieldProp(modelType.getOwnerTypeField(), 'field', { context }),
          subTypeNames = modelType.getChildTypeNames({ virtual: false, primitive: false, ownable: true }),
          hasSelfSubType = false,
          subTypes = subTypeNames.map((typeName) => {
            var subModelType = schemaEngine.getModelType(typeName);
            if (!(subModelType instanceof ModelType))
              throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid schema type`);

            var thisTableName = this.getTableNameFromModelType(schemaEngine, subModelType);
            if (noe(thisTableName))
              throw new Error(`${subModelType.getTypeName()} model doesn't specify a valid database table / bucket`);

            if (thisTableName === primaryTableName)
              hasSelfSubType = true;

            return {
              typeName,
              modelType: subModelType,
              tableName: thisTableName
            };
          }),
          querySQL = `SELECT ${subTypes.map((type) => {
            var { tableName, modelType } = type;
            return this.tableToNamedFields(schemaEngine, tableName, modelType);
          }).join(',')} FROM ${primaryTableName}\n${subTypes.map((type) => {
            var { tableName } = type;

            if (tableName === primaryTableName)
              return '';

            return `  LEFT OUTER JOIN ${tableName} ON (${tableName}.${ownerTypeFieldName}=${this.escape(primaryTypeName)} AND ${tableName}.${ownerIDFieldName}=${primaryTableName}.${primaryKeyFieldName})`;
          }).filter((chunk) => !!chunk).join('\n')}\nWHERE ((${(hasSelfSubType) ? `${primaryTableName}.${ownerTypeFieldName}=${this.escape(primaryTypeName)} AND ${primaryTableName}.${ownerIDFieldName} IN (${primaryIDList})) OR ` : ''}${primaryTableName}.id IN (${primaryIDList}))`;

      //console.log('SUB QUERY: ', querySQL);
      try {
        var result = await this.exec(querySQL),
            rows = this.getRowsFromQueryResult(schemaEngine, result),
            decomposedModels = this.getRawModelDataFromRows(schemaEngine, rows);

        decomposedModels = decomposedModels.filter((decomposedModel) => {
          var { modelType, value, modelID } = this.getDecomposedModelInfo(decomposedModel);

          if (modelMap.hasOwnProperty(modelID))
            return false;

          modelMap[modelID] = decomposedModel;

          var ownerID = modelType.retrieveOwnerIDValue(value);
          return !!ownerID;
        });

        var subDecomposedModels = await this.readSecondaryModelCollection(schemaEngine, modelType, decomposedModels, {
          ...opts,
          modelMap
        });

        //console.log('Secondary Models!', decomposedModels, subDecomposedModels);
        return decomposedModels.concat(...subDecomposedModels);
      } catch (e) {
        Logger.error(e);
        return [];
      }
    }

    async query(schemaEngine, query, _opts) {
      var opts = _opts || {},
          modelType = query.getModelType();

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid schema type`);

      return await this.readPrimaryModels(schemaEngine, modelType, query, opts);
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

      var rets = await Promise.all(promises),
          errors = [];

      rets.forEach((ret) => {
        if (ret instanceof Error)
          errors.push(ret);
      });

      return { connector: this, model: data, success: !errors.length, errors };
    }
  }

  Object.assign(root, {
    BaseSQLConnector
  });
};
