module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe } = requireModule('./utils');

  const FLAGS = {
    OR: 0x01,
    NOT: 0x02,
    EQUAL: 0x04,
    FUZZY: 0x08,
    GREATER: 0x10,
    SMALLER: 0x20,
    CONTAINS: 0x40
  };

  function addCondition(value, flags) {
    if (noe(this._currentOp))
      throw new Error('Unknown field for query operation');

    this._conditions.push({
      ...this._currentOp,
      value,
      flags: (this._currentOp.flags & 0x03) | (flags & ~0x03)
    });

    return this;
  }

  function groupCondition(cb, flags) {
    var group = new this.constructor(this.getSchemaEngine(), this.getConnector(), this.getModelType(), this.options);

    group._parent = this;
    group._currentOp = {
      ...this._currentOp,
      flags: (flags & 0x03)
    };

    cb.call(group, group);
    if (group._conditions.length)
      this._conditions.push(group);

    return this;
  }

  function getFirstConditionFlags() {
    var conditions = this._conditions,
        condition;

    for (var i = 0, il = conditions.length; i < il; i++) {
      condition = conditions[i];

      if (condition instanceof QueryEngine) {
        var ret = getFirstConditionFlags.call(condition);
        if (ret === undefined)
          continue;
      }

      break;
    }

    return (condition) ? condition.flags : undefined;
  }

  class QueryEngine {
    static FLAGS = FLAGS;

    constructor(schemaEngine, connector, modelType, _opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_schemaEngine', schemaEngine);
      definePropertyRW(this, '_connector', connector);
      definePropertyRW(this, '_modelType', modelType);
      definePropertyRW(this, '_conditions', []);
      definePropertyRW(this, '_parent', null);
      definePropertyRW(this, '_currentOp', {
        field: null,
        flags: 0
      });

      modelType.iterateFields((field, fieldName) => {
        if (QueryEngine.prototype.hasOwnProperty(fieldName))
          throw new Error(`You can not have a field named ${fieldName}. This is a reserved name.`);

        definePropertyRO(this, fieldName, undefined, () => {
          this._currentOp.field = fieldName;
          return this;
        }, () => {});
      });

      definePropertyRO(this, 'first', undefined, async () => {
        var result = await this.executeQuery();
        return (noe(result)) ? null : result[0];
      }, () => {});

      definePropertyRO(this, 'all', undefined, async () => {
        var result = await this.executeQuery();
        return (noe(result)) ? [] : result;
      }, () => {});

      definePropertyRO(this, 'last', undefined, async () => {
        var result = await this.executeQuery();
        return (noe(result)) ? null : result[result.length - 1];
      }, () => {});
    }

    getSchemaEngine() {
      return this._schemaEngine;
    }

    getConnector() {
      return this._connector;
    }

    getModelType() {
      return this._modelType;
    }

    async executeQuery() {
      return await this.getConnector().query(this.getSchemaEngine(), this, this.options);
    }

    getFirstConditionFlags() {
      var flags = getFirstConditionFlags.call(this);
      return (flags) ? flags : 0;
    }

    iterateConditions(cb) {
      var conditions = this._conditions,
          rets = [],
          abort = () => abort;

      for (var i = 0, il = conditions.length; i < il; i++) {
        var condition = conditions[i],
            ret = cb.call(this, condition, abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    not(cb) {
      var flags = this._currentOp.flags;
      if (cb instanceof Function)
        return groupCondition.call(this, cb, flags ^ ~FLAGS.NOT);

      // Toggle "NOT"
      this._currentOp.flags = flags ^ ~FLAGS.NOT;

      return this;
    }

    and(cb) {
      var flags = this._currentOp.flags;
      if (cb instanceof Function)
        return groupCondition.call(this, cb, flags & ~FLAGS.OR);

      // Turn off "OR"
      this._currentOp.flags = flags & ~FLAGS.OR;

      return this;
    }

    or(cb) {
      var flags = this._currentOp.flags;
      if (cb instanceof Function)
        return groupCondition.call(this, cb, flags | FLAGS.OR);

      // Turn on "OR"
      this._currentOp.flags = flags | FLAGS.OR;

      return this;
    }

    is() {
      return this.equals.apply(this, arguments);
    }

    eq() {
      return this.equals.apply(this, arguments);
    }

    equals(val) {
      return addCondition.call(this, val, FLAGS.EQUAL);
    }

    cont() {
      return this.contains.apply(this, arguments);
    }

    oneOf() {
      return this.contains.apply(this, arguments);
    }

    contains(...args) {
      var vals = args[0];
      if (!(vals instanceof Array))
        vals = args;

      return addCondition.call(this, vals, FLAGS.CONTAINS);
    }

    like(val) {
      return addCondition.call(this, val, FLAGS.EQ | FLAGS.FUZZY);
    }

    between(min, max, inclusive) {
      this.and((group) => {
        addCondition.call(group, min, (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER));
        addCondition.call(group, max, (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER));
      });

      return this;
    }

    gt() {
      return this.greaterThan.apply(this, arguments);
    }

    greaterThan(val, inclusive) {
      return addCondition.call(this, val, (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER));
    }

    lt() {
      return this.lessThan.apply(this, arguments);
    }

    lessThan(val, inclusive) {
      return addCondition.call(this, val, (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER));
    }
  }

  Object.assign(root, {
    QueryEngine
  });
};
