describe('LazyCollection', function() {
  beforeEach(function() {
    //jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000000;

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

    this.verifyItemIntegrity = (item, index) => {
      expect(item.index).toBeTheSame(index);
    };

    this.resetIntegrityCheck = () => {
      this.verifyIndex = 0;
    };

    this.asyncOp = () => {
      var index = this.asyncOpIndex++,
          t = 10 + (Math.random() * 40);

      return () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ index, time: t });
          }, t);
        });
      };
    };

    var collection = this.collection = new LazyCollection(),
        items = this.items = [];

    for (var i = 0, il = 5; i < il; i++) {
      var item = this.asyncOp();
      items.push(item);
      collection.push(item);
    }
  });

  it('should be able to be constructed from "from"', async function(done) {
    var collection = this.LazyCollection.from(this.items);
    var ret = await collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));

    expect(ret).toBe(undefined);

    done();
  });

  it('should be able to be constructed from "of"', async function(done) {
    var collection = this.LazyCollection.of(...this.items);
    var ret = await collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);

    this.resetIntegrityCheck();

    var collection = this.LazyCollection.of(
      { index: 0 },
      { index: 1 },
      { index: 2 }
    );

    var ret = await collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);

    done();
  });

  it('should be able to use concat', async function(done) {
    var ret = await this.collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);

    this.resetIntegrityCheck();

    var collection = this.LazyCollection.of(
      { index: this.asyncOpIndex },
      { index: this.asyncOpIndex + 1 },
      { index: this.asyncOpIndex + 2 }
    );

    var newCollection = this.collection.concat(collection);
    var ret = await newCollection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);
    expect(newCollection.length).toBe(8);

    done();
  });

  it('should be able to use push', async function(done) {
    this.collection.push(this.asyncOp());
    this.collection.push(this.asyncOp());
    this.collection.push(this.asyncOp(), this.asyncOp(), this.asyncOp());

    var ret = await this.collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);
    expect(this.collection.length).toBe(10);

    done();
  });

  it('should be able to use unshift', async function(done) {
    var c = this.collection;

    // Insert 5
    c.unshift(this.asyncOp());

    // Insert 6
    c.unshift(this.asyncOp());

    // Insert 7, 8, 9
    c.unshift(this.asyncOp(), this.asyncOp(), this.asyncOp());

    this.verifyItemIntegrity(await c.index(0), 7);
    this.verifyItemIntegrity(await c.index(1), 8);
    this.verifyItemIntegrity(await c.index(2), 9);
    this.verifyItemIntegrity(await c.index(3), 6);
    this.verifyItemIntegrity(await c.index(4), 5);
    this.verifyItemIntegrity(await c.index(5), 0);
    this.verifyItemIntegrity(await c.index(6), 1);
    this.verifyItemIntegrity(await c.index(7), 2);
    this.verifyItemIntegrity(await c.index(8), 3);
    this.verifyItemIntegrity(await c.index(9), 4);

    expect(c.length).toBe(10);

    done();
  });

  it('should be able to use pop', async function(done) {
    var c = this.collection;

    this.verifyItemIntegrity(await c.pop(), 4);
    expect(c.length).toBe(4);

    this.verifyItemIntegrity(await c.pop(), 3);
    expect(c.length).toBe(3);

    this.verifyItemIntegrity(await c.pop(), 2);
    expect(c.length).toBe(2);

    this.verifyItemIntegrity(await c.pop(), 1);
    expect(c.length).toBe(1);

    this.verifyItemIntegrity(await c.pop(), 0);
    expect(c.length).toBe(0);

    expect(await c.pop()).toBe(undefined);

    done();
  });

  it('should be able to use shift', async function(done) {
    var c = this.collection;

    this.verifyItemIntegrity(await c.shift(), 0);
    expect(c.length).toBe(4);

    this.verifyItemIntegrity(await c.shift(), 1);
    expect(c.length).toBe(3);

    this.verifyItemIntegrity(await c.shift(), 2);
    expect(c.length).toBe(2);

    this.verifyItemIntegrity(await c.shift(), 3);
    this.verifyItemIntegrity(await c.shift(), 4);
    expect(c.length).toBe(0);

    expect(await c.shift()).toBe(undefined);

    done();
  });

  it('should be able to use slice', async function(done) {
    var c = this.collection,
        newCollection1 = this.collection.slice(2),
        newCollection2 = this.collection.slice(1, 3);

    var ret = await this.collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);
    expect(this.collection.length).toBe(5);

    this.verifyIndex = 2;
    var ret = await newCollection1.forEach((item, i) => this.verifyCollectionIntegrity(item, i + 2));
    expect(ret).toBe(undefined);
    expect(newCollection1.length).toBe(3);

    this.verifyIndex = 1;
    var ret = await newCollection2.forEach((item, i) => this.verifyCollectionIntegrity(item, i + 1));
    expect(ret).toBe(undefined);
    expect(newCollection2.length).toBe(2);

    done();
  });

  it('should be able to use splice', async function(done) {
    var c = this.collection;
    expect(c.length).toBe(5);

    var newCollection = await c.splice(1, 1);
    this.verifyItemIntegrity(await newCollection.index(0), 1);
    expect(c.length).toBe(4);
    expect(newCollection.length).toBe(1);

    newCollection = await c.splice(2, 0, this.asyncOp(), this.asyncOp());
    expect(c.length).toBe(6);
    expect(newCollection.length).toBe(0);

    this.verifyItemIntegrity(await c.index(0), 0);
    this.verifyItemIntegrity(await c.index(1), 2);
    this.verifyItemIntegrity(await c.index(2), 5);
    this.verifyItemIntegrity(await c.index(3), 6);
    this.verifyItemIntegrity(await c.index(4), 3);
    this.verifyItemIntegrity(await c.index(5), 4);

    done();
  });

  it('should be able to iterate a LazyCollection', async function(done) {
    var ret = await this.collection.forEach((item, i) => {
      this.verifyCollectionIntegrity(item, i);
    });

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
    });

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
