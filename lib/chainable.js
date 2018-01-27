module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const Logger = requireModule('./logger');

  function chainableProxy(_target) {
    var target = _target || this;

    var thisProxy = new Proxy(this, {
        get: (me, key) => {
          if (typeof key !== 'string' && !(key instanceof String))
            return target[key];

          if (key in target) {
            var prop = target[key];

            if (prop instanceof Function) {
              var ret = prop.call(target);
              if (ret === target || ret === undefined)
                ret = thisProxy;

              if (ret && ret !== thisProxy)
                return ret;

              return chainableProxy.call(prop, target);
            }

            return prop;
          }

          return target._getter.call(target, key);
        },
        set: function(target, property, value, receiver) {
          throw new Error('Can not set a property on chainable. Try again!');
        },
        apply: (me, thisArg, args) => {
          var ret = me.apply(target, args);
          if (ret === target || ret === undefined)
            ret = thisProxy;

          if (ret && ret !== thisProxy)
            return ret;

          return ret;
        }
      }
    );

    definePropertyRW(this, '_chainable', thisProxy);

    return thisProxy;
  }

  class Chainable {
    constructor() {
      return chainableProxy.call(this);
    }

    _getter(key) {
      Logger.warn(`Unhandled key in chainable: [${key}]`);
      return this;
    }
  }

  Object.assign(root, {
    chainableProxy,
    Chainable
  });
};
