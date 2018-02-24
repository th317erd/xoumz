module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function({ Date }) {
        return {
          'validAt': Date.notNull.required
        };
      }
    });
  };
};
