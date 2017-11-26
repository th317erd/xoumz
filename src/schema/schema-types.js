module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf, humanifyArrayItems } = requireModule('./utils');
  const { required } = requireModule('./schema/validators');
  const Logger = requireModule('./logger');
  const defaultSchemaTypes = requireModule('./schema/default-schema-types');

  function getContext(_context) {
    var context = (noe(_context)) ? '*' : _context,
        specifiedContext = this._contexts[context];
    
    if (!specifiedContext) {
      specifiedContext = {};
      definePropertyRO(this._contexts, context, specifiedContext);
    }
    
    return specifiedContext;
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
                throw new Error(`Unable to set ${name} on ${this.getProp('field')}. Schema has been locked.`);
              this.setProp(name, altValue, this._context); return this;
            },
          (val) => {
            this.setProp(name, val, this._context);
            return this;
          }
        );
      });

      definePropertyRW(this, 'defineProp', (name, defaultValue, _cb, _valueChecker) => {
        definePropertyRW(defaultContext, '_' + name, defaultValue);
        definePropertyRO(this, name, (_cb instanceof Function) ? _cb : (_val) => {
          if (this._lock)
            throw new Error(`Unable to set ${name} on ${this.getProp('field')}. Schema has been locked.`);

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
      this.defineStaticProp('primitive', false);

      this.defineProp('value', null);
      this.defineProp('field', null);

      this.defineProp('setter', (val) => val, undefined, (val, name) => {
        defaultSchemaTypes.assertSchemaTypes('function')(val, name);
        return val.bind(this);
      });
      this.defineProp('getter', (val) => val, undefined, (val, name) => {
        defaultSchemaTypes.assertSchemaTypes('function')(val, name);
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

    validateSchema() {
    }

    isValidValue(val) {
      return false;
    }

    decompose(val) {
      throw new Error('Can not decompose a base SchemaType');
    }

    instantiate(val) {
      throw new Error('Can not instantiate a base SchemaType');
    }
  }

  const DefaultSchemaTypes = defaultSchemaTypes.defineDefaultSchemaTypes(SchemaType),
        SchemaTypes = {},
        NOP = () => { return SchemaTypes };

  function oneOfType(...types) {
    return new DefaultSchemaTypes.OneOf(...types);
  }

  function arrayOfType(type) {
    return new DefaultSchemaTypes.Array(type);
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

  Object.assign(root, defaultSchemaTypes, {
    SchemaType,
    SchemaTypes,
    DefaultSchemaTypes,
    defineSchemaType,
    iterateDefaultSchemaTypes,
    newSchemaTypes
  });
};
