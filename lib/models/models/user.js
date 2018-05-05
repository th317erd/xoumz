module.exports = function(root, requireModule) {
  const { instanceOf } = requireModule('./base/utils');
  const { ModelBase } = requireModule('./models/model-base');
  const userSchema = requireModule('./models/schemas/user');

  class User extends ModelBase {
    static schema(...args) {
      return userSchema.call(this, ...args);
    }

    async getPermissionLevel(accessor) {
      if (!this.isPermissibleType(accessor))
        return this.accessLevelDefault();

      // If I am an administrator than I have full access
      if ((await accessor.hasRole('admin')))
        return this.accessLevelFull();

      // If accessor is the owner they also have full access
      if (this.isPermissableType('model')) {
        if (instanceOf(accessor, ModelBase) && instanceOf(accessor, User)) {
          if (accessor.id === this.id)
            return
        }
      }
    }
  }

  root.export({
    User
  });
};
