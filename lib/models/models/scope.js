module.exports = function(root, requireModule) {
  const { copyStaticMethods } = requireModule('./base/utils');
  const { SchemaType } = requireModule('./schema/schema-type');
  const { ModelBase } = requireModule('./models/model-base');
  const scopeSchema = requireModule('./models/schemas/scope');
  const { QueryBuilder } = requireModule('./base/query-builder');

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
  }

  class OwnerScopeSchemaType extends ScopeSchemaType {
    createNewConsumer(type, specifiedType) {
      var consumer = super.createNewConsumer(type, specifiedType);
      return consumer.hostSchemaMutator(function(types, typeName, field, fieldName, modelSchema) {
        var extraFields = [];

        if (!modelSchema[`${fieldName}ID`])
          extraFields.push(this.createDefaultOwnerIDField(types, typeName, fieldName));

        if (!modelSchema[`${fieldName}Type`])
          extraFields.push(this.createDefaultOwnerTypeField(types, typeName, fieldName));

        if (!modelSchema[`${fieldName}Order`])
          extraFields.push(this.createDefaultOwnerOrderField(types, typeName, fieldName));

        if (!modelSchema[`${fieldName}Field`])
          extraFields.push(this.createDefaultOwnerFieldField(types, typeName, fieldName));

        return extraFields;
      });
    }
  }

  class OwnerScope extends Scope {
    static schema(...args) {
      return scopeSchema.call(this, ...args);
    }

    static getSchemaTypeClass() {
      return OwnerScopeSchemaType;
    }

    onAccess() {
      return 'derp';
    }

    onAssign(value, field) {
      var TargetClass = field.getProp('targetType');
      if (!TargetClass)
        throw new Error('Target class not defined for Scope');

      if (value && value.id) {
        this.query = new QueryBuilder().type(TargetClass.getTypeName()).field('id').equals(value.id).serialize();
        this.ownerID = value.id;
        this.ownerType = value.getTypeName();
        this.ownerField = field.getProp('field');
        debugger;
      } else {
        this.query = null;
      }
    }
  }

  root.export({
    Scope,
    OwnerScope
  });
};
