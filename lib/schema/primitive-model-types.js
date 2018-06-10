module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');
  const { SchemaType, DEFAULT_VALIDATION_PHASE } = requireModule('./schema/schema-type');
  const { LazyCollection, LazyItem } = requireModule('./base/collections');
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
    constructor(field, val) {
      if (val === null || val === undefined)
        super();
      else
        super(val);
    }
  }

  // Integer
  class IntegerPrimitive extends Number {
    constructor(field, val) {
      super(Math.round(parseNumber(val)));
    }
  }

  // Decimal
  class DecimalPrimitive extends Number {
    constructor(field, val) {
      super(parseNumber(val));
    }
  }

  // Boolean
  class BooleanPrimitive extends Boolean {
    constructor(field, val) {
      super(!!val);
    }
  }

  // Date
  class DateSchemaType extends SchemaType {
    constructor() {
      super(DatePrimitive);
    }

    // Default properties can be set here (on the newly created consumer)
    createNewConsumer() {
      return super.createNewConsumer(DatePrimitive);
    }
  }

  class DatePrimitive extends moment {
    constructor(field, val, ...args) {
      if (val === null || val === undefined)
        super();
      else
        super(val, ...args);
    }

    static getType() {
      return new DateSchemaType();
    }
  }

  // Role
  class RolePrimitive extends StringPrimitive {}

  // Array
  class CollectionSchemaType extends SchemaType {
    constructor(ModelClass) {
      super(ModelClass || CollectionPrimitive);
    }

    createNewConsumer(type, specifiedType) {
      return super.createNewConsumer(type).targetType(specifiedType.getModelClass());
    }

    initialize(type, specifiedType) {
      if (!specifiedType)
        throw new Error('Array type requires an element schema type to be specified');
    }
  }

  class CollectionPrimitive extends LazyCollection {
    constructor(field, ...args) {
      super(...args);
    }

    static getType() {
      return new CollectionSchemaType();
    }

    static schema(...args) {
      null;
    }
  }

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive, BooleanPrimitive, DatePrimitive, RolePrimitive, CollectionPrimitive ].forEach((klass) => {
    class GenericSchemaType extends SchemaType {
      constructor() {
        super(klass);
      }
    }

    if (!(klass.getType instanceof Function))
      klass['getType'] = () => new GenericSchemaType();

    if (!(klass.schema instanceof Function)) {
      klass['schema'] = (defineSchema) => {
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
      klass['primitive'] = () => Object.getPrototypeOf(klass);

    definePropertyRW(klass.prototype, 'primitive', klass.primitive);

    if (!(klass.getTypeName instanceof Function))
      klass['getTypeName'] = () => Object.getPrototypeOf(klass).name;

    definePropertyRW(klass.prototype, 'validate', validateModel);
    definePropertyRW(klass.prototype, 'getBaseModelClass', () => klass);
    definePropertyRW(klass.prototype, 'getModelClass', () => klass);
    definePropertyRW(klass.prototype, 'getTypeName', klass.getTypeName);
    definePropertyRW(klass.prototype, 'getType', klass.getType);
    definePropertyRW(klass.prototype, 'schema', klass.schema);
  });

  root.export({
    String: StringPrimitive,
    Integer: IntegerPrimitive,
    Decimal: DecimalPrimitive,
    Boolean: BooleanPrimitive,
    Date: DatePrimitive,
    Role: RolePrimitive,
    Collection: CollectionPrimitive
  });
};
