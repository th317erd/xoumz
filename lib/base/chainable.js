const util = require('util');

module.exports = function(root, requireModule) {
  const { extend } = requireModule('./base/utils');

  // This ensures the scope being used exists
  // If it is the base scope is is pre-filled with the template (if any)
  function getChainableConsumerScope(scope = '*') {
    if (!this._scopes.hasOwnProperty(scope)) {
      var newScope = {};
      Object.defineProperty(this._scopes, scope, {
        writable: true,
        enumerable: true,
        configurable: false,
        value: newScope
      });

      var template = this._template;
      if (template && scope === '*' && template.entries instanceof Function) {
        for (var [ key, value ] of template.entries())
          newScope[key] = value;
      }

      Object.defineProperty(newScope, '_name', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: scope
      });
    }

    return this._scopes[scope];
  }

  // This is the proxy getter / setter
  function chainableConsumerPropHelper(isGet, scope, target, key, _value, proxy) {
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
      native.call(target, target._scopes[scope], key);
      return chainableConsumerProxy(target, native, key, scope);
    } else {
      target._scopes[scope][key] = value;
    }

    return proxy;
  }

  // Spin up a new proxy for the target
  function chainableConsumerProxy(target, callFunc, callFuncKeyName, scope = '*') {
    // Create scope
    getChainableConsumerScope.call(target, scope);

    var proxyTarget = (callFunc instanceof Function) ? callFunc : target,
        proxy = new Proxy(proxyTarget, {
          get: (_, key, proxy) => {
            if (typeof key !== 'symbol' && key.charAt(0) === '_')
                return _[key];

            return chainableConsumerPropHelper(true, scope, target, key, undefined, proxy);
          },
          set: (_, key, value, proxy) => chainableConsumerPropHelper(false, scope, target, key, value, proxy),
          apply: (_, thisArg, argumentList) => {
            if (!(callFunc instanceof Function))
              throw new Error('Unable to call object');

            var ret = callFunc.call(target, target._scopes[scope], callFuncKeyName, ...argumentList);
            return (!ret || ret === target) ? chainableConsumerProxy(target, undefined, undefined, scope) : ret;
          }
        });

    if (!proxy.hasOwnProperty('_proxyTarget')) {
      Object.defineProperty(proxy, '_proxyTarget', {
        writable: true,
        enumerable: false,
        configurable: true,
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

        Object.defineProperty(this, '_scopes', {
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

        delete this._proxyTarget;

        return this;
      }

      clone(...args) {
        var copy = new this.constructor(...this._arguments);

        var proxy = copy.start(...this._arguments);
        extend(true, copy._template, this._template);
        extend(true, copy._scopes, this._scopes, ...args);
        copy._done = false;

        return proxy;
      }

      getScopeName(opts) {
        if (typeof opts === 'string' || opts instanceof String)
          return opts.valueOf();

        if (opts && typeof opts.getScopeName === 'function')
          return opts.getScopeName.call(opts);

        return (opts) ? opts.scope : opts;
      }

      getScopes() {
        return this._scopes;
      }

      getScope(_opts) {
        var opts = _opts || {},
            scopeName = this.getScopeName(opts) || '*';

        return this._scopes[scopeName];
      }

      getProp(propName, _opts) {
        var opts = _opts || {},
            scope = this.getScope(opts),
            propValue = (!scope || !scope.hasOwnProperty(propName)) ? this._scopes['*'][propName] : scope[propName];

        if ((opts.unwind || (propName === 'value' && opts.unwind !== false)) && typeof propValue === 'function')
          propValue = propValue.call(opts, propName, this);

        return propValue;
      }

      *keys(scope = '*') {
        var thisContext = getChainableConsumerScope.call(this, scope),
            keys = Object.keys(thisContext);

        for (var i = 0, il = keys.length; i < il; i++)
          yield keys[i];
      }

      *values(scope = '*') {
        var thisContext = getChainableConsumerScope.call(this, scope),
            keys = Object.keys(thisContext);

        for (var i = 0, il = keys.length; i < il; i++)
          yield thisContext[keys[i]];
      }

      *entries(scope = '*') {
        var thisContext = getChainableConsumerScope.call(this, scope),
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
        return this._scopes;
      }

      $_default(scope, name, value) {
        if (arguments.length < 3)
          scope[name] = true;
        else
          scope[name] = value;
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
                if (typeof key !== 'symbol' && key.charAt(0) === '_')
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
