module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./utils');
  const { ContentType } = requireModule('./content-type/content-type');

  class ContentTypeJSON extends ContentType {
    constructor(data, opts) {
      super(data, opts);

      definePropertyRO(this, 'type', 'json');
      definePropertyRO(this, 'data', undefined, () => {
        var d = this._parsedData;

        if (!this.hasOwnProperty('_parsedData')) {
          d = JSON.parse(('' + this._data));
          definePropertyRO(this, '_parsedData', d);
        }

        return d;
      }, () => {
        throw new Error('You can not set data directly on a ContentType instance. Try creating a new instance instead.');
      });
    }
  }

  Object.assign(root, {
    ContentTypeJSON
  });
};
