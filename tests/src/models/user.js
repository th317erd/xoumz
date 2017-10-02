import { Model } from '../../../index';

class User extends Model {
  constructor() {
    super();
    
    this.firstName = 'Test';
    this.lastName = 'User';
    this.dependents = [];
  }
}

module.exports = Object.assign(module.exports, {
  User
});
