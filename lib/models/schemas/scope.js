module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      schema: function(types, modelName) {
        return [
          types.String.field('query').nullable(false).size(1024).required,
          this.createDefaultOwnerIDField(types, modelName),
          this.createDefaultOwnerTypeField(types, modelName),
          this.createDefaultOwnerOrderField(types, modelName),
          this.createDefaultOwnerFieldField(types, modelName)
        ];
      },
      demote: function(values, _opts) {},
      promote: function(values, _opts) {}
    });
  };
};
