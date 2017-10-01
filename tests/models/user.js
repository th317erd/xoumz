class User {
  constructor() {
    this.firstName = 'Test';
    this.lastName = 'User';
    this.dependents = [];
  }
}

module.exports = Object.assign(module.exports, {
  User
});
