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
        fieldDefinition = (this.getFieldDefinition instanceof Function) ? this.getFieldDefinition() : null;

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

  // String
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

  // Role
  class RolePrimitive extends StringPrimitive {}

  // Array
  const ArraySchemaType = this.wrapClass(class ArraySchemaType extends SchemaType {
    initialize(type) {
      if (!type)
        throw new Error('Array type requires an element type to be specified');
    }
  });

  class ArrayPrimitive extends Array {
    static getType() {
      return new ArraySchemaType();
    }

    static schema(...args) {
      null;
    }

    static primitive() {
      return true;
    }
  }

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive, BooleanPrimitive, DatePrimitive, RolePrimitive, ArrayPrimitive ].forEach((klass) => {
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

    if (!(klass.getType instanceof Function))
      klass.getType = () => new GenericSchemaType();

    if (!(klass.schema instanceof Function)) {
      klass.schema = (defineSchema) => {
        return defineSchema(null, {
          version: 1,
          schema: (types) => {
            var type = types[klass.getTypeName()];

            return {
              value: type
            };
          },
          demote: (model) => model,
          promote: (model) => model
        });
      };
    }

    if (!(klass.primitive instanceof Function))
      klass.primitive = () => true;

    if (!(klass.getTypeName instanceof Function))
      klass.getTypeName = () => klass.name;
  });

  root.export({
    String: StringPrimitive,
    Integer: IntegerPrimitive,
    Decimal: DecimalPrimitive,
    Boolean: BooleanPrimitive,
    Date: DatePrimitive,
    Role: RolePrimitive,
    Array: ArrayPrimitive
  });
};
