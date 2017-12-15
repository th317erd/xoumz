module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf } = requireModule('./utils');
  const { required } = requireModule('./schema/validators');
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
    constructor(schema, model, typeName) {
      definePropertyRW(this, 'parentSchema', schema);
      definePropertyRW(this, 'parentModel', model);
      definePropertyRW(this, 'LNOP', () => this);
      definePropertyRW(this, 'defineStaticProp', (name, defaultValue, _altValue, _cb) => {
        var propNames = this._propNames;
        if (propNames.indexOf(name) < 0)
          propNames.push(name);

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
        var propNames = this._propNames;
        if (propNames.indexOf(name) < 0)
          propNames.push(name);

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
      definePropertyRO(this, '_propNames', []);
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
      this.defineStaticProp('required', undefined, undefined, () => {
        this.validator(required);
      });

      this.defineStaticProp('primitive', false);
      this.defineStaticProp('virtual', false);

      this.defineProp('value', null);
      this.defineProp('field', null);
      this.defineProp('max', null);
      this.defineProp('min', null);

      this.defineProp('setter', (val) => val, undefined, (val, name) => {
        defaultSchemaTypes.assertSchemaTypes('function')(val, name);
        return val.bind(this);
      });

      this.defineProp('getter', (val) => val, undefined, (val, name) => {
        defaultSchemaTypes.assertSchemaTypes('function')(val, name);
        return val.bind(this);
      });
    }

    getAllPropNames() {
      return this._propNames;
    }

    getTypeName() {
      return this.typeName;
    }

    getTargetTypeName() {
      return this.getTypeName();
    }

    getModelType() {
      return this.parentModel;
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

    validator(cb) {
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

    async validate(_val, _opts) {
      var opts = _opts || {},
          context = opts.context;

      // We skip virtual fields
      if (this.getProp('virtual', context))
        return;

      var getter = this.getProp('getter', context),
          value = getter(_val, opts.owner),
          validators = this.getProp('validators', context),
          promises = [];

      if (noe(validators))
        return;

      for (var i = 0, il = validators.length; i < il; i++) {
        var validator = validators[i];
        promises.push(validator.call(this, value));
      }

      return Promise.all(promises);
    }

    validateSchema() {
    }

    isValidValue(val) {
      return false;
    }

    decompose(val, _opts) {
      throw new Error('Can not decompose a base SchemaType');
    }

    instantiate(val) {
      throw new Error('Can not instantiate a base SchemaType');
    }

    compareTo(schemaType, cb) {
      var nativePropNames = this.getAllPropNames(),
          foreignPropNames = schemaType.getAllPropNames(),
          propNames = Object.keys(nativePropNames.concat(foreignPropNames).reduce((obj, item) => {
            obj[item] = true;
            return obj;
          }, {})),
          abort = () => abort,
          areSame = true;

      for (var i = 0, il = propNames.length; i < il; i++) {
        var propName = propNames[i];
        if (propName.match(/^(setter|getter)$/))
          continue;

        var nativeProp = this.getProp(propName),
            foreignProp = schemaType.getProp(propName),
            ret;

        if (nativeProp !== foreignProp) {
          ret = cb('different', 'prop', propName, nativeProp, foreignProp, this, schemaType, abort);
          if (ret !== false)
            areSame = false;
        }

        if (ret === abort)
          break;
      }

      return areSame;
    }
  }

  const DefaultSchemaTypes = defaultSchemaTypes.defineDefaultSchemaTypes(SchemaType),
        NOP = () => {
          return DefaultSchemaTypes;
        };

  function definePrimitiveSchemaType(schema, name, TypeKlass) {
    Object.defineProperty(schema, name, {
      enumerable: true,
      configurable: true,
      get: () => {
        return new TypeKlass();
      },
      set: NOP
    });
  }

  function iteratePrimitiveSchemaTypes(cb) {
    var keys = Object.keys(DefaultSchemaTypes),
        rets = [],
        abort = () => abort;

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          ret = cb(key, DefaultSchemaTypes[key], abort);

      if (ret === abort)
        break;

      rets.push(ret);
    }

    return rets;
  }

  Object.assign(root, defaultSchemaTypes, {
    SchemaType,
    DefaultSchemaTypes,
    definePrimitiveSchemaType,
    iteratePrimitiveSchemaTypes
  });
};
