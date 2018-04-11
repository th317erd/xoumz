module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, equal } = requireModule('./base/utils');

  class LazyItem {
    constructor(item) {
      definePropertyRW(this, '_loading', null);

      if (item instanceof LazyItem) {
        this._loading = item._loading;

        if (item.hasOwnProperty('_result'))
          definePropertyRO(this, '_result', item._result);

        definePropertyRO(this, '_fetch', item._fetch);
      } else if (typeof item !== 'function') {
        definePropertyRO(this, '_result', item);
      } else {
        definePropertyRO(this, '_fetch', item);
      }
    }

    async fetch() {
      if (this.hasOwnProperty('_result'))
        return this._result;

      if (this._loading)
        return await this._loading;

      var loading = this._loading = this._fetch(),
          result = await loading;

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

  function convertToLazyItems(src, dst, method = 'push') {
    var items = dst,
        oldLength = dst.length;

    for (var item of src.values()) {
      // If item isn't a lazy item, then make it one...
      if (!(item instanceof LazyItem))
        item = new LazyItem(item);

      items[method](item);
    }

    if (this._items === dst)
      updateIndices.call(this, oldLength);

    return dst;
  }

  function updateIndices(oldLength) {
    function createIndexKey(index) {
      Object.defineProperty(this, i, {
        enumerable: true,
        configurable: true,
        get: () => this.index(index),
        set: (val) => {
          this._items[index] = new LazyItem(val);
          return val;
        }
      });
    }

    // Add new index properties
    for (var i = oldLength, il = this._items.length; i < il; i++)
      createIndexKey.call(this, i);

    // Remove old index properties
    for (var i = this._items.length, il = oldLength; i < il; i++)
      delete this[i];
  }

  class LazyCollection {
    static from(iterable) {
      var collection = new LazyCollection();
      convertToLazyItems.call(collection, iterable, collection._items);
      return collection;
    }

    static of(...args) {
      return LazyCollection.from(...args);
    }

    constructor(...incomingItems) {
      var items = convertToLazyItems.call(this, Array.prototype.concat.apply([], incomingItems), []);

      definePropertyRW(this, 'length', undefined, () => items.length, (set) => {
        if (!set)
          return;

        for (var i = set, il = items.length; i < il; i++)
          items[i] = null;

        items.length = set;
      });

      definePropertyRW(this, '_items', items);
      definePropertyRW(this, '_mutator', null);
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

    concat(...concatItems) {
      return new LazyCollection(this._items.concat(concatItems));
    }

    push(...args) {
      convertToLazyItems.call(this, args, this._items);
      return this._items.length;
    }

    unshift(...args) {
      convertToLazyItems.call(this, args, this._items, 'unshift');
      return this._items.length;
    }

    async pop() {
      var ret = this.last(),
          oldLength = this._items.length;

      this._items.pop();
      updateIndices.call(this, oldLength);

      return await ret;
    }

    async shift() {
      if (!this._items.length)
        return;

      var ret = this.first(),
          oldLength = this._items.length;

      this._items.shift();
      updateIndices.call(this, oldLength);

      return await ret;
    }

    slice(...args) {
      return new LazyCollection(this._items.slice(...args));
    }

    splice(start, deleteCount, ...args) {
      var oldLength = this._items.length,
          removedItems = this._items.splice(start, deleteCount),
          insertItems = convertToLazyItems(args, []);

      this._items.splice(start, 0, insertItems);
      updateIndices.call(this, oldLength);

      return new LazyCollection(removedItems);
    }

    async indexOf(searchElement, fromIndex, reverse) {
      for (var [ index, value ] of this.entries(true, fromIndex, reverse)) {
        var item = await value;

        if (equal(item, searchElement))
          return index;
      }

      return -1;
    }

    async lastIndexOf(searchElement, fromIndex) {
      return await this.indexOf(searchElement, fromIndex, true);
    }

    async includes(searchElement, fromIndex) {
      var index = await this.indexOf(searchElement, fromIndex);
      return (index >= 0);
    }

    async forEach(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        callback.call(thisArg, item, index, this);
      }
    }

    async filter(callback, thisArg) {
      var newItems = [];
      for (var [ index, value, lazyItem ] of this.entries(true)) {
        var item = await value,
            keep = callback.call(thisArg, item, index, this);

        if (keep)
          newItems.push(lazyItem);
      }

      return new LazyCollection(newItems);
    }

    async every(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (!valid)
          return false;
      }

      return true;
    }

    async some(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (valid)
          return true;
      }

      return false;
    }

    async reduce(callback, _initial) {
      var initial = _initial;
      if (arguments.length === 1) {
        if (!this._items.length)
          throw new TypeError('Reduce of empty array with no initial value');

        initial = await this.index(0);
      }

      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            initial = callback(initial, item, index, this);
      }

      return initial;
    }

    async reduceRight(callback, _initial) {
      var initial = _initial;
      if (arguments.length === 1) {
        if (!this._items.length)
          throw new TypeError('Reduce of empty array with no initial value');

        initial = await this.index(0);
      }

      for (var [ index, value ] of this.entries(true, 0, true)) {
        var item = await value,
            initial = callback(initial, item, index, this);
      }

      return initial;
    }

    toString() {
      return `LazyCollection[${this._items.length}]`;
    }

    toLocaleString() {
      return this.toString();
    }

    async join(...args) {
      var finalItems = new Array(this._items.length);
      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        finalItems[index] = item;
      }

      return finalItems.join(...args);
    }

    reverse() {
      this._items.reverse();
      return this;
    }

    async sort(_callback) {
      // Request load of every item
      var promises = [];
      for (var i = 0, il = this._items.length; i < il; i++)
        promises.push(this.index(i));

      // Wait for loading to finish
      await Promise.all(promises);

      // Sort items
      var callback = (_callback instanceof Function) ? _callback : null;
      this._items.sort((a, b) => {
        var x = a.value(),
            y = b.value();

        if (!callback)
          return (x == y) ? 0 : (x < y) ? -1 : 1;

        return callback(x, y);
      });

      return this;
    }

    async find(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (!valid)
          return item;
      }
    }

    async findIndex(callback, thisArg) {
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            valid = callback.call(thisArg, item, index, this);

        if (!valid)
          return index;
      }

      return -1;
    }

    *entries(parallel, fromIndex, reverse) {
      var items = this._items;

      // Load all items at once if this is a parallel operation
      if (parallel) {
        for (var i = fromIndex, il = items.length; i < il; i++)
          this.index(i);
      }

      if (reverse) {
        let startIndex = (fromIndex === undefined) ? items.length - 1 : fromIndex;
        if (startIndex < 0)
          startIndex = 0;

        if (startIndex >= items.length)
          startIndex = items.length;

        for (let i = startIndex; i >= 0; i--)
          yield [ i, this.index(i), this._items[i] ];
      } else {
        let startIndex = (fromIndex === undefined) ? 0 : fromIndex;
        if (startIndex < 0)
          startIndex = 0;

        if (startIndex >= items.length)
          startIndex = items.length;

        for (let i = startIndex, il = items.length; i < il; i++)
          yield [ i, this.index(i), this._items[i] ];
      }
    }

    *keys(fromIndex = 0) {
      var items = this._items;
      for (var i = fromIndex, il = items.length; i < il; i++)
        yield i;
    }

    *values(parallel, fromIndex = 0) {
      for (var [ _, value ] of this.entries(parallel, fromIndex))
        yield value;
    }

    *[Symbol.iterator]() {
      yield* this.entries(true);
    }

    async map(callback, thisArg) {
      var newValues = new Array(this._items.length);
      for (var [ index, value ] of this.entries(true)) {
        var item = await value,
            newValue = callback.call(thisArg, item, index, this);

        newValues[index] = newValue;
      }

      return new LazyCollection(newValues);
    }

    async index(offset) {
      if (offset < 0 || offset >= this.length)
        return;

      var lazyItem = this._items[offset],
          item = (lazyItem.loaded()) ? lazyItem.value() : await lazyItem.fetch();

      return this.mutateItem(item, offset);
    }

    first() {
      if (!this.length)
        return;

      return this.index(0);
    }

    last() {
      if (!this.length)
        return;

      return this.index(this._items.length - 1);
    }

    async all() {
      var newValues = new Array(this._items.length);

      for (var [ index, value ] of this.entries(true)) {
        var item = await value;
        newValues[index] = item;
      }

      return newValues;
    }
  }

  Object.assign(root, {
    LazyItem,
    LazyCollection
  });
};
