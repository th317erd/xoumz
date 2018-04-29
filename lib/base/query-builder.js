module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf } = requireModule('./base/utils');

  // TODO: Convert to use Chainable

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

    this._currentOpDirty = false;

    return this;
  }

  function groupCondition(cb, flags) {
    var group = new this.constructor(this._options);

    group._parent = this;
    group._currentOp = {
      ...this._currentOp,
      flags: (flags & 0x03)
    };

    cb.call(group, group);
    if (group._conditions.length)
      this._conditions.push(group);

    this._currentOpDirty = false;

    return this;
  }

  function getFirstConditionFlags() {
    var conditions = this._conditions,
        condition;

    for (var i = 0, il = conditions.length; i < il; i++) {
      condition = conditions[i];

      if (instanceOf(condition, QueryBuilder)) {
        var ret = getFirstConditionFlags.call(condition);
        if (ret === undefined)
          continue;
      }

      break;
    }

    return (condition) ? condition.flags : undefined;
  }

  class QueryBuilder {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, '_options', opts);
      definePropertyRW(this, '_conditions', []);
      definePropertyRW(this, '_parent', null);
      definePropertyRW(this, '_currentOp', {
        field: null,
        flags: 0
      });

      definePropertyRW(this, '_currentOpDirty', false);

      var modelType = opts.modelType;
      if (modelType) {
        modelType.iterateFields((field, fieldName) => {
          if (QueryBuilder.prototype.hasOwnProperty(fieldName) || ('' + fieldName).match(/^(first|last|all|field)$/))
            throw new Error(`You can not have a field named ${fieldName}. This is a reserved name.`);

          definePropertyRO(this, fieldName, undefined, () => {
            this._currentOpDirty = (this._currentOp.field !== fieldName);
            this._currentOp.field = fieldName;

            return this;
          }, () => {});
        });
      }

      definePropertyRO(this, 'field', (fieldName) => {
        this._currentOp.field = fieldName;
        return this;
      });

      definePropertyRO(this, 'type', (typeName) => {
        this._currentOpDirty = (this._currentOp.type !== typeName);
        this._currentOp.type = typeName;

        return this;
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

    getConnector(modelType) {
      var connector = this._options.connector,
          ConnectorBaseClass = this.getApplication().getConnectorClass();

      if (!(connector instanceof ConnectorBaseClass))
        connector = this.getApplication().getConnector({ query: this, modelType, operation: 'query' });

      if (!(connector instanceof ConnectorBaseClass))
        throw new Error('Can not figure out which connector to use from query. Please be more specific or specify a connector');

      return connector;
    }

    getModelType(_opts) {
      var modelType = this._options.modelType;
      if (!modelType) {
        modelType = this.getApplication().getModelTypesFromQuery(this, Object.assign({
          query: this,
          operation: 'query'
        }, _opts || {}));
      }

      if (!modelType)
        throw new Error('Can not figure out model type from query. Please be more specific or specify a model type');

      return (modelType instanceof Array) ? modelType : [modelType];
    }

    async executeQuery() {
      var modelTypes = this.getModelType(),
          // If there are multiple model types the order is not guaranteed
          promises = modelTypes.map((modelType) => {
            return this.getConnector(modelType).query(this, { ...this._options, modelType });
          });

      // Filter out empty query results
      var rets = await Promise.all(promises);
      return (rets || []).reduce((arr, ret) => arr.concat(ret), []).filter((model) => !!model);
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
      if (cb instanceof Function) {
        groupCondition.call(this, cb, flags ^ ~FLAGS.NOT);
        return this;
      }

      // Toggle "NOT"
      this._currentOp.flags = flags ^ ~FLAGS.NOT;
      this._currentOpDirty = true;

      return this;
    }

    and(cb) {
      var flags = this._currentOp.flags;
      if (cb instanceof Function) {
        groupCondition.call(this, cb, flags & ~FLAGS.OR);
        return this;
      }

      // Turn off "OR"
      this._currentOp.flags = flags & ~FLAGS.OR;
      this._currentOpDirty = true;

      return this;
    }

    or(cb) {
      var flags = this._currentOp.flags;
      if (cb instanceof Function) {
        groupCondition.call(this, cb, flags | FLAGS.OR);
        return this;
      }

      // Turn on "OR"
      this._currentOp.flags = flags | FLAGS.OR;
      this._currentOpDirty = true;

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

  // Static properties
  Object.assign(QueryBuilder, {
    FLAGS
  });

  Object.assign(root, {
    QueryBuilder
  });
};
