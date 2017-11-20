module.exports = function(self, schemaTypes, User) {
  return class Dependent extends User {
    static schema() {
      return User.schema();
    }
  };
};
