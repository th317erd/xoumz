module.exports = function(root, requireModule) {
  const userSchema = requireModule('./models/schemas/user');

  function userModelCreator(ModelBase) {
    return class User extends ModelBase {
      static schema(...args) {
        return userSchema.call(this, ...args);
      }
    };
  }

  Object.assign(root, {
    User: userModelCreator
  });
};
