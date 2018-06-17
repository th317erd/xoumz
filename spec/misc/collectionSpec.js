describe('LazyCollection', function() {
  beforeEach(function() {
    const { LazyCollection } = this.app.requireModule('./base/collections');
    const COUNT = 5;

    this.LazyCollection = LazyCollection;

    this.asyncOpIndex = 0;
    this.asyncOpValues = new Array(COUNT);
    this.verifyIndex = 0;

    this.testMappedItem = (item, index) => {
      expect(item.index).toBeTheSame(index);
      expect(item.hello).toBeTheSame(`world@${index}`);
    };

    this.verifyCollectionIntegrity = (item, index, reverse) => {
      var i = (reverse) ? (this.collection.length - (index + 1)) : index;
      expect(i).toBeTheSame(this.verifyIndex);
      expect(item.index).toBeTheSame(this.verifyIndex);

      if (reverse)
        this.verifyIndex--;
      else
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
          t = 5 + (Math.random() * 20),
          item = { index, time: t };

      this.asyncOpValues[index] = item;

      return () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(item);
          }, t);
        });
      };
    };

    var collection = this.collection = new LazyCollection(),
        items = this.items = [];

    for (var i = 0, il = COUNT; i < il; i++) {
      var item = this.asyncOp();
      items.push(item);
      collection.push(item);
    }
  });

  it('should be able to iterate a LazyCollection', async function(done) {
    var ret = await this.collection.forEach((item, i) => {
      this.verifyCollectionIntegrity(item, i);
    });

    expect(ret).toBeTheSame(undefined);

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

    var items = await this.collection.all();
    expect(items).toBeType(Array);
    expect(items.length).toBeTheSame(5);
    expect(items[0]).toBe(this.asyncOpValues[0]);
    expect(items[1]).toBe(this.asyncOpValues[1]);
    expect(items[2]).toBe(this.asyncOpValues[2]);
    expect(items[3]).toBe(this.asyncOpValues[3]);
    expect(items[4]).toBe(this.asyncOpValues[4]);

    done();
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

  it('should be able to use indexOf', async function(done) {
    var c = this.collection;

    // Add same item to end (which shouldn't be found)
    await c.push(this.asyncOpValues[2]);

    // Find items
    expect(await c.indexOf(this.asyncOpValues[2])).toBe(2);
    expect(await c.indexOf(this.asyncOpValues[4])).toBe(4);
    expect(await c.indexOf(this.asyncOpValues[0])).toBe(0);

    // Can't find item when offset is beyond value
    expect(await c.indexOf(this.asyncOpValues[1], 2)).toBe(-1);

    // Make sure item CAN'T be found
    expect(await c.indexOf('derp')).toBe(-1);

    done();
  });

  it('should be able to use lastIndexOf', async function(done) {
    var c = this.collection;

    // Add same item to end (which should be found)
    await c.push(this.asyncOpValues[2]);

    // Find items
    expect(await c.lastIndexOf(this.asyncOpValues[2])).toBe(5);
    expect(await c.lastIndexOf(this.asyncOpValues[4])).toBe(4);
    expect(await c.lastIndexOf(this.asyncOpValues[0])).toBe(0);

    // Can't find item when offset is beyond value
    expect(await c.lastIndexOf(this.asyncOpValues[2], 4)).toBe(2);

    // Make sure item CAN'T be found
    expect(await c.lastIndexOf('derp')).toBe(-1);

    done();
  });

  it('should be able to use includes', async function(done) {
    var c = this.collection;

    expect(await c.includes(this.asyncOpValues[2])).toBe(true);
    expect(await c.includes(this.asyncOpValues[4])).toBe(true);
    expect(await c.includes('derp')).toBe(false);

    done();
  });

  it('should be able to use filter', async function(done) {
    var c = this.collection;

    // Filter out even items
    var newCollection = await c.filter((item, index) => {
      expect(item.index).toBe(index);
      return (index % 2);
    });

    expect(newCollection.length).toBe(2);
    this.verifyItemIntegrity(await newCollection.index(0), 1);
    this.verifyItemIntegrity(await newCollection.index(1), 3);

    done();
  });

  it('should be able to use every', async function(done) {
    // Should succeed
    expect(await this.collection.every((item, index) => {
      expect(item.index).toBe(index);
      return (item.time > 0);
    })).toBe(true);

    // Should fail
    expect(await this.collection.every((item, index) => {
      expect(item.index).toBe(index);
      return (item.index > 0);
    })).toBe(false);

    done();
  });

  it('should be able to use some', async function(done) {
    // Should succeed
    expect(await this.collection.some((item, index) => {
      expect(item.index).toBe(index);
      return (item.index > 2);
    })).toBe(true);

    // Should fail
    expect(await this.collection.some((item, index) => {
      expect(item.index).toBe(index);
      return (item.index > 10);
    })).toBe(false);

    done();
  });

  it('should be able to use reduce', async function(done) {
    expect(await this.collection.reduce((sum, item, index) => {
      expect(item.index).toBe(index);
      return sum * (sum * (item.index + 1));
    }, 1)).toBe(1658880);

    expect(await this.collection.reduce((_sum, item, index) => {
      expect(item.index).toBe(index);

      var sum = _sum;
      if (typeof sum !== 'number')
        sum = sum.index;

      return (sum + 1) * ((sum + 1) * (item.index + 1));
    })).toBe(49203845);

    try {
      var newCollection = new this.LazyCollection();
      await newCollection.reduce(() => 0);
      fail('Reduce call should have failed');
    } catch (e) {
      expect(e.message).toBe('Reduce of empty array with no initial value');
    }

    done();
  });

  it('should be able to use reduceRight', async function(done) {
    expect(await this.collection.reduceRight((sum, item, index) => {
      expect(item.index).toBe(index);
      return sum * (sum * (item.index + 1));
    }, 1)).toBe(3240000000000000000);

    expect(await this.collection.reduceRight((_sum, item, index) => {
      expect(item.index).toBe(index);

      var sum = _sum;
      if (typeof sum !== 'number')
        sum = sum.index;

      return (sum + 1) * ((sum + 1) * (item.index + 1));
    })).toBe(3508914329163994600);

    try {
      var newCollection = new this.LazyCollection();
      await newCollection.reduceRight(() => 0);
      fail('Reduce call should have failed');
    } catch (e) {
      expect(e.message).toBe('Reduce of empty array with no initial value');
    }

    done();
  });

  it('should be able to use join', async function(done) {
    var newCollection = new this.LazyCollection('a', 'b', 'c', 'd');

    expect(await newCollection.join()).toBe('a,b,c,d');
    expect(await newCollection.join('-')).toBe('a-b-c-d');
    expect(await newCollection.join(' ')).toBe('a b c d');
    expect(await newCollection.join('_derp_')).toBe('a_derp_b_derp_c_derp_d');

    done();
  });

  it('should be able to use reverse', async function(done) {
    var newCollection = new this.LazyCollection('a', 'b', 'c', 'd');

    expect(await newCollection.reverse().join()).toBe('d,c,b,a');
    expect(await newCollection.join('-')).toBe('d-c-b-a');
    expect(await newCollection.reverse().join(' ')).toBe('a b c d');
    expect(await newCollection.join('_derp_')).toBe('a_derp_b_derp_c_derp_d');

    done();
  });

  it('should be able to use sort', async function(done) {
    await this.collection.sort((a, b) => {
      var x = a.index,
          y = b.index;

      return (x == y) ? 0 : (x < y) ? 1 : -1;
    });

    this.verifyIndex = 4;
    var ret = await this.collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i, true));
    expect(ret).toBe(undefined);

    await this.collection.sort((a, b) => {
      var x = a.index,
          y = b.index;

      return (x == y) ? 0 : (x < y) ? -1 : 1;
    });

    this.verifyIndex = 0;
    var ret = await this.collection.forEach((item, i) => this.verifyCollectionIntegrity(item, i));
    expect(ret).toBe(undefined);

    done();
  });

  it('should be able to use find', async function(done) {
    expect(await this.collection.find((item) => (item.index === 2))).toBe(this.asyncOpValues[2]);
    expect(await this.collection.find((item) => (item.index === 4))).toBe(this.asyncOpValues[4]);
    expect(await this.collection.find((item) => (item.index === 0))).toBe(this.asyncOpValues[0]);
    expect(await this.collection.find((item) => (item.index === -1))).toBe(undefined);

    done();
  });

  it('should be able to use findIndex', async function(done) {
    expect(await this.collection.findIndex((item) => (item.index === 2))).toBe(2);
    expect(await this.collection.findIndex((item) => (item.index === 4))).toBe(4);
    expect(await this.collection.findIndex((item) => (item.index === 0))).toBe(0);
    expect(await this.collection.findIndex((item) => (item.index === -1))).toBe(-1);

    done();
  });

  it('should be able to access by key', async function(done) {
    var c = this.collection;

    expect(await c[0]).toBe(this.asyncOpValues[0]);
    expect(await c[1]).toBe(this.asyncOpValues[1]);
    expect(await c[2]).toBe(this.asyncOpValues[2]);
    expect(await c[3]).toBe(this.asyncOpValues[3]);
    expect(await c[4]).toBe(this.asyncOpValues[4]);
    expect(await c[5]).toBe(undefined);

    // Delete an item
    await c.splice(4, 1);
    expect(await c[4]).toBe(undefined);

    // Make sure index keys have been updated
    var keys = Object.keys(c);
    expect(keys).toBeType(Array);
    expect(keys.length).toBe(4);

    done();
  });
});
