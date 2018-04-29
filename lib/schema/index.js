

module.exports = function(root, requireModule) {
  const SchemaType = requireModule('./schema/schema-type');
  const ModelSchema = requireModule('./schema/model-schema');
  const SchemaEngine = requireModule('./schema/schema-engine');
  const PrimitiveTypes = requireModule('./schema/primitive-model-types');

  root.export(SchemaType, ModelSchema, SchemaEngine, {
    PrimitiveTypes
  });
};
