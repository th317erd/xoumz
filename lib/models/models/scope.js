module.exports = function(root, requireModule) {
  const { SchemaType } = requireModule('./schema/schema-type');
  const { ModelBase } = requireModule('./models/model-base');
  const scopeSchema = requireModule('./models/schemas/scope');

  const ScopeSchemaType = this.wrapClass(class ScopeSchemaType extends SchemaType {
    constructor(modelClass) {
      super(modelClass || Scope);
    }

    createNewConsumer(type, specifiedType) {
      var consumer = super.createNewConsumer(type);
      return consumer.abstract.targetType(specifiedType.getModelClass());
    }

    initialize(type, specifiedType) {
      if (!specifiedType)
        throw new Error('Scope type requires a schema type to be specified');
    }
  });

  class Scope extends ModelBase {
    static schema(...args) {
      return scopeSchema.call(this, ...args);
    }

    static getSchemaTypeClass() {
      return ScopeSchemaType;
    }

    onAccess() {
      return 'derp';
    }
  }

  root.export({
    Scope
  });
};
