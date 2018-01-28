const SQLString = require('sqlstring');

module.exports = function(root, requireModule) {
  const { instanceOf, noe, setProp, getProp, sizeOf } = requireModule('./utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const Logger = requireModule('./logger');
  const { ModelType } = requireModule('./schema');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { QueryEngine } = requireModule('./query-engine');
  const { DecomposedModel } = requireModule('./schema/decomposed-model');

  class BaseSQLConnector extends BaseConnector {
    escape(...args) {
      return args.map((arg) => SQLString.escape('' + arg)).join('');
    }

    async exec(queryStr, values, _opts) {
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

    async migrate(_opts) {
      var schemaEngine = this.getApplication().getSchemaEngine(this.getContext()),
          opts = _opts || {},
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

        await this.execAll(queries, Object.assign(opts, { tableOperation: true }));
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

    async dropColumn(schemaEngine, modelType, schemaType, _opts) {
      var opts = _opts || {},
          tableName = (modelType instanceof ModelType) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType,
          columnName = (schemaType instanceof SchemaType) ? schemaType.getProp('field', this.getContext()) : schemaType;

      if (noe(tableName))
        throw new Error('Can not drop column, unknown table name');

      if (noe(columnName))
        throw new Error(`Can not drop column, unknown column name (for table ${tableName})`);

      var queries = this.generateDropColumnQueries(schemaEngine, modelType, tableName, columnName);

      await this.execAll(queries, undefined, opts);
    }

    async addColumn(schemaEngine, modelType, schemaType, _opts) {
      var opts = _opts || {},
          tableName = (modelType instanceof ModelType) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType;

      if (noe(tableName))
        throw new Error('Can not drop column, unknown table name');

      var queries = this.generateAddColumnQueries(schemaEngine, modelType, tableName, schemaType);
      await this.execAll(queries, undefined, opts);
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
            var flags = query.getFirstConditionFlags(),
                binaryOp = (flags & QueryEngine.FLAGS.OR) ? ' OR ' : ' AND ',
                subQuery = `${queryToString.call(this, query)}`;

            if (!subQuery)
              return;

            if (queryStr.length)
              queryStr.push(binaryOp);

            queryStr.push(subQuery);
          } else {
            if (!modelType.hasField(query.field))
              return;

            if (queryStr.length)
              queryStr.push((query.flags & QueryEngine.FLAGS.OR) ? ' OR ' : ' AND ');

            queryStr.push(this.queryConditionalToString.call(this, query));
          }
        });

        var finalStr = queryStr.join('');
        return (queryStr.length > 1) ? `(${finalStr})` : finalStr;
      }

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

    getModelTypePrimaryKey(modelType, _opts) {
      var primaryKey = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field', _opts);
      if (!primaryKey)
        throw new Error(`Connector (${this.context}) error: Can not read data: primary key for type ${modelType.getTypeName()} is unknown or invalid`);

      return primaryKey;
    }

    getModelTypeInfoFromTypeName(schemaEngine, typeName) {
      var modelType = schemaEngine.getModelType(typeName);
      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not read data: unknown or invalid schema type: ${typeName}`);

      return { modelType, typeName, primaryKey: this.getModelTypePrimaryKey(modelType) };
    }

    getDecomposedModelInfo(decomposedModel) {
      var { modelType, typeName, primaryKey, value, modelID } = decomposedModel;

      if (!(modelType instanceof ModelType))
        throw new Error(`Connector (${this.context}) error: Can not acquire decomposed model data: unknown or invalid schema type`);

      if (noe(value))
        throw new Error(`Connector (${this.context}) error: Invalid decomposed model data`);

      if (!primaryKey)
        primaryKey = decomposedModel.primaryKey = this.getModelTypePrimaryKey(modelType);

      if (!modelID)
        decomposedModel.modelID = value[primaryKey];

      if (!typeName)
        decomposedModel.typeName = modelType.getTypeName();

      return decomposedModel;
    }

    getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName) {
      var modelEntry = modelTypeMap[typeName];
      if (!modelEntry) {
        var modelTypeInfo = this.getModelTypeInfoFromTypeName(schemaEngine, typeName);

        modelEntry = modelTypeMap[typeName] = {
          primaryKey: modelTypeInfo.primaryKey,
          modelType: modelTypeInfo.modelType,
          typeName,
          ids: {},
          modelData: {}
        };
      }

      return modelEntry;
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

          var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName);
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

    stitchDecomposedModels(schemaEngine, decomposedModels, _opts) {
      if (noe(decomposedModels))
        return [];

      var modelMap = {},
          parentModels = {};

      // Generate a map of all models
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { value, modelID, typeName } = this.getDecomposedModelInfo(decomposedModel),
            thisID = `${typeName}:${modelID}`;

        modelMap[thisID] = value;
      }

      // Stitch models together
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { modelType, value, modelID, typeName } = this.getDecomposedModelInfo(decomposedModel),
            thisID = `${typeName}:${modelID}`;

        // if (!modelType.retrieveOwnerIDValue(value)) {
        //   finalModels.push(value);
        //   continue;
        // }

        var parentID = modelType.retrieveOwnerIDValue(value);
        if (parentID) {
          var parentType = modelType.retrieveOwnerTypeValue(value),
              thisParentID = `${parentType}:${parentID}`,
              parentModel = modelMap[thisParentID],
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
        } else {
          parentModels[thisID] = value;
        }
      }

      return { models: modelMap, parents: parentModels };
    }

    async fetchFromQuery(schemaEngine, modelType, query, _opts) {
      var primaryTypeName = modelType.getTypeName(),
          primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var opts = _opts || {},
          context = this.getContext(),
          querySQLWhere = this.queryToSQLQueryString(modelType, query),
          primaryKeyFieldName = this.getModelTypePrimaryKey(modelType, { context }),
          querySQL = `SELECT ${primaryKeyFieldName} FROM ${primaryTableName} WHERE ${querySQLWhere}`;

      try {
        //console.log('QUERY: ', querySQL);
        var result = await this.exec(querySQL, undefined, opts),
            ids = this.getRowsFromQueryResult(schemaEngine, result);

        if (noe(ids))
          return [];

        ids = ids.map((row) => row[primaryKeyFieldName]);

        var decomposedModels = await this.readModelsFromIDs(schemaEngine, modelType, ids, opts);
        if (noe(decomposedModels))
          return [];

        //console.log('Secondary models: ', secondaryModels);
        // Stitch all models together
        var stitchedModels = this.stitchDecomposedModels(schemaEngine, decomposedModels, opts),
            finalModels = ids.reduce((obj, id) => {
              obj[id] = null;

              return obj;
            }, {}),
            parents = stitchedModels.parents;

        Object.keys(parents).forEach((parentID) => {
          var decomposedModel = parents[parentID];

          modelType.instantiate(decomposedModel, {
            owner: decomposedModel.owner,
            onModelCreate: function() {
              var modelType = this.schema(),
                  typeName = modelType.getTypeName(),
                  primaryKeyValue = modelType.retrievePrimaryKeyValue(this);

              if (typeName === primaryTypeName && finalModels.hasOwnProperty(primaryKeyValue))
                finalModels[primaryKeyValue] = this;

              return this;
            }
          });
        });

        return ids.map((id) => finalModels[id]).filter((model) => (model !== undefined && model !== null));
      } catch (e) {
        Logger.error(e);
        return [];
      }
    }

    async readRelatedModels(schemaEngine, modelType, decomposedModels, _opts) {
      if (noe(decomposedModels))
        return [];

      var opts = _opts || {},
          modelTypeMap = {};

      decomposedModels.forEach((decomposedModel) => {
        var { modelType, modelID, value } = this.getDecomposedModelInfo(decomposedModel),
            typeName = modelType.getTypeName();

        var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName);
        modelEntry.ids[modelID] = modelID;

        var ownerID = modelType.retrieveOwnerIDValue(value);
        if (ownerID) {
          var ownerType = modelType.retrieveOwnerTypeValue(value);
          if (ownerType) {
            modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, ownerType);
            modelEntry.ids[ownerID] = ownerID;
          }
        }
      });

      var allModels = await Promise.all(Object.keys(modelTypeMap).map((typeName) => {
        var modelEntry = modelTypeMap[typeName];
        return this.readModelsFromIDs(schemaEngine, modelEntry.modelType, Object.keys(modelEntry.ids), opts);
      }));

      return [].concat(...allModels);
    }

    async readModelsFromIDs(schemaEngine, modelType, modelIDs, _opts) {
      if (noe(modelIDs))
        return [];

      var primaryTypeName = modelType.getTypeName(),
          primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

      if (noe(primaryTableName))
        throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

      var opts = _opts || {},
          modelMap = opts.modelMap || {},
          primaryIDList = modelIDs.filter((id) => {
            var thisID = `${primaryTypeName}:${id}`,
                hasProperty = modelMap.hasOwnProperty(thisID);

            if (!hasProperty)
              modelMap[thisID] = null;

            return !hasProperty;
          }).map((id) => this.escape(id)).join(',');

      if (noe(primaryIDList))
        return [];

      var context = this.getContext(),
          primaryKeyFieldName = this.getModelTypePrimaryKey(modelType, { context }),
          ownerIDField = modelType.getOwnerIDField(),
          ownerIDFieldName = (ownerIDField) ? modelType.getFieldProp(ownerIDField, 'field', { context }) : undefined,
          ownerTypeField = modelType.getOwnerTypeField(),
          ownerTypeFieldName = (ownerTypeField) ? modelType.getFieldProp(ownerTypeField, 'field', { context }) : undefined,
          subTypeNames = modelType.getChildTypeNames({ virtual: false, internal: false, target: true }),
          hasSelfSubType = false,
          subTypes = subTypeNames.map((typeName) => {
            var subModelType = schemaEngine.getModelType(typeName);
            if (!(subModelType instanceof ModelType))
              throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid schema type`);

            var thisTableName = this.getTableNameFromModelType(schemaEngine, subModelType);
            if (noe(thisTableName))
              throw new Error(`${subModelType.getTypeName()} model doesn't specify a valid database table / bucket`);

            if (thisTableName === primaryTableName) {
              hasSelfSubType = true;
              return;
            }

            return {
              typeName,
              modelType: subModelType,
              tableName: thisTableName
            };
          }).filter((e) => !!e),
          querySQL = `SELECT ${subTypes.concat({ typeName: primaryTypeName, modelType, tableName: primaryTableName }).map((type) => {
            var { tableName, modelType } = type;
            return this.tableToNamedFields(schemaEngine, tableName, modelType);
          }).join(',')} FROM ${primaryTableName}\n${subTypes.map((type) => {
            var { tableName, modelType } = type;

            if (tableName === primaryTableName)
              return '';

            var thisOwnerIDField = modelType.getOwnerIDField(),
                thisOwnerIDFieldName = (thisOwnerIDField) ? modelType.getFieldProp(thisOwnerIDField, 'field', { context }) : undefined,
                thisOwnerTypeField = modelType.getOwnerTypeField(),
                thisOwnerTypeFieldName = (thisOwnerTypeField) ? modelType.getFieldProp(thisOwnerTypeField, 'field', { context }) : undefined;

            if (!thisOwnerIDFieldName || !thisOwnerTypeFieldName)
              return '';

            return `  LEFT OUTER JOIN ${tableName} ON (${tableName}.${thisOwnerTypeFieldName}=${this.escape(primaryTypeName)} AND ${tableName}.${thisOwnerIDFieldName}=${primaryTableName}.${primaryKeyFieldName})`;
          }).filter((chunk) => !!chunk).join('\n')}\nWHERE (${(hasSelfSubType) ? `(${primaryTableName}.${ownerTypeFieldName}=${this.escape(primaryTypeName)} AND ${primaryTableName}.${ownerIDFieldName} IN (${primaryIDList})) OR ` : ''}${primaryTableName}.id IN (${primaryIDList}))`;

      //console.log('SUB QUERY: ', querySQL);
      try {
        var result = await this.exec(querySQL, undefined, opts),
            rows = this.getRowsFromQueryResult(schemaEngine, result),
            decomposedModels = this.getRawModelDataFromRows(schemaEngine, rows);

        decomposedModels = decomposedModels.filter((decomposedModel) => {
          var { typeName, modelID } = this.getDecomposedModelInfo(decomposedModel),
              thisID = `${typeName}:${modelID}`;

          if (modelMap[thisID])
            return false;

          modelMap[thisID] = decomposedModel;

          return true;
        });

        var subDecomposedModels = await this.readRelatedModels(schemaEngine, modelType, decomposedModels, {
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
  }

  Object.assign(root, {
    BaseSQLConnector
  });
};
