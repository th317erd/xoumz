module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, prettify, sizeOf, instanceOf, noe, pluralOf, uuid } = requireModule('./utils');
  const { SchemaTypeModel } = requireModule('./schema/schema-type-model');
  const SchemaTypes = requireModule('./schema/schema-types');
  const Validators = requireModule('./schema/validators');
  const Logger = requireModule('./logger');

  class Schema {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      if (!opts.application)
        throw new Error('"application" property must be specified for Schema');

      if (!opts.baseRecordType)
        throw new Error('"baseRecordType" property must be specified for Schema');

      definePropertyRO(this, 'typesInfoHash', {});
      definePropertyRW(this, '_cachedSchemaTypes', null);
      definePropertyRW(this, 'baseRecordType', opts.baseRecordType);
    }

    getSchemaTypes() {
      var cachedSchemaTypes = this._cachedSchemaTypes;
      if (cachedSchemaTypes)
        return cachedSchemaTypes;

      cachedSchemaTypes = this._cachedSchemaTypes = {};

      // Handle primitive types that require arguments
      SchemaTypes.iteratePrimitiveSchemaTypes((name, typeClass) => {
        definePropertyRO(cachedSchemaTypes, name, undefined, () => {
          // If this type requires contructor arguments then return a function
          // instead of a new type
          if (typeClass.requiresArguments)
            return (...args) => new typeClass(this, ...args);
          
          return new typeClass(this);
        }, () => {
          throw new Error('You can not attempt to assign a value to a schema type');
        });
      });

      // Handle all other types
      var typesInfoHash = this.typesInfoHash,
          keys = Object.keys(typesInfoHash);
      
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            typeInfo = typesInfoHash[key];

        // Don't overwrite primitive types with model type
        if (cachedSchemaTypes.hasOwnProperty(typeInfo.typeName))
          continue;

        definePropertyRO(cachedSchemaTypes, typeInfo.typeName, undefined, () => {
          return new typeInfo.schemaTypeClass(this);
        }, () => {
          throw new Error('You can not attempt to assign a value to a schema type');
        });
      }

      return cachedSchemaTypes;
    }

    createNewModelType(_typeName, callback, _opts) {
      var opts = _opts || {},
          self = this,
          typeName = ('' + _typeName).substring(0, 1).toUpperCase() + ('' + _typeName).substring(1),
          TypeKlass = class GenericSchemaType extends SchemaTypes.SchemaType {
            constructor() {
              super(self, typeName);
            }

            decompose(_val, _opts) {
              var modelTypeClass = registrationScope.modelTypeClass;
              if (modelTypeClass && modelTypeClass.decompose instanceof Function)
                return modelTypeClass.decompose.call(this, _val, _opts);

              var opts = _opts || {},
                  inputValue = _val,
                  modelType = self.getModelSchema(typeName),
                  context = opts.context,
                  rawVal = {},
                  subVals = [{ modelType: registrationScope.modelType, value: rawVal }];

              modelType.iterateFields((field, fieldName) => {
                var getter = field.getProp('getter', context),
                    value = getter(inputValue[fieldName]),
                    fieldTypeName = field.getTypeName(),
                    isSpecial = (fieldTypeName === 'Array' || fieldTypeName === 'Variant');

                if (!field.getProp('primitive') || isSpecial) {
                  subVals.push(field.decompose(value, { ...opts, owner: (isSpecial) ? opts.owner : value, ownerField: field }));
                  return true;
                }

                var contextFieldName = field.getProp('field', context);
                rawVal[contextFieldName] = value;
              });

              return subVals;
            }

            instantiate(...args) {
              var instance = new registrationScope.modelTypeClass(...args);
              return instance;
            }
          },
          registrationScope = {
            typeName: typeName,
            typeInitializer: callback,
            schemaType: new TypeKlass(this),
            schemaTypeClass: TypeKlass,
            modelType: null,
            modelTypeClass: null,
            parentType: null,
            primitiveType: null,
            ...opts
          };

      return registrationScope;
    }

    registerModelType(typeName, callback, _opts) {
      var opts = (instanceOf(_opts, 'string', 'number', 'boolean')) ? ({ parentType: _opts }) : (_opts || {}),
          scope = this.createNewModelType(typeName, callback, opts);
      
      // Add new type
      this.typesInfoHash[typeName] = scope;

      // Clear type cache
      this._cachedSchemaTypes = null;
    }

    initialize() {
      // Register models for all primitive types
      SchemaTypes.iteratePrimitiveSchemaTypes((name, typeClass) => {
        if (typeClass.requiresArguments)
          return true;

        this.registerModelType(name, (selfType, schemaTypes, BaseRecord) => {
          return class PrimitiveModel extends BaseRecord {
            static schema(selfType, types) {
              return {
                ownerType: types.String,
                ownerID: types.String,
                ownerField: types.String,
                value: new typeClass()
              };
            }

            static decompose(_val, _opts) {
              var opts = _opts || {},
                  val = _val;
              
              if (!opts.owner || !opts.ownerField)
                throw new Error('Trying to decompose a primitive when owner / ownerField is not known');
              
              var owner = opts.owner,
                  ownerField = opts.ownerField;

              if (!(owner.schema instanceof Function))
                throw new Error('Trying to decompose a primitive when the owner is not a valid model');

              if (!(ownerField instanceof SchemaTypes.SchemaType))
                throw new Error('Trying to decompose a primitive when the ownerField is not a valid schema type');

              var modelType = opts.owner.schema();
              if (!(modelType instanceof SchemaTypeModel))
                throw new Error('Trying to decompose a primitive when the owner is not a valid model');

              var myModelType = this.getTypeModel();
              if (!myModelType)
                return;

              var getterID = modelType.getFieldProp('id', 'getter', opts.context),
                  ownerType = modelType.getTypeName(),
                  ownerID = getterID(owner.id),
                  ownerFieldName = ownerField.getProp('field'),
                  myGetter = this.getProp('getter', opts.context);

              if (noe(ownerType, ownerID, ownerFieldName))
                throw new Error(`Unable to extract owner information when trying to decompose a primitive: [${ownerType}][${ownerID}][${ownerFieldName}]`);
                
              return { modelType: myModelType, value: { ownerType, ownerID, ownerField: ownerFieldName, value: myGetter(val) } };
            }
          };
        }, { primitiveType: typeClass });
      });

      return Promise.resolve().then(async () => {
        var typesInfoHash = this.typesInfoHash,
            callbackKeys = Object.keys(typesInfoHash),
            schemaTypes = this.getSchemaTypes();

        try {
          for (var i = 0, il = callbackKeys.length; i < il; i++) {
            var key = callbackKeys[i],
                typeInfo = typesInfoHash[key],
                parentType = this.getTypeParentClass(typeInfo.typeName);

            var modelTypeClass = await typeInfo.typeInitializer.call(typeInfo, typeInfo.schemaType, schemaTypes, parentType);
            if (!(modelTypeClass instanceof Function))
              throw new Error(`${typeInfo.typeName}: Return value from a Schema.register call must be a class`);

            if (!('schema' in modelTypeClass))
              throw new Error(`${typeInfo.typeName}: "schema" static function is required for every model class`);

            // Wrap schema function in a helper function that translates and caches the schema result
            modelTypeClass.schema = (function(typeInfo, parentType, schemaFunc) {
              return (function(...args) {
                var scope = typesInfoHash[typeInfo.typeName];
                if (scope && scope.modelType)
                  return scope.modelType;

                var schema = schemaFunc.call(this, typeInfo.schemaType, schemaTypes, parentType, typeInfo);
                if (!(schema instanceof SchemaTypeModel)) {
                  schema = new SchemaTypeModel(this, typeInfo, schema);
                } else {
                  // If we have a valid SchemaTypeModel, clone it and set the typeName
                  schema = new schema.constructor(this, schema.getTypeInfo(), schema.getRawSchema());
                  schema.setTypeName(typeInfo.typeName);
                }

                scope.modelType = schema;

                return schema;
              }).bind(this);
            }).call(this, typeInfo, parentType, modelTypeClass.schema);
              
            typeInfo.modelType = modelTypeClass.schema();
            typeInfo.modelTypeClass = modelTypeClass;
          }
        } catch (e) {
          Logger.error(e);
          throw e;
        }
      });
    }

    getTypeNameFromSchemaCode(schemaCode) {
      return schemaCode;
    }

    introspectSchemaType(_fieldValues, _opts) {
      var opts = _opts || {},
          fieldValues = _fieldValues || {},
          typeInfo,
          typeName = opts.modelType;

      // Does opts.modelType contain a valid schema?
      if (typeName instanceof SchemaTypeModel)
        return typeName;

      // Is opts.modelType a typename instead of a schema?
      if (instanceOf(typeName, 'string', 'number', 'boolean')) {
        typeInfo = this.getTypeInfo(typeName);
        if (typeInfo)
          return this.getModelSchema(typeName);
      }

      // Does the data passed to us repond to a schema query?
      if (fieldValues.schema instanceof Function) {
        var schema = fieldValues.schema();
        if (schema instanceof SchemaTypeModel)
          return schema;
      }

      // See if we can figure out a type
      typeName = fieldValues.modelType;
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
        var weight = 0,
            key = keys[i],
            typeInfo = typesInfoHash[key],
            modelType = this.getModelSchema(typeInfo.typeName);

        // We can't guess a primitive type
        if (!(modelType instanceof SchemaTypeModel))
          continue;

        modelType.iterateFields((field, key) => {
          if (fieldValues.hasOwnProperty(key))
            weight++;
          else
            weight -= 10;
        });

        typesList.push({ modelType, weight });
      }

      // Fint closest match by weight
      typesList = typesList.sort((a, b) => {
        var x = a.weight,
            y = b.weight;
        
        return (x == y) ? 0 : (x < y) ? 1 : -1;
      });

      var typeGuess = typesList[0];
      return (typeGuess) ? typeGuess.modelType : undefined;
    }

    getTypeInfo(_typeName) {
      var typeName = _typeName;
      if (typeName instanceof SchemaTypeModel || typeName instanceof SchemaTypes.SchemaType)
        typeName = typeName.getTypeName();
        
      return this.typesInfoHash[typeName];
    }

    getSchemaType(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema for model type: ${typeName}`);

      return typeInfo.schemaType;
    }

    getModelSchema(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema for model type: ${typeName}`);

      return typeInfo.modelType;
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

      if (!typeInfo.modelTypeClass)
        throw new Error(`Attempting to inherit from a schema type that isn't yet fully initialized: ${parentType}`);

      return typeInfo.modelTypeClass;
    }

    async createType(typeName, ...args) {
      var modelType = this.getModelSchema(typeName);
      return modelType.instantiate(...args);
    }

    async saveType(connector, model, _opts) {
      function writeToConntector(items, conntector, conntectorOpts) {
        var promises = [];

        for (var i = 0, il = items.length; i < il; i++) {
          var item = items[i];
          if (item instanceof Array)
            promises.push(writeToConntector.call(this, item, conntector, conntectorOpts));
          else
            promises.push(conntector.write(this, item.value, { ...conntectorOpts, modelType: item.modelType }));
        }

        return Promise.all(promises);
      }

      if (!model)
        return;

      var opts = _opts || {},
          modelType = this.introspectSchemaType(model, opts);

      if (!(modelType instanceof SchemaTypeModel))
        throw new Error(`Schema error: Can not save data: unkown of invalid schema type`);
      
      if (opts.bulk)
        return connector.write(this, model, opts);

      var decomposedItems = modelType.decompose(model, { context: connector.getContext(), owner: model })
      return writeToConntector.call(this, decomposedItems, connector, opts);
    }

    async loadType(connector, params, _opts) {
      return connector.query(this, params, _opts);
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    SchemaTypeModel,
    Schema
  });
};
