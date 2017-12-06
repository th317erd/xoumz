module.exports = function(root, requireModule) {
  const { definePropertyRW, noe, pluralOf, singularOf, prettify } = requireModule('./utils');
  const Logger = requireModule('./logger');

  class BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'context', undefined, () => this.options.context, (val) => this.options.context = val);
      definePropertyRW(this, 'readable', undefined, () => this.options.read, (val) => this.options.read = val);
      definePropertyRW(this, 'writable', undefined, () => this.options.write, (val) => this.options.write = val);
      definePropertyRW(this, 'primary', undefined, () => this.options.primary, (val) => this.options.primary = val);
    }

    async onShutdown() {}

    validateSchema() {
      
    }

    getContext() {
      return this.context;
    }

    async migrate(schemaEngine) {
      throw new Error(`Connector [${this.context}] doesn't support schema migration`);
    }

    getTableNameFromModelType(schemaEngine, modelType) {
      var opts = this.options,
          tableName = modelType.getTypeName('_table', 'value', this.context);
      
      if (noe(tableName))
        tableName = pluralOf(modelType.getTypeName());
      
      return (opts.tableNameFormatter) ? opts.tableNameFormatter.call(this, tableName, 'format') : tableName;
    }

    getModelNameFromTableName(schemaEngine, tableName) {
      var opts = this.options,
          modelName = prettify(singularOf(tableName));

      return (opts.tableNameFormatter) ? opts.tableNameFormatter.call(this, modelName, 'unformat') : modelName;
    }

    async getRawDatabaseSchema() {
      throw new Error(`Connector [${this.context}] doesn't support fetching raw database schema`);
    }

    databaseTypeNameToSchemaTypeName(_type) {
      var type = ('' + _type);
      if (type.match(/varchar/i))
        return 'String';
      else if (type.match(/int/i))
        return 'Integer';
      else if (type.match(/double/i))
        return 'Decimal';
      else if (type.match(/tinyint/i))
        return 'Boolean';
      else if (type.match(/datetime/i))
        return 'DateTime';
    }

    schemaTypeNameToDatabaseTypeName(_type) {
      var type = ('' + _type);

      if (type === 'Integer')
        return 'int';
      else if (type === 'Decimal')
        return 'double';
      else if (type === 'String')
        return 'varchar';
      else if (type === 'DateTime')
        return 'datetime';
      else if (type === 'Boolean')
        return 'tinyint';
    }


    databaseTypeToSchemaType(schemaEngine, column) {
      var schemaTypes = schemaEngine.getSchemaTypes();
      if (!schemaTypes || !schemaTypes.hasOwnProperty(column.type)) {
        Logger.warn(`Do not know how to convert database type ${column.type} into native schema type`);
        return;
      }

      var field = schemaTypes[column.type];
      
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

    databaseTypesToSchema(schemaEngine, table) {
      var columnNames = Object.keys(table),
          schema = {};

      for (var i = 0, il = columnNames.length; i < il; i++) {
        var fieldName = columnNames[i],
            rawColumn = table[fieldName],
            field = this.databaseTypeToSchemaType(schemaEngine, rawColumn);

        if (!field)
          continue;

        schema[fieldName] = field;
      }

      return schema;
    }

    async getSchema() {
      try {
        var rawSchema = await this.getRawDatabaseSchema(),
            tableNames = Object.keys(rawSchema),
            schemaEngine = this.getApplication().getSchemaEngine();

        for (var i = 0, il = tableNames.length; i < il; i++) {
          var tableName = tableNames[i],
              table = rawSchema[tableName],
              modelName = this.getModelNameFromTableName(schemaEngine, tableName),
              schema = this.databaseTypesToSchema(schemaEngine, table);

          console.log('Model Name: ', modelName, schema);
        }
      } catch (e) {
        Logger.error(e);
      }
    }

    introspectSchemaType(schema, data, _opts) {
      var opts = _opts || {};
      return schema.introspectSchemaType(data, opts);
    }

    async query(schema, params, opts) {
      throw new Error(`Connector [${this.context}] doesn't support queries`);
    }

    async write(schema, params, opts) {
      throw new Error(`Connector [${this.context}] doesn't support writing`);
    }
  }

  Object.assign(root, {
    BaseConnector
  });
};
