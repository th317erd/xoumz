module.exports = function(root, requireModule) {
  const { SchemaType, DEFAULT_VALIDATION_PHASE } = requireModule('./schema/schema-type');

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

    static getTypeName() {
      return 'String';
    }

    static getType() {
      return new StringType();
    }
  }

  // String
  const StringType = this.wrapClass(class StringType extends SchemaType {
    constructor() {
      super(StringPrimitive);
    }
  });

  // Integer
  class IntegerPrimitive extends Number {
    constructor(val) {
      super(Math.round(parseNumber(val)));
    }

    static getTypeName() {
      return 'Integer';
    }

    static getType() {
      return new IntegerType();
    }
  }

  const IntegerType = this.wrapClass(class IntegerType extends SchemaType {
    constructor() {
      super(IntegerPrimitive);
    }
  });

  // Decimal
  class DecimalPrimitive extends Number {
    constructor(val) {
      super(parseNumber(val));
    }

    static getTypeName() {
      return 'Decimal';
    }

    static getType() {
      return new DecimalType();
    }
  }

  const DecimalType = this.wrapClass(class DecimalType extends SchemaType {
    constructor() {
      super(DecimalPrimitive);
    }
  });

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive ].forEach((klass) => {
    klass.prototype['validate'] = validateModel;
    klass.prototype['getBaseModelClass'] = () => klass;
    klass.prototype['getModelClass'] = () => klass;
    klass.prototype['getTypeName'] = () => klass.getTypeName();
    klass.prototype['getType'] = () => klass.getType();
    klass.prototype['schema'] = () => null;
    klass.schema = () => null;
  });

  root.export({
    StringPrimitive,
    IntegerPrimitive,
    DecimalPrimitive
  });
};
