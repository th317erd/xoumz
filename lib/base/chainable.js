const util = require('util');

module.exports = function(root, requireModule) {
  // This ensures the context being used exists
  // If it is the base context is is pre-filled with the template (if any)
  function getChainableConsumerContext(context = '*') {
    if (!this._contexts.hasOwnProperty(context)) {
      var newContext = {};
      Object.defineProperty(this._contexts, context, {
        writable: true,
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

  // This is the proxy getter / setter
  function chainableConsumerPropHelper(isGet, context, target, key, _value, proxy) {
    // If what is being asked for exists on the target than return it
    if (key in target) {
      var val = target[key];
      return (val instanceof Function) ? val.bind(target) : val;
    }

    // If what is being asked for is a symbol than return it
    if (typeof key === 'symbol' || key.charAt(0) === '_')
      return target[key];

    // if (key === 'prototype') {
    //   debugger;
    //   return target.constructor.prototype['prototype'];
    // }

    // If we have already locked this chain then throw an error
    if (target._done)
      throw new Error('Can not continue with chainable: chainable has been finalized');

    // Proxy request to internal method (or $_default if method not found)
    var value = (isGet) ? true : _value,
        native = target.constructor.prototype[`$${key}`];

    if (!(native instanceof Function))
      native = target.constructor.prototype['$_default'];

    if (native instanceof Function) {
      native.call(target, target._contexts[context], key);
      return chainableConsumerProxy(target, native, key, context);
    } else {
      target._contexts[context][key] = value;
    }

    return proxy;
  }

  // Spin up a new proxy for the target
  function chainableConsumerProxy(target, callFunc, callFuncKeyName, context = '*') {
    // Create context
    getChainableConsumerContext.call(target, context);

    var proxyTarget = (callFunc instanceof Function) ? callFunc : target,
        proxy = new Proxy(proxyTarget, {
          get: (_, key, proxy) => {
            if (key.charAt(0) === '_')
                return _[key];

            return chainableConsumerPropHelper(true, context, target, key, undefined, proxy);
          },
          set: (_, key, value, proxy) => chainableConsumerPropHelper(false, context, target, key, value, proxy),
          apply: (_, thisArg, argumentList) => {
            if (!(callFunc instanceof Function))
              throw new Error('Unable to call object');

            var ret = callFunc.call(target, target._contexts[context], callFuncKeyName, ...argumentList);
            return (!ret || ret === target) ? chainableConsumerProxy(target, undefined, undefined, context) : ret;
          }
        });

    if (!proxy.hasOwnProperty('_proxyTarget')) {
      Object.defineProperty(proxy, '_proxyTarget', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: target
      });
    }

    return proxy;
  }

  // This is the guts of Chainable
  const ChainableConsumer = this.defineClass((ParentClass) => {
    return class ChainableConsumer extends ParentClass {
      constructor(...args) {
        super();

        Object.defineProperty(this, '_arguments', {
          writable: false,
          enumerable: false,
          configurable: false,
          value: args
        });
      }

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
        if (!this._done)
          this._done = true;

        return this;
      }

      clone() {
        var copy = new this.constructor(...this._arguments);

        var proxy = copy.start(...this._arguments);
        Object.assign(copy._template, this._template);
        Object.assign(copy._contexts, this._contexts);
        copy._done = false;

        return proxy;
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

      $_default(context, name, value) {
        if (arguments.length < 3)
          context[name] = true;
        else
          context[name] = value;
      }
    };
  });

  // Chainable class... inherit from this to allow abstract property chaining
  const Chainable = this.defineClass((ParentClass) => {
    return class Chainable extends ParentClass {
      createProxy(...args) {
        // Dummy function for proxy
        function proxyBase() {}

        var target = this,
            proxy = new Proxy(proxyBase, {
              get: (_, key) => {
                if (key.charAt(0) === '_')
                  return _[key];

                var ret = this.createNewConsumer(...args);
                return ret[key];
              },
              set: (_, key, value) => {
                var ret = this.createNewConsumer(...args);
                ret[key] = value;

                return ret;
              },
              apply: (_, thisArg, argList) => {
                // Initalize with arguments
                var callArgs = args.concat(argList),
                    consumer = this.createNewConsumer(...callArgs);

                return target.initialize.call(target, consumer, ...callArgs);
              }
            });

        Object.defineProperty(proxy, '_proxyTarget', {
          writable: false,
          enumerable: false,
          configurable: false,
          value: proxyBase
        });

        return proxy;
      }

      createNewConsumer(...args) {
        var consumer = new ChainableConsumer(...args);
        return consumer.start(...args);
      }

      initialize() {
        // Child classes may want to do something with this
      }
    };
  });

  root.export(root, {
    ChainableConsumer,
    Chainable
  });
};
