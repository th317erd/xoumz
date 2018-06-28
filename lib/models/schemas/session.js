module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      schema: function({ User, OwnerScope, Date }) {
        return {
          'owner': OwnerScope(User),
          'validAt': Date.required,
        };
      },
      demote: function(values, _opts) {

      },
      promote: function(values, _opts) {

      }
    });
  };
};
