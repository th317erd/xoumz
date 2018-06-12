module.exports = function(root, requireModule) {
  const { noe, definePropertyRO } = requireModule('./base/utils');

  const Context = this.defineClass((ParentClass) => {
    return class Context extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = _opts || {};
        if (noe(opts.name))
          throw new Error('Context constructor must receive a name for the context');

        for (var [ key, value ] of opts)
          definePropertyRO(this, key, value);
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
