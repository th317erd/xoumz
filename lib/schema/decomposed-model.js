module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { SchemaType } = requireModule('./schema/schema-type');
  const Logger = requireModule('./logger');

  class DecomposedModel {
    constructor(_opts) {
      var opts = _opts || {};
      definePropertyRW(this, 'options', opts);
    }
  }

  Object.assign(root, {
    DecomposedModel
  });
};
