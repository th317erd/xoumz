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

  Object.assign(root, {
    required
  });
};
