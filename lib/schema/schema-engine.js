module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, instanceOf, noe } = requireModule('./utils');
  const { ModelType } = requireModule('./schema/model-type');
  const SchemaTypes = requireModule('./schema/schema-type');
  const Validators = requireModule('./schema/validators');
  const Logger = requireModule('./logger');
  const { ModelBase } = requireModule('./models/model-base');

  class SchemaEngine {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      definePropertyRO(this, 'typesInfoHash', {});
      definePropertyRW(this, 'options', opts);
    }

    async onInit() {
    }

    async onFinalizeModelSchemas() {
      // Lock all schemas
      this.iterateModelSchemas((modelType) => {
        modelType.lock();
      });
    }

    getModelBaseClass() {
      return ModelBase;
    }

    getModelTypeClass() {
      return ModelType;
    }

    getBaseSchemaType() {
      return SchemaTypes.SchemaType;
    }

    getSchemaTypes(_modelType) {
      var schemaTypes = {},
          modelType = _modelType || null;

      // Handle primitive types that require arguments
      SchemaTypes.iteratePrimitiveSchemaTypes((name, typeClass) => {
        definePropertyRO(schemaTypes, name, undefined, () => {
          // If this type requires contructor arguments then return a function
          // instead of a new type

          if (typeClass.requiresArguments) {
            return (...args) => {
              return new typeClass(this, modelType, ...args);
            };
          }
          
          return new typeClass(this, modelType);
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
        if (schemaTypes.hasOwnProperty(typeInfo.typeName))
          continue;

        (function(typeName, typeClass) {
          definePropertyRO(schemaTypes, typeName, undefined, () => {
            return new typeClass(this, modelType);
          }, () => {
            throw new Error('You can not attempt to assign a value to a schema type');
          });
        })(typeInfo.typeName, typeInfo.schemaTypeClass);
      }

      return schemaTypes;
    }

    createNewModelType(_typeName, callback, _opts) {
      var opts = _opts || {},
          self = this,
          typeName = ('' + _typeName).substring(0, 1).toUpperCase() + ('' + _typeName).substring(1),
          TypeKlass = class GenericSchemaType extends SchemaTypes.SchemaType {
            constructor() {
              super(self, registrationScope.modelType, typeName);
            }

            decompose(_val, _opts) {
              var modelTypeClass = registrationScope.modelTypeClass;
              if (modelTypeClass && modelTypeClass.decompose instanceof Function)
                return modelTypeClass.decompose.call(this, _val, _opts);

              var opts = _opts || {},
                  primitiveOpts = { ...opts, primitive: true },
                  inputValue = _val,
                  modelType = self.getModelType(typeName),
                  context = opts.context,
                  rawVal = {},
                  subVals = [{ modelType: registrationScope.modelType, value: rawVal }];

              modelType.iterateFields((field, fieldName) => {
                var getter = field.getProp('getter', context),
                    value = getter(inputValue[fieldName], opts.owner),
                    targetTypeName = field.getTargetTypeName(),
                    isSpecial = (targetTypeName instanceof Array);

                // We skip virtual fields
                if (field.getProp('virtual', context))
                  return;

                if (!field.getProp('primitive') || isSpecial) {
                  subVals.push(field.decompose(value, { ...opts, owner: (isSpecial) ? opts.owner : value, ownerField: field }));
                  return;
                }

                var contextFieldName = field.getProp('field', context);
                rawVal[contextFieldName] = field.decompose(value, primitiveOpts);
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
    }

    async start() {
      // Register models for all primitive types
      SchemaTypes.iteratePrimitiveSchemaTypes((name, typeClass) => {
        if (typeClass.requiresArguments)
          return;

        this.registerModelType(name, (ModelBase) => {
          return class PrimitiveModel extends ModelBase {
            static schema(selfType, types) {
              return {
                ownerType: types.String.max(64),
                ownerID: types.String.max(64),
                ownerField: types.String.max(64),
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
              if (!(modelType instanceof ModelType))
                throw new Error('Trying to decompose a primitive when the owner is not a valid model');

              var myModelType = this.getModelType();
              if (!myModelType)
                return;

              var getterID = modelType.getFieldProp('id', 'getter', opts.context),
                  ownerType = modelType.getTypeName(),
                  ownerID = getterID(owner.id),
                  ownerFieldName = ownerField.getProp('field'),
                  myGetter = this.getProp('getter', opts.context);

              if (noe(ownerType, ownerID, ownerFieldName))
                throw new Error(`Unable to extract owner information when trying to decompose a primitive: [${ownerType}][${ownerID}][${ownerFieldName}]`);
                
              return { modelType: myModelType, value: { ownerType, ownerID, ownerField: ownerFieldName, value: myGetter(val, owner) } };
            }
          };
        }, { primitiveType: typeClass });
      });

      await Promise.resolve().then(async () => {
        var typesInfoHash = this.typesInfoHash,
            callbackKeys = Object.keys(typesInfoHash);

        try {
          for (var i = 0, il = callbackKeys.length; i < il; i++) {
            var key = callbackKeys[i],
                typeInfo = typesInfoHash[key],
                parentType = this.getTypeParentClass(typeInfo.typeName);

            var modelTypeClass = await typeInfo.typeInitializer.call(typeInfo, parentType);
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

                var modelTypeClass = this.getModelTypeClass(),
                    modelType = new modelTypeClass(),
                    schemaTypes = this.getSchemaTypes(modelType),
                    rawSchema = schemaFunc.call(this, new typeInfo.schemaTypeClass(this, modelType), schemaTypes, typeInfo);

                if (!(rawSchema instanceof ModelType)) {
                  modelType.initialize(this, typeInfo, schemaTypes, rawSchema);
                } else {
                  // If we have a valid ModelType, clone it and set the typeName
                  modelType.options = { ...modelType.options };
                  modelType.initialize(this, rawSchema.getTypeInfo(), schemaTypes, rawSchema.getRawSchema());
                  modelType.setTypeName(typeInfo.typeName);
                }

                scope.modelType = modelType;

                return modelType;
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

      // Calculate foreign fields
      this.iterateModelSchemas((typeInfo, typeName) => {
        if (typeInfo.primitiveType)
          return;

        typeInfo.modelType.iterateFields((field, fieldName) => {
          var targetTypeNames = field.getTargetTypeName(),
              isSpecial = (targetTypeNames instanceof Array);

          if (!isSpecial && (field.getProp('primitive') || field.getProp('virtual')))
            return;
          
          // Grab target schema type(s), and inject 'ownerID', 'ownerType', and 'ownerField' schema fields
          if (!(targetTypeNames instanceof Array))
            targetTypeNames = [targetTypeNames];

          console.log('Target type names: ', targetTypeNames);

          for (var i = 0, il = targetTypeNames.length; i < il; i++) {
            var targetTypeName = targetTypeNames[i],
                modelType = this.getModelType(targetTypeName);

            console.log(targetTypeName, modelType);
            var schemaTypes = modelType.getSchemaTypes();

            // Inject "owner" fields into schema if they don't exist
            // TODO: Add validator to validate ownerType is proper
            if (!modelType.hasField('ownerID'))
              modelType.addField(schemaTypes.String.field('ownerID').max(64));
            
            
            if (!modelType.hasField('ownerType'))
              modelType.addField(schemaTypes.String.field('ownerType').max(64));
            

            if (!modelType.hasField('ownerField'))
              modelType.addField(schemaTypes.String.field('ownerField').max(64));
            
          }
        });
      }, true);

      await this.onFinalizeModelSchemas();
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
      if (typeName instanceof ModelType)
        return typeName;

      // Is opts.modelType a typename instead of a schema?
      if (instanceOf(typeName, 'string', 'number', 'boolean')) {
        typeInfo = this.getTypeInfo(typeName);
        if (typeInfo)
          return this.getModelType(typeName);
      }

      // Does the data passed to us repond to a schema query?
      if (fieldValues.schema instanceof Function) {
        var schema = fieldValues.schema();
        if (schema instanceof ModelType)
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
          return this.getModelType(typeName);
      }

      // If we couldn't find it a type then make our best guess
      var typesInfoHash = this.typesInfoHash,
          keys = Object.keys(typesInfoHash),
          typesList = [];

      for (var i = 0, il = keys.length; i < il; i++) {
        var weight = 0,
            key = keys[i],
            typeInfo = typesInfoHash[key],
            modelType = this.getModelType(typeInfo.typeName);

        // We can't guess a primitive type
        if (!(modelType instanceof ModelType))
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

    getAllTypeInfo() {
      return this.typesInfoHash;
    }

    getTypeInfo(_typeName) {
      var typeName = _typeName;
      if (typeName instanceof ModelType || typeName instanceof SchemaTypes.SchemaType)
        typeName = typeName.getTypeName();
        
      return this.typesInfoHash[typeName];
    }

    getSchemaType(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema for model type: ${typeName}`);

      return new typeInfo.schemaTypeClass(this, this.getModelType(typeName));
    }

    getModelType(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      return (typeInfo) ? typeInfo.modelType : undefined;
    }

    iterateModelSchemas(cb, raw = false) {
      var typesInfoHash = this.typesInfoHash,
          keys = Object.keys(typesInfoHash),
          rets = [],
          abort = () => abort;

      for (var i = 0, il = keys.length; i < il; i++) {
        var typeName = keys[i],
            typeInfo = typesInfoHash[typeName],
            modelType = (raw) ? typeInfo : typeInfo.modelType,
            modelTypeName = (raw) ? typeInfo.typeName : modelType.getTypeName(),
            ret = cb.call(this, modelType, modelTypeName, this, abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    getTypeParentClass(typeName) {
      var typeInfo = this.getTypeInfo(typeName);
      if (!typeInfo)
        throw new Error(`Unable to find schema type: ${typeName}`);

      var parentType = typeInfo.parentType;
      if (!parentType)
        return this.getApplication().wrapClass(this.getModelBaseClass());

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
      var modelType = this.getModelType(typeName);
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

      if (!(modelType instanceof ModelType))
        throw new Error('Schema error: Can not save data: unkown of invalid schema type');
      
      if (opts.bulk)
        return connector.write(this, model, opts);

      var decomposedItems = modelType.decompose(model, { context: connector.getContext(), owner: model });
      return writeToConntector.call(this, decomposedItems, connector, opts);
    }

    async loadType(connector, params, _opts) {
      return connector.query(this, params, _opts);
    }

    async schemaEngineFromRawSchema(rawSchema) {
      var newSchemaEngine = new this.constructor(this.options),
          keys = Object.keys(rawSchema);

      await newSchemaEngine.onInit();
      
      for (var i = 0, il = keys.length; i < il; i++) {
        var modelTypeName = keys[i],
            schema = rawSchema[modelTypeName];
        
        (function(modelTypeName, schema) {
          newSchemaEngine.registerModelType(modelTypeName, (ModelBase) => {
            return class GenericModelType extends ModelBase {
              static schema() {
                return schema;
              }
            };
          });
        })(modelTypeName, schema);
      }

      await newSchemaEngine.start();

      return newSchemaEngine;
    }

    compareTo(schemaEngine, cb) {
      var nativeTypesInfoHash = this.getAllTypeInfo(),
          foreignTypeInfoHash = schemaEngine.getAllTypeInfo(),
          typeNames = Object.keys(Object.keys(nativeTypesInfoHash).concat(Object.keys(foreignTypeInfoHash)).reduce((obj, item) => {
            obj[item] = true;
            return obj;
          }, {})),
          abort = () => abort,
          areSame = true;

      for (var i = 0, il = typeNames.length; i < il; i++) {
        var modelTypeName = typeNames[i],
            nativeTypeInfo = this.getTypeInfo(modelTypeName),
            foreignTypeInfo = schemaEngine.getTypeInfo(modelTypeName),
            ret;

        if (nativeTypeInfo && foreignTypeInfo) {
          ret = nativeTypeInfo.modelType.compareTo(foreignTypeInfo.modelType, cb);
          if (!ret) {
            ret = cb('different', 'model', modelTypeName, nativeTypeInfo.modelType, foreignTypeInfo.modelType, this, schemaEngine, abort);
            if (ret !== false)
              areSame = false;
          }
        } else if (nativeTypeInfo) {
          ret = cb('missing', 'model', modelTypeName, nativeTypeInfo.modelType, null, this, schemaEngine, abort);
          if (ret !== false)
            areSame = false;
        } else {
          ret = cb('extra', 'model', modelTypeName, null, foreignTypeInfo.modelType, this, schemaEngine, abort);
          if (ret !== false)
            areSame = false;
        }

        if (ret === abort)
          break;
      }

      return areSame;
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    ModelType,
    SchemaEngine
  });
};
