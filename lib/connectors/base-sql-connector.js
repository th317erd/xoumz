const SQLString = require('sqlstring');

module.exports = function(root, requireModule) {
  const { noe, setProp, instanceOf, typeOf } = requireModule('./base/utils');
  const { BaseConnector } = requireModule('./connectors/base-connector');
  const Logger = requireModule('./base/logger');
  const { DecomposedModelCollection, DecomposedModel } = requireModule('./schema/decomposed-model');
  const { Context } = requireModule('./base/context');

  const BaseSQLConnector = this.defineClass((BaseConnector) => {
    return class BaseSQLConnector extends BaseConnector {
      getContext(...args) {
        return new Context({ name: 'sql', group: 'connector' }, ...args);
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
            version = schemaEngine.getVersion(),
            opts = this.getContext(_opts),
            queries = [],
            tables = await this.getSchema(),
            tableModels = tables[version];

        for (var [ modelName, modelClass ] of tableModels) {
          var schemaModelClass = schemaEngine.getModelClass(modelName);
          if (!schemaModelClass) {
            // missing
            continue;
          }

          var modelSchema = schemaModelClass.getSchema(),
              diff = modelSchema.modelSchemaDiff(modelClass.getSchema());

          if (diff) {
            console.log('Field differ!', diff);
          }
        }

        // for (var modelClass of schemaEngine.values()) {
        //   var sqlStatement = this.generateTableCreateQuery(modelClass, opts);
        //   if (!sqlStatement)
        //     continue;

        //   queries.push(sqlStatement);
        // }

        try {
          await this.transaction((connection) => {
            connection.execAll(queries);
          });
        } catch (e) {
          Logger.error(e);
        }
      }

      modelClassToSQLType(field) {
        var context = this.getContext(),
            parts = [];

        if (!field)
          return '';

        var modelClass = field.getModelClass(),
            primitiveType = modelClass.primitive();

        if (!primitiveType)
          return '';

        var modelName = modelClass.getModelName();
        if (modelName === 'Integer' || typeOf(modelClass, 'IntegerPrimitive')) {
          parts.push('INT');
        } else if (modelName === 'Decimal' || typeOf(modelClass, 'DecimalPrimitive')) {
          parts.push('DOUBLE');
        } else if (modelName === 'Boolean' || typeOf(modelClass, 'BooleanPrimitive', 'Boolean')) {
          parts.push('TINYINT(1)');
        } else if (modelName === 'String' || typeOf(modelClass, 'StringPrimitive', 'String')) {
          var size = field.getProp('length', context);
          if (!size)
            size = this.getDefaultStringMaxLength();

          parts.push('VARCHAR');
          parts.push(`(${size})`);
        } else if (modelName === 'Date' || typeOf(modelClass, 'DatePrimitive', 'moment', 'Date')) {
          parts.push('DATETIME');
        }

        return parts.join('');
      }

      generateFieldDefinitionQuery(field) {
        var query = [],
            fieldName = field.getProp('field', this.getContext());

        query.push(`${fieldName} ${this.modelClassToSQLType(field)}`);

        var flags = this.modelClassToSQLTypeFlags(field);
        if (!noe(flags)) {
          query.push(' ');
          query.push(flags);
        }

        return query.join('');
      }

      async dropColumn(schemaEngine, modelClass, schemaType, _opts) {
        var ModelNameClass = this.getApplication().getModelNameClass(),
            SchemaTypeClass = this.getApplication().getSchemaTypeClass(),
            opts = _opts || {},
            tableName = (modelClass instanceof ModelNameClass) ? this.getTableNameFromModelName(schemaEngine, modelClass) : modelClass,
            columnName = (schemaType instanceof SchemaTypeClass) ? schemaType.getProp('field', this.getContext()) : schemaType;

        if (noe(tableName))
          throw new Error('Can not drop column, unknown table name');

        if (noe(columnName))
          throw new Error(`Can not drop column, unknown column name (for table ${tableName})`);

        var queries = this.generateDropColumnQueries(schemaEngine, modelClass, tableName, columnName);

        await this.execAll(queries, undefined, opts);
      }

      async addColumn(schemaEngine, modelClass, schemaType, _opts) {
        var ModelNameClass = this.getApplication().getModelNameClass(),
            opts = _opts || {},
            tableName = (modelClass instanceof ModelNameClass) ? this.getTableNameFromModelName(schemaEngine, modelClass) : modelClass;

        if (noe(tableName))
          throw new Error('Can not drop column, unknown table name');

        var queries = this.generateAddColumnQueries(schemaEngine, modelClass, tableName, schemaType);
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
            val = !(('' + val).match(/^(0|n|f)/i));
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

      queryToSQLQueryString(modelClass, query) {
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
              if (!modelClass.hasField(query.field))
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

      tableToNamedFields(schemaEngine, tableName, modelClass, minimal) {
        var context = this.getContext(),
            modelName = modelClass.getModelName(),
            fields = [];

        if (minimal) {
          fields = modelClass.getMinimalRequiredFields();
        } else {
          modelClass.iterateFields((field, fieldName, index, flags) => {
            fields.push(field);
            //
            // namedFields.push();
          }, { virtual: false, primitive: true });
        }

        return fields.map((field) => {
          var context = this.getContext(),
              fieldName = field.getProp('field', context),
              contextField = field.getProp('field', context);

          return `${tableName}.${contextField} as ${this.escape(`${modelName}:${fieldName}`)}`;
        }).join(',');
      }

      tableToPrimaryKeyField(schemaEngine, tableName, modelClass) {
        var context = this.getContext(),
            modelName = modelClass.getModelName(),
            primaryKeyFieldDBName = this.getModelNamePrimaryKeyField(modelClass, this.getContext()),
            primaryKeyFieldName = this.getModelNamePrimaryKeyField(modelClass);

        // modelClass.iterateFields((field, fieldName, index, flags) => {
        //   var contextField = field.getProp('field', this.getContext());
        //   namedFields.push();
        // }, { virtual: false, primitive: true });

        return `${tableName}.${primaryKeyFieldDBName} as ${this.escape(`${modelName}:${primaryKeyFieldName}`)}`;
      }

      getRowsFromQueryResult(schemaEngine, result) {
        throw new Error(`Connector [${this.context}] doesn't implement "getRowsFromQueryResult" method`);
      }

      getModelEntryFromTypeName(schemaEngine, modelClassMap, modelName) {
        var modelEntry = modelClassMap[modelName];
        if (!modelEntry) {
          var modelClassInfo = this.getModelNameInfoFromTypeName(schemaEngine, modelName);

          modelEntry = modelClassMap[modelName] = Object.assign({
            ids: {},
            modelData: {}
          }, modelClassInfo);
        }

        return modelEntry;
      }

      getDecomposedModelsFromRows(schemaEngine, rows) {
        var decomposedModels = new DecomposedModelCollection();
        if (noe(rows))
          return decomposedModels;

        var modelClassMap = {},
            context = this.getContext();

        for (var i = 0, il = rows.length; i < il; i++) {
          var row = rows[i],
              columns = Object.keys(row);

          for (var j = 0, jl = columns.length; j < jl; j++) {
            var column = columns[j],
                columnName,
                modelName;

            column.replace(/^([^:]+):(.*)$/g, function(m, tn, col) {
              modelName = tn;
              columnName = col;
            });

            var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelClassMap, modelName);
            var { modelData, modelClass, primaryKeyFieldName } = modelEntry,
                contextField = modelClass.getField(columnName, context);

            if (!contextField)
              continue;

            var fieldName = contextField.getProp('field', this.getContext()),
                currentValue = row[column];

            if (primaryKeyFieldName === fieldName) {
              var primaryKey = modelData[fieldName];
              if (currentValue !== primaryKey && !noe(primaryKey)) {
                // Did we hit a new value?
                decomposedModels.push(new DecomposedModel({ modelClass, primaryKeyFieldName, value: modelData, primaryKey }));
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
        var keys = Object.keys(modelClassMap);
        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i],
              modelEntry = modelClassMap[key],
              { modelData, modelClass, primaryKeyFieldName } = modelEntry,
              primaryKey = modelData[primaryKeyFieldName];

          if (!noe(primaryKey))
            decomposedModels.push(new DecomposedModel({ modelClass, primaryKeyFieldName, value: modelData, primaryKey }));
        }

        return decomposedModels;
      }

      getModelNameQueryInfo(modelClass) {
        if (!modelClass)
          throw new Error('Unknown or empty model type provided');

        var primaryTypeName = modelClass.getModelName(),
            primaryTableName = this.getTableNameFromModelName(schemaEngine, modelClass);

        if (noe(primaryTableName))
          throw new Error(`${modelClass.getModelName()} model doesn't specify a valid database table / bucket`);

        var ModelNameClass = this.getApplication().getModelNameClass(),
            context = this.getContext(),
            schemaEngine = modelClass.getSchemaEngine(),
            primaryKeyFieldName = this.getModelNamePrimaryKeyField(modelClass, { context }),
            ownerIDField = modelClass.getOwnerIDField(),
            ownerIDFieldName = (ownerIDField) ? modelClass.getFieldProp(ownerIDField, 'field', { context }) : undefined,
            ownerTypeField = modelClass.getOwnerTypeField(),
            ownerTypeFieldName = (ownerTypeField) ? modelClass.getFieldProp(ownerTypeField, 'field', { context }) : undefined,
            subTypeNames = modelClass.getChildTypeNames({ virtual: false, internal: false, target: true }),
            hasSelfSubType = false,
            subTypes = subTypeNames.map((modelName) => {
              var subModelName = schemaEngine.getModelName(modelName);
              if (!(subModelName instanceof ModelNameClass))
                throw new Error(`Connector (${context}) error: Can not query data: unknown or invalid schema type`);

              var thisTableName = this.getTableNameFromModelName(schemaEngine, subModelName);
              if (noe(thisTableName))
                throw new Error(`${subModelName.getModelName()} model doesn't specify a valid database table / bucket`);

              if (thisTableName === primaryTableName) {
                hasSelfSubType = true;
                return;
              }

              return {
                modelName,
                modelClass: subModelName,
                tableName: thisTableName
              };
            }).filter((e) => !!e),
            tables = subTypes.concat({ modelName: primaryTypeName, modelClass, tableName: primaryTableName }).map((type) => {
              var { tableName, modelClass } = type;

              type.fields = this.tableToNamedFields(schemaEngine, tableName, modelClass, (type.tableName !== primaryTableName));

              var thisOwnerIDField = modelClass.getOwnerIDField(),
                  thisOwnerTypeField = modelClass.getOwnerTypeField();

              type.ownerIDFieldName = (thisOwnerIDField) ? modelClass.getFieldProp(thisOwnerIDField, 'field', { context }) : undefined;
              type.ownerTypeFieldName = (thisOwnerTypeField) ? modelClass.getFieldProp(thisOwnerTypeField, 'field', { context }) : undefined;

              return type;
            });

        return {
          modelClass,
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

      async fetchFromQuery(schemaEngine, modelClass, query, _opts) {
        var primaryTypeName = modelClass.getModelName(),
            primaryTableName = this.getTableNameFromModelName(schemaEngine, modelClass);

        if (noe(primaryTableName))
          throw new Error(`${modelClass.getModelName()} model doesn't specify a valid database table / bucket`);

        var opts = _opts || {},
            context = this.getContext(),
            querySQLWhere = this.queryToSQLQueryString(modelClass, query),
            primaryKeyFieldName = this.getModelNamePrimaryKeyField(modelClass, { context }),
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
          //   collection.push(this.generateLazyModelLoader(modelClass, id, loaderOpts));
          // });

          // return collection;

          ids = ids.map((row) => row[primaryKeyFieldName]);
          var decomposedModels = await this.readDecomposedModelsFromIDs(schemaEngine, modelClass, ids, opts);

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

      // async readRelatedModels(schemaEngine, modelClass, decomposedModels, _opts) {
      //   if (noe(decomposedModels))
      //     return [];

      //   var opts = _opts || {},
      //       modelClassMap = {};

      //   decomposedModels.forEach((decomposedModel) => {
      //     var { modelClass, primaryKey, value, modelName } = decomposedModel.getInfo();

      //     var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelClassMap, modelName);
      //     modelEntry.ids[primaryKey] = primaryKey;

      //     var ownerID = modelClass.retrieveOwnerIDValue(value);
      //     if (ownerID) {
      //       var ownerType = modelClass.retrieveOwnerTypeValue(value);
      //       if (ownerType) {
      //         modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelClassMap, ownerType);
      //         modelEntry.ids[ownerID] = ownerID;
      //       }
      //     }
      //   });

      //   var allModels = await Promise.all(Object.keys(modelClassMap).map((modelName) => {
      //     var modelEntry = modelClassMap[modelName];
      //     return this.readDecomposedModelsFromIDs(schemaEngine, modelEntry.modelClass, Object.keys(modelEntry.ids), opts);
      //   }));

      //   return [].concat(...allModels);
      // }

      // async readDecomposedModelsFromIDs(schemaEngine, modelClass, modelIDs, _opts) {
      //   if (noe(modelIDs))
      //     return [];

      //   var { primaryTypeName,
      //         primaryTableName,
      //         primaryKeyFieldName,
      //         ownerIDFieldName,
      //         ownerTypeFieldName,
      //         hasSelfSubType,
      //         tables
      //       } = this.getModelNameQueryInfo(modelClass);

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
      //       var { modelName, primaryKey } = decomposedModel.getInfo(),
      //           thisID = `${modelName}:${primaryKey}`;

      //       if (modelMap[thisID])
      //         return false;

      //       modelMap[thisID] = decomposedModel;

      //       return true;
      //     });

      //     var subDecomposedModels = await this.readRelatedModels(schemaEngine, modelClass, decomposedModels, {
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

      // async readChildModelIDs(schemaEngine, modelClass, decomposedModels, _opts) {
      //   if (noe(decomposedModels))
      //     return [];

      //   var opts = _opts || {},
      //       modelClassMap = {};

      //   decomposedModels.forEach((decomposedModel) => {
      //     var { modelClass, primaryKey, value, modelName } = decomposedModel.getInfo();

      //     var modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelClassMap, modelName);
      //     modelEntry.ids[primaryKey] = primaryKey;

      //     var ownerID = modelClass.retrieveOwnerIDValue(value);
      //     if (ownerID) {
      //       var ownerType = modelClass.retrieveOwnerTypeValue(value);
      //       if (ownerType) {
      //         modelEntry = this.getModelEntryFromTypeName(schemaEngine, modelClassMap, ownerType);
      //         modelEntry.ids[ownerID] = ownerID;
      //       }
      //     }
      //   });

      //   var allModels = await Promise.all(Object.keys(modelClassMap).map((modelName) => {
      //     var modelEntry = modelClassMap[modelName];
      //     return this.readDecomposedModelsFromIDs(schemaEngine, modelEntry.modelClass, Object.keys(modelEntry.ids), opts);
      //   }));

      //   return [].concat(...allModels);
      // }

      async readDecomposedModelsFromIDs(schemaEngine, modelClass, modelIDs, _opts) {
        if (!modelIDs)
          return new DecomposedModelCollection();

        var { primaryTypeName,
              primaryTableName,
              primaryKeyFieldName,
              ownerIDFieldName,
              ownerTypeFieldName,
              hasSelfSubType,
              tables
            } = this.getModelNameQueryInfo(modelClass);

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

          // var subDecomposedModels = await this.readChildModelIDs(schemaEngine, modelClass, decomposedModels, opts);
          // decomposedModels = decomposedModels.concat(...subDecomposedModels);

          debugger;

          return DecomposedModelCollection.from(decomposedModels);
        } catch (e) {
          Logger.error(e);
          return [];
        }
      }

      async readModelsFromIDs(schemaEngine, modelClass, modelIDs, _opts) {
        var opts = _opts || {},
            decomposedModels = await this.readDecomposedModelsFromIDs(schemaEngine, modelClass, modelIDs, opts);

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

        var { primaryTypeName } = this.getModelNameQueryInfo(modelClass);

        Object.keys(parents).forEach((parentID) => {
          var decomposedModel = parents[parentID];

          modelClass.instantiate(decomposedModel, {
            owner: decomposedModel.owner,
            onModelCreate: function() {
              var modelClass = this.schema(),
                  modelName = modelClass.getModelName(),
                  primaryKey = modelClass.retrievePrimaryKeyValue(this);

              if (modelName === primaryTypeName && finalModels.hasOwnProperty(primaryKey))
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
              { modelClass, modelName, primaryKey, primaryKeyFieldName } = owner.getInfo();

          var queryInfo = this.getModelNameQueryInfo(modelClass),
              { tables } = queryInfo;

          var queries = tables.reduce((q, tableInfo) => {
            var { tableName, modelClass } = tableInfo,
                thisOwnerIDFieldName = tableInfo.ownerIDFieldName,
                thisOwnerTypeFieldName = tableInfo.ownerTypeFieldName;

            if (opts.primitivesOnly) {
              var schemaEngine = modelClass.getSchemaEngine(),
                  typeInfo = schemaEngine.getTypeInfo(modelClass.getModelName());

              if (typeInfo && !typeInfo.primitiveType)
                return q;
            }

            if (!noe(thisOwnerIDFieldName, thisOwnerTypeFieldName)) {
              q.push({
                query: `DELETE FROM ${tableName} WHERE (${thisOwnerIDFieldName}=${this.escape(primaryKey)} AND ${thisOwnerTypeFieldName}=${this.escape(modelName)})`,
                required: true
              });
            }

            return q;
          }, []);

          if (!opts.descendantsOnly) {
            var tableName = this.getTableNameFromModelName(modelClass.getEngine('schema', this.getContext()), modelClass);

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
