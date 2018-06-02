module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, copyStaticMethods } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { ModelSchema } = requireModule('./schema/model-schema');
  const PrimitiveModelTypes = requireModule('./schema/primitive-model-types');

  class SchemaEngine extends EngineBase {
    static name() {
      return 'schema';
    }

    static configKeyName() {
      return 'schema';
    }

    constructor(_specifiedModels, _opts) {
      super(_opts);

      definePropertyRO(this, '_specifiedModels', _specifiedModels || {});
    }

    async start() {
      function defineModel(_typeName, model) {
        var schemaEngine = this,
            modelSchema,
            typeName = (_typeName) ? _typeName : model.getTypeName(),
            modelClass = copyStaticMethods(class GenericModel extends model {
              getTypeName() {
                return typeName;
              }

              static getTypeName() {
                return typeName;
              }
            }, model);

        if (!(modelClass.getType instanceof Function)) {
          const SchemaTypeClass = (typeof modelClass.getSchemaTypeClass === 'function') ? modelClass.getSchemaTypeClass() : SchemaType;
          const GenericSchemaType = this.getApplication().wrapClass(class GenericSchemaType extends SchemaTypeClass {
            constructor() {
              super(modelClass);
            }
          });

          modelClass['getType'] = () => new GenericSchemaType();
        }

        if (!(modelClass.getSchema instanceof Function)) {
          modelClass['getSchema'] = function() {
            if (!modelSchema) {
              modelSchema = new ModelSchema(schemaEngine, modelClass);
              modelSchema.initialize();
            }

            return modelSchema;
          };
        }

        if (!(modelClass.prototype.getBaseModelClass instanceof Function))
          definePropertyRW(modelClass.prototype, 'getBaseModelClass', () => model);

        if (!(modelClass.prototype.getModelClass instanceof Function))
          definePropertyRW(modelClass.prototype, 'getModelClass', () => modelClass);

        if (!(modelClass.prototype.getType instanceof Function))
          definePropertyRW(modelClass.prototype, 'getType', () => modelClass.getType());

        if (!(modelClass.prototype.getTypeName instanceof Function))
          definePropertyRW(modelClass.prototype, 'getTypeName', () => modelClass.getTypeName());

        if (!(modelClass.prototype.getSchema instanceof Function))
          definePropertyRW(modelClass.prototype, 'getSchema', () => modelClass.getSchema());

        if (!(modelClass.prototype.getSchemaEngine instanceof Function))
          definePropertyRW(modelClass.prototype, 'getSchemaEngine', () => schemaEngine);

        if (!(modelClass.prototype.getField instanceof Function)) {
          definePropertyRW(modelClass.prototype, 'getField', function(...args) {
            return this.getSchema().getField(...args);
          });
        }

        if (!(modelClass.prototype.getFieldProp instanceof Function)) {
          definePropertyRW(modelClass.prototype, 'getFieldProp', function(...args) {
            return this.getSchema().getFieldProp(...args);
          });
        }

        Object.defineProperty(finalModels, typeName, {
          enumerable: true,
          configurable: true,
          get: () => modelClass,
          set: (val) => {
            modelClass = val;
            return val;
          }
        });
      }

      if (this.isStarted())
        return;

      await super.start();

      var models = Object.assign({}, PrimitiveModelTypes, this._specifiedModels),
          finalModels = {},
          isArray = (models instanceof Array);

      for (var [ typeName, model ] of models.entries())
        defineModel.call(this, (!isArray) ? typeName : null, model);

      definePropertyRO(this, '_models', finalModels);
    }

    getType(name) {
      var prop = this._models[name];
      return (prop) ? prop.getType() : prop;
    }

    getTypes() {
      var proxy = new Proxy(this._models, {
        get: (target, key) => {
          var prop = target[key];
          if (target.hasOwnProperty(key))
            return prop.getType();

          return prop;
        }
      });

      Object.defineProperty(proxy, '_proxyTarget', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: this._models
      });

      return proxy;
    }

    getModelClass(name) {
      return this._models[name];
    }

    create(typeName, decomposedModel, _opts) {
      var ModelClass = this.getModelClass(typeName);
      if (!ModelClass)
        throw new Error(`Unable to create model of type ${typeName}: Unknown model type`);

      return new ModelClass(decomposedModel, _opts);
    }
  }

  root.export({
    SchemaEngine
  });
};
