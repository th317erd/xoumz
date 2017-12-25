module.exports = function(root, requireModule) {
  const { definePropertyRW, noe } = requireModule('./utils');
  const { Chainable, chainableProxy } = requireModule('./chainable');

  const FLAGS = {
    AND: 0x01,
    OR: 0x01,
    NOT: 0x02
  };

  function getHighestParent() {
    var parent = this;

    while(parent._parent)
      parent = parent._parent;

    return parent;
  }

  class QueryEngine extends Chainable {
    static FLAGS = FLAGS;

    constructor(connector, _opts) {
      super();

      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_connector', connector);
      definePropertyRW(this, '_groups', []);
      definePropertyRW(this, '_queries', []);
      definePropertyRW(this, '_parent', opts.parent || null);
      definePropertyRW(this, '_flags', opts.flags || 0);
    }

    getFlags() {
      return this._flags;
    }

    iterateGroups(cb) {
      if (!arguments.length)
        return;

      if (arguments.length !== 1 || !(cb instanceof Function))
        throw new Error('Argument to QueryEngine "iterateGroups" call must be a function');

      var groups = this._groups,
          rets = [],
          abort = () => abort;

      for (var i = 0, il = groups.length; i < il; i++) {
        var group = groups[i],
            ret = cb.call(this, group, abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    iterateQueries(cb) {
      if (!arguments.length)
        return;

      if (arguments.length !== 1 || !(cb instanceof Function))
        throw new Error('Argument to QueryEngine "iterateQueries" call must be a function');

      var queries = this._queries,
          keys = Object.keys(queries),
          rets = [],
          abort = () => abort;

      for (var i = 0, il = keys.length; i < il; i++) {
        var query = keys[i],
            args = queries[query],
            ret = cb.call(this, query, args, abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    and(func) {
      if (!arguments.length)
        return;

      if (arguments.length !== 1 || !(func instanceof Function))
        throw new Error('Argument to QueryEngine "and" call must be a function');

      var qe = new QueryEngine(this._connector, { ...this.options, parent: this, flags: this._flags & ~FLAGS.AND });
      this._groups.push(qe);

      func.call(this, qe);
    }

    or(func) {
      if (!arguments.length)
        return;

      if (arguments.length !== 1 || !(func instanceof Function))
        throw new Error('Argument to QueryEngine "or" call must be a function');

      var qe = new QueryEngine(this._connector, { ...this.options, parent: this, flags: this._flags | FLAGS.OR });
      this._groups.push(qe);

      func.call(this, qe);
    }

    not(func) {
      if (!arguments.length)
        return;

      if (arguments.length !== 1 || !(func instanceof Function))
        throw new Error('Argument to QueryEngine "not" call must be a function');

      var qe = new QueryEngine(this._connector, { ...this.options, parent: this, flags: this._flags | FLAGS.NOT });
      this._groups.push(qe);

      func.call(this, qe);
    }

    async first() {
      var qe = getHighestParent.call(this),
          response = await this._connector.query(qe);

      if (noe(response))
        return null;

      return response[0];
    }

    async all() {
      var qe = getHighestParent.call(this),
          response = await this._connector.query(qe);

      if (noe(response))
        return [];

      return response;
    }

    async last() {
      var qe = getHighestParent.call(this),
          response = await this._connector.query(qe);

      if (noe(response))
        return null;

      return response[response.length - 1];
    }

    _getter(key) {
      if (key.match(/(prototype|call|apply|inspect|then|catch)/))
        return this[key];

      console.log('KEY!', key);
      return chainableProxy.call((...args) => {
        if (!args.length)
          return;

        this._queries[key] = args;
      }, this);
    }
  }

  Object.assign(root, {
    QueryEngine
  });
};
