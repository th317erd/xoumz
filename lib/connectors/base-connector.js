module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf, sizeOf } = requireModule('./base/utils');
  const Logger = requireModule('./base/logger');
  const { DecomposedModelCollection, DecomposedModel } = requireModule('./schema/decomposed-model');
  const { Context } = requireModule('./base/context');
  const { SchemaIntegrity } = requireModule('./schema/schema-integrity');

  const BaseConnector = this.defineClass((ParentClass) => {
    return class BaseConnector extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});

        definePropertyRO(this, '_base', this);
        definePropertyRW(this, 'options', opts);
        definePropertyRW(this, '_schemaCache', null);

        definePropertyRW(this, 'context', undefined, () => this.options.context, (val) => {
          this.options.context = val;
          return val;
        });

        definePropertyRW(this, 'readable', undefined, () => this.options.read, (val) => {
          this.options.read = val;
          return val;
        });

        definePropertyRW(this, 'writable', undefined, () => this.options.write, (val) => {
          this.options.write = val;
          return val;
        });

        definePropertyRW(this, 'primary', undefined, () => this.options.primary, (val) => {
          this.options.primary = val;
          return val;
        });
      }

      async onShutdown() {}

      getContext(...args) {
        return new Context({ name: 'base', group: 'connector' }, ...args);
      }

      async migrate() {
        throw new Error(`Connector [${this.context}] doesn't support schema migration`);
      }

      getTableNameFromModelName(modelClass, _opts) {
        var opts = _opts || {},
            modelSchema = modelClass.getSchema(),
            tableName = modelSchema.getFieldProp('_table', 'value', this.getContext(opts, { modelClass, modelSchema }));

        if (noe(tableName))
          tableName = `${modelClass.getModelName()}_${modelSchema.getVersion()}`;

        return tableName;
      }

      async getModelSchemaFromTableName(tableName) {
        var app = this.getMasterApplication(),
            versions = app.getApplicationVersions();

        for (var i = 0, il = versions.length; i < il; i++) {
          var version = versions[i],
              schemaEngine = app.getEngine('schema', { version });

          for (var modelClass of schemaEngine.values()) {
            var modelTableName = this.getTableNameFromModelName(modelClass, { version });

            if (modelTableName === tableName)
              return modelClass.getSchema();
          }
        }
      }

      async getRawDatabaseSchema() {
        throw new Error(`Connector [${this.context}] doesn't support fetching raw database schema`);
      }

      // TODO: Update using primitive type name of schema
      databaseTypeNameToSchemaTypeName(_type, _name) {
        var type = ('' + _type);
        if (type.match(/varchar/i)) {
          if (_name === 'OwnerID')
            return 'OwnerID';
          else if (_name === 'OwnerField')
            return 'OwnerField';
          else if (_name === 'OwnerType')
            return 'OwnerType';
          else if (_name === 'Role')
            return 'Role';

          return 'String';
        } else if (type.match(/tinyint/i)) {
          return 'Boolean';
        } else if (type.match(/int/i)) {
          if (_name === 'OwnerOrder')
            return 'OwnerOrder';

          return 'Integer';
        } else if (type.match(/double/i)) {
          return 'Decimal';
        } else if (type.match(/datetime/i)) {
          return 'Date';
        }
      }

      abstractTypeToFieldDefinition(schemaEngine, column, opts) {
        var schemaTypes = schemaEngine.getSchemaTypes(this.getContext(opts)),
            field = schemaTypes[column.type];

        if (!column.type)
          debugger;

        if (!field) {
          Logger.warn(`Do not know how to convert database column type ${column.type} into native schema type`);
          return;
        }

        if (column.field != null)
          field = field.field(column.field);

        if (column.value != null)
          field = field.value(column.value);

        if (column.type === 'String')
          field = field.size((column.size != null) ? column.size : this.getDefaultStringMaxLength());

        if (column.primaryKey)
          field = field.primaryKey(true);

        field = field.nullable(!!column.nullable);

        var scope = field.getScope();
        return field;
      }

      async databaseTableToModelClass(schemaEngine, tableName, table) {
        var definedModelSchema = await this.getModelSchemaFromTableName(tableName),
            columnNames = Object.keys(table),
            rawSchema = {};

        for (var i = 0, il = columnNames.length; i < il; i++) {
          var fieldName = columnNames[i],
              rawColumn = table[fieldName];

          if (!rawColumn.type)
            continue;

          var field = this.abstractTypeToFieldDefinition(schemaEngine, rawColumn, { version: definedModelSchema.getVersion() });
          if (!field)
            continue;

          rawSchema[fieldName] = field;
        }

        var ModelClass = definedModelSchema.getModelClass(),
            modelName = ModelClass.getModelName(),
            app = this.getVersionedApplication({ version: definedModelSchema.getVersion() });

        return app.defineClass((ModelClass) => {
          return class GenericModel extends ModelClass {
            static getModelName() {
              return modelName;
            }

            static schema(defineSchema) {
              return defineSchema(ModelClass.schema, {
                schema: function(types, modelName, parentSchema) {
                  return (parentSchema) ? this.merge(rawSchema, { onlyMatching: true }) : rawSchema;
                },
                demote: function(values, _opts) {},
                promote: function(values, _opts) {}
              });
            }
          };
        }, ModelClass);
      }

      async getSchema(_opts) {
        var opts = this.getContext(_opts);
        if (this._schemaCache && opts.force !== true)
          return this._schemaCache;

        var schemaEngine = this.getEngine('schema'),
            rawSchema = await this.getRawDatabaseSchema(schemaEngine),
            tableNames = Object.keys(rawSchema),
            finalRawSchema = {};

        for (var i = 0, il = tableNames.length; i < il; i++) {
          var tableName = tableNames[i],
              table = rawSchema[tableName],
              modelClass = await this.databaseTableToModelClass(schemaEngine, tableName, table),
              modelSchema = modelClass.getSchema(),
              modelVersion = modelSchema.getVersion(),
              group = finalRawSchema[modelVersion];

          if (!group)
            group = finalRawSchema[modelVersion] = {};

          group[modelClass.getModelName()] = modelClass;
        }

        this._schemaCache = finalRawSchema;
        return finalRawSchema;
      }

      verifySchemaIntegrity(schemaEngine, tableModels) {
        return new SchemaIntegrity(schemaEngine, tableModels, this.getContext());
      }

      async verifySchemaUpdate(schemaEngine, opts) {
        var tables = await this.getSchema(),
            rawTableSchema = await this.getRawDatabaseSchema(schemaEngine, opts),
            version = schemaEngine.getVersion(),
            tableModels = tables[version] || {},
            integrity = this.verifySchemaIntegrity(schemaEngine, tableModels),
            autoMigrateOptions = true;/*this.getConfigValue('schema.autoMigrate', {
              allowCoerceColumn: false,
              allowDropColumn: false,
              allowAddColumn: true,
              allowDropTable: false,
              allowAddTable: true
            });*/

        if (instanceOf(autoMigrateOptions, 'boolean')) {
          var booleanValue = autoMigrateOptions;
          autoMigrateOptions = {
            allowCoerceColumn: booleanValue,
            allowDropColumn: booleanValue,
            allowAddColumn: booleanValue,
            allowDropTable: booleanValue,
            allowAddTable: booleanValue
          };
        }

        // WIP: Verify schema against all keys
        var schemaTypeNames = schemaEngine.getSchemaTypeNames({ real: true }),
            allKeys = Object.keys(Object.assign({}, schemaTypeNames.reduce((obj, name) => (obj[name] = true && obj), {}), tableModels));

        for (var i = 0, il = allKeys.length; i < il; i++) {
          var modelName = allKeys[i],
              modelClass = schemaEngine.getModelClass(modelName),
              hasTable = tableModels.hasOwnProperty(modelName);

          if (hasTable) {
            if (!integrity.getModelIntegrity(modelName))
              continue;

            if (!autoMigrateOptions.allowDropTable && !modelClass)
              throw new Error(`Error: Would have dropped table for model ${modelName}, but autoMigrate options disallow dropping tables. Please manually migrate the data for ${opts.scope} connector first`);

            var columnNames = integrity.isAddingFields(modelName);
            if (!autoMigrateOptions.allowAddColumn && columnNames.length)
              throw new Error(`Error: Would have added column for fields [${columnNames.join(', ')}], but autoMigrate options disallow adding columns. Please manually migrate the data for ${opts.scope} connector first`);

            var columnNames = integrity.isDroppingFields(modelName);
            if (!autoMigrateOptions.allowDropColumn && columnNames.length)
              throw new Error(`Error: Would have dropped column [${columnNames.join(', ')}], but autoMigrate options disallow dropping columns. Please manually migrate the data for ${opts.scope} connector first`);

            var columnNames = integrity.isCoercingFields(modelName);
            if (!autoMigrateOptions.allowCoerceColumn && columnNames.length)
              throw new Error(`Error: Would have coerced column [${columnNames.join(', ')}], but autoMigrate options disallow coercing columns. Please manually migrate the data for ${opts.scope} connector first`);
          } else {
            if (!autoMigrateOptions.allowAddTable && modelClass)
              throw new Error(`Error: Would have added table for model ${modelName}, but autoMigrate options disallow adding tables. Please manually migrate the data for ${opts.scope} connector first`);
          }
        }

        return integrity;
      }

      introspectModelName(schemaEngine, data, _opts) {
        var opts = _opts || {};
        return schemaEngine.introspectModelName(data, opts);
      }

      getModelNamePrimaryKeyField(modelClass, _opts) {
        var primaryKeyFieldName = modelClass.getFieldProp(modelClass.getPrimaryKeyField(), 'field', _opts);
        if (!primaryKeyFieldName)
          throw new Error(`Connector (${this.context}) error: Can not read data: primary key for type ${modelClass.getModelName()} is unknown or invalid`);

        return primaryKeyFieldName;
      }

      getDecomposedModelOwners(decomposedModels) {
        var owners = {},
            application = this.getApplication(),
            context = this.getContext();

        // Get owner information
        for (var i = 0, il = decomposedModels.length; i < il; i++) {
          var decomposedModel = decomposedModels[i];
          if (!decomposedModel)
            continue;

          var { modelClass, value } = decomposedModel.getInfo();
          if (!modelClass || !value)
            continue;

          var ownerID = modelClass.retrieveOwnerIDValue(value),
              ownerType = modelClass.retrieveOwnerTypeValue(value);

          if (noe(ownerID, ownerType))
            continue;

          var key = `${ownerType}:${ownerID}`;
          if (owners.hasOwnProperty(key))
            continue;

          var ownerModelName = application.getModelName(ownerType, { context, model: decomposedModel, operation: 'write' });
          if (!ownerModelName)
            throw new Error(`Can not figure out model type for owner type ${ownerType}`);

          var primaryKeyFieldName = this.getModelNamePrimaryKeyField(ownerModelName, { context: this.getContext() });
          owners[key] = new DecomposedModel({
            modelClass,
            modelName: ownerType,
            primaryKey: ownerID,
            primaryKeyFieldName
          });
        }

        return owners;
      }

      async query(query, _opts) {
        var ModelNameClass = this.getApplication().getModelNameClass(),
            opts = _opts || {},
            modelClass = opts.modelClass,
            schemaEngine,
            contextOpts = Object.assign({ context: this.getContext(), operation: 'query', query }, opts);

        if (!modelClass)
          modelClass = this.getApplication().getModelName(null, contextOpts);

        if (!modelClass)
          modelClass = query.getModelName(contextOpts)[0];

        if (!(modelClass instanceof ModelNameClass))
          throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid model type`);

        var schemaEngine = modelClass.getEngine('schema');
        return await this.fetchFromQuery(schemaEngine, modelClass, query, opts);
      }

      async writeRaw(decomposedModel, _opts) {
        throw new Error(`Connector [${this.context}] doesn't implement "writeRaw" method`);
      }

      async getDecomposedModelAndInfo(data, _opts) {
        if (!data || !instanceOf(data, 'object') || !sizeOf(data))
          return;

        var ModelNameClass = this.getApplication().getModelNameClass(),
            opts = _opts || {},
            modelClass = opts.modelClass,
            schemaEngine,
            contextOpts = Object.assign({ context: this.getContext(), operation: 'write', model: data }, opts);

        if (!modelClass) {
          schemaEngine = this.getApplication().getSchemaEngine(contextOpts);
          if (schemaEngine)
            modelClass = schemaEngine.introspectModelName(data, contextOpts);
        } else {
          schemaEngine = modelClass.getSchemaEngine();
        }

        if (!(modelClass instanceof ModelNameClass))
          throw new Error(`Connector (${this.context}) error: Can not write data: unknown or invalid schema type`);

        var items = (data instanceof DecomposedModelCollection)
                      ? data
                      : (data instanceof DecomposedModel)
                        ? new DecomposedModelCollection(data)
                        : await data.decompose();

        return {
          modelClass,
          schemaEngine,
          opts: contextOpts,
          items
        };
      }

      async write(data, _opts) {
        var { opts, items } = await this.getDecomposedModelAndInfo(data, _opts);

        var rets = await this.transaction(async (connectionOpts) => {
          var writeOpts = Object.assign({}, opts, connectionOpts);

          await this.destroyDecomposedModels(items, Object.assign({}, writeOpts, { descendantsOnly: true }));

          var promises = items.map(async (item) => {
            await this.writeRaw(item, writeOpts);
          });

          return await Promise.all(promises);
        });

        var errors = [];
        rets.forEach((ret) => {
          if (ret instanceof Error)
            errors.push(ret);
        });

        return { connector: this, model: data, success: !errors.length, errors };
      }

      async destroy(data, _opts) {
        var { opts, items } = this.getDecomposedModelAndInfo(data, _opts);

        var rets = await this.transaction(async (connectionOpts) => {
          var writeOpts = Object.assign({}, opts, connectionOpts);

          return await this.destroyDecomposedModels(items, writeOpts);
        });

        var errors = [];
        rets.forEach((ret) => {
          if (ret instanceof Error)
            errors.push(ret);
        });

        return { connector: this, model: data, success: !errors.length, errors };
      }

      transaction(cb) {
        throw new Error(`Connector [${this.context}] doesn't implement the 'transaction' method`);
      }

      async beginTransaction() {
        throw new Error(`Connector [${this.context}] doesn't implement the 'beginTransaction' method`);
      }

      async endTransaction() {
        throw new Error(`Connector [${this.context}] doesn't implement the 'endTransaction' method`);
      }

      async transaction(cb) {
        var connectionOpts = await this.beginTransaction();

        try {
          var ret = await cb.call(this, connectionOpts);
          await this.endTransaction(null, connectionOpts);
          return ret;
        } catch (e) {
          await this.endTransaction(e, connectionOpts);
          throw e;
        }
      }
    };
  });

  root.export({
    BaseConnector
  });
};
