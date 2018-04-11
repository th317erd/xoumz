describe('LazyCollection', function() {
  beforeEach(function() {
    const { LazyCollection } = this.app.requireModule('./base/collections');

    this.LazyCollection = LazyCollection;

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

    var collection = this.collection = new LazyCollection();
    for (var i = 0, il = 5; i < il; i++)
      collection.push(this.asyncOp());
  });

  it('should be able to iterate a LazyCollection', async function(done) {
    var ret = await this.collection.forEach((item, i) => {
      this.verifyCollectionIntegrity(item, i);
    });

    expect(ret).toBeTheSame(undefined);

    done();
  });

  it('should be able to iterate a LazyCollection (parallel)', async function(done) {
    var ret = await this.collection.forEach((item, i) => {
      this.verifyCollectionIntegrity(item, i);
    }, { sequential: false });

    expect(ret).toBeTheSame(undefined);

    done();
  });

  it('should be able to map a LazyCollection', async function(done) {
    var rets = await this.collection.map((item, i) => {
      this.verifyCollectionIntegrity(item, i);
      return { index: item.index, time: item.time, hello: `world@${item.index}` };
    });

    expect(rets).toBeType(this.LazyCollection);
    await rets.forEach((item, index) => this.testMappedItem(item, index));

    // Make sure none of the values have changed
    this.verifyIndex = 0;
    await this.collection.forEach((item, i) => {
      this.verifyCollectionIntegrity(item, i);
      expect(item.hello).toBeTheSame(undefined);
    }, { sequential: true });

    done();
  });

  it('should be able to map a LazyCollection (parallel)', async function(done) {
    var rets = await this.collection.map((item, i) => {
      this.verifyCollectionIntegrity(item, i);
      return { index: item.index, time: item.time, hello: `world@${item.index}` };
    }, { sequential: false });

    expect(rets).toBeType(this.LazyCollection);
    await rets.forEach((item, index) => this.testMappedItem(item, index));

    // Make sure none of the values have changed
    this.verifyIndex = 0;
    await this.collection.forEach((item, i) => {
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
