module.exports = function(root, requireModule) {
  const { SchemaType, DEFAULT_VALIDATION_PHASE } = requireModule('./schema/schema-type');
  const moment = requireModule('moment');

  function parseNumber(_val) {
    var val = (!_val) ? 0 : _val.valueOf();

    if (typeof val !== 'number' && !(val instanceof Number))
      val = parseFloat(('' + val).replace(/[^\d.-]/g, ''));

    if (isNaN(val) || !isFinite(val))
      val = 0;

    return val;
  }

  function validateModel(_opts) {
    if (!(this.schema instanceof Function))
      return;

    var opts = _opts || {},
        schema = this.schema(),
        validators = schema.getProp('validators', opts),
        phaseValidators = validators[opts.phase || DEFAULT_VALIDATION_PHASE] || [],
        value = this.valueOf(),
        errors = [],
        validateOpts = Object.assign({ phase: 'validate' }, opts, { schema });

    for (var validator of phaseValidators.values()) {
      var ret = validator.call(this, value, validateOpts);
      if (ret)
        errors = errors.concat(ret);
    }

    return (errors.length) ? errors : undefined;
  }

  class StringPrimitive extends String {
    constructor(val) {
      if (val === null || val === undefined)
        super();
      else
        super(val);
    }
  }

  // Integer
  class IntegerPrimitive extends Number {
    constructor(val) {
      super(Math.round(parseNumber(val)));
    }
  }

  // Decimal
  class DecimalPrimitive extends Number {
    constructor(val) {
      super(parseNumber(val));
    }
  }

  // Boolean
  class BooleanPrimitive extends Boolean {
    constructor(val) {
      super(!!val);
    }
  }

  // Date
  class DatePrimitive extends moment {
    constructor(...args) {
      super(...args);
    }
  }

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive, BooleanPrimitive, DatePrimitive ].forEach((klass) => {
    const GenericSchemaType = this.wrapClass(class GenericSchemaType extends SchemaType {
      constructor() {
        super(klass);
      }
    });

    klass.prototype['validate'] = validateModel;
    klass.prototype['getBaseModelClass'] = () => klass;
    klass.prototype['getModelClass'] = () => klass;
    klass.prototype['getTypeName'] = () => klass.getTypeName();
    klass.prototype['getType'] = () => klass.getType();
    klass.prototype['schema'] = () => null;
    klass.prototype['primitive'] = () => true;

    klass.getType = () => new GenericSchemaType();
    klass.schema = () => null;
    klass.primitive = () => true;
    klass.getTypeName = () => klass.name;
  });

  root.export({
    String: StringPrimitive,
    Integer: IntegerPrimitive,
    Decimal: DecimalPrimitive,
    Boolean: BooleanPrimitive,
    Date: DatePrimitive
  });
};
