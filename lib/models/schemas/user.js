const moment = require('moment'),
      { SHA512 } = require('crypto-js');

module.exports = function(root, requireModule) {
  const { password } = requireModule('./schema/validators'),
        application = this;

  var salt;

  return function(self, types) {
    return {
      'userName': types.String.notNull.required,
      'password': types.String.notNull.validator(password, 'init').setter((val) => {
        if (salt === undefined)
          salt = application.getConfigValue('salt', '');

        var hash = SHA512(val + salt);
        return hash.toString();
      }),
      'firstName': types.String,
      'middleName': types.String,
      'lastName': types.String.max(1024),
      'dob': types.Date.notNull,
      'age': types.Integer.virtual.setter((val, model) => {
        if (!model)
          return;

        var format = (model.schema instanceof Function) ? model.schema().getFieldProp('dob', 'format') : undefined;
        return moment().diff(moment(model.dob, format), 'years');
      }),
      'dependents': types.ArrayOf(types.User),
      'roles': types.ArrayOf(types.Role)
    };
  };
};
