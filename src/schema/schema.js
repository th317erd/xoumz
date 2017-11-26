module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, prettify, sizeOf, instanceOf, noe, pluralOf, uuid } = requireModule('./utils');
  const { ModelSchema } = requireModule('./schema/model-schema');
  const SchemaTypes = requireModule('./schema/schema-types');
  const Validators = requireModule('./schema/validators');

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
      definePropertyRW(this, 'baseRecordType', opts.baseRecordType);
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

            decompose(_val, _opts) {
              var opts = _opts || {},
                  inputValue = _val,
                  modelSchema = registrationScope.modelClass.schema(),
                  context = opts.context,
                  rawVal = {},
                  subVals = [{ type: registrationScope.type, value: rawVal }];

              modelSchema.iterateFields((field, fieldName) => {
                var getter = field.getProp('getter', context),
                    value = getter(inputValue[fieldName]),
                    fieldTypeName = field.getTypeName();

                if (!field.getProp('primitive') || fieldTypeName === 'Array' || fieldTypeName === 'Variant') {
                  console.log('Decomposing: ', fieldName, fieldTypeName, value);
                  subVals.push(field.decompose(value, opts));
                  return true;
                }

                var contextFieldName = field.getProp('field', context);
                rawVal[contextFieldName] = value;
              });

              console.log('Subvals: ', subVals);
              return subVals;
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

    introspectModelType(_fieldValues, _opts) {
      var opts = _opts || {},
          fieldValues = _fieldValues || {},
          typeInfo;

      // Does opts.modelSchema contain a valid schema?
      if (opts.modelSchema instanceof ModelSchema)
        return opts.modelSchema;

      // Is opts.modelSchema a typename instead of a schema?
      if (instanceOf(opts.modelSchema, 'string', 'number', 'boolean')) {
        typeInfo = this.getTypeInfo(opts.modelSchema);
        if (typeInfo)
          return this.getModelSchema(typeName);
      }

      // Does the data passed to us repond to a schema query?
      if (fieldValues.schema instanceof Function) {
        var schema = fieldValues.schema();
        if (schema instanceof ModelSchema)
          return schema;
      }

      // See if we can figure out a type
      var typeName = opts.modelType || fieldValues.modelType;
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
      function writeToConntector(items, conntector, conntectorOpts) {
        var promises = [];

        console.log('Dumping: ', items);
        for (var i = 0, il = items.length; i < il; i++) {
          var item = items[i];
          if (item instanceof Array)
            promises.push(writeToConntector.call(this, item, conntector, conntectorOpts));
          else
            promises.push(conntector.write(this, item.value, { ...conntectorOpts, modelType: item.type }));
        }

        return Promise.all(promises);
      }

      if (!model)
        return;

      var opts = _opts || {},
          modelSchema = this.introspectModelType(model, opts);

      if (!(modelSchema instanceof ModelSchema))
        throw new Error('Second argument to Schema "saveType" must be a model instance that responds to ".schema()" and returns a proper model schema');
      
      if (opts.bulk)
        return connector.write(this, model, opts);

      var decomposedItems = modelSchema.decompose(model, { context: connector.getContext() })
      return writeToConntector.call(this, decomposedItems, connector, opts);
    }

    async loadType(connector, params, _opts) {
      return connector.query(this, params, _opts);
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    ModelSchema,
    Schema
  });
};
