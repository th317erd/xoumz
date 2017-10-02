var cacheIDCounter = 1;

class SelectorEngine {
  constructor() {
    Object.defineProperty(this, '_cache', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: {}
    });
  }

  isCacheInvalid(cacheKey, value) {
    if (!this._cache.hasOwnProperty(cacheKey))
      return true;
    
    var cachedValue = this._cache[cacheKey];

    if (cachedValue instanceof Array && value instanceof Array) {
      if (cachedValue.length !== value.length)
        return true;

      for (var i = 0, il = cachedValue.length; i < il; i++) {
        if (cachedValue[i] !== value[i])
          return true;
      }
    } else {
      return (cachedValue !== value);
    }

    return false;
  }

  cacheGet(cacheKey) {
    return this._cache[cacheKey];
  }

  cacheSet(cacheKey, value) {
    this._cache[cacheKey] = value;
    return value;
  }

  create(...args) {
    if (args.length < 2)
      throw new Error('Transmutor must have at least two arguments (one getter, one resolver)');

    var getters = args.slice(0, args.length - 1),
        resolver = args[args.length - 1],
        cacheID = (cacheIDCounter++),
        paramsCacheKey = cacheID + 'params',
        resultCacheKey = cacheID + 'result',
        selectorContext = Object.create(this, {
          cacheID: { writable: false, enumerable: false, configurable: false, value: cacheID },
          paramsCacheKey: { writable: false, enumerable: false, configurable: false, value: paramsCacheKey },
          resultCacheKey: { writable: false, enumerable: false, configurable: false, value: resultCacheKey },
          cachedResult: { writable: false, enumerable: false, configurable: false, value: () => this.cacheGet(resultCacheKey) }
        });

    if (!(resolver instanceof Function))
      throw new Error('Transmutor resolver must be a function');
    
    for (var i = 0, il = getters.length; i < il; i++) {
      if (!(getters[i] instanceof Function))
        throw new Error('Transmutor getter must be a function');
    }
    
    return (function(...params) {
      if (!this.isCacheInvalid(paramsCacheKey, params))
        return this.cacheGet(resultCacheKey);
      
      this.cacheSet(paramsCacheKey, params);
      var hasPromise = false,
          values = new Array(getters.length);
          
      for (var j = 0, jl = getters.length; j < jl; j++) {
        var getter = getters[j],
            value = getter.apply(this, params);
        
        if (!hasPromise && (value instanceof Promise))
          hasPromise = true;
        
        values[j] = value;
      }

      if (hasPromise) {
        return new Promise((resolve, reject) => {
          Promise.all(values).then((results) => {
            var ret = resolver.apply(this, results);
            this.cacheSet(resultCacheKey, ret)

            if (ret instanceof Promise) {
              ret.then(resolve, reject);
            } else {
              resolve(ret);
            }
          });
        });
      } else {
        return this.cacheSet(resultCacheKey, resolver.apply(this, values));
      }
    }).bind(selectorContext);
  }
}

module.exports = Object.assign(module.exports, {
  SelectorEngine
});
