module.exports = function(schemaTypes, BaseRecord) {
  return class User extends BaseRecord {
    static schema() {
      return {
        'firstName': schemaTypes.String
      };
    }
  };
};
