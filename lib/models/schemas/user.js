const moment = require('moment'),
      { SHA512 } = require('crypto-js');

module.exports = function(root, requireModule) {
  const { password } = requireModule('./base/validation'),
        application = this;

  var salt;

  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function({ User, Role, String, Date, Integer, Array }, parent) {
        return {
          'userName': String.nullable(false).required,
          'password': String.nullable(false).required.validator(password, 'init').setter(function(val) {
            if (salt === undefined)
              salt = application.getConfigValue('salt', '');

            var hash = SHA512(val + salt);
            return hash.toString();
          }),
          'firstName': String,
          'middleName': String,
          'lastName': String.max(1024),
          'dob': Date.nullable(false),
          'age': Integer.virtual.setter(function(val) {
            var format = this.schema().getFieldProp('dob', 'format');
            return moment().diff(moment(this.dob, format), 'years');
          }),
          'dependent': Array(User).nullable(false).required,
          'roles': Array(Role)
        };
      },
      demote: function(values, _opts) {

      },
      promote: function(values, _opts) {

      }
    });
  };
};
