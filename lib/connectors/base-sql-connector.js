const SQLString = require('sqlstring');

module.exports = function(root, requireModule) {
  const { noe, setProp, instanceOf, typeOf } = requireModule('./base/utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const Logger = requireModule('./base/logger');
  const { DecomposedModelCollection, DecomposedModel } = requireModule('./schema/decomposed-model');
  const { Context } = requireModule('./base/context');

  const BaseSQLConnector = this.defineClass((BaseConnector) => {
    return class BaseSQLConnector extends BaseConnector {
      getContext(_opts) {
        return new Context(Object.assign({ name: 'sql', group: 'connector' }, _opts || {}));
      }

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

      async buildTablesFromSchema(_opts) {
        var schemaEngine = this.getEngine('schema'),
            opts = Object.assign({ context: this.getContext() }, _opts || {}),
            queries = [];
            //tables = await this.getSchema();

        for (var [ typeName, type ] of schemaEngine) {
          var modelSchema = type.getSchema();
          var sqlStatement = this.generateTableCreateQuery(modelSchema, opts);
          if (!sqlStatement)
            continue;

          queries.push(sqlStatement);
        }

        try {
          await this.transaction((connection) => {
            connection.execAll(queries);
          });
          debugger;
        } catch (e) {
          Logger.error(e);
        }
      }

      modelTypeToSQLType(field) {
        var context = this.getContext(),
            parts = [];

        if (!field)
          return '';

        var modelClass = field.getModelClass(),
            primitiveType = modelClass.primitive();

        if (!primitiveType)
          return '';

        var typeName = modelClass.getTypeName();
        if (typeName === 'Integer' || typeOf(modelClass, 'IntegerPrimitive')) {
          parts.push('INT');
        } else if (typeName === 'Decimal' || typeOf(modelClass, 'DecimalPrimitive')) {
          parts.push('DOUBLE');
        } else if (typeName === 'Boolean' || typeOf(modelClass, 'BooleanPrimitive', 'Boolean')) {
          parts.push('TINYINT(1)');
        } else if (typeName === 'String' || typeOf(modelClass, 'StringPrimitive', 'String')) {
          var max = field.getProp('max', context);
          if (!max)
            max = this.getDefaultStringMaxLength();

          parts.push('VARCHAR');
          parts.push(`(${max})`);
        } else if (typeName === 'Date' || typeOf(modelClass, 'DatePrimitive', 'moment', 'Date')) {
          parts.push('DATETIME');
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
        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            SchemaTypeClass = this.getApplication().getSchemaTypeClass(),
            opts = _opts || {},
            tableName = (modelType instanceof ModelTypeClass) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType,
            columnName = (schemaType instanceof SchemaTypeClass) ? schemaType.getProp('field', this.getContext()) : schemaType;

        if (noe(tableName))
          throw new Error('Can not drop column, unknown table name');

        if (noe(columnName))
          throw new Error(`Can not drop column, unknown column name (for table ${tableName})`);

        var queries = this.generateDropColumnQueries(schemaEngine, modelType, tableName, columnName);

        await this.execAll(queries, undefined, opts);
      }

      async addColumn(schemaEngine, modelType, schemaType, _opts) {
        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            opts = _opts || {},
            tableName = (modelType instanceof ModelTypeClass) ? this.getTableNameFromModelType(schemaEngine, modelType) : modelType;

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
          if (flags & QueryEngineFlags.NOT) {
            op.push((!invert) ? '<' : '>');
            if (!(flags & QueryEngineFlags.EQUAL))
              op.push('=');
          } else {
            op.push((!invert) ? '>' : '<');
            if (flags & QueryEngineFlags.EQUAL)
              op.push('=');
          }

          return `${field}${op.join('')}${this.escape(value)}`;
        }

        var QueryEngineClass = this.getApplication().getQueryEngineClass(),
            QueryEngineFlags = QueryEngineClass.FLAGS,
            { flags, field, value } = query;

        if (flags & QueryEngineFlags.CONTAINS) {
          return `${field} ${(flags & QueryEngineFlags.NOT) ? 'NOT ' : ''}IN (${value.map((v) => this.escape(v)).join(',')})`;
        } else if (flags & QueryEngineFlags.GREATER) {
          return greaterLessThen.call(this, false);
        } else if (flags & QueryEngineFlags.SMALLER) {
          return greaterLessThen.call(this, true);
        } else if (flags & QueryEngineFlags.EQUAL) {
          if (flags & QueryEngineFlags.FUZZY) {
            if (!value)
              throw new Error('Value can not be NULL for LIKE condition');

            return `${field} LIKE ${this.escape(value.replace(/[*?]/g, function(m) {
              return (m === '*') ? '%' : '_';
            }))}`;
          } else {
            var val = this.escape(value),
                isNull = (value === undefined || value === null),
                op = '';

            if (flags & QueryEngineFlags.NOT) {
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
            if (query instanceof QueryEngineClass) {
              var flags = query.getFirstConditionFlags(),
                  binaryOp = (flags & QueryEngineFlags.OR) ? ' OR ' : ' AND ',
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
                queryStr.push((query.flags & QueryEngineFlags.OR) ? ' OR ' : ' AND ');

              queryStr.push(this.queryConditionalToString.call(this, query));
            }
          });

          var finalStr = queryStr.join('');
          return (queryStr.length > 1) ? `(${finalStr})` : finalStr;
        }

        var QueryEngineClass = this.getApplication().getQueryEngineClass(),
            QueryEngineFlags = QueryEngineClass.FLAGS;

        return `${queryToString.call(this, query)}`;
      }

      tableToNamedFields(schemaEngine, tableName, modelType, minimal) {
        var context = this.getContext(),
            typeName = modelType.getTypeName(),
            fields = [];

        if (minimal) {
          fields = modelType.getMinimalRequiredFields();
        } else {
          modelType.iterateFields((field, fieldName, index, flags) => {
            fields.push(field);
            //
            // namedFields.push();
          }, { virtual: false, primitive: true });
        }

        return fields.map((field) => {
          var context = this.getContext(),
              fieldName = field.getProp('field', context),
              contextField = field.getProp('field', context);

          return `${tableName}.${contextField} as ${this.escape(`${typeName}:${fieldName}`)}`;
        }).join(',');
      }

      tableToPrimaryKeyField(schemaEngine, tableName, modelType) {
        var context = this.getContext(),
            typeName = modelType.getTypeName(),
            primaryKeyFieldDBName = this.getModelTypePrimaryKeyField(modelType, this.getContext()),
            primaryKeyFieldName = this.getModelTypePrimaryKeyField(modelType);

        // modelType.iterateFields((field, fieldName, index, flags) => {
        //   var contextField = field.getProp('field', this.getContext());
        //   namedFields.push();
        // }, { virtual: false, primitive: true });

        return `${tableName}.${primaryKeyFieldDBName} as ${this.escape(`${typeName}:${primaryKeyFieldName}`)}`;
      }

      getRowsFromQueryResult(schemaEngine, result) {
        throw new Error(`Connector [${this.context}] doesn't implement "getRowsFromQueryResult" method`);
      }

      getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName) {
        var modelEntry = modelTypeMap[typeName];
        if (!modelEntry) {
          var modelTypeInfo = this.getModelTypeInfoFromTypeName(schemaEngine, typeName);

          modelEntry = modelTypeMap[typeName] = Object.assign({
            ids: {},
            modelData: {}
          }, modelTypeInfo);
        }

        return modelEntry;
      }

      getDecomposedModelsFromRows(schemaEngine, rows) {
        var decomposedModels = new DecomposedModelCollection();
        if (noe(rows))
          return decomposedModels;

        var modelTypeMap = {},
            context = this.getContext();

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
            var { modelData, modelType, primaryKeyFieldName } = modelEntry,
                contextField = modelType.getField(columnName, context);

            if (!contextField)
              continue;

            var fieldName = contextField.getProp('field', this.getContext()),
                currentValue = row[column];

            if (primaryKeyFieldName === fieldName) {
              var primaryKey = modelData[fieldName];
              if (currentValue !== primaryKey && !noe(primaryKey)) {
                // Did we hit a new value?
                decomposedModels.push(new DecomposedModel({ modelType, primaryKeyFieldName, value: modelData, primaryKey }));
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
              { modelData, modelType, primaryKeyFieldName } = modelEntry,
              primaryKey = modelData[primaryKeyFieldName];

          if (!noe(primaryKey))
            decomposedModels.push(new DecomposedModel({ modelType, primaryKeyFieldName, value: modelData, primaryKey }));
        }

        return decomposedModels;
      }

      getModelTypeQueryInfo(modelType) {
        if (!modelType)
          throw new Error('Unknown or empty model type provided');

        var primaryTypeName = modelType.getTypeName(),
            primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

        if (noe(primaryTableName))
          throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            context = this.getContext(),
            schemaEngine = modelType.getSchemaEngine(),
            primaryKeyFieldName = this.getModelTypePrimaryKeyField(modelType, { context }),
            ownerIDField = modelType.getOwnerIDField(),
            ownerIDFieldName = (ownerIDField) ? modelType.getFieldProp(ownerIDField, 'field', { context }) : undefined,
            ownerTypeField = modelType.getOwnerTypeField(),
            ownerTypeFieldName = (ownerTypeField) ? modelType.getFieldProp(ownerTypeField, 'field', { context }) : undefined,
            subTypeNames = modelType.getChildTypeNames({ virtual: false, internal: false, target: true }),
            hasSelfSubType = false,
            subTypes = subTypeNames.map((typeName) => {
              var subModelType = schemaEngine.getModelType(typeName);
              if (!(subModelType instanceof ModelTypeClass))
                throw new Error(`Connector (${context}) error: Can not query data: unknown or invalid schema type`);

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
            tables = subTypes.concat({ typeName: primaryTypeName, modelType, tableName: primaryTableName }).map((type) => {
              var { tableName, modelType } = type;

              type.fields = this.tableToNamedFields(schemaEngine, tableName, modelType, (type.tableName !== primaryTableName));

              var thisOwnerIDField = modelType.getOwnerIDField(),
                  thisOwnerTypeField = modelType.getOwnerTypeField();

              type.ownerIDFieldName = (thisOwnerIDField) ? modelType.getFieldProp(thisOwnerIDField, 'field', { context }) : undefined;
              type.ownerTypeFieldName = (thisOwnerTypeField) ? modelType.getFieldProp(thisOwnerTypeField, 'field', { context }) : undefined;

              return type;
            });

        return {
          modelType,
          primaryTypeName,
          primaryTableName,
          primaryKeyFieldName,
          ownerIDFieldName,
          ownerTypeFieldName,
          hasSelfSubType,
          tables
        };
      }

      generateLazyModelLoader(decomposedModel) {
        return () => {
          //readModelsFromIDs
        };
      }

      instantiateLazyModel(decomposedModel) {

      }

      async fetchFromQuery(schemaEngine, modelType, query, _opts) {
        var primaryTypeName = modelType.getTypeName(),
            primaryTableName = this.getTableNameFromModelType(schemaEngine, modelType);

        if (noe(primaryTableName))
          throw new Error(`${modelType.getTypeName()} model doesn't specify a valid database table / bucket`);

        var opts = _opts || {},
            context = this.getContext(),
            querySQLWhere = this.queryToSQLQueryString(modelType, query),
            primaryKeyFieldName = this.getModelTypePrimaryKeyField(modelType, { context }),
            querySQL = `SELECT ${primaryKeyFieldName} FROM ${primaryTableName} WHERE ${querySQLWhere}`;

        try {
          //console.log('QUERY: ', querySQL);
          var result = await this.exec(querySQL, undefined, opts),
              ids = this.getRowsFromQueryResult(schemaEngine, result);

          if (noe(ids))
            return [];

          // var loaderOpts = Object.assign({}, opts, { modelMap: null });
          // ids.forEach((row) => {
          //   var id = row[primaryKeyFieldName];
          //   collection.push(this.generateLazyModelLoader(modelType, id, loaderOpts));
          // });

          // return collection;

          ids = ids.map((row) => row[primaryKeyFieldName]);
          var decomposedModels = await this.readDecomposedModelsFromIDs(schemaEngine, modelType, ids, opts);

          debugger;

          var stitched = decomposedModels.stitch({ context }),
              models = stitched.models,
              finalModels = ids.map((id) => {
                var key = `${primaryTypeName}:${id}`;
                return models[key];
              }).filter((elem) => !!elem),
              lazyItems = finalModels.map((decomposedModel) => this.instantiateLazyModel(decomposedModel));

          debugger;
        } catch (e) {
          Logger.error(e);
          return [];
        }
      }

      // async readRelatedModels(schemaEngine, modelType, decomposedModels, _opts) {
      //   if (noe(decomposedModels))
      //     return [];

      //   var opts = _opts || {},
      //       modelTypeMap = {};

      //   decomposedModels.forEach((decomposedModel) => {
      //     var { modelType, primaryKey, value, typeName } = decomposedModel.getInfo();

      //     var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName);
      //     modelEntry.ids[primaryKey] = primaryKey;

      //     var ownerID = modelType.retrieveOwnerIDValue(value);
      //     if (ownerID) {
      //       var ownerType = modelType.retrieveOwnerTypeValue(value);
      //       if (ownerType) {
      //         modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, ownerType);
      //         modelEntry.ids[ownerID] = ownerID;
      //       }
      //     }
      //   });

      //   var allModels = await Promise.all(Object.keys(modelTypeMap).map((typeName) => {
      //     var modelEntry = modelTypeMap[typeName];
      //     return this.readDecomposedModelsFromIDs(schemaEngine, modelEntry.modelType, Object.keys(modelEntry.ids), opts);
      //   }));

      //   return [].concat(...allModels);
      // }

      // async readDecomposedModelsFromIDs(schemaEngine, modelType, modelIDs, _opts) {
      //   if (noe(modelIDs))
      //     return [];

      //   var { primaryTypeName,
      //         primaryTableName,
      //         primaryKeyFieldName,
      //         ownerIDFieldName,
      //         ownerTypeFieldName,
      //         hasSelfSubType,
      //         tables
      //       } = this.getModelTypeQueryInfo(modelType);

      //   var opts = _opts || {},
      //       modelMap = opts.modelMap || {},
      //       primaryIDList = modelIDs.filter((id) => {
      //         var thisID = `${primaryTypeName}:${id}`,
      //             hasProperty = modelMap.hasOwnProperty(thisID);

      //         if (!hasProperty)
      //           modelMap[thisID] = null;

      //         return !hasProperty;
      //       }).map((id) => this.escape(id)).join(',');

      //   if (noe(primaryIDList))
      //     return [];

      //   var context = this.getContext(),
      //       queryFields = tables.reduce((arr, tableInfo) => arr.concat(tableInfo.fields), []).join(','),
      //       querySQL = `SELECT ${queryFields} FROM ${primaryTableName}\n${tables.map((tableInfo) => {
      //         var { tableName } = tableInfo;

      //         if (tableName === primaryTableName)
      //           return '';

      //         var thisOwnerIDFieldName = tableInfo.ownerIDFieldName,
      //             thisOwnerTypeFieldName = tableInfo.ownerTypeFieldName;

      //         return `  LEFT OUTER JOIN ${tableName} ON (${tableName}.${thisOwnerTypeFieldName}=${this.escape(primaryTypeName)} AND ${tableName}.${thisOwnerIDFieldName}=${primaryTableName}.${primaryKeyFieldName})`;
      //       }).filter((chunk) => !!chunk).join('\n')}\nWHERE (${(hasSelfSubType) ? `(${primaryTableName}.${ownerTypeFieldName}=${this.escape(primaryTypeName)} AND ${primaryTableName}.${ownerIDFieldName} IN (${primaryIDList})) OR ` : ''}${primaryTableName}.id IN (${primaryIDList}))`;

      //   //console.log('SUB QUERY: ', querySQL);
      //   try {
      //     var result = await this.exec(querySQL, undefined, opts),
      //         rows = this.getRowsFromQueryResult(schemaEngine, result),
      //         decomposedModels = this.getDecomposedModelsFromRows(schemaEngine, rows);

      //     decomposedModels = decomposedModels.filter((decomposedModel) => {
      //       var { typeName, primaryKey } = decomposedModel.getInfo(),
      //           thisID = `${typeName}:${primaryKey}`;

      //       if (modelMap[thisID])
      //         return false;

      //       modelMap[thisID] = decomposedModel;

      //       return true;
      //     });

      //     var subDecomposedModels = await this.readRelatedModels(schemaEngine, modelType, decomposedModels, {
      //       ...opts,
      //       modelMap
      //     });

      //     //console.log('Secondary Models!', decomposedModels, subDecomposedModels);
      //     return decomposedModels.concat(...subDecomposedModels);
      //   } catch (e) {
      //     Logger.error(e);
      //     return [];
      //   }
      // }

      // async readChildModelIDs(schemaEngine, modelType, decomposedModels, _opts) {
      //   if (noe(decomposedModels))
      //     return [];

      //   var opts = _opts || {},
      //       modelTypeMap = {};

      //   decomposedModels.forEach((decomposedModel) => {
      //     var { modelType, primaryKey, value, typeName } = decomposedModel.getInfo();

      //     var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, typeName);
      //     modelEntry.ids[primaryKey] = primaryKey;

      //     var ownerID = modelType.retrieveOwnerIDValue(value);
      //     if (ownerID) {
      //       var ownerType = modelType.retrieveOwnerTypeValue(value);
      //       if (ownerType) {
      //         modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelTypeMap, ownerType);
      //         modelEntry.ids[ownerID] = ownerID;
      //       }
      //     }
      //   });

      //   var allModels = await Promise.all(Object.keys(modelTypeMap).map((typeName) => {
      //     var modelEntry = modelTypeMap[typeName];
      //     return this.readDecomposedModelsFromIDs(schemaEngine, modelEntry.modelType, Object.keys(modelEntry.ids), opts);
      //   }));

      //   return [].concat(...allModels);
      // }

      async readDecomposedModelsFromIDs(schemaEngine, modelType, modelIDs, _opts) {
        if (!modelIDs)
          return new DecomposedModelCollection();

        var { primaryTypeName,
              primaryTableName,
              primaryKeyFieldName,
              ownerIDFieldName,
              ownerTypeFieldName,
              hasSelfSubType,
              tables
            } = this.getModelTypeQueryInfo(modelType);

        var opts = _opts || {},
            primaryIDList = modelIDs.map((id) => this.escape(id)).join(','),
            queryFields = tables.reduce((arr, tableInfo) => arr.concat(tableInfo.fields), []).join(','),
            querySQL = `SELECT ${queryFields} FROM ${primaryTableName}\n${tables.map((tableInfo) => {
              var { tableName } = tableInfo;

              if (tableName === primaryTableName)
                return '';

              var thisOwnerIDFieldName = tableInfo.ownerIDFieldName,
                  thisOwnerTypeFieldName = tableInfo.ownerTypeFieldName;

              return `  LEFT OUTER JOIN ${tableName} ON (${tableName}.${thisOwnerTypeFieldName}=${this.escape(primaryTypeName)} AND ${tableName}.${thisOwnerIDFieldName}=${primaryTableName}.${primaryKeyFieldName})`;
            }).filter((chunk) => !!chunk).join('\n')}\nWHERE (${(hasSelfSubType) ? `(${primaryTableName}.${ownerTypeFieldName}=${this.escape(primaryTypeName)} AND ${primaryTableName}.${ownerIDFieldName} IN (${primaryIDList})) OR ` : ''}${primaryTableName}.id IN (${primaryIDList}))`;

        console.log('SUB QUERY: ', querySQL);
        try {
          var result = await this.exec(querySQL, undefined, opts),
              rows = this.getRowsFromQueryResult(schemaEngine, result),
              decomposedModels = this.getDecomposedModelsFromRows(schemaEngine, rows);

          // var subDecomposedModels = await this.readChildModelIDs(schemaEngine, modelType, decomposedModels, opts);
          // decomposedModels = decomposedModels.concat(...subDecomposedModels);

          debugger;

          return DecomposedModelCollection.from(decomposedModels);
        } catch (e) {
          Logger.error(e);
          return [];
        }
      }

      async readModelsFromIDs(schemaEngine, modelType, modelIDs, _opts) {
        var opts = _opts || {},
            decomposedModels = await this.readDecomposedModelsFromIDs(schemaEngine, modelType, modelIDs, opts);

        if (noe(decomposedModels))
          return [];

          //console.log('Secondary models: ', secondaryModels);
          // Stitch all models together
        var stitchedModels = decomposedModels.stitch(opts),
            finalModels = modelIDs.reduce((obj, id) => {
              obj[id] = null;

              return obj;
            }, {}),
            parents = stitchedModels.parents;

        var { primaryTypeName } = this.getModelTypeQueryInfo(modelType);

        Object.keys(parents).forEach((parentID) => {
          var decomposedModel = parents[parentID];

          modelType.instantiate(decomposedModel, {
            owner: decomposedModel.owner,
            onModelCreate: function() {
              var modelType = this.schema(),
                  typeName = modelType.getTypeName(),
                  primaryKey = modelType.retrievePrimaryKeyValue(this);

              if (typeName === primaryTypeName && finalModels.hasOwnProperty(primaryKey))
                finalModels[primaryKey] = this;

              return this;
            }
          });
        });

        return modelIDs.map((id) => finalModels[id]).filter((model) => (model !== undefined && model !== null));
      }

      async destroyDecomposedModels(decomposedModels, _opts) {
        var opts = _opts || {},
            owners = this.getDecomposedModelOwners(decomposedModels, opts);

        var promises = Object.keys(owners).map((ownerKey) => {
          var owner = owners[ownerKey],
              { modelType, typeName, primaryKey, primaryKeyFieldName } = owner.getInfo();

          var queryInfo = this.getModelTypeQueryInfo(modelType),
              { tables } = queryInfo;

          var queries = tables.reduce((q, tableInfo) => {
            var { tableName, modelType } = tableInfo,
                thisOwnerIDFieldName = tableInfo.ownerIDFieldName,
                thisOwnerTypeFieldName = tableInfo.ownerTypeFieldName;

            if (opts.primitivesOnly) {
              var schemaEngine = modelType.getSchemaEngine(),
                  typeInfo = schemaEngine.getTypeInfo(modelType.getTypeName());

              if (typeInfo && !typeInfo.primitiveType)
                return q;
            }

            if (!noe(thisOwnerIDFieldName, thisOwnerTypeFieldName)) {
              q.push({
                query: `DELETE FROM ${tableName} WHERE (${thisOwnerIDFieldName}=${this.escape(primaryKey)} AND ${thisOwnerTypeFieldName}=${this.escape(typeName)})`,
                required: true
              });
            }

            return q;
          }, []);

          if (!opts.descendantsOnly) {
            var tableName = this.getTableNameFromModelType(modelType.getSchemaEngine(), modelType);

            queries.push({
              query: `DELETE FROM ${tableName} WHERE (${primaryKeyFieldName}=${this.escape(primaryKey)})`,
              required: true
            });
          }

          return this.execAll(queries, opts);
        });

        return await Promise.all(promises);
      }
    };
  }, BaseConnector);

  root.export({
    BaseSQLConnector
  });
};
