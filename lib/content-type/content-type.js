module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');

  const ContentType = this.defineClass((ParentClass) => {
    return class ContentType extends ParentClass {
      constructor(data, _opts) {
        var opts = _opts || {};

        definePropertyRW(this, 'options', opts);
        definePropertyRO(this, '_data', data);
      }
    };
  });

  root.export({
    ContentType
  });
};
