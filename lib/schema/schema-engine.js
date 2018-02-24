module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');
  const PrimitiveModelTypes = requireModule('./schema/primitive-model-types');
  // const { ModelType } = requireModule('./schema/model-type');
  // const SchemaTypes = requireModule('./schema/schema-type');
  // const Validators = requireModule('./base/validation');
  // const Logger = requireModule('./base/logger');
  // const { ModelBase } = requireModule('./models/model-base');
  // const { DecomposedModelCollection, DecomposedModel } = requireModule('./schema/decomposed-model');

  class SchemaEngine {
    constructor(_models, _opts) {
      function defineModel(model) {
        var schemaEngine = this,
            modelSchema,
            typeName = model.getTypeName(),
            _model = model;

        model.getSchema = function() {
          if (!modelSchema)
            modelSchema = new modelSchema(schemaEngine, model);

          return modelSchema;
        };

        model.prototype.getSchemaEngine = function() {
          return schemaEngine;
        };

        model.prototype.schema = function() {
          return model.getSchema();
        };

        Object.defineProperty(finalModels, typeName, {
          enumerable: true,
          configurable: true,
          get: () => _model,
          set: (val) => {
            _model = val;
            return val;
          }
        });
      }

      var opts = Object.assign({}, _opts || {}),
          models = Object.assign({}, PrimitiveModelTypes, _models || {}),
          finalModels = {};

      for (var model of models.values())
        defineModel.call(this, model);

      definePropertyRO(this, 'models', finalModels);
      definePropertyRW(this, 'options', opts);
    }

    getTypes() {
      return new Proxy(this.models, {
        get: (target, key) => {
          var prop = target[key];
          if (target.hasOwnProperty(key))
            return prop.getType();

          return prop;
        }
      });
    }

    // async onBeforeStart() {
    // }

    // async onStart() {
    //   // Register models for all primitive types
    //   if (this.options.registerPrimitiveSchemaTypes !== false) {
    //     this.iteratePrimitiveSchemaTypes((name, typeClass) => {
    //       if (typeClass.requiresArguments)
    //         return;

    //       this.registerModelType(name, function(ModelBase) {
    //         return class PrimitiveModel extends ModelBase {
    //           constructor(...args) {
    //             super(...args);
    //           }

    //           static schema(selfType, types) {
    //             return {
    //               ownerType: types.OwnerType,
    //               ownerID: types.OwnerID,
    //               ownerField: types.OwnerField,
    //               ownerOrder: types.OwnerOrder,
    //               value: new typeClass(selfType.getSchemaEngine(), selfType.getModelType())
    //             };
    //           }

    //           static validate() {}
    //         };
    //       }, { primitiveType: typeClass });
    //     });
    //   }

    //   await Promise.resolve().then(async () => {
    //     var typesInfoHash = this.typesInfoHash,
    //         callbackKeys = Object.keys(typesInfoHash);

    //     try {
    //       for (var i = 0, il = callbackKeys.length; i < il; i++) {
    //         var key = callbackKeys[i],
    //             typeInfo = typesInfoHash[key],
    //             parentType = this.getTypeParentClass(typeInfo.typeName);

    //         var modelTypeClass = await typeInfo.typeInitializer.call(typeInfo, parentType);
    //         if (!(modelTypeClass instanceof Function))
    //           throw new Error(`${typeInfo.typeName}: Return value from a Schema.register call must be a class`);

    //         if (!('schema' in modelTypeClass))
    //           throw new Error(`${typeInfo.typeName}: "schema" static function is required for every model class`);

    //         // Wrap schema function in a helper function that translates and caches the schema result
    //         modelTypeClass.schema = (function(typeInfo, parentType, schemaFunc) {
    //           return (function(...args) {
    //             var scope = typesInfoHash[typeInfo.typeName];
    //             if (scope && scope.modelType)
    //               return scope.modelType;

    //             var modelTypeClass = this.getApplication().wrapClass(this.getModelTypeClass()),
    //                 modelType = new modelTypeClass(),
    //                 schemaTypes = this.getSchemaTypes(modelType),
    //                 rawSchema = schemaFunc.call(this, new typeInfo.schemaTypeClass(this, modelType), schemaTypes, typeInfo);

    //             if (!(rawSchema instanceof modelTypeClass)) {
    //               modelType.initialize(this, typeInfo, schemaTypes, rawSchema);
    //             } else {
    //               // If we have a valid ModelType, clone it and set the typeName
    //               modelType.options = { ...modelType.options };
    //               modelType.initialize(this, rawSchema.getTypeInfo(), schemaTypes, rawSchema.getRawSchema());
    //               modelType.setTypeName(typeInfo.typeName);
    //             }

    //             scope.modelType = modelType;

    //             return modelType;
    //           }).bind(this);
    //         }).call(this, typeInfo, parentType, modelTypeClass.schema);

    //         typeInfo.modelType = modelTypeClass.schema();
    //         typeInfo.modelTypeClass = modelTypeClass;
    //       }
    //     } catch (e) {
    //       Logger.error(e);
    //       throw e;
    //     }
    //   });

    //   // Calculate foreign fields
    //   this.iterateModelSchemas((typeInfo, typeName) => {
    //     if (typeInfo.primitiveType)
    //       return;

    //     typeInfo.modelType.iterateFields((field, fieldName) => {
    //       var targetTypeNames = field.getTargetTypeName();

    //       // Grab target schema type(s), and inject 'ownerID', 'ownerType', and 'ownerField' schema fields
    //       if (!(targetTypeNames instanceof Array))
    //         targetTypeNames = [targetTypeNames];

    //       for (var i = 0, il = targetTypeNames.length; i < il; i++) {
    //         var targetTypeName = targetTypeNames[i],
    //             modelType = this.getModelType(targetTypeName);

    //         var schemaTypes = modelType.getSchemaTypes();

    //         // Inject "owner" fields into schema if they don't exist
    //         // TODO: Add validator to validate ownerType is proper
    //         if (!modelType.getOwnerIDField())
    //           modelType.addField(schemaTypes.OwnerID.field('ownerID'));

    //         if (!modelType.getOwnerTypeField())
    //           modelType.addField(schemaTypes.OwnerType.field('ownerType'));

    //         if (!modelType.getOwnerFieldField())
    //           modelType.addField(schemaTypes.OwnerField.field('ownerField'));

    //         if (!modelType.getOwnerOrderField())
    //           modelType.addField(schemaTypes.OwnerOrder.field('ownerOrder'));
    //       }
    //     }, { virtual: false, primitive: false, complex: true });
    //   }, true);

    //   await this.onFinalizeModelSchemas();
    // }

    // async onAfterStart() {
    // }

    // getTypeNameFromSchemaCode(schemaCode) {
    //   return schemaCode;
    // }

    // // This will attempt to figure out a model type from anything passed to it
    // introspectModelType(_fieldValues, _opts) {
    //   var opts = _opts || {},
    //       fieldValues = _fieldValues || {},
    //       typeInfo,
    //       typeName = opts.modelType,
    //       ModelTypeClass = this.getModelTypeClass(),
    //       ModelClass = this.getModelBaseClass();

    //   // Does opts.modelType contain a valid schema?
    //   if (typeName instanceof ModelTypeClass)
    //     return typeName;

    //   // Does opts.modelType contain a valid schema?
    //   if (typeName instanceof ModelClass)
    //     return typeName.schema();

    //   // Is fieldValues a valid schema?
    //   if (fieldValues instanceof ModelTypeClass)
    //     return fieldValues;

    //   // Is fieldValues a valid model with a schema?
    //   if (fieldValues instanceof ModelClass)
    //     return fieldValues.schema();

    //   // Is opts.modelType a typename instead of a schema?
    //   if (instanceOf(typeName, 'string', 'number', 'boolean')) {
    //     var modelType = this.getModelType(('' + typeName));
    //     if (modelType instanceof ModelTypeClass)
    //       return modelType;
    //   }

    //   // Is fieldValues a typename instead of a schema?
    //   if (instanceOf(fieldValues, 'string', 'number', 'boolean')) {
    //     var modelType = this.getModelType(('' + fieldValues));
    //     if (modelType instanceof ModelTypeClass)
    //       return modelType;
    //   }

    //   // Does the data passed to us repond to a schema query?
    //   if (fieldValues.schema instanceof Function) {
    //     var schema = fieldValues.schema();
    //     if (schema instanceof ModelTypeClass)
    //       return schema;
    //   }

    //   // If we couldn't find it a type then make our best guess
    //   var typesInfoHash = this.typesInfoHash,
    //       keys = Object.keys(typesInfoHash),
    //       typesList = [];

    //   for (var i = 0, il = keys.length; i < il; i++) {
    //     var weight = 0,
    //         key = keys[i],
    //         typeInfo = typesInfoHash[key];

    //     // We can't guess a primitive type
    //     if (typeInfo.primitiveType)
    //       continue;

    //     var modelType = this.getModelType(typeInfo.typeName),
    //         // Ask the model if it knows...
    //         isModelType = modelType.modelIsType(fieldValues);

    //     if (isModelType)
    //       return modelType;

    //     // Still can't figure out type... attempt to "weight" the model type based on matching fields
    //     modelType.iterateFields((field, key) => {
    //       if (fieldValues.hasOwnProperty(key))
    //         weight++;
    //       else
    //         weight -= 10;
    //     });

    //     typesList.push({ modelType, weight });
    //   }

    //   // Fint closest match by weight
    //   typesList = typesList.sort((a, b) => {
    //     var x = a.weight,
    //         y = b.weight;

    //     return (x == y) ? 0 : (x < y) ? 1 : -1;
    //   });

    //   var typeGuess = typesList[0];
    //   return (typeGuess) ? typeGuess.modelType : undefined;
    // }

    // getAllTypeInfo() {
    //   return this.typesInfoHash;
    // }

    // getTypeInfo(_typeName) {
    //   var typeName = _typeName,
    //       SchemaTypeClass = this.getApplication().wrapClass(this.getSchemaTypeClass()),
    //       ModelTypeClass = this.getModelTypeClass();

    //   if (typeName instanceof ModelTypeClass || typeName instanceof SchemaTypeClass)
    //     typeName = typeName.getTypeName();

    //   return this.typesInfoHash[typeName];
    // }

    // getSchemaType(typeName) {
    //   var typeInfo = this.getTypeInfo(typeName);
    //   if (!typeInfo)
    //     throw new Error(`Unable to find schema for model type: ${typeName}`);

    //   return new typeInfo.schemaTypeClass(this, this.getModelType(typeName));
    // }

    // getModelType(typeName) {
    //   var typeInfo = this.getTypeInfo(typeName);
    //   return (typeInfo) ? typeInfo.modelType : undefined;
    // }

    // iterateModelSchemas(cb, raw = false) {
    //   var typesInfoHash = this.typesInfoHash,
    //       keys = Object.keys(typesInfoHash),
    //       rets = [],
    //       abort = () => abort;

    //   for (var i = 0, il = keys.length; i < il; i++) {
    //     var typeName = keys[i],
    //         typeInfo = typesInfoHash[typeName],
    //         modelType = (raw) ? typeInfo : typeInfo.modelType,
    //         modelTypeName = (raw) ? typeInfo.typeName : modelType.getTypeName(),
    //         ret = cb.call(this, modelType, modelTypeName, this, abort);

    //     if (ret === abort)
    //       break;

    //     rets.push(ret);
    //   }

    //   return rets;
    // }

    // getTypeParentClass(typeName) {
    //   var typeInfo = this.getTypeInfo(typeName);
    //   if (!typeInfo)
    //     throw new Error(`Unable to find schema type: ${typeName}`);

    //   var parentType = typeInfo.parentType;
    //   if (!parentType)
    //     return this.getApplication().wrapClass(this.getModelBaseClass());

    //   if (parentType instanceof Function)
    //     return parentType;

    //   typeInfo = this.getTypeInfo(parentType);
    //   if (!typeInfo)
    //     throw new Error(`Unable to find schema type: ${parentType}`);

    //   if (!typeInfo.modelTypeClass)
    //     throw new Error(`Attempting to inherit from a schema type that isn't yet fully initialized: ${parentType}`);

    //   return typeInfo.modelTypeClass;
    // }

    // async create(_modelType, ...args) {
    //   var modelType = this.getModelType(_modelType);
    //   return modelType.instantiate(...args);
    // }

    // // async save(connector, _models, _opts) {
    // //   if (noe(_models))
    // //     return;

    // //   var opts = _opts || {},
    // //       models = _models,
    // //       promises = [];

    // //   if (!(models instanceof Array))
    // //     models = [models];

    // //   if (opts.bulk)
    // //     return connector.write(models, opts);

    // //   for (var i = 0, il = models.length; i < il; i++) {
    // //     var model = models[i],
    // //         modelType = this.introspectModelType(model, opts);

    // //     if (!(modelType instanceof ModelType))
    // //       throw new Error('Schema error: Can not save data: unknown of invalid schema type');

    // //     promises.push(connector.write(model, { ...opts, modelType }));
    // //   }

    // //   return Promise.all(promises);
    // // }

    // // query(connector, _modelType, _opts) {
    // //   var modelType = this.getModelType(_modelType);
    // //   if (!modelType)
    // //     throw new Error('Unable to find schema type for query operation');

    // //   var QueryEngineClass = this.getApplication().wrapClass(this.getQueryEngineClass());
    // //   return new QueryEngineClass(this, connector, modelType, _opts);
    // // }

    // async buildSchemaEngineFromRawSchema(rawSchema) {
    //   var newSchemaEngine = new this.constructor(Object.assign({}, this.options, {
    //         registerPrimitiveSchemaTypes: false
    //       })),
    //       keys = Object.keys(rawSchema);

    //   await newSchemaEngine.onBeforeStart();

    //   for (var i = 0, il = keys.length; i < il; i++) {
    //     var modelTypeName = keys[i],
    //         schema = rawSchema[modelTypeName];

    //     (function(modelTypeName, schema) {
    //       newSchemaEngine.registerModelType(modelTypeName, (ModelBase) => {
    //         return class GenericModelType extends ModelBase {
    //           static schema() {
    //             return schema;
    //           }
    //         };
    //       });
    //     })(modelTypeName, schema);
    //   }

    //   await newSchemaEngine.onStart();
    //   await newSchemaEngine.onAfterStart();

    //   return newSchemaEngine;
    // }

    // compareTo(schemaEngine, cb) {
    //   var nativeTypesInfoHash = this.getAllTypeInfo(),
    //       foreignTypeInfoHash = schemaEngine.getAllTypeInfo(),
    //       typeNames = Object.keys(Object.keys(nativeTypesInfoHash).concat(Object.keys(foreignTypeInfoHash)).reduce((obj, item) => {
    //         obj[item] = true;
    //         return obj;
    //       }, {})),
    //       abort = () => abort,
    //       areSame = true;

    //   for (var i = 0, il = typeNames.length; i < il; i++) {
    //     var modelTypeName = typeNames[i],
    //         nativeTypeInfo = this.getTypeInfo(modelTypeName),
    //         foreignTypeInfo = schemaEngine.getTypeInfo(modelTypeName),
    //         ret;

    //     if (nativeTypeInfo.primitiveType && !(new nativeTypeInfo.primitiveType(this, nativeTypeInfo.modelType)).getProp('ownable'))
    //       continue;

    //     if (nativeTypeInfo && foreignTypeInfo) {
    //       ret = nativeTypeInfo.modelType.compareTo(foreignTypeInfo.modelType, cb);
    //       if (!ret) {
    //         ret = cb('different', 'model', modelTypeName, nativeTypeInfo.modelType, foreignTypeInfo.modelType, this, schemaEngine, abort);
    //         if (ret !== false)
    //           areSame = false;
    //       }
    //     } else if (nativeTypeInfo) {
    //       ret = cb('missing', 'model', modelTypeName, nativeTypeInfo.modelType, null, this, schemaEngine, abort);
    //       if (ret !== false)
    //         areSame = false;
    //     } else {
    //       ret = cb('extra', 'model', modelTypeName, null, foreignTypeInfo.modelType, this, schemaEngine, abort);
    //       if (ret !== false)
    //         areSame = false;
    //     }

    //     if (ret === abort)
    //       break;
    //   }

    //   return areSame;
    // }
  }

  root.export({
    SchemaEngine
  });
};
