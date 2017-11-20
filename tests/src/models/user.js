import userSchema from '../schema/user';

module.exports = function(self, schemaTypes, BaseRecord) {
  return class User extends BaseRecord {
    static schema(...args) {
      return userSchema(...args);
    }
  };
};
