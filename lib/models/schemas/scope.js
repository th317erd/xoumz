module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function({ String, Integer }, parent) {
        return {
          'query': String.nullable(false).required
        };
      },
      demote: function(values, _opts) {},
      promote: function(values, _opts) {}
    });
  };
};
