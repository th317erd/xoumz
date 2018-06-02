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

  function serializeFlags(flags) {
    var keys = Object.keys(FLAGS),
        parts = [];

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i];
      if (flags & FLAGS[key])
        parts.push(key.charAt(0));
    }

    return parts.join('|');
  }

  function addCondition(value, flags) {
    if (noe(this._currentOp))
      throw new Error('Unknown field for query operation');

    this._conditions.push({
      ...this._currentOp,
      value,
      flags: (this._currentOp.flags & 0x03) | (flags & ~0x03)
    });

    this._currentOp.flags = this._currentOp.flags & ~FLAGS.NOT;
    this._currentOpDirty = false;

    return this;
  }

  function groupCondition(cb, flags) {
    var group = new this.constructor(this._options);

    group._parent = this;
    group._currentOp = {
      ...this._currentOp,
      flags: (flags & FLAGS.OR)
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
          if (QueryBuilder.prototype.hasOwnProperty(fieldName) || ('' + fieldName).match(/^(first|last|all|field|type)$/))
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

    getRoot() {
      var parent = this;
      while(parent && parent._parent)
        parent = parent._parent;

      return parent;
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
        groupCondition.call(this, cb, flags ^ FLAGS.NOT);
        return this;
      }

      // Toggle "NOT"
      this._currentOp.flags = flags ^ FLAGS.NOT;
      this._currentOpDirty = true;

      return this;
    }

    and(cb) {
      var flags = this._currentOp.flags;
      if (flags & FLAGS.NOT)
        throw new Error('QueryBuilder: Can not place a NOT condition immediately before an AND');

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
      if (flags & FLAGS.NOT)
        throw new Error('QueryBuilder: Can not place a NOT condition immediately before an OR');

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
      var flags = this._currentOp.flags,
          not = (flags & FLAGS.NOT);

      groupCondition.call(this, (group) => {
        var greater = (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER),
            smaller = (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER);

        addCondition.call(group, min, (not) ? smaller : greater);

        if (not)
          group.or();
        else
          group.and();

        addCondition.call(group, max, (not) ? greater : smaller);
      }, flags & ~FLAGS.NOT);

      return this;
    }

    gt() {
      return this.greaterThan.apply(this, arguments);
    }

    gte(val) {
      return this.greaterThan.call(this, val, true);
    }

    greaterThan(val, inclusive) {
      return addCondition.call(this, val, (inclusive) ? (FLAGS.GREATER | FLAGS.EQUAL) : (FLAGS.GREATER));
    }

    lt() {
      return this.lessThan.apply(this, arguments);
    }

    lte(val) {
      return this.lessThan.call(this, val, true);
    }

    lessThan(val, inclusive) {
      return addCondition.call(this, val, (inclusive) ? (FLAGS.SMALLER | FLAGS.EQUAL) : (FLAGS.SMALLER));
    }

    serialize() {
      function qbToJSON(qb) {
        function pushFlags(flags) {
          output.push((flags & FLAGS.OR) ? '|' : '&');
        }

        function pushOp(flags) {
          if (flags & (FLAGS.GREATER | FLAGS.SMALLER))
            output.push((flags & FLAGS.GREATER) ? '>' : '<');
          else if (flags & FLAGS.NOT)
            output.push('!');

          if (flags & FLAGS.EQUAL)
            output.push('=');
          else if (flags & FLAGS.FUZZY)
            output.push('~');
          else if (flags & FLAGS.CONTAINS)
            output.push('%');
        }

        var conditions = qb._conditions,
            output = [];

        for (var i = 0, il = conditions.length; i < il; i++) {
          var condition = conditions[i];

          if (condition instanceof QueryBuilder) {
            var firstCondition = condition._conditions[0];
            if (!firstCondition)
              continue;

            if (i !== 0)
              pushFlags(firstCondition.flags);

            output.push(`(${qbToJSON(condition)})`);
          } else {
            let value = condition.value;
            if (value === null || value === undefined)
              value = '';
            else
              value = value.valueOf();

            if (i !== 0)
              pushFlags(condition.flags);

            output.push(condition.field);
            pushOp(condition.flags);
            output.push((typeof value === 'string') ? value.replace(/"/g, '\\"') : value);
          }
        }

        return output.join('');
      }

      return qbToJSON(this.getRoot(), true);
    }
  }

  // Static properties
  Object.assign(QueryBuilder, {
    FLAGS
  });

  root.export({
    QueryBuilder
  });
};
