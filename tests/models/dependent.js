import { User } from './user';

class Dependent extends User {
  constructor() {
    super();
  }
}

module.exports = Object.assign(module.exports, {
  Dependent
});
