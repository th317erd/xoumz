module.exports = function(root, requireModule) {
  function parseNumber(_val) {
    var val = (!_val) ? 0 : _val.valueOf();

    if (typeof val !== 'number' && !(val instanceof Number))
      val = parseFloat(('' + val).replace(/[^\d.-]/g, ''));

    if (isNaN(val) || !isFinite(val))
      val = 0;

    return val;
  }

  function validateModel(_opts) {
    if (typeof this.getSchema !== 'function')
      return;

    var opts = _opts || {},
        fieldDefinition = (typeof this.getFieldDefinition === 'function') ? this.getFieldDefinition() : null;

    if (!fieldDefinition)
      return;

    var validators = fieldDefinition.getProp('validators', opts),
        phaseValidators = validators[opts.phase || DEFAULT_VALIDATION_PHASE] || [],
        value = this.valueOf(),
        errors = [],
        validateOpts = Object.assign({ phase: 'validate' }, opts, { field: fieldDefinition });

    for (var validator of phaseValidators.values()) {
      var ret = validator.call(this, value, validateOpts);
      if (ret)
        errors = errors.concat(ret);
    }

    return (errors.length) ? errors : undefined;
  }

  const { definePropertyRW, definePropertyRO } = requireModule('./base/utils');
  const { SchemaType, DEFAULT_VALIDATION_PHASE } = requireModule('./schema/schema-type');
  const { generateModelMethods } = requireModule('./schema/model-schema');
  const { DecomposedModel } = requireModule('./schema/decomposed-model');
  const moment = requireModule('moment');

  // String
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const StringPrimitive = this.defineClass(() => {
    return class StringPrimitive extends String {
      constructor(val) {
        if (val === null || val === undefined)
          super();
        else
          super(val);
      }
    };
  });

  // Integer
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const IntegerPrimitive = this.defineClass(() => {
    return class IntegerPrimitive extends Number {
      constructor(val) {
        super(Math.round(parseNumber(val)));
      }
    };
  });

  // Decimal
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const DecimalPrimitive = this.defineClass(() => {
    return class DecimalPrimitive extends Number {
      constructor(val) {
        super(parseNumber(val));
      }
    };
  });

  // Boolean
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const BooleanPrimitive = this.defineClass(() => {
    return class BooleanPrimitive extends Boolean {
      constructor(val) {
        super(!!val);

        //definePropertyRO(this, '_fieldDefinition', opts.field);
      }
    };
  });

  // Date
  const DateSchemaType = this.defineClass((SchemaType) => {
    return class DateSchemaType extends SchemaType {
      constructor(ModelClass, ...args) {
        super(ModelClass || DatePrimitive, ...args);
      }

      // Default properties can be set here (on the newly created consumer)
      createNewConsumer(ModelClass, ...args) {
        return super.createNewConsumer(ModelClass || DatePrimitive, ...args);
      }
    };
  }, SchemaType);

  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const DatePrimitive = this.defineClass(() => {
    function convertMomentToRealClass() {
      function createWrapperFunction(func) {
        return function(...args) {
          var ret = func.apply(this, args);
          return (ret instanceof moment) ? new DatePrimitive(this._fieldDefinition, ret) : ret;
        };
      }

      function Moment(...args) {
        var thisMoment = moment.apply(this, args);
        Object.assign(this, thisMoment);
      }

      var momentProto = moment.prototype,
          proto = Moment.prototype = Object.create(momentProto),
          keys = Object.getOwnPropertyNames(momentProto);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        if (!momentProto.hasOwnProperty(key))
          continue;

        var value = momentProto[key];
        if (typeof value !== 'function')
          continue;

        proto[key] = createWrapperFunction(value);
      }

      return Moment;
    }

    const Moment = convertMomentToRealClass();

    return class DatePrimitive extends Moment {
      constructor(val, ...args) {
        if (val === null || val === undefined)
          super();
        else
          super(val, ...args);
      }

      static getSchemaTypeClass() {
        return DateSchemaType;
      }
    };
  });

  // Role
  const RolePrimitive = this.defineClass(() => {
    return class RolePrimitive extends StringPrimitive {};
  });

  // Copy over model type methods to prototypes
  var primitives = {
        'String': StringPrimitive,
        'Integer': IntegerPrimitive,
        'Decimal': DecimalPrimitive,
        'Boolean': BooleanPrimitive,
        'Date': DatePrimitive,
        'Role': RolePrimitive
      };

  Object.keys(primitives).forEach((modelName) => {
    var klass = primitives[modelName];

    if (!klass.hasOwnProperty('schema')) {
      klass['schema'] = (defineSchema) => {
        return defineSchema(null, {
          schema: (types) => {
            var type = types[klass.getModelName()];

            return {
              value: type
            };
          },
          demote: (model) => model,
          promote: (model) => model
        });
      };
    }

    if (!klass.hasOwnProperty('primitive'))
      klass['primitive'] = () => Object.getPrototypeOf(klass);

    if (!klass.prototype.hasOwnProperty('validate'))
      definePropertyRW(klass.prototype, 'validate', validateModel);

    if (!klass.prototype.hasOwnProperty('primitive'))
      definePropertyRW(klass.prototype, 'primitive', klass.primitive);

    if (!klass.prototype.hasOwnProperty('decompose')) {
      definePropertyRW(klass.prototype, 'decompose', async function(field) {
        var value = this.value;
        if (value != null)
          value = value.valueOf();

        return [new DecomposedModel(value, { model: this, schema: this.getSchema(), field })];
      });
    }

    primitives[modelName] = generateModelMethods(klass, modelName);
  });

  root.export(primitives);
};
