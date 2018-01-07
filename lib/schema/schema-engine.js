module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, instanceOf, noe, isCyclic } = requireModule('./utils');
  const { ModelType } = requireModule('./schema/model-type');
  const SchemaTypes = requireModule('./schema/schema-type');
  const Validators = requireModule('./schema/validators');
  const Logger = requireModule('./logger');
  const { ModelBase } = requireModule('./models/model-base');
  const { QueryEngine } = requireModule('./query-engine');

  class SchemaEngine {
    static createInstance(Klass, opts) {
      return new Klass(opts);
    }

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
      return this.getApplication().ModelBase;
    }

    getModelTypeClass() {
      return this.getApplication().ModelType;
    }

    getQueryEngineClass() {
      return this.getApplication().QueryEngine;
    }

    getSchemaTypeClass() {
      return this.getApplication().SchemaType;
    }

    getPrimitiveSchemaTypes() {
      return SchemaTypes.getPrimitiveSchemaTypes(this.getSchemaTypeClass(), this.getModelTypeClass());
    }

    iteratePrimitiveSchemaTypes(cb) {
      var defaultSchemaTypes = this.getPrimitiveSchemaTypes(),
          keys = Object.keys(defaultSchemaTypes),
          rets = [],
          abort = () => abort;

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            ret = cb(key, defaultSchemaTypes[key], abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    getSchemaTypes(_modelType) {
      var schemaTypes = {},
          modelType = _modelType || null,
          application = this.getApplication();

      var defaultSchemaTypes = this.getPrimitiveSchemaTypes(),
          typesInfoHash = this.typesInfoHash,
          keys = Object.keys(Object.assign({}, typesInfoHash, defaultSchemaTypes));

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            typeInfo = typesInfoHash[key];

        // Is this a primitive type?
        if (!typeInfo) {
          var primitiveType = defaultSchemaTypes[key];
          typeInfo = {
            primitiveType,
            typeName: key
          };
        }

        // Primitive types take precedence over model types
        ((typeName, typeClass) => {
          definePropertyRO(schemaTypes, typeName, undefined, () => {
            // Does this type require arguments?
            if (typeClass.requiresArguments) {
              return (...args) => {
                return new typeClass(this, modelType, ...args);
              };
            }

            // Return the new type class (SchemaType)
            return new typeClass(this, modelType);
          }, () => {
            throw new Error('You can not attempt to assign a value to a schema type');
          });
        })(typeInfo.typeName, typeInfo.primitiveType || typeInfo.schemaTypeClass);
      }

      return schemaTypes;
    }

    skipCyclicTypes(obj) {
      // In cyclic checks we only want to test types that are models
      var typesInfoHash = this.typesInfoHash,
          keys = Object.keys(typesInfoHash);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            typeInfo = typesInfoHash[key];

        if (obj instanceof typeInfo.modelTypeClass)
          return false;
      }

      return true;
    }

    createNewModelType(_typeName, callback, _opts) {
      var opts = _opts || {},
          self = this,
          typeName = ('' + _typeName).substring(0, 1).toUpperCase() + ('' + _typeName).substring(1),
          SchemaTypeClass = this.getApplication().wrapClass(this.getSchemaTypeClass()),
          TypeKlass = class GenericSchemaType extends SchemaTypeClass {
            constructor(schemaEngine, modelType) {
              super(schemaEngine || self, modelType || registrationScope.modelType, typeName);
            }

            decompose(_val, _opts) {
              var modelTypeClass = registrationScope.modelTypeClass;
              if (modelTypeClass && modelTypeClass.decompose instanceof Function)
                return modelTypeClass.decompose.call(this, _val, _opts);

              var opts = _opts || {},
                  primitiveOpts = { ...opts },
                  inputValue = _val,
                  modelType = self.getModelType(typeName),
                  context = opts.context,
                  rawVal = {},
                  subVals = [{ modelType: registrationScope.modelType, model: inputValue, value: rawVal }];

              if (isCyclic(inputValue, self.skipCyclicTypes.bind(self)))
                throw new Error(`Error while trying to decompose modal type ${modelType.getTypeName()}. A cyclic data object was provided.`);

              modelType.iterateFields((field, fieldName, index, flags) => {
                var getter = field.getProp('getter', context),
                    value = getter(inputValue[fieldName], opts.owner),
                    complex = flags & ModelType.FLAGS.COMPLEX;

                if (registrationScope.primitiveType && !value && fieldName === 'value')
                  value = inputValue;

                if (!(flags & ModelType.FLAGS.PRIMITIVE) || complex) {
                  var decomposedValue = field.decompose(value, { ...opts, owner: inputValue, ownerField: field, ownerType: modelType });
                  subVals = subVals.concat(decomposedValue);
                  return;
                }

                rawVal[fieldName] = field.decompose(value, primitiveOpts);
              }, { virtual: false, primitive: true });

              return subVals;
            }

            decomposeAsModel(val, _opts) {
              return this.decompose(val, _opts);
            }

            async validate(_val, _opts) {
              if (registrationScope.primitiveType)
                return;

              var modelTypeClass = registrationScope.modelTypeClass;
              if (modelTypeClass && modelTypeClass.validate instanceof Function)
                return await modelTypeClass.validate.call(this, _val, _opts);

              var opts = _opts || {},
                  inputValue = _val,
                  modelType = self.getModelType(typeName),
                  promises = [];

              if (isCyclic(inputValue, self.skipCyclicTypes.bind(self)))
                throw new Error(`Error while trying to validate modal type ${modelType.getTypeName()}. A cyclic data object was provided.`);

              modelType.iterateFields((field, fieldName) => {
                promises.push(field.validate((inputValue) ? inputValue[fieldName] : undefined, opts));
              });

              return Promise.all(promises);
            }

            instantiate(data, ...args) {
              if (data instanceof ModelBase)
                return data;

              if (isCyclic(data, self.skipCyclicTypes.bind(self)))
                throw new Error(`Error while trying to instantiate modal type ${typeName}. A cyclic data object was provided.`);

              if (registrationScope.modelTypeClass.instantiate instanceof Function)
                return registrationScope.modelTypeClass.instantiate(data, ...args);

              return new registrationScope.modelTypeClass(data, ...args);
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
      var schemaEngine = this;

      this.iteratePrimitiveSchemaTypes((name, typeClass) => {
        if (typeClass.requiresArguments)
          return;

        this.registerModelType(name, function(ModelBase) {
          var typeInfo = this;

          return class PrimitiveModel extends ModelBase {
            constructor(...args) {
              super(...args);
            }

            static schema(selfType, types) {
              return {
                ownerType: types.OwnerType,
                ownerID: types.OwnerID,
                ownerField: types.OwnerField,
                ownerOrder: types.OwnerOrder,
                value: new typeClass(selfType.getSchemaEngine(), selfType.getModelType())
              };
            }

            static validate() {}
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

                var modelTypeClass = this.getApplication().wrapClass(this.getModelTypeClass()),
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
          var targetTypeNames = field.getTargetTypeName();

          // Grab target schema type(s), and inject 'ownerID', 'ownerType', and 'ownerField' schema fields
          if (!(targetTypeNames instanceof Array))
            targetTypeNames = [targetTypeNames];

          for (var i = 0, il = targetTypeNames.length; i < il; i++) {
            var targetTypeName = targetTypeNames[i],
                modelType = this.getModelType(targetTypeName);

            var schemaTypes = modelType.getSchemaTypes();

            // Inject "owner" fields into schema if they don't exist
            // TODO: Add validator to validate ownerType is proper
            if (!modelType.getOwnerIDField())
              modelType.addField(schemaTypes.OwnerID.field('ownerID'));

            if (!modelType.getOwnerTypeField())
              modelType.addField(schemaTypes.OwnerType.field('ownerType'));

            if (!modelType.getOwnerFieldField())
              modelType.addField(schemaTypes.OwnerField.field('ownerField'));

            if (!modelType.getOwnerOrderField())
              modelType.addField(schemaTypes.OwnerOrder.field('ownerOrder'));
          }
        }, { virtual: false, primitive: false, complex: true });
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
      var typeName = _typeName,
          SchemaTypeClass = this.getApplication().wrapClass(this.getSchemaTypeClass());

      if (typeName instanceof ModelType || typeName instanceof SchemaTypeClass)
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

    async create(typeName, ...args) {
      var modelType = this.getModelType(typeName);
      return modelType.instantiate(...args);
    }

    async save(connector, _models, _opts) {
      if (noe(_models))
        return;

      var opts = _opts || {},
          models = _models,
          promises = [];

      if (!(models instanceof Array))
        models = [models];

      if (opts.bulk)
        return connector.write(this, models, opts);

      for (var i = 0, il = models.length; i < il; i++) {
        var model = models[i],
            modelType = this.introspectSchemaType(model, opts);

        if (!(modelType instanceof ModelType))
          throw new Error('Schema error: Can not save data: unknown of invalid schema type');

        promises.push(connector.write(this, model, { ...opts, modelType }));
      }

      return Promise.all(promises);
    }

    query(connector, _modelType, _opts) {
      var modelType = this.getModelType(_modelType);
      if (!modelType)
        throw new Error('Unable to find schema type for query operation');

      var QueryEngineClass = this.getApplication().wrapClass(this.getQueryEngineClass());
      return new QueryEngineClass(this, connector, modelType, _opts);
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
