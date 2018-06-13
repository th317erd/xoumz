module.exports = function(root, requireModule) {
  const { noe } = requireModule('./base/utils');

  const Context = this.defineClass((ParentClass) => {
    return class Context extends ParentClass {
      constructor(...args) {
        super();

        var opts = args.reduce((sum, arg) => {
          if (!arg)
            return sum;

          if (arg instanceof Array)
            return sum;

          var argType = typeof arg.valueOf();
          if (argType === 'string' || argType === 'number' || argType === 'boolean' || argType === 'function')
            return sum;

          return Object.assign(sum, arg);
        }, {});

        if (noe(opts.name))
          throw new Error('Context constructor must receive a name for the context');

        for (var [ key, value ] of opts)
          Object.defineProperty(this, key, { writable: false, enumerable: true, configurable: false, value: value });
      }

      getContextName() {
        var parts = [];

        if (this.group)
          parts.push(this.group);

        parts.push(this.name);

        return parts.join(':');
      }
    };
  });

  root.export({
    Context
  });
};
