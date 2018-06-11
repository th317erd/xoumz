module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');
  const { ContentType } = requireModule('./content-type/content-type');

  const ContentTypeText = this.defineClass((ContentType) => {
    return class ContentTypeText extends ContentType {
      constructor(data, opts) {
        super(data, opts);

        definePropertyRO(this, 'type', 'text');
        definePropertyRO(this, 'data', undefined, () => {
          return this._data;
        }, () => {
          throw new Error('You can not set data directly on a ContentType instance. Try creating a new instance instead.');
        });
      }

      serialize() {
        return this.data;
      }
    };
  }, ContentType);

  root.export({
    ContentTypeText
  });
};
