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
        return 'org_xoumz_model_Scope';
      }

      static isAbstract() {
        return true;
      }
    };
  }, ModelBase);

  const OwnerScopeSchemaType = this.defineClass((ScopeSchemaType) => {
    return class OwnerScopeSchemaType extends ScopeSchemaType {
      createNewConsumer(type, opts, specifiedType) {
        var consumer = super.createNewConsumer(type, opts, specifiedType);
        return consumer.abstract.hostSchemaMutator(function(types, modelName, field, fieldName, modelSchema) {
          var extraFields = [];

          if (!modelSchema[`${fieldName}ID`])
            extraFields.push(this.createDefaultOwnerIDField(types, modelName, fieldName));

          if (!modelSchema[`${fieldName}Type`])
            extraFields.push(this.createDefaultOwnerTypeField(types, modelName, fieldName));

          if (!modelSchema[`${fieldName}Order`])
            extraFields.push(this.createDefaultOwnerOrderField(types, modelName, fieldName));

          if (!modelSchema[`${fieldName}Field`])
            extraFields.push(this.createDefaultOwnerFieldField(types, modelName, fieldName));

          return extraFields;
        });
      }
    };
  }, ScopeSchemaType);

  const OwnerScope = this.defineClass((Scope) => {
    return class OwnerScope extends Scope {
      static schema(defineSchema) {
        return defineSchema(null, {
          schema: function(types, modelName) {
            return [
              this.createDefaultOwnerIDField(types, modelName),
              this.createDefaultOwnerTypeField(types, modelName),
              this.createDefaultOwnerOrderField(types, modelName),
              this.createDefaultOwnerFieldField(types, modelName)
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
        return 'org_xoumz_model_OwnerScope';
      }

      static isAbstract() {
        return true;
      }

      onAccess() {
        return 'derp';
      }

      onAssign(value, field) {
        var TargetClass = field.getProp('targetType');
        if (!TargetClass)
          throw new Error('Target class not defined for Scope');

        if (value && value.id) {
          this.query = new QueryBuilder().type(TargetClass.getModelName()).field('id').equals(value.id).serialize();
          this.ownerID = value.id;
          this.ownerType = value.getModelName();
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
