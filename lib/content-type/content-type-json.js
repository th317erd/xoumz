module.exports = function(root, requireModule) {
  const { definePropertyRO, instanceOf } = requireModule('./utils');
  const { ContentType } = requireModule('./content-type/content-type');

  class ContentTypeJSON extends ContentType {
    constructor(_data, opts) {
      var data = _data;

      if (instanceOf(data, 'string', 'number', 'boolean'))
        data = JSON.parse(data);

      super(data, opts);

      definePropertyRO(this, 'type', 'json');
      definePropertyRO(this, 'data', undefined, () => {
        return this._data;
      }, () => {
        throw new Error('You can not set data directly on a ContentType instance. Try creating a new instance instead.');
      });
    }
  }

  Object.assign(root, {
    ContentTypeJSON
  });
};