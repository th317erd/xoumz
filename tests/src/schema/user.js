const { inspect } = require('../utils');

module.exports = function(self, types) {
  var app = this.getApplication();

  return {
    'firstName': types.String,
    'age': types.Integer,
    'items': types.ArrayOf(types.Integer)
  };
};
