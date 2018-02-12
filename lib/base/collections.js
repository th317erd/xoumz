module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');

  class LazyItem {
    constructor(item) {
      if (!(item instanceof Function))
        definePropertyRO(this, '_result', item);
      else
        definePropertyRO(this, '_fetch', item);
    }

    async fetch() {
      if (this.hasOwnProperty('_result'))
        return this._result;

      var result = await this._fetch();
      definePropertyRO(this, '_result', result);
      return result;
    }

    loaded() {
      return this.hasOwnProperty('_result');
    }

    value() {
      return this._result;
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
      definePropertyRW(this, '_mutator', null);
    }

    concat(...concatItems) {
      return new LazyCollection([].concat(concatItems));
    }

    itemMutator(cb) {
      if (!(cb instanceof Function))
        throw new Error('LazyCollection item mutator must be a function');

      var func = this._mutator;
      definePropertyRW(this, '_mutator', (_item, index) => {
        var item = (func instanceof Function) ? func.call(this, _item, index) : _item;
        return cb.call(this, item, index);
      });

      return this._mutator;
    }

    mutateItem(item, index) {
      var mutator = this._mutator;
      return (mutator instanceof Function) ? mutator.call(this, item, index) : item;
    }

    push(...items) {
      addToLazyCollection.call(this, items, this._items);
      return this.length;
    }

    forEach(cb, _opts) {
      this.map(cb, _opts);
    }

    map(cb, _opts) {
      async function mapSequential() {
        var rets = new Array(items.length);
        for (var i = 0, il = items.length; i < il; i++) {
          var item = await this.index(i);
          rets[i] = await cb.call(this, item, i);
        }

        return rets;
      }

      async function mapParallel() {
        var rets = new Array(items.length);
        for (var i = 0, il = items.length; i < il; i++)
          rets[i] = this.index(i);

        rets = (await Promise.all(rets)).map((item, i) => cb.call(this, item, i));
        return await Promise.all(rets);
      }

      function onlyLoaded() {
        var rets = [];
        for (var i = 0, il = items.length; i < il; i++) {
          var lazyItem = this._items[i];
          if (!lazyItem.loaded())
            continue;

          rets.push(this.mutateItem(lazyItem.value(), i));
        }
      }

      var opts = _opts || {},
          sequential = (opts.sequential === true),
          items = this._items;

      if (opts.onlyLoaded)
        return onlyLoaded.call(this);

      return (sequential) ? mapSequential.call(this) : mapParallel.call(this);
    }

    async index(offset) {
      if (offset < 0 || offset >= this.length)
        return;

      var lazyItem = this._items[offset],
          item = (lazyItem.loaded()) ? lazyItem.value() : await lazyItem.fetch();

      return this.mutateItem(item, offset);
    }

    async first() {
      if (!this.length)
        return;

      return await this.index(0);
    }

    async last() {
      if (!this.length)
        return;

      return await this.index(this._items.length - 1);
    }

    async all(_opts) {
      if (!this.length)
        return [];

      return await this.map((item) => item, _opts);
    }
  }

  Object.assign(root, {
    LazyItem,
    LazyCollection
  });
};
