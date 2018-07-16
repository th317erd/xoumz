module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const PrimitiveModelNames = requireModule('./schema/primitive-model-types');
  const { ModelSchema } = requireModule('./schema/model-schema');
  const { Context } = requireModule('./base/context');

  const FLAGS = ModelSchema.FLAGS;

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

        var models = Object.assign({}, PrimitiveModelNames, this._specifiedModels),
            finalModels = {};

        for (var modelClass of models.values()) {
          if (typeof modelClass.getModelName !== 'function')
            throw new Error('Model has no defined name. Did you forget to define the static method getModelName?');

          if (typeof modelClass.getResourceName !== 'function')
            throw new Error('Model has no defined unique resource id. Did you forget to define the static method getResourceName?');

          (function(modelClass) {
            Object.defineProperty(finalModels, modelClass.getModelName(), {
              enumerable: true,
              configurable: false,
              get: () => modelClass,
              set: () => {}
            });

            Object.defineProperty(finalModels, `_${modelClass.getResourceName()}`, {
              enumerable: false,
              configurable: false,
              get: () => modelClass,
              set: () => {}
            });
          })(modelClass);
        }

        definePropertyRO(this, '_models', finalModels);
      }

      getModelFlags(modelClass) {
        var flags = 0;

        if (modelClass.isVirtual())
          flags |= FLAGS.VIRTUAL;

        if (modelClass.isAbstract())
          flags |= FLAGS.ABSTRACT;

        if (modelClass.isComplex())
          flags |= FLAGS.COMPLEX;

        if ((typeof modelClass.primitive === 'function') && modelClass.primitive())
          flags |= FLAGS.PRIMITIVE;

        return flags;
      }

      getVersioned(_opts) {
        var version = this.getVersionFromContext(_opts);
        return (version === this.getVersion()) ? this : this.getEngine('schema', _opts)
      }

      getModelClassFromResourceID(resourceID, _opts) {
        var schemaEngine = this.getVersioned(_opts);
        if (!schemaEngine)
          return;

        return schemaEngine._models[`_${resourceID}`];
      }

      getModelClass(name, _opts) {
        var prop = this._models[`_${name}`] || this._models[name];
        if (!prop)
          return;

        var resourceID = prop.getResourceName();
        return this.getModelClassFromResourceID(resourceID, _opts);
      }

      getModelSchema(name, _opts) {
        var modelClass = this.getModelClass(name, _opts);
        if (!modelClass)
          return;

        return modelClass.getSchema();
      }

      getSchemaType(name, _opts) {
        var modelClass = this.getModelClass(name, _opts);
        if (!modelClass)
          return;

        return modelClass.getSchemaType(_opts);
      }

      getSchemaTypes(opts) {
        var proxy = new Proxy(this._models, {
              get: (target, key) => {
                var prop = target[key];
                if (target.hasOwnProperty(key))
                  return this.getSchemaType(key, opts);

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

      getSchemaTypeNames(_opts) {
        var opts = Object.assign({ hidden: false }, _opts || {}),
            models = this._models,
            keys = Object.keys(models),
            typeNames = [];

        if (opts.hasOwnProperty('real')) {
          var real = !!opts.real;
          opts.hidden = !real;
          opts.virtual = !real;
          opts.complex = !real;
        }

        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i],
              modelClass = models[key],
              name = (opts.resourceNames) ? modelClass.getResourceName() : modelClass.getModelName(),
              flags = this.getModelFlags(modelClass);

          if (!ModelSchema.flagsPass(flags, opts))
            continue;

          typeNames.push(name);
        }

        return typeNames;
      }

      create(modelName, decomposedModel, _opts) {
        var ModelClass = this.getModelClass(modelName);
        if (!ModelClass)
          throw new Error(`Unable to create model of type ${modelName}: Unknown model type`);

        return new ModelClass(decomposedModel, _opts);
      }

      *entries(_opts) {
        var models = this._models,
            keys = Object.keys(models);

        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i];
          yield [ key, models[key] ];
        }
      }

      *keys(_opts, _version) {
        var keys = Object.keys(this._models);
        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i];
          yield key;
        }
      }

      *values(_opts, _version) {
        var models = this._models,
            keys = Object.keys(models);

        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i];
          yield models[key];
        }
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
