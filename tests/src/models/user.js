import userSchema from '../schema/user';

module.exports = function(schemaTypes, BaseRecord) {
  return class User extends BaseRecord {
    static schema() {
      return userSchema(schemaTypes);
    }
  };
};
