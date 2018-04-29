module.exports = function(root, requireModule) {
  const { ModelBase } = requireModule('./models/model-base');
  const userSchema = requireModule('./models/schemas/user');

  class User extends ModelBase {
    static schema(...args) {
      return userSchema.call(this, ...args);
    }
  }

  root.export({
    User
  });
};
