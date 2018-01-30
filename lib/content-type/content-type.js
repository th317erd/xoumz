module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./utils');

  class ContentType {
    constructor(data, _opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRO(this, '_data', data);
    }
  }

  Object.assign(root, {
    ContentType
  });
};
