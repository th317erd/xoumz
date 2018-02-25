const { Readable } = require('stream'),
      Buffer = require('safe-buffer').Buffer;

module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');

  class StreamableToStream extends Readable {
    constructor(_streamable, _opts) {
      // Calls the stream.Readable(options) constructor
      super(_opts);

      var streamable = _streamable,
          opts = Object.assign({
            chunkSize: 32000
          }, _opts || {});

      if (streamable === undefined || streamable === null)
        streamable = new Buffer();
      else if (!(streamable instanceof Buffer))
        streamable = new Buffer(('' + streamable));

      definePropertyRO(this, 'options', opts);
      definePropertyRO(this, 'streamable', streamable);
      definePropertyRW(this, 'position', 0);
    }

    _read() {
      var pos = this.position,
          streamable = this.streamable,
          opts = this.options,
          size = opts.chunkSize || 32000;

      if (pos >= streamable.length) {
        this.push(null);
        return;
      }

      while (true) {
        var ret = this.push(streamable.slice(pos, pos + size));
        pos += size;
        this.position = pos;

        if (pos >= streamable.length) {
          this.push(null);
          break;
        }

        if (!ret)
          break;
      }
    }
  }

  root.export({
    StreamableToStream
  });
};
