module.exports = function(root, requireModule) {
  const { definePropertyRW, definePropertyRO } = requireModule('./base/utils');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { LazyCollection } = requireModule('./base/collections');
  const { Scope } = requireModule('./models/models/scope');
  const scopeSchema = requireModule('./models/schemas/scope');

  // Array
  const CollectionSchemaType = this.defineClass((SchemaType) => {
    return class CollectionSchemaType extends SchemaType {
      constructor(ModelClass, ...args) {
        super(ModelClass || Collection, ...args);
      }

      initialize(consumer, type, opts, specifiedType) {
        if (!specifiedType)
          throw new Error('Collection type requires an element schema type to be specified');

        return consumer.abstract.targetType(specifiedType.getModelClass());
      }
    };
  }, SchemaType);

  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const Collection = this.defineClass((ScopeModel) => {
    function createProxyFunction(name, func) {
      return function(...args) {
        return func.apply(this._collection, args);
      };
    }

    function Scope(...args) {
      ScopeModel.constructor.apply(this, ...args);
    }

    var proto = Scope.prototype = Object.create(ScopeModel.prototype),
        lcProto = LazyCollection.prototype,
        keys = Object.getOwnPropertyNames(lcProto);

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i];
      if (!lcProto.hasOwnProperty(key))
        continue;

      var value = lcProto[key];
      if (typeof value !== 'function')
        continue;

      proto[key] = createProxyFunction(key, value);
    }

    return class Collection extends Scope {
      constructor(field, values) {
        super(field);

        definePropertyRW(this, 'length', undefined, () => this._collection.length, (set) => {
          this._collection.length = set;
          return set;
        });

        definePropertyRW(this, '_collection', new LazyCollection(values));
      }

      static schema(...args) {
        return scopeSchema.call(this, ...args);
      }

      static getResourceName() {
        return 'org_xoumz_model_Collection';
      }

      static getSchemaTypeClass() {
        return CollectionSchemaType;
      }

      static isAbstract() {
        return true;
      }
    };
  }, Scope);

  root.export({
    Collection,
  });
};
