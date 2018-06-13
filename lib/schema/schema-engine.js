module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, copyStaticMethods } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { ModelSchema } = requireModule('./schema/model-schema');
  const PrimitiveModelTypes = requireModule('./schema/primitive-model-types');
  const { Context } = requireModule('./base/context');

  const SchemaEngine = this.defineClass((EngineBase) => {
    return class SchemaEngine extends EngineBase {
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

      getContext(...args) {
        return new Context({ name: 'schema', group: 'engine' }, ...args);
      }

      generateModelType(model, _typeName) {
        if (!model)
          throw new Error('Empty/invalid model passed to SchemaEngine.generateModelType');

        var schemaEngine = this,
            modelSchema,
            typeName = (_typeName) ? _typeName : model.getTypeName && model.getTypeName();

        if (!typeName)
          throw new Error('Model has no defined name. Did you forget to define the static method getTypeName?');

        var app = this.getApplication(),
            modelClass = app.defineClass((ModelClass) => {
              return class GenericModel extends ModelClass {
                getTypeName() {
                  return typeName;
                }

                static getTypeName() {
                  return typeName;
                }
              };
            }, model);

        if (!(modelClass.getSchemaType instanceof Function)) {
          const SchemaTypeClass = (typeof modelClass.getSchemaTypeClass === 'function') ? modelClass.getSchemaTypeClass() : SchemaType;
          class GenericSchemaType extends SchemaTypeClass {
            constructor(Klass, opts, ...args) {
              super(Klass || modelClass, opts, ...args);
            }
          }

          modelClass['getSchemaType'] = (opts) => {
            return new GenericSchemaType(modelClass, Object.assign({}, opts || {}, { schemaEngine }));
          };
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

        if (typeof modelClass.getSchemaEngine !== 'function')
          modelClass.getSchemaEngine = () => schemaEngine;

        if (typeof modelClass.getBaseModelClass !== 'function')
          modelClass.getBaseModelClass = () => model;

        if (typeof modelClass.getModelClass !== 'function')
          modelClass.getModelClass = () => modelClass;

        if (!(modelClass.prototype.getSchemaEngine instanceof Function))
          definePropertyRW(modelClass.prototype, 'getSchemaEngine', modelClass.getSchemaEngine);

        if (!(modelClass.prototype.getBaseModelClass instanceof Function))
          definePropertyRW(modelClass.prototype, 'getBaseModelClass', modelClass.getBaseModelClass);

        if (!(modelClass.prototype.getModelClass instanceof Function))
          definePropertyRW(modelClass.prototype, 'getModelClass', modelClass.getModelClass);

        if (!(modelClass.prototype.getSchemaType instanceof Function))
          definePropertyRW(modelClass.prototype, 'getSchemaType', (opts) => modelClass.getSchemaType(opts));

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

        return modelClass;
      }

      async start() {
        if (this.isStarted())
          return;

        await super.start();

        var models = Object.assign({}, PrimitiveModelTypes, this._specifiedModels),
            finalModels = {},
            isArray = (models instanceof Array);

        for (var [ typeName, model ] of models.entries()) {
          var thisTypeName = (!isArray) ? typeName : model.getTypeName(),
              modelClass = this.generateModelType(model, thisTypeName);

          (function(modelClass, typeName) {
            Object.defineProperty(finalModels, typeName, {
              enumerable: true,
              configurable: false,
              get: () => modelClass,
              set: () => {}
            });
          })(modelClass, thisTypeName);
        }

        definePropertyRO(this, '_models', finalModels);
      }

      getType(name, _opts) {
        var opts = Object.assign({}, _opts || {}, { schemaEngine: this }),
            prop = this._models[name];

        return (prop) ? prop.getSchemaType(opts) : prop;
      }

      getTypes(opts) {
        var proxy = new Proxy(this._models, {
              get: (target, key) => {
                var prop = target[key];
                if (target.hasOwnProperty(key))
                  return this.getType(key, opts);

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

      *entries(_opts) {
        yield* this._models.entries();
      }

      *keys(_opts, _version) {
        yield* this._models.keys();
      }

      *values(_opts, _version) {
        yield* this._models.values();
      }

      *[Symbol.iterator]() {
        yield* this.entries();
      }
    };
  }, EngineBase);

  root.export({
    SchemaEngine
  });
};
