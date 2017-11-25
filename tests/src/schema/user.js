import { inspect } from '../utils';

module.exports = function(self, types) {
  console.log(this);
  var app = this.getApplication();

  return {
    'firstName': types.String,
    'age': types.Integer,
    'items': types.arrayOf(types.Integer)
  };
};
