module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf, sizeOf } = requireModule('./base/utils');
  const Logger = requireModule('./base/logger');
  const { DecomposedModelCollection, DecomposedModel } = requireModule('./schema/decomposed-model');
  const { Context } = requireModule('./base/context');

  const BaseConnector = this.defineClass((ParentClass) => {
    return class BaseConnector extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});

        definePropertyRO(this, '_base', this);
        definePropertyRW(this, 'options', opts);
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

      getTableNameFromModelType(modelType, _opts) {
        var opts = _opts || {},
            modelSchema = modelType.getSchema(),
            tableName = modelSchema.getFieldProp('_table', 'value', this.getContext(opts, { modelType, modelSchema }));

        if (noe(tableName))
          tableName = `${modelType.getTypeName()}_${modelSchema.getVersion()}`;

        return tableName;
      }

      async getModelSchemaFromTableName(tableName) {
        var app = this.getMasterApplication(),
            versions = app.getApplicationVersions();

        for (var i = 0, il = versions.length; i < il; i++) {
          var version = versions[i],
              schemaEngine = app.getEngine('schema', { version });

          for (var [ typeName, type ] of schemaEngine) {
            var modelSchema = type.getSchema(),
                modelTableName = this.getTableNameFromModelType(type, { version });

            if (modelTableName === tableName)
              return modelSchema.cloneWithVersion(version);
          }
        }
      }

      async getRawDatabaseSchema(schemaEngine) {
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

        if (column.value !== null && column.value !== undefined)
          field.value(column.value);

        if (column.type === 'String' && column.max !== null && column.max !== undefined)
          field.max(column.max);

        if (column.type === 'String' && column.min !== null && column.min !== undefined)
          field.min(column.min);

        if (column.primaryKey)
          field.primaryKey(true);

        field.nullable(!!column.nullable);

        return field;
      }

      async databaseTableToModelType(schemaEngine, tableName, table) {
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

        var ModelClass = definedModelSchema.getModelClass();
        return schemaEngine.generateModelType(class GenericModel extends ModelClass {
          static schema(defineSchema) {
            return defineSchema(null, {
              version: definedModelSchema.getVersion(),
              schema: function() {
                return rawSchema;
              },
              demote: function(values, _opts) {},
              promote: function(values, _opts) {}
            });
          }
        }, definedModelSchema.getTypeName());
      }

      async getSchema() {
        var schemaEngine = this.getEngine('schema'),
            rawSchema = await this.getRawDatabaseSchema(schemaEngine),
            tableNames = Object.keys(rawSchema),
            finalRawSchema = {};

        for (var i = 0, il = tableNames.length; i < il; i++) {
          var tableName = tableNames[i],
              table = rawSchema[tableName],
              modelType = await this.databaseTableToModelType(schemaEngine, tableName, table);

          finalRawSchema[modelType.getTypeName()] = modelType;
        }

        return finalRawSchema;
      }

      introspectModelType(schemaEngine, data, _opts) {
        var opts = _opts || {};
        return schemaEngine.introspectModelType(data, opts);
      }

      getModelTypePrimaryKeyField(modelType, _opts) {
        var primaryKeyFieldName = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field', _opts);
        if (!primaryKeyFieldName)
          throw new Error(`Connector (${this.context}) error: Can not read data: primary key for type ${modelType.getTypeName()} is unknown or invalid`);

        return primaryKeyFieldName;
      }

      getModelTypeInfoFromTypeName(schemaEngine, typeName) {
        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            modelType = schemaEngine.getModelType(typeName);

        if (!(modelType instanceof ModelTypeClass))
          throw new Error(`Connector (${this.context}) error: Can not read data: unknown or invalid schema type: ${typeName}`);

        return { modelType, typeName, primaryKeyFieldName: this.getModelTypePrimaryKeyField(modelType) };
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

          var { modelType, value } = decomposedModel.getInfo();
          if (!modelType || !value)
            continue;

          var ownerID = modelType.retrieveOwnerIDValue(value),
              ownerType = modelType.retrieveOwnerTypeValue(value);

          if (noe(ownerID, ownerType))
            continue;

          var key = `${ownerType}:${ownerID}`;
          if (owners.hasOwnProperty(key))
            continue;

          var ownerModelType = application.getModelType(ownerType, { context, model: decomposedModel, operation: 'write' });
          if (!ownerModelType)
            throw new Error(`Can not figure out model type for owner type ${ownerType}`);

          var primaryKeyFieldName = this.getModelTypePrimaryKeyField(ownerModelType, { context: this.getContext() });
          owners[key] = new DecomposedModel({
            modelType,
            typeName: ownerType,
            primaryKey: ownerID,
            primaryKeyFieldName
          });
        }

        return owners;
      }

      async query(query, _opts) {
        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            opts = _opts || {},
            modelType = opts.modelType,
            schemaEngine,
            contextOpts = Object.assign({ context: this.getContext(), operation: 'query', query }, opts);

        if (!modelType)
          modelType = this.getApplication().getModelType(null, contextOpts);

        if (!modelType)
          modelType = query.getModelType(contextOpts)[0];

        if (!(modelType instanceof ModelTypeClass))
          throw new Error(`Connector (${this.context}) error: Can not query data: unknown or invalid model type`);

        var schemaEngine = modelType.getEngine('schema');
        return await this.fetchFromQuery(schemaEngine, modelType, query, opts);
      }

      async writeRaw(decomposedModel, _opts) {
        throw new Error(`Connector [${this.context}] doesn't implement "writeRaw" method`);
      }

      async getDecomposedModelAndInfo(data, _opts) {
        if (!data || !instanceOf(data, 'object') || !sizeOf(data))
          return;

        var ModelTypeClass = this.getApplication().getModelTypeClass(),
            opts = _opts || {},
            modelType = opts.modelType,
            schemaEngine,
            contextOpts = Object.assign({ context: this.getContext(), operation: 'write', model: data }, opts);

        if (!modelType) {
          schemaEngine = this.getApplication().getSchemaEngine(contextOpts);
          if (schemaEngine)
            modelType = schemaEngine.introspectModelType(data, contextOpts);
        } else {
          schemaEngine = modelType.getSchemaEngine();
        }

        if (!(modelType instanceof ModelTypeClass))
          throw new Error(`Connector (${this.context}) error: Can not write data: unknown or invalid schema type`);

        var items = (data instanceof DecomposedModelCollection)
                      ? data
                      : (data instanceof DecomposedModel)
                        ? new DecomposedModelCollection(data)
                        : await data.decompose();

        return {
          modelType,
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
