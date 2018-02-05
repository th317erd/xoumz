module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');
  const { ContentType } = requireModule('./content-type/content-type');

  class ContentTypeStream extends ContentType {
    constructor(data, _opts) {
      var opts = _opts || {};

      super(data, opts);

      definePropertyRO(this, 'type', 'stream');
      definePropertyRO(this, 'data', undefined, () => {
        return this._data;
      }, () => {
        throw new Error('You can not set data directly on a ContentType instance. Try creating a new instance instead.');
      });
    }

    serialize() {
      return this.data;
    }
  }

  Object.assign(root, {
    ContentTypeStream
  });
};
