const moment = require('moment'),
      { SHA512 } = require('crypto-js');

module.exports = function(root, requireModule) {
  const { password } = requireModule('./base/validation'),
        application = this;

  var salt;

  return function(defineSchema) {
    return defineSchema(null, {
      version: 1,
      schema: function({ User, Role, String, Date, Integer, Collection }, parent) {
        return {
          'userName': String.nullable(false).required,
          'password': String.nullable(false).required.validate(password, 'init')/*.setter(function(val) {
            if (salt === undefined)
              salt = application.getConfigValue('salt', '');

            var hash = SHA512(val + salt);
            return hash.toString();
          })*/,
          'firstName': String,
          'middleName': String,
          'lastName': String.maxLength(1024),
          'dob': Date.nullable(false),
          'age': Integer.virtual.getter(function() {
            return moment().diff(moment(this.dob), 'years');
          }),
          'dependent': Collection(User).nullable(false).required,
          'roles': Collection(Role)
        };
      },
      demote: function(values, _opts) {

      },
      promote: function(values, _opts) {

      }
    });
  };
};
