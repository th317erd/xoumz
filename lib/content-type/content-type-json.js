const Buffer = require('safe-buffer').Buffer;

module.exports = function(root, requireModule) {
  const { definePropertyRO, instanceOf } = requireModule('./base/utils');
  const { ContentType } = requireModule('./content-type/content-type');

  const ContentTypeJSON = this.defineClass((ContentType) => {
    return class ContentTypeJSON extends ContentType {
      constructor(_data, opts) {
        var data = _data;

        if (data instanceof Buffer || instanceOf(data, 'string', 'number', 'boolean'))
          data = JSON.parse(data.toString());

        super(data, opts);

        definePropertyRO(this, 'type', 'json');
        definePropertyRO(this, 'data', undefined, () => {
          return this._data;
        }, () => {
          throw new Error('You can not set data directly on a ContentType instance. Try creating a new instance instead.');
        });
      }

      serialize() {
        return JSON.stringify(this.data);
      }
    };
  }, ContentType);

  root.export({
    ContentTypeJSON
  });
};
