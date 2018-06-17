module.exports = function(root, requireModule) {
  const { SchemaType } = requireModule('./schema/schema-type');
  const { ModelBase } = requireModule('./models/model-base');
  const scopeSchema = requireModule('./models/schemas/scope');
  const { QueryBuilder } = requireModule('./base/query-builder');

  const ScopeSchemaType = this.defineClass((SchemaType) => {
    return class ScopeSchemaType extends SchemaType {
      constructor(ModelClass, ...args) {
        super(ModelClass || Scope, ...args);
      }

      initialize(consumer, type, opts, specifiedType) {
        if (!specifiedType)
          throw new Error('Scope type requires a schema type to be specified');

        return consumer.abstract.targetType(specifiedType.getModelClass());
      }
    };
  }, SchemaType);

  const Scope = this.defineClass((ModelBase) => {
    return class Scope extends ModelBase {
      static schema(...args) {
        return scopeSchema.call(this, ...args);
      }

      static getSchemaTypeClass() {
        return ScopeSchemaType;
      }

      static getUniqueResourceID() {
        return 'org/xoumz/model/Scope';
      }
    };
  }, ModelBase);

  const OwnerScopeSchemaType = this.defineClass((ScopeSchemaType) => {
    return class OwnerScopeSchemaType extends ScopeSchemaType {
      createNewConsumer(type, opts, specifiedType) {
        var consumer = super.createNewConsumer(type, opts, specifiedType);
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
    };
  }, ScopeSchemaType);

  const OwnerScope = this.defineClass((Scope) => {
    return class OwnerScope extends Scope {
      static schema(defineSchema) {
        return defineSchema(null, {
          version: 1,
          schema: function(types, typeName) {
            return [
              this.createDefaultOwnerIDField(types, typeName),
              this.createDefaultOwnerTypeField(types, typeName),
              this.createDefaultOwnerOrderField(types, typeName),
              this.createDefaultOwnerFieldField(types, typeName)
            ];
          },
          demote: function(values, _opts) {},
          promote: function(values, _opts) {}
        });
      }

      static getSchemaTypeClass() {
        return OwnerScopeSchemaType;
      }

      static getUniqueResourceID() {
        return 'org/xoumz/model/OwnerScope';
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
    };
  }, Scope);

  root.export({
    Scope,
    OwnerScope
  });
};
