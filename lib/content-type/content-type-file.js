const fs = require('fs');

module.exports = function(root, requireModule) {
  const { definePropertyRO, noe } = requireModule('./base/utils');
  const { ContentType } = requireModule('./content-type/content-type');

  const ContentTypeFile = this.defineClass((ContentType) => {
    return class ContentTypeFile extends ContentType {
      constructor(data, _opts) {
        var opts = _opts || {};

        super(data, opts);

        if (noe(opts.filePath))
          throw new Error('"filePath" required for ContentTypeFile type');

        if (noe(opts.encoding))
          throw new Error('"encoding" required for ContentTypeFile type');

        definePropertyRO(this, 'type', 'file');
        definePropertyRO(this, 'data', undefined, () => {
          var d = this._stream;

          if (!this.hasOwnProperty('_stream')) {
            d = fs.createReadStream(this.options.filePath, { encoding: this.options.encoding });
            definePropertyRO(this, '_stream', d);
          }

          return d;
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
    ContentTypeFile
  });
};
