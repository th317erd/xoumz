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
  const Collection = this.defineClass((Scope) => {
    return class Collection extends Scope {
      constructor(field, ...args) {
        super(...args);

        definePropertyRO(this, '_fieldDefinition', field);
        definePropertyRW(this, '_collection', new LazyCollection());
      }

      static schema(...args) {
        return scopeSchema.call(this, ...args);
      }

      static getUniqueResourceID() {
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
