module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
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

      async start() {
        if (this.isStarted())
          return;

        await super.start();

        var models = Object.assign({}, PrimitiveModelTypes, this._specifiedModels),
            finalModels = {};

        for (var modelClass of models.values()) {
          if (typeof modelClass.getTypeName !== 'function')
            throw new Error('Model has no defined name. Did you forget to define the static method getTypeName?');

          if (typeof modelClass.getUniqueResourceID !== 'function')
            throw new Error('Model has no defined unique resource id. Did you forget to define the static method getUniqueResourceID?');

          (function(modelClass) {
            Object.defineProperty(finalModels, modelClass.getTypeName(), {
              enumerable: true,
              configurable: false,
              get: () => modelClass,
              set: () => {}
            });
          })(modelClass);
        }

        definePropertyRO(this, '_models', finalModels);
      }

      getType(name, _opts) {
        var opts = _opts || {},
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

        return new ModelClass(null, decomposedModel, _opts);
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
