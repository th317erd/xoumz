const moment = require('moment'),
      { SHA512 } = require('crypto-js');

module.exports = function(root, requireModule) {
  const { password } = requireModule('./base/validation'),
        application = this;

  var salt;

  return function(defineSchema) {
    return defineSchema(null, {
      schema: function({ User, Session, Role, String, Date, Integer, Collection }) {
        return {
          'userName': String.nullable(false).size(64).required,
          'password': String.nullable(false).size(128).required.validate(password, 'init')/*.setter(function(val) {
            if (salt === undefined)
              salt = application.getConfigValue('salt', '');

            var hash = SHA512(val + salt);
            return hash.toString();
          })*/,
          'firstName': String.size(64),
          'middleName': String.size(64),
          'lastName': String.size(128),
          'dob': Date.nullable(false),
          'age': Integer.virtual.getter(function() {
            return moment().diff(moment(this.dob), 'years');
          }),
          'dependent': Collection(User).nullable(false).required,
          'roles': Collection(Role),
          'sessions': Collection(Session),
          'derp': String.size(64)
        };
      },
      demote: function(values, _opts) {

      },
      promote: function(values, _opts) {

      }
    });
  };
};
