module.exports = function(root, requireModule) {
  const userSchema = requireModule('./models/schemas/user');

  function userModelCreator(self, schemaTypes, BaseRecord) {
    return class User extends BaseRecord {
      static schema(...args) {
        return userSchema.call(this, ...args);
      }
    };
  };

  Object.assign(root, {
    User: userModelCreator
  });
};
