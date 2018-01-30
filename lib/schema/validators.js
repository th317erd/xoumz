module.exports = function(root, requireModule) {
  const { noe } = requireModule('./utils');

  function required(val, _opts) {
    if (noe(val)) {
      var opts = _opts || {},
          modelType = this.getParentModelType();

      if (!modelType)
        modelType = this.getModelType();

      var typeName = (modelType) ? modelType.getTypeName() : '<unkown model type>';
      throw new Error(`Value required for ${typeName}.${this.getProp('field')}`);
    }
  }

  function password(_val, _opts) {
    var error,
        val = ('' + _val);

    if (noe(val) || !val.match(/[A-Z]/) || !val.match(/[a-z]/) || !val.match(/\W/) || val.length < 8)
      throw new Error('Invalid password. Passwords must contain at least one uppercase letter, one lowercase letter, and one special symbol, and must be eight or more characters');
  }

  Object.assign(root, {
    required,
    password
  });
};
