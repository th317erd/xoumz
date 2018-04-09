module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, equal } = requireModule('./base/utils');

  class LazyItem {
    constructor(item) {
      definePropertyRW(this, '_loading', null);

      if (!(item instanceof Function))
        definePropertyRO(this, '_result', item);
      else
        definePropertyRO(this, '_fetch', item);
    }

    async fetch() {
      if (this._loading)
        return await this._loading;

      if (this.hasOwnProperty('_result'))
        return this._result;

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
    var items = dst;

    for (var item of src.values()) {
      // If item isn't a lazy item, then make it one...
      if (!(item instanceof LazyItem))
        item = new LazyItem(item);

      items[method](item);
    }

    updateIndices.call(this);

    return dst;
  }

  function updateIndices() {

  }

  class LazyCollection {
    constructor(...incomingItems) {
      var items = convertToLazyItems.call(this, incomingItems, []);

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

    static from(arr) {
      var collection = new LazyCollection();
      convertToLazyItems.call(this, arr, collection._items);
      return collection;
    }

    concat(...concatItems) {
      return new LazyCollection([].concat(concatItems));
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
      var ret = this.last();
      this._items.pop();
      updateIndices.call(this);
      return await ret;
    }

    async shift() {
      var ret = this.first();
      this._items.shift();
      updateIndices.call(this);
      return await ret;
    }

    slice(...args) {
      var newCollection = new LazyCollection();
      newCollection._items = this._items.slice(...args);
      updateIndices.call(newCollection);
      return newCollection;
    }

    splice(start, deleteCount, ...args) {
      var removedItems = this._items.splice(start, deleteCount),
          insertItems = convertToLazyItems.call(this, args, []);

      this._items.splice(start, 0, insertItems);
      updateIndices.call(this);

      return new LazyCollection(removedItems);
    }

    async indexOf(searchElement, fromIndex) {
      for (var [ index, value ] of this.entries(true, fromIndex)) {
        var item = await value;

        if (equal(item, searchElement))
          return index;
      }

      return -1;
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

    async join(sep) {
      var finalItems = new Array(this._items.length);
      for (var [ index, value ] of this.entries(true, 0, true)) {
        var item = await value;
        finalItems[index] = item;
      }

      return finalItems.join(sep);
    }

    reverse() {
      this._items.reverse();
      return this;
    }

    sort() {
    }

    lastIndexOf() {
    }

    copyWithin() {
    }

    find() {
    }

    findIndex() {
    }

    fill() {
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

    map(cb, _opts) {

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
