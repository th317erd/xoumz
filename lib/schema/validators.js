module.exports = function(root, requireModule) {
  const { noe } = requireModule('./utils');
  
  function required(val) {
    if (noe(val))
      throw new Error(`Value required for ${this.getModelType().getTypeName()}.${this.getProp('field')}`);
  }

  Object.assign(root, {
    required
  });
};
