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

  const QueryBuilder = this.defineClass((ParentClass) => {
    return class QueryBuilder extends ParentClass {
      constructor(_opts) {
        super(_opts);

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
            if (moduleLocal.QueryBuilder.prototype.hasOwnProperty(fieldName) || ('' + fieldName).match(/^(first|last|all|field|type)$/))
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

      getConditions() {
        return this._conditions;
      }

      setConditions(conditions) {
        this._conditions = conditions;
      }

      getRoot() {
        var parent = this;
        while (parent && parent._parent)
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

        this._currentOp.flags = flags & ~FLAGS.NOT;

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
        var serializer = new moduleLocal.QueryBuilderSerializer(this);
        return serializer.serialize();
      }

      static unserialize(str) {
        var unserializer = new moduleLocal.QueryBuilderUnserializer(str);
        return unserializer.unserialize();
      }
    };
  }, undefined, {
    // Static properties
    FLAGS
  });

  const QueryBuilderSerializer = this.defineClass((ParentClass) => {
    return class QueryBuilderSerializer extends ParentClass {
      constructor(queryBuilder) {
        super();

        if (!instanceOf(queryBuilder, moduleLocal.QueryBuilder))
          throw new Error('QueryBuilderSerializer constructor requires a QueryBuilder instance');

        definePropertyRW(this, 'queryBuilder', queryBuilder);
        definePropertyRW(this, 'currentType', null);
      }

      binaryOpToString(flags) {
        return (flags & FLAGS.OR) ? '|' : '&';
      }

      fieldOpToString(flags) {
        var output = [];

        if (flags & (FLAGS.GREATER | FLAGS.SMALLER))
          output.push((flags & FLAGS.GREATER) ? '>' : '<');
        else if (flags & FLAGS.NOT)
          output.push('!');

        if (flags & FLAGS.EQUAL)
          output.push('=');
        else if (flags & FLAGS.FUZZY)
          output.push('%');
        else if (flags & FLAGS.CONTAINS)
          output.push('~');

        return output.join('');
      }

      fieldToString(type, name) {
        return `${type}:${name}`;
      }

      valueToString(value) {
        return JSON.stringify(value);
      }

      serializeConditions(queryBuilder) {
        var conditions = queryBuilder.getConditions(),
            output = [],
            currentType = this.currentType;

        for (var i = 0, il = conditions.length; i < il; i++) {
          var condition = conditions[i];

          if (instanceOf(condition, moduleLocal.QueryBuilder)) {
            var firstCondition = condition._conditions[0];
            if (!firstCondition)
              continue;

            if (i !== 0)
              output.push(this.binaryOpToString(firstCondition.flags));

            output.push(`(${this.serializeConditions(condition)})`);
          } else {
            let value = condition.value;
            if (value === null || value === undefined)
              value = '';
            else
              value = value.valueOf();

            if (i !== 0)
              output.push(this.binaryOpToString(condition.flags));

            if (currentType !== condition.type)
              currentType = this.currentType = condition.type;

            output.push(this.fieldToString(currentType, condition.field));
            output.push(this.fieldOpToString(condition.flags));
            output.push(this.valueToString(value));
          }
        }

        return output.join('');
      }

      serialize() {
        this.currentType = null;
        return this.serializeConditions(this.queryBuilder.getRoot());
      }
    };
  });


  const QueryBuilderUnserializer = this.defineClass((ParentClass) => {
    return class QueryBuilderUnserializer extends ParentClass {
      constructor(serializedString, QueryBuilderClass = moduleLocal.QueryBuilder) {
        super();

        if (!serializedString)
          throw new Error('QueryBuilderUnserializer constructor requires a serialized QueryBuilder string');

        definePropertyRW(this, 'QueryBuilderClass', QueryBuilderClass);
        definePropertyRW(this, 'serializedString', serializedString);
        definePropertyRW(this, 'serializedStringLength', serializedString.length);

        // Parser has a shared "state" to pass values between parsing functions to be nicer on the garbage collector
        definePropertyRW(this, 'parserState', { offset: 0, type: null, value: null });
      }

      parseRegExp(re, offset) {
        re.lastIndex = offset;
        var m = re.exec(this.serializedString);

        if (m.index !== offset)
          throw new Error('QueryBuilderUnserializer: unexpected end of input');

        var state = this.parserState;
        state.offset = offset + m[0].length;
        state.value = m[0];

        return state;
      }

      parseString(offset) {
        var lastChar,
            parsedStr = [],
            c,
            str = this.serializedString,
            strLen = this.serializedStringLength,
            state = this.parserState;

        for (var i = offset; i < strLen; i++) {
          lastChar = c;
          c = str.charAt(i);

          if (c === '\\') {
            if (lastChar === '\\')
              parsedStr.push(c);

            continue;
          } else if (c === '"' && lastChar !== '\\') {
            state.offset = i + 1;
            state.value = parsedStr.join('');
            return state;
          }

          parsedStr.push(c);
        }

        throw new Error('QueryBuilderUnserializer: unexpected end of input');
      }

      parseFieldName(offset) {
        var str = this.serializedString,
            thisParsed = (str.charAt(offset) === '"') ? this.parseString(offset + 1) : this.parseRegExp(/[^!><=%~]+/g, offset),
            parts = thisParsed.value.split(':');

        if (!parts || parts.length !== 2)
          throw new Error(`QueryBuilderUnserializer: no type specified for field: ${thisParsed.value}`);

        if (parts[0].length)
          thisParsed.type = parts[0];

        thisParsed.value = parts[1];

        return thisParsed;
      }

      parseFieldOp(offset) {
        return this.parseRegExp(/[!><=%~]+/g, offset);
      }

      fieldOpToFlags(op) {
        var flags = 0,
            opMap = {
              '=': FLAGS.EQUAL,
              '>': FLAGS.GREATER,
              '<': FLAGS.SMALLER,
              '!': FLAGS.NOT,
              '~': FLAGS.CONTAINS,
              '%': FLAGS.FUZZY
            };

        for (var i = 0, il = op.length; i < il; i++) {
          var c = op.charAt(i),
              flag = opMap[c];

          if (!flag)
            throw new Error(`QueryBuilderUnserializer: unknown op symbol encountered: "${c}"`);

          flags = flags | flag;
        }

        return flags;
      }

      parseAllValues(offset) {
        var values = [],
            str = this.serializedString,
            strLen = this.serializedStringLength,
            state = this.parserState;

        for (var i = offset; i < strLen;) {
          this.parseFieldValue(i);
          values.push(state.value);
          i = state.offset;

          if (str.charAt(i) !== ',') {
            state.offset = state.offset + 1;
            state.value = values;
            return state;
          }

          i++;
        }

        throw new Error('QueryBuilderUnserializer: unexpected end of input');
      }

      parseFieldValue(offset) {
        var str = this.serializedString,
            c = str.charAt(offset),
            state = this.parserState;

        if (c === '"')
          return this.parseString(offset + 1);
        else if (c === '[')
          return this.parseAllValues(offset + 1);

        this.parseRegExp(/(true|false|[e\d.-]+)/g, offset);
        var value = state.value;

        if (value === 'true')
          state.value = true;
        else if (value === 'false')
          state.value = false;
        else
          state.value = parseFloat(value);

        return state;
      }

      parseCondition(offset, flags) {
        var parts = [],
            state = this.parserState;

        this.parseFieldName(offset);
        parts.push(state.value);

        this.parseFieldOp(state.offset);
        parts.push(state.value);

        this.parseFieldValue(state.offset);
        parts.push(state.value);

        state.value = {
          field: parts[0],
          type: state.type,
          flags: this.fieldOpToFlags(parts[1]) | flags,
          value: parts[2]
        };

        return state;
      }

      parseGroup(offset, binOp) {
        var conditions = [],
            binaryOp = binOp,
            str = this.serializedString,
            strLen = this.serializedStringLength,
            state = this.parserState;

        for (var i = offset; i < strLen;) {
          var c = str.charAt(i);

          if (c === '(') {
            this.parseGroup(i + 1, binaryOp);
            state.value = this.conditionsToQueryBuilder(state.value);
          } else if (c === ')') {
            break;
          } else if (c === '&' || c === '|') {
            binaryOp = (c === '&') ? 0 : FLAGS.OR;
            i++;
            continue;
          } else {
            this.parseCondition(i, binaryOp);
            if (!state.type)
              throw new Error('QueryBuilderUnserializer: expected a type, but none was specified');
          }

          conditions.push(state.value);
          i = state.offset;
        }

        state.offset = i + 1;
        state.value = conditions;

        return state;
      }

      conditionsToQueryBuilder(conditions) {
        var queryBuilder = new this.QueryBuilderClass();
        queryBuilder.setConditions(conditions);

        return queryBuilder;
      }

      unserialize() {
        // Reset parser state
        var state = this.parserState;
        state.offset = 0;
        state.type = null;
        state.value = null;

        this.parseGroup(0, 0);
        return this.conditionsToQueryBuilder(state.value);
      }
    };
  });

  const moduleLocal = root.export({
    QueryBuilder,
    QueryBuilderSerializer,
    QueryBuilderUnserializer
  });
};
