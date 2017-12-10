import userSchema from '../schema/user';

module.exports = function(self, schemaTypes, ModelBase) {
  return class User extends ModelBase {
    static schema(...args) {
      return userSchema.call(this, ...args);
    }
  };
};
