module.exports = function(root, requireModule) {
  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function({ User, OwnerScope, Date }) {
        return {
          'owner': OwnerScope(User),
          'validAt': Date.notNull.required,
        };
      },
      demote: function(values, _opts) {

      },
      promote: function(values, _opts) {

      }
    });
  };
};
