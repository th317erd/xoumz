module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, prettify, sizeOf, instanceOf, noe, pluralOf } = requireModule('./utils');
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
    constructor(_typeName, _schemaObj) {
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

      var typeName = _typeName,
          schemaObj = _schemaObj;

      if (arguments.length < 2) {
        schemaObj = typeName;
        typeName = undefined;
      }

      var finalSchema = {},
          isArray = (schemaObj instanceof Array);

      if (!schemaObj || !(isArray || schemaObj instanceof Object) || !sizeOf(schemaObj))
        throw new Error('Schema must be an array or enumerable object');

      var keys = Object.keys(schemaObj);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            fieldSchema = schemaObj[key];

        if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        fieldSchema.validateSchema();
        
        if (!isArray && !fieldSchema.getProp('field'))
          fieldSchema.setProp('field', key, '*');

        var currentField = fieldSchema.getProp('field', '*');
        if (noe(currentField))
          throw new Error(`Schema field ${key} does not specify a "field" on the root context`);

        finalSchema[currentField] = fieldSchema;
      }

      definePropertyRW(this, '_schema', finalSchema);

      this.setTypeName(typeName);
    }

    setTypeName(typeName) {
      var finalSchema = this._schema;
      if (!noe(typeName) && !finalSchema.hasOwnProperty('_table'))
        finalSchema['_table'] = SchemaTypes.SchemaTypes.Meta.field('_table').value(pluralOf(typeName));

      definePropertyRW(this, '_typeName', typeName);
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

              var schema = schemaFunc.call(typeInfo, typeInfo.type, schemaTypes, parentType);
              if (!(schema instanceof ModelSchema)) {
                schema = new ModelSchema(typeInfo.typeName, schema);
              } else {
                schema = new schema.constructor(schema.getRawSchema());
                schema.setTypeName(typeInfo.typeName);
              }

              schemaCache[typeInfo.typeName] = schema;

              return schema;
            }).bind(typeInfo);
          })(typeInfo, parentType, modelClass.schema);
            
          typeInfo.schema = modelClass.schema();
          typeInfo.modelClass = modelClass;
        }
      });
    }

    getTypeInfo(typeName) {
      return this.typesInfoHash[typeName];
    }

    getType(typeName) {
      return this.schemaTypes[typeName];
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

    createType(typeName, ...args) {
      var type = this.getType(typeName);
      if (!type)
        throw new Error(`Unable to find schema type: ${typeName}`);

      return type.instantiate(...args);
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    ModelSchema,
    Schema,
    getBaseRecordType
  });
};
