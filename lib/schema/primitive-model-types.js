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
  const DateSchemaType = this.wrapClass(class DateSchemaType extends SchemaType {
    constructor() {
      super(DatePrimitive);
    }

    // Default properties can be set here (on the newly created consumer)
    createNewConsumer() {
      return super.createNewConsumer(DatePrimitive);
    }
  });

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
  const CollectionSchemaType = this.wrapClass(class CollectionSchemaType extends SchemaType {
    constructor() {
      super(CollectionPrimitive);
    }

    createNewConsumer() {
      return super.createNewConsumer(CollectionPrimitive);
    }

    initialize(type) {
      if (!type)
        throw new Error('Array type requires an element schema type to be specified');
    }
  });

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

  // Scope
  const ScopeSchemaType = this.wrapClass(class ScopeSchemaType extends SchemaType {
    constructor() {
      super(ScopePrimitive);
    }

    createNewConsumer(type) {
      var consumer = super.createNewConsumer(ScopePrimitive),
          modelClass = type.getModelClass();

      debugger;

      return consumer.virtual.getter(function() {
        return 'derp';
      }).setter(function(value) {
        console.log('SETTING VALUE FOR SCOPE!', value);
      });
    }

    initialize(type) {
      if (!type)
        throw new Error('Scope type requires an schema type to be specified');
    }
  });

  class ScopePrimitive extends LazyItem {
    constructor(field, ...args) {
      super(...args);

      var type = this.getType().modelType;
      debugger;
    }

    static getType() {
      return new ScopeSchemaType();
    }

    static schema(defineSchema) {
      return defineSchema(null, {
        version: 1,
        schema: function({ String, Integer }, parent) {
          return {
            'ownerID': String.nullable(false).required,
            'ownerType': String.nullable(false).required,
            'ownerOrder': Integer.nullable(true),
            'ownerField': String.nullable(true)
          };
        },
        demote: function(values, _opts) {},
        promote: function(values, _opts) {}
      });
    }
  }

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive, BooleanPrimitive, DatePrimitive, RolePrimitive, CollectionPrimitive, ScopePrimitive ].forEach((klass) => {
    const GenericSchemaType = this.wrapClass(class GenericSchemaType extends SchemaType {
      constructor() {
        super(klass);
      }
    });

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

    if (!(klass.getTypeName instanceof Function))
      klass['getTypeName'] = () => true;

    definePropertyRW(klass.prototype, 'validate', validateModel);
    definePropertyRW(klass.prototype, 'getBaseModelClass', () => klass);
    definePropertyRW(klass.prototype, 'getModelClass', () => klass);
    definePropertyRW(klass.prototype, 'getTypeName', klass.getTypeName);
    definePropertyRW(klass.prototype, 'getType', klass.getType);
    definePropertyRW(klass.prototype, 'schema', klass.schema);
    definePropertyRW(klass.prototype, 'primitive', klass.primitive);
  });

  root.export({
    String: StringPrimitive,
    Integer: IntegerPrimitive,
    Decimal: DecimalPrimitive,
    Boolean: BooleanPrimitive,
    Date: DatePrimitive,
    Role: RolePrimitive,
    Collection: CollectionPrimitive,
    Scope: ScopePrimitive
  });
};
