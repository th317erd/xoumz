module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, prettify, sizeOf, instanceOf, noe, pluralOf, uuid } = requireModule('./utils');
  const SchemaTypes = requireModule('./schema/schema-types');
  const Validators = requireModule('./schema/validators');

  function getBaseRecordType(opts) {
    var BaseRecordClass = opts.baseRecordType,
        app = opts.application;

    class BaseRecord extends BaseRecordClass {
      constructor(...args) {
        super(...args);
      }

      getApplication() {
        return app;
      }
    }

    // Copy over static methods
    var keys = Object.keys(BaseRecordClass);
    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i];
      BaseRecord[key] = BaseRecordClass[key];
    }

    return BaseRecord;
  }

  class ModelSchema {
    constructor(typeInfo, schemaObj) {
      function validateSchema(_fieldSchema) {
        var fieldSchema = _fieldSchema;

        if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType || fieldSchema instanceof Array))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        /*if (fieldSchema instanceof Array) {
          // Get arrayOf type
          fieldSchema = fieldSchema[0];
          
          // Index zero is the type, which can be another array if multiple types
          // So we just always make sure this "type" is an array, so we can easily
          // Verify the types at every index
          if (!(fieldSchema instanceof Array))
            fieldSchema = [fieldSchema];

          for (var i = 0, il = fieldSchema.length; i < il; i++) {
            var thisFieldSchema = fieldSchema[i];
            if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType || fieldSchema instanceof Array))
              throw new Error(`Schema field ${key} must inherit from SchemaType`);
          }
        }*/
      }

      if (!typeInfo || !schemaObj)
        throw new Error('Type info and type schema required to instantiate a ModelSchema class');

      var finalSchema = {},
          isArray = (schemaObj instanceof Array),
          typeName = typeInfo.typeName,
          schemaCode,
          fieldSchema;

      if (!schemaObj || !(isArray || schemaObj instanceof Object) || !sizeOf(schemaObj))
        throw new Error('Schema must be an array or enumerable object');

      var keys = Object.keys(schemaObj),
          hasPrimaryKey = false;

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        
        fieldSchema = schemaObj[key];

        if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        fieldSchema.validateSchema();
        
        if (!isArray && !fieldSchema.getProp('field'))
          fieldSchema.setProp('field', key, '*');

        if (fieldSchema.getProp('primaryKey'))
          hasPrimaryKey = true;

        var currentField = fieldSchema.getProp('field', '*');
        if (noe(currentField))
          throw new Error(`Schema field ${key} does not specify a "field" on the root context`);

        if (currentField === '_schemaCode')
          schemaCode = fieldSchema.getProp('value', '*');

        // Don't allow any more changes to this field
        fieldSchema.lock();
        finalSchema[currentField] = fieldSchema;
      }

      if (noe(schemaCode)) {
        schemaCode = this.getDefaultSchemaCode(typeName);
        fieldSchema = this.getDefaultSchemaCodeField(schemaCode);
        finalSchema['_schemaCode'] = fieldSchema;
        fieldSchema.lock();
      }

      if (!hasPrimaryKey) {
        fieldSchema = this.getDefaultPrimaryKeyField(schemaCode);
        finalSchema['id'] = fieldSchema;
        fieldSchema.lock();
      }

      definePropertyRW(this, '_typeInfo', typeInfo);
      definePropertyRW(this, '_schema', finalSchema);

      this.setTypeName(typeName);
    }

    getDefaultSchemaCode(typeName) {
      return typeName;
    }

    getDefaultSchemaCodeField(schemaCode) {
      return SchemaTypes.SchemaTypes.Meta.value(schemaCode).field('_schemaCode');
    }

    getDefaultPrimaryKeyField(schemaCode) {
      return SchemaTypes.SchemaTypes.String.primaryKey.setter((val) => {
        return (val) ? val : (schemaCode + ':' + uuid());
      }).field('id');
    }

    setTypeName(typeName) {
      var finalSchema = this._schema;
      if (!noe(typeName) && !finalSchema.hasOwnProperty('_table'))
        finalSchema['_table'] = SchemaTypes.SchemaTypes.Meta.field('_table').value(pluralOf(typeName));

      definePropertyRW(this, '_typeName', typeName);
    }

    getTypeInfo() {
      return this._typeInfo;
    }

    getSchemaType() {
      return this.getTypeInfo().type;
    }

    getTypeName() {
      return this._typeName;
    }
  
    getRawSchema() {
      return this._schema;
    }

    iterateFields(cb) {
      var schemaObj = this._schema,
          keys = Object.keys(schemaObj);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            fieldSchema = schemaObj[key];

        if (key.charAt(0) === '_')
          continue;

        cb.call(this, fieldSchema, key, this);
      }
    }

    getField(fieldName) {
      var schemaObj = this._schema;
      return schemaObj[fieldName];
    }

    hasField(fieldName) {
      var schemaObj = this._schema;
      return schemaObj.hasOwnProperty(fieldName);
    }

    getFieldProp(fieldName, propName, opts) {
      var field = this.getField(fieldName);
      return field.getProp(propName, opts);
    }
  }

  class Schema {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      if (!opts.application)
        throw new Error('"application" property must be specified for Schema');

      if (!opts.baseRecordType)
        throw new Error('"baseRecordType" property must be specified for Schema');

      var schemaTypes = SchemaTypes.newSchemaTypes();
      definePropertyRO(this, 'typesInfoHash', {});
      definePropertyRW(this, 'schemaTypes', schemaTypes);
      definePropertyRW(this, 'baseRecordType', root.getBaseRecordType(opts));
      definePropertyRO(this, '_schemaCache', {});
    }

    register(_typeName, callback, inheritsFrom) {
      var typeName = prettify(_typeName),
          TypeKlass = class GenericSchemaType extends SchemaTypes.SchemaType {
            constructor() {
              super(typeName);

              definePropertyRW(this, 'modelClass', null);
              definePropertyRW(this, 'Model', undefined, () => this.modelClass, (val) => { this.modelClass = val; });
            }

            instantiate(...args) {
              var instance = new registrationScope.modelClass(registrationScope.schema, ...args);
              return instance;
            }
          },
          registrationScope = {
            typeName: typeName,
            typeInitializer: callback,
            parentType: inheritsFrom,
            schemaType: TypeKlass,
            type: new TypeKlass()
          };

      this.schemaTypes[typeName] = registrationScope.type;
      this.typesInfoHash[typeName] = registrationScope;
    }

    initialize() {
      return Promise.resolve().then(async () => {
        var typesInfoHash = this.typesInfoHash,
            callbackKeys = Object.keys(typesInfoHash),
            schemaTypes = this.schemaTypes,
            schemaCache = this._schemaCache;

        for (var i = 0, il = callbackKeys.length; i < il; i++) {
          var key = callbackKeys[i],
              typeInfo = typesInfoHash[key],
              parentType = this.getTypeParentClass(typeInfo.typeName);

          var modelClass = await typeInfo.typeInitializer.call(typeInfo, typeInfo.type, schemaTypes, parentType);
          if (!(modelClass instanceof Function))
            throw new Error(`${typeInfo.typeName}: Return value from a Schema.register call must be a class`);

          if (!('schema' in modelClass))
            throw new Error(`${typeInfo.typeName}: "schema" static function is required for every model class`);

          // Wrap schema function in a helper function that translates and caches the schema result
          modelClass.schema = (function(typeInfo, parentType, schemaFunc) {
            return (function(...args) {
              var cache = schemaCache[typeInfo.typeName];
              if (cache)
                return cache;

              var schema = schemaFunc.call(this, typeInfo.type, schemaTypes, parentType, typeInfo);
              if (!(schema instanceof ModelSchema)) {
                schema = new ModelSchema(typeInfo, schema);
              } else {
                schema = new schema.constructor(schema.getTypeInfo(), schema.getRawSchema());
                schema.setTypeName(typeInfo.typeName);
              }

              schemaCache[typeInfo.typeName] = schema;

              return schema;
            }).bind(this);
          }).call(this, typeInfo, parentType, modelClass.schema);
            
          typeInfo.schema = modelClass.schema();
          typeInfo.modelClass = modelClass;
        }
      });
    }

    getTypeNameFromSchemaCode(schemaCode) {
      return schemaCode;
    }

    introspectModelType(fieldValues) {
      if (noe(fieldValues))
        return;

      // See if we can figure out a type
      var typeName = fieldValues.modelType;
      if (!typeName && fieldValues.id) {
        var parts = ('' + fieldValues).match(/^(\w+):.*$/);
        if (parts && !noe(parts[1])) {
          var schemaCode = parts[1];
          typeName = this.getTypeNameFromSchemaCode(schemaCode);
        }
      }

      if (typeName) {
        var typeInfo = this.getTypeInfo(typeName);
        if (typeInfo)
          return this.getModelSchema(typeName);
      }

      // If we couldn't find it a type then make our best guess
      var typesInfoHash = this.typesInfoHash,
          keys = Object.keys(typesInfoHash),
          typesList = [];

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            typeInfo = typesInfoHash[key];
        
        if (typeInfo.type.getProp('primitive'))
          continue;

        var weight = 0,
            modelSchema = this.getModelSchema(typeInfo.typeName);
        
        modelSchema.iterateFields((field, key) => {
          if (fieldValues.hasOwnProperty(key))
            weight++;
          else
            weight -= 10;
        });

        typesList.push({ modelSchema, weight });
      }

      // Fint closest match by weight
      typesList = typesList.sort((a, b) => {
        var x = a.weight,
            y = b.weight;
        
        return (x == y) ? 0 : (x < y) ? 1 : -1;
      });

      var typeGuess = typesList[0];
      return (typeGuess) ? typeGuess.modelSchema : undefined;
    }

    getTypeInfo(_typeName) {
      var typeName = _typeName;
      if (typeName instanceof ModelSchema)
        typeName = typeName.getTypeName();
        
      return this.typesInfoHash[typeName];
    }

    getModelSchema(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema for model type: ${typeName}`);

      return typeInfo.modelClass.schema();
    }

    getTypeParentClass(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema type: ${typeName}`);

      var parentType = typeInfo.parentType;
      if (!parentType)
        return this.baseRecordType;

      if (parentType instanceof Function)
        return parentType;
      
      typeInfo = this.getTypeInfo(parentType);
      if (!typeInfo)
        throw new Error(`Unable to find schema type: ${parentType}`);

      if (!typeInfo.modelClass)
        throw new Error(`Attempting to inherit from a schema type that isn't yet fully initialized: ${parentType}`);

      return typeInfo.modelClass;
    }

    async createType(typeName, ...args) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema for model type: ${typeName}`);

      return typeInfo.type.instantiate(...args);
    }

    async saveType(connector, model, _opts) {
      return connector.write(this, model, _opts);
    }

    async loadType(connector, params, _opts) {
      return connector.query(this, params, _opts);
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    ModelSchema,
    Schema,
    getBaseRecordType
  });
};
