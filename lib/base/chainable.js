const util = require('util');

module.exports = function(root, requireModule) {
  function getChainableConsumerContext(context = '*') {
    if (!this._contexts.hasOwnProperty(context)) {
      var newContext = {};
      Object.defineProperty(this._contexts, context, {
        writable: false,
        enumerable: true,
        configurable: false,
        value: newContext
      });

      var template = this._template;
      if (template && context === '*' && template.entries instanceof Function) {
        for (var [ key, value ] of template.entries())
          newContext[key] = value;
      }

      Object.defineProperty(newContext, '_name', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: context
      });
    }

    return this._contexts[context];
  }

  function chainableConsumerPropHelper(isGet, context, target, key, _value, proxy) {
    if (key in target) {
      var val = target[key];
      return (val instanceof Function) ? val.bind(target) : val;
    }

    if (typeof key === 'symbol')
      return target[key];

    if (target._done)
      throw new Error('Can not continue with chainable: chainable has been finalized');

    var value = (isGet) ? true : _value,
        native = target.constructor.prototype[`$${key}`];

    if (!(native instanceof Function))
      native = target.constructor.prototype['$_default'];

    if (native instanceof Function) {
      native.call(target, target._contexts[context]);
      return chainableConsumerProxy(target, native, context);
    } else {
      target._contexts[context][key] = value;
    }

    return proxy;
  }

  function chainableConsumerProxy(target, callFunc, context = '*') {
    // Create context
    getChainableConsumerContext.call(target, context);

    return new Proxy((callFunc instanceof Function) ? callFunc : target, {
      get: (_, key, proxy) => chainableConsumerPropHelper(true, context, target, key, undefined, proxy),
      set: (_, key, value, proxy) => chainableConsumerPropHelper(false, context, target, key, value, proxy),
      apply: (_, thisArg, argumentList) => {
        if (!(callFunc instanceof Function))
          throw new Error('Unable to call object');

        var ret = callFunc.call(target, target._contexts[context], ...argumentList);
        return (!ret || ret === target) ? chainableConsumerProxy(target, undefined, context) : ret;
      }
    });
  }

  class ChainableConsumer {
    chainableConsumerProxy(...args) {
      return chainableConsumerProxy(...args);
    }

    start(template) {
      Object.defineProperty(this, '_done', {
        writable: true,
        enumerable: false,
        configurable: false,
        value: false
      });

      Object.defineProperty(this, '_template', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: template
      });

      Object.defineProperty(this, '_contexts', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: {}
      });

      return chainableConsumerProxy(this);
    }

    finalize() {
      this._done = true;
      return this;
    }

    getProp(propName, _opts) {
      var opts = (typeof _opts === 'string' || _opts instanceof String) ? { context: _opts.valueOf() } : (_opts || {}),
          specifiedContext = this._contexts[opts.context || '*'],
          propValue = (!specifiedContext || !specifiedContext.hasOwnProperty(propName)) ? this._contexts['*'][propName] : specifiedContext[propName];

      if (opts.unwind && propValue instanceof Function)
        propValue = propValue.call(opts.parent || {}, propName, this);

      return propValue;
    }

    *keys(context = '*') {
      var thisContext = getChainableConsumerContext.call(this, context),
          keys = Object.keys(thisContext);

      for (var i = 0, il = keys.length; i < il; i++)
        yield keys[i];
    }

    *values(context = '*') {
      var thisContext = getChainableConsumerContext.call(this, context),
          keys = Object.keys(thisContext);

      for (var i = 0, il = keys.length; i < il; i++)
        yield thisContext[keys[i]];
    }

    *entries(context = '*') {
      var thisContext = getChainableConsumerContext.call(this, context),
          keys = Object.keys(thisContext);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            value = thisContext[key];

        yield [ key, value ];
      }
    }

    [Symbol.iterator]() {
      return this.entries();
    }

    [util.inspect.custom]() {
      return this._contexts;
    }
  }

  class Chainable {
    createProxy(...args) {
      // Dummy function for proxy
      function proxyBase() {}

      var target = this;

      return new Proxy(proxyBase, {
        get: (_, key) => {
          // Initialize
          target.initialize.apply(target, []);

          var ret = this.createNewConsumer(...args);
          return ret[key];
        },
        set: (_, key, value) => {
          // Initialize
          target.initialize.apply(target, []);

          var ret = this.createNewConsumer(...args);
          ret[key] = value;

          return ret;
        },
        apply: (_, thisArg, argList) => {
          // Initalize with arguments
          target.initialize.apply(target, argList);
          return this.createNewConsumer(...args);
        }
      });
    }

    createNewConsumer(...args) {
      var consumer = new ChainableConsumer(...args);
      return consumer.start(...args);
    }

    initialize() {
      // Child classes may want to do something with this
    }
  }

  root.export(root, {
    ChainableConsumer,
    Chainable
  });
};
