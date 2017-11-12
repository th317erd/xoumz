module.exports = function(schemaTypes, User) {
  return class Dependent extends User {
    static schema() {
      return User.schema();
    }
  };
};
