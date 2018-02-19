module.exports = function(root, requireModule) {
  const { noe } = requireModule('./base/utils');

  class ValidationErrors extends Error {
    constructor(_errors) {
      super();

      var errors = _errors;
      if (!(errors instanceof Array))
        errors = [errors];

      this.message = errors;
    }
  }

  function required(val, _opts) {
    if (noe(val)) {
      var opts = _opts || {},
          fieldName = (opts.schema) ? opts.schema.getProp('field', opts) : '<unknown field>';

      throw new Error(`Value required for ${fieldName}`);
    }
  }

  function password(_val, _opts) {
    var error,
        val = ('' + _val);

    if (noe(val) || !val.match(/[A-Z]/) || !val.match(/[a-z]/) || !val.match(/\W/) || val.length < 8)
      throw new Error('Invalid password. Passwords must contain at least one uppercase letter, one lowercase letter, and one special symbol, and must be eight or more characters');
  }

  root.export(root, {
    ValidationErrors,
    required,
    password
  });
};
