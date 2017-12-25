module.exports = function(root, requireModule) {
  const { definePropertyRW, noe, instanceOf, sizeOf } = requireModule('./utils');
  const Logger = requireModule('./logger');
  const { ModelType } = requireModule('./schema');
  const { SchemaType } = requireModule('./schema/schema-type');

  class BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

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

    getSchemaEngine() {
      return this.getApplication().getSchemaEngine()
    }

    getContext() {
      return this.context;
    }

    async migrate(schemaEngine) {
      throw new Error(`Connector [${this.context}] doesn't support schema migration`);
    }

    getTableNameFromModelType(schemaEngine, modelType) {
      var opts = this.options,
          tableName = (modelType.hasField('_table')) ? modelType.getFieldProp('_table', 'value', this.context) : null;

      if (noe(tableName))
        tableName = `${modelType.getTypeName()}_Models`;

      return (opts.tableNameFormatter) ? opts.tableNameFormatter.call(this, tableName, 'format') : tableName;
    }

    getModelNameFromTableName(schemaEngine, tableName) {
      var opts = this.options,
          modelName;

      schemaEngine.iterateModelSchemas((modelType, modelTypeName, _, abort) => {
        var modelTableName = this.getTableNameFromModelType(schemaEngine, modelType);
        if (modelTableName === tableName) {
          modelName = modelTypeName;
          return abort;
        }
      });

      if (!modelName)
        modelName = tableName.replace(/_Models$/, '');

      return (opts.tableNameFormatter) ? opts.tableNameFormatter.call(this, modelName, 'unformat') : modelName;
    }

    async getRawDatabaseSchema() {
      throw new Error(`Connector [${this.context}] doesn't support fetching raw database schema`);
    }

    databaseTypeNameToSchemaTypeName(_type, _name) {
      var type = ('' + _type);
      if (type.match(/varchar/i)) {
        if (_name === 'OwnerID')
          return 'OwnerID';
        else if (_name === 'OwnerField')
          return 'OwnerField';
        else if (_name === 'OwnerType')
          return 'OwnerType';

        return 'String';
      } else if (type.match(/int/i)) {
        return 'Integer';
      } else if (type.match(/double/i)) {
        return 'Decimal';
      } else if (type.match(/tinyint/i)) {
        return 'Boolean';
      } else if (type.match(/datetime/i)) {
        return 'Date';
      }
    }

    schemaTypeNameToDatabaseTypeName(_type) {
      var type = ('' + _type);

      if (type === 'Integer')
        return 'int';
      else if (type === 'Decimal')
        return 'double';
      else if (this.isStringBaseType(type))
        return 'varchar';
      else if (type === 'Date')
        return 'datetime';
      else if (type === 'Boolean')
        return 'tinyint';
    }


    databaseTypeToSchemaType(schemaEngine, modelTypeName, column) {
      var modelType = schemaEngine.getModelType(modelTypeName);
      if (!modelType) {
        Logger.warn(`Do not know how to convert database type ${modelTypeName} into native schema type`);
        return;
      }

      var schemaTypes = modelType.getSchemaTypes();
      if (!schemaTypes) {
        Logger.warn(`Do not know how to convert database column type ${column.type} into native schema type`);
        return;
      }

      var field = schemaTypes[column.type];
      if (!field) {
        Logger.warn(`Do not know how to convert database column type ${column.type} into native schema type`);
        return;
      }

      if (column.value !== null && column.value !== undefined)
        field.value(column.value);

      if (column.max !== null && column.max !== undefined)
        field.max(column.max);

      if (column.min !== null && column.min !== undefined)
        field.min(column.min);

      if (column.primaryKey)
        field.primaryKey = true;

      field.field(column.field);
      field.notNull = !!column.notNull;

      return field;
    }

    databaseTypesToSchema(schemaEngine, modelTypeName, table) {
      var columnNames = Object.keys(table),
          schema = {};

      for (var i = 0, il = columnNames.length; i < il; i++) {
        var fieldName = columnNames[i],
            rawColumn = table[fieldName],
            field = this.databaseTypeToSchemaType(schemaEngine, modelTypeName, rawColumn);

        if (!field)
          continue;

        schema[fieldName] = field;
      }

      return schema;
    }

    async getSchema() {
      var rawSchema = await this.getRawDatabaseSchema(),
          tableNames = Object.keys(rawSchema),
          schemaEngine = this.getSchemaEngine(),
          finalRawSchema = {};

      for (var i = 0, il = tableNames.length; i < il; i++) {
        var tableName = tableNames[i],
            table = rawSchema[tableName],
            modelName = this.getModelNameFromTableName(schemaEngine, tableName),
            schema = this.databaseTypesToSchema(schemaEngine, modelName, table);

        finalRawSchema[modelName] = schema;
      }

      return finalRawSchema;
    }

    isStringBaseType(type) {
      return (type === 'String' || type === 'OwnerType' || type === 'OwnerField' || type === 'OwnerID');
    }

    introspectSchemaType(schema, data, _opts) {
      var opts = _opts || {};
      return schema.introspectSchemaType(data, opts);
    }

    async query(schema, query, opts) {
      throw new Error(`Connector [${this.context}] doesn't support queries`);
    }

    async write(schema, data, opts) {
      throw new Error(`Connector [${this.context}] doesn't support writing`);
    }
  }

  Object.assign(root, {
    BaseConnector
  });
};
