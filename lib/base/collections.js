module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');

  class LazyItem {
    constructor(_item) {
      var item = _item;
      if (!(item instanceof Function))
        item = () => item;

      definePropertyRO(this, '_fetch', item);
    }

    async fetch() {
      if (this.hasOwnProperty('_result'))
        return this._result;

      var result = await this._fetch();
      definePropertyRO(this, '_result', result);
      return result;
    }
  }

  function addToLazyCollection(src, dst) {
    var items = dst;

    for (var i = 0, il = src.length; i < il; i++) {
      var item = src[i];

      // If item isn't a lazy item, then make it one...
      if (!(item instanceof LazyItem))
        item = new LazyItem(item);

      items.push(item);
    }

    return dst;
  }

  class LazyCollection {
    static from(arr) {
      var collection = new LazyCollection();
      addToLazyCollection.call(this, arr, collection._items);
      return collection;
    }

    constructor(...incomingItems) {
      var items = addToLazyCollection.call(this, incomingItems, []);

      definePropertyRW(this, 'length', undefined, () => items.length, (set) => {
        if (!set)
          return;

        for (var i = set, il = items.length; i < il; i++)
          items[i] = null;

        items.length = set;
      });

      definePropertyRO(this, '_items', items);
    }

    concat(...concatItems) {
      var finalItems = [].concat(concatItems);
      return new LazyCollection(finalItems);
    }

    push(...items) {
      addToLazyCollection.call(this, items, this._items);
      return this.length;
    }

    async forEach(cb, _sequential) {
      await this.map(cb, _sequential);
    }

    map(cb, _sequential) {
      async function mapSequential() {
        for (var i = 0, il = items.length; i < il; i++) {
          var item = items[i].fetch();

          item = await item;
          rets[i] = await cb.call(this, item, i);
        }

        return rets;
      }

      async function mapParallel(item, i) {
        for (var i = 0, il = items.length; i < il; i++)
          rets[i] = items[i].fetch();

        rets = (await Promise.all(rets)).map((item, i) => cb.call(this, item, i));
        return await Promise.all(rets);
      }

      var sequential = (_sequential === false),
          items = this._items,
          rets = new Array(items.length);

      return (sequential) ? mapSequential.call(this) : mapParallel.call(this);
    }

    async index(offset) {
      if (offset < 0 || offset >= this.length)
        return;

      return await this._items[offset].fetch();
    }

    async first() {
      if (!this.length)
        return;

      return await this._items[0].fetch();
    }

    async last() {
      if (!this.length)
        return;

      return await this._items[this._items.length - 1].fetch();
    }
  }

  Object.assign(root, {
    LazyItem,
    LazyCollection
  });
};
