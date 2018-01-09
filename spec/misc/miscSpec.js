const fs = require('fs'),
      Buffer = require('safe-buffer').Buffer;

function createLargeString(size) {
  var arr = [],
      totalSize = 0,
      start = 'a'.charCodeAt(0),
      end = 'z'.charCodeAt(0),
      range = Math.abs(end - start);

  while (totalSize < size) {
    var code = start + (range * Math.random());
    arr.push(String.fromCharCode(code));
    totalSize++;
  }

  return arr.join('');
}

describe('Utils', function() {
  describe('Utils', function() {
    it('should be able to work with mime types', function() {
      expect(this.app.Utils.getMimeType('test.json')).toBe('application/json');
      expect(this.app.Utils.getMimeType('test.html')).toBe('text/html');
      expect(this.app.Utils.getExtensionFromMimeType('application/json')).toBe('json');
      expect(this.app.Utils.getExtensionFromMimeType('text/html')).toBe('html');
    });
  });

  describe('StreamableToStream', function() {
    it('should be able to convert a string to a stream', function(done) {
      var str = createLargeString(65000),
          stream = new this.app.Utils.StreamableToStream(str);

      stream.on('end', () => {
        var newStr = fs.readFileSync('/tmp/_temp.buf', { encoding: 'utf8' });
        expect(newStr).toBe(str);
        done();
      }).pipe(fs.createWriteStream('/tmp/_temp.buf'));
    });

    it('should be able to convert a buffer to a stream', function(done) {
      var str = createLargeString(65050),
          stream = new this.app.Utils.StreamableToStream(new Buffer(str));

      stream.on('end', () => {
        var newStr = fs.readFileSync('/tmp/_temp.buf', { encoding: 'utf8' });
        expect(newStr).toBe(str);
        done();
      }).pipe(fs.createWriteStream('/tmp/_temp.buf'));
    });
  });
});
