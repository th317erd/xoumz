import { inspect } from '../utils';

module.exports = function(self, types) {
  console.log(inspect(types));
  return {
    'firstName': types.String,
    'age': types.Integer,
    'dependents': types.arrayOf(self)
  };
};
