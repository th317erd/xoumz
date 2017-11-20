import { inspect } from '../utils';

module.exports = function(self, types) {
  return {
    'firstName': types.String,
    'age': types.Integer,
    'items': types.arrayOf(types.Integer)
  };
};
