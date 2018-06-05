module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function(types, typeName) {
        return [
          types.String.field('query').nullable(false).required,
          this.createDefaultOwnerIDField(types, typeName),
          this.createDefaultOwnerTypeField(types, typeName),
          this.createDefaultOwnerOrderField(types, typeName),
          this.createDefaultOwnerFieldField(types, typeName)
        ];
      },
      demote: function(values, _opts) {},
      promote: function(values, _opts) {}
    });
  };
};
