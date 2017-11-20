import { definePropertyRO, definePropertyRW, noe, instanceOf, humanifyArrayItems } from '../utils';
import { required } from './validators';

(function(root) {
  function getContext(_context) {
    var context = (noe(_context)) ? '*' : _context,
        specifiedContext = this._contexts[context];
    
    if (!specifiedContext) {
      specifiedContext = {};
      definePropertyRO(this._contexts, context, specifiedContext);
    }
    
    return specifiedContext;
  }

  function ASSERT_TYPE(...types) {
    return function(val, propName) {
      if (val === undefined || val === null)
        return null;

      if (!instanceOf(val, ...types))
        throw new Error(propName + ' must be a ' + humanifyArrayItems(types));

      return val;
    };
  }

  function PARSE_FLOAT(val) {
    var finalVal = parseFloat(('' + val).replace(/[^e\d+-.]/g, ''));
    return (!isFinite(finalVal)) ? 0 : finalVal;
  }

  function PARSE_INT(val) {
    return Math.round(PARSE_FLOAT(val));
  }

  function PARSE_BOOLEAN(val) {
    if (typeof val === 'string' || val instanceof String)
      return (('' + val).match(/^(n|no|not|null|nil|0|void|false)$/i)) ? false : true;
    
    return !!val;
  }

  function PARSE_STRING(val) {
    if (val === null || val === undefined)
      return '';
    
    if ((typeof val === 'number' || val instanceof Number ) && !isFinite(val))
      return '';
      
    return ('' + val);
  }

  function PARSE_ARRAY(_val) {
    function parseArrayItems(val) {
      if (val instanceof String || typeof val === 'string') {
        var delimiter = this.getProp('delimiter');

        if (!delimiter)
          return [val];

        var items = [],
            startIndex = 0,
            lastIndex = 0,
            index = val.indexOf(delimiter),
            skipIndex = false;

        if (index < 0)
          return [val];

        while(index >= 0) {
          skipIndex = (delimiter.length === 1 && index > 0 && val.charAt(index - 1) === '\\');
          
          if (!skipIndex) {
            items.push(val.substring(startIndex, index).replace('\\' + delimiter, delimiter));
            startIndex = index + delimiter.length;
          }
          
          lastIndex = index + delimiter.length;
          index = val.indexOf(delimiter, lastIndex + 1);
        }

        if (startIndex <= val.length)
          items.push(val.substring(startIndex).replace('\\' + delimiter, delimiter));

        return items;
      }

      return [val];
    }

    var val = (_val instanceof Array) ? _val : parseArrayItems.call(this, _val),
        finalVal = [],
        type = this.internalType;
    
    for (var i = 0, il = val.length; i < il; i++) {
      var thisVal = val[i];
      if (thisVal === null || thisVal === undefined)
        continue;

      finalVal.push(type.instantiate(thisVal));
    }

    return finalVal;
  }

  class SchemaType {
    constructor(typeName) {
      definePropertyRW(this, 'LNOP', () => this);
      definePropertyRW(this, 'defineStaticProp', (name, defaultValue, _altValue, _cb) => {
        var altValue = (_altValue === undefined) ? !defaultValue : _altValue;

        if (!(_cb instanceof Function) && !defaultContext.hasOwnProperty('_' + name))
          definePropertyRW(defaultContext, '_' + name, defaultValue);

        definePropertyRO(
          this,
          name,
          undefined,
          (_cb instanceof Function)
            ? () => { _cb.call(this); return this; }
            : () => {
              if (this._lock)
                throw new Error(`Unable to set ${name} on ${this.field}. Schema has been locked.`);
              this.setProp(name, altValue, this._context); return this;
            },
          this.LNOP
        );
      });

      definePropertyRW(this, 'defineProp', (name, defaultValue, _cb, _valueChecker) => {
        definePropertyRW(defaultContext, '_' + name, defaultValue);
        definePropertyRO(this, name, (_cb instanceof Function) ? _cb : (_val) => {
          if (this._lock)
            throw new Error(`Unable to set ${name} on ${this.field}. Schema has been locked.`);

          var val = _val;
          if (_valueChecker instanceof Function)
            val = _valueChecker.call(this, val, name);

          this.setProp(name, val, this._context);
          return this;
        });
      });

      var locked = false;
      definePropertyRO(this, 'typeName', typeName);
      definePropertyRW(this, '_lock', undefined, () => locked, () => {
        if (!locked)
          locked = true;
        return locked;
      });

      var contexts = {};
      definePropertyRW(this, '_context', '*');
      definePropertyRO(this, '_contexts', contexts);

      var defaultContext = getContext.call(this);

      this.defineStaticProp('notNull', false);
      this.defineStaticProp('primaryKey', false);
      this.defineStaticProp('forignKey', false);
      this.defineStaticProp('required', undefined, undefined, () => { this.validate(required); });

      this.defineProp('value', null);
      this.defineProp('field', null);

      this.defineProp('setter', (val) => val, undefined, (val, name) => {
        root.ASSERT_TYPE('function')(val, name);
        return val.bind(this);
      });
      this.defineProp('getter', (val) => val, undefined, (val, name) => {
        root.ASSERT_TYPE('function')(val, name);
        return val.bind(this);
      });
    }

    getTypeName() {
      return this.typeName;
    }

    context(name, cb) {
      if (!instanceOf(name, 'string') || noe(name))
        throw new Error('Context name must be a valid string');

      if (!(cb instanceof Function))
        throw new Error('Context scope callback must be a function');

      this._context = name;
      cb.call(this, this);
      
      return this;
    }

    lock() {
      this._lock = true;
    }

    getProp(name, _opts) {
      var opts = (instanceOf(_opts, 'string')) ? { context: opts } : (_opts || {}),
          specifiedContext = getContext.call(this, opts.context),
          propName = '_' + name,
          propValue = (!specifiedContext.hasOwnProperty(propName)) ? this._contexts['*'][propName] : specifiedContext[propName];
      
      if (opts.unwind && propValue instanceof Function)
        propValue = propValue.call(opts.parent || {}, name, this);

      return propValue;
    }

    setProp(name, val, _opts) {
      if (this._lock)
        throw new Error(`Unable to set ${name} on ${this.field}. Schema has been locked.`);

      var opts = (instanceOf(_opts, 'string')) ? { context: opts } : (_opts || {}),
          specifiedContext = getContext.call(this, opts.context),
          propName = '_' + name;

      if (!specifiedContext.hasOwnProperty(propName))
        definePropertyRW(specifiedContext, propName, val);
      else
        specifiedContext[propName] = val;
      
      return this;
    }

    allowNull(val) {
      if (this._lock)
        throw new Error(`Unable to set allowNull on ${this.field}. Schema has been locked.`);

      this.setProp('notNull', !val, this._context);
      return this;
    }

    validate(cb) {
      if (this._lock)
        throw new Error(`Unable to set validator on ${this.field}. Schema has been locked.`);

      if (!(cb instanceof Function))
        throw new Error('Validator must be a function');

      var specifiedContext = getContext.call(this, this._context),
          validators = specifiedContext._validators;

      if (!validators) {
        validators = [];
        definePropertyRW(specifiedContext, '_validators', validators);
      }

      validators.push(cb);

      return this;
    }

    validateType() {
    }
  }

  class IntegerType extends SchemaType {
    constructor() {
      super('Integer');

      this.getter(PARSE_INT);
      this.setter(PARSE_INT);
    }

    instantiate(number) {
      return PARSE_INT.call(this, number);
    }
  }

  class DecimalType extends SchemaType {
    constructor() {
      super('Decimal');

      this.getter(PARSE_FLOAT);
      this.setter(PARSE_FLOAT);
    }

    instantiate(number) {
      return PARSE_FLOAT.call(this, number);
    }
  }

  class DateTimeType extends SchemaType {
    constructor() {
      super('DateTime');
    }
  }

  class DateType extends SchemaType {
    constructor() {
      super('Date');
    }
  }

  class TimeType extends SchemaType {
    constructor() {
      super('Time');
    }
  }

  class StringType extends SchemaType {
    constructor() {
      super('String');

      this.getter(PARSE_STRING);
      this.setter(PARSE_STRING);
    }

    instantiate(val) {
      return PARSE_STRING.call(this, val);
    }
  }

  class BooleanType extends SchemaType {
    constructor() {
      super('Boolean');

      this.getter(PARSE_BOOLEAN);
      this.setter(PARSE_BOOLEAN);
    }

    instantiate(val) {
      return PARSE_BOOLEAN.call(this, val);
    }
  }

  class MetaType extends SchemaType {
    constructor() {
      super('Meta');
    }

    instantiate(val) {
      return val;
    }
  }

  class ArrayOfType extends SchemaType {
    constructor(type) {
      super('ArrayOf');

      this.defineProp('delimiter', '|');

      definePropertyRO(this, 'internalType', type);

      this.getter(PARSE_ARRAY);
      this.setter(PARSE_ARRAY);
    }

    instantiate(val) {
      return PARSE_ARRAY.call(this, val);
    }

    validateType() {
      var fieldSchema = this.internalType;
      if (!fieldSchema || !(fieldSchema instanceof SchemaType))
        throw new Error(`Schema field ${key} must inherit from SchemaType`);
    }
  }

  class OneOfType extends SchemaType {
    constructor(...types) {
      super('OneOf');

      this.getter(PARSE_ONEOF);
      this.setter(PARSE_ONEOF);
    }

    instantiate(val) {
      return PARSE_ONEOF.call(this, val);
    }

    validateType() {
      var fieldSchema = this.internalType;
      if (!fieldSchema || !(fieldSchema instanceof SchemaType))
        throw new Error(`Schema field ${key} must inherit from SchemaType`);
    }
  }

  const DefaultSchemaTypes = {
          'Integer': IntegerType,
          'Decimal': DecimalType,
          'Date': DateType,
          'Time': TimeType,
          'DateTime': DateTimeType,
          'String': StringType,
          'Boolean': BooleanType,
          'Meta': MetaType
        },
        SchemaTypes = {},
        NOP = () => { return SchemaTypes };

  function oneOfType(...types) {
    return new OneOfType(...types);
  }

  function arrayOfType(type) {
    return new ArrayOfType(type);
  }

  function defineSchemaType(schema, name, TypeKlass) {
    Object.defineProperty(schema, name, {
      enumerable: true,
      configurable: true,
      get: () => {
        return new TypeKlass();
      },
      set: NOP
    });
  }

  function iterateDefaultSchemaTypes(cb) {
    var keys = Object.keys(DefaultSchemaTypes);
    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i];
      cb(key, DefaultSchemaTypes[key]);  
    }
  }

  function newSchemaTypes() {
    return Object.create(SchemaTypes);
  }

  iterateDefaultSchemaTypes((name, type) => {
    defineSchemaType(SchemaTypes, name, type);
  });

  definePropertyRW(SchemaTypes, 'oneOf', oneOfType);
  definePropertyRW(SchemaTypes, 'arrayOf', arrayOfType);

  Object.assign(root, {
    ASSERT_TYPE,
    SchemaType,
    SchemaTypes,
    DefaultSchemaTypes,
    defineSchemaType,
    iterateDefaultSchemaTypes,
    newSchemaTypes
  });
})(module.exports);
