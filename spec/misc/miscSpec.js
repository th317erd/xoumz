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
      expect(this.app.Utils.getMimeType('test.json')).toBeTheSame('application/json');
      expect(this.app.Utils.getMimeType('test.html')).toBeTheSame('text/html');
      expect(this.app.Utils.getExtensionFromMimeType('application/json')).toBeTheSame('json');
      expect(this.app.Utils.getExtensionFromMimeType('text/html')).toBeTheSame('html');
    });
  });

  describe('StreamableToStream', function() {
    it('should be able to convert a string to a stream', function(done) {
      var str = createLargeString(65000),
          stream = new this.app.StreamUtils.StreamableToStream(str);

      stream.on('end', () => {
        var newStr = fs.readFileSync('/tmp/_temp.buf', { encoding: 'utf8' });
        expect(newStr).toBeTheSame(str);
        done();
      }).pipe(fs.createWriteStream('/tmp/_temp.buf'));
    });

    it('should be able to convert a buffer to a stream', function(done) {
      var str = createLargeString(65050),
          stream = new this.app.StreamUtils.StreamableToStream(new Buffer(str));

      stream.on('end', () => {
        var newStr = fs.readFileSync('/tmp/_temp.buf', { encoding: 'utf8' });
        expect(newStr).toBeTheSame(str);
        done();
      }).pipe(fs.createWriteStream('/tmp/_temp.buf'));
    });
  });

  describe('LazyCollection', function() {
    beforeEach(function() {
      this.asyncOpIndex = 0;
      this.verifyIndex = 0;

      this.testMappedItem = (item, index) => {
        expect(item.index).toBeTheSame(index);
        expect(item.hello).toBeTheSame(`world@${index}`);
      };

      this.verifyCollectionIntegrity = (item, index) => {
        expect(index).toBeTheSame(this.verifyIndex);
        expect(item.index).toBeTheSame(this.verifyIndex);
        this.verifyIndex++;
      };

      this.asyncOp = () => {
        var index = this.asyncOpIndex++,
            t = 10 + (Math.random() * 90);

        return () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ index, time: t });
            }, t);
          });
        };
      };

      var collection = this.collection = new this.app.LazyCollection();
      for (var i = 0, il = 5; i < il; i++)
        collection.push(this.asyncOp());
    });

    it('should be able to iterate a LazyCollection', async function(done) {
      var ret = await this.collection.forEach(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
      }, { sequential: true });

      expect(ret).toBeTheSame(undefined);

      done();
    });

    it('should be able to iterate a LazyCollection (parallel)', async function(done) {
      var ret = await this.collection.forEach(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
      }, { sequential: false });

      expect(ret).toBeTheSame(undefined);

      done();
    });

    it('should be able to map a LazyCollection', async function(done) {
      var rets = await this.collection.map(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
        return { index: item.index, time: item.time, hello: `world@${item.index}` };
      }, { sequential: true });

      expect(rets).toBeType(Array);
      rets.forEach((item, index) => this.testMappedItem(item, index));

      // Make sure none of the values have changed
      this.verifyIndex = 0;
      await this.collection.forEach(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
        expect(item.hello).toBeTheSame(undefined);
      }, { sequential: true });

      done();
    });

    it('should be able to map a LazyCollection (parallel)', async function(done) {
      var rets = await this.collection.map(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
        return { index: item.index, time: item.time, hello: `world@${item.index}` };
      }, { sequential: false });

      expect(rets).toBeType(Array);
      rets.forEach((item, index) => this.testMappedItem(item, index));

      // Make sure none of the values have changed
      this.verifyIndex = 0;
      await this.collection.forEach(async (item, i) => {
        this.verifyCollectionIntegrity(item, i);
        expect(item.hello).toBeTheSame(undefined);
      }, { sequential: false });

      done();
    });

    it('should be able to access LazyCollection items directly', async function(done) {
      expect(this.collection.length).toBeTheSame(5);

      var item = await this.collection.index(4);
      expect(item.index).toBeTheSame(4);

      var item = await this.collection.index(1);
      expect(item.index).toBeTheSame(1);

      var item = await this.collection.index(0);
      expect(item.index).toBeTheSame(0);

      var item = await this.collection.index(3);
      expect(item.index).toBeTheSame(3);

      var item = await this.collection.index(2);
      expect(item.index).toBeTheSame(2);

      var item = await this.collection.first();
      expect(item.index).toBeTheSame(0);

      var item = await this.collection.last();
      expect(item.index).toBeTheSame(4);

      done();
    });
  });
});
