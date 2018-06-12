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

  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');
  const { SchemaType, DEFAULT_VALIDATION_PHASE } = requireModule('./schema/schema-type');
  const { LazyCollection } = requireModule('./base/collections');
  const moment = requireModule('moment');

  // String
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const StringPrimitive = this.defineClass(() => {
    return class StringPrimitive extends String {
      constructor(field, val) {
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
      constructor(field, val) {
        super(Math.round(parseNumber(val)));
      }
    };
  });

  // Decimal
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const DecimalPrimitive = this.defineClass(() => {
    return class DecimalPrimitive extends Number {
      constructor(field, val) {
        super(parseNumber(val));
      }
    };
  });

  // Boolean
  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const BooleanPrimitive = this.defineClass(() => {
    return class BooleanPrimitive extends Boolean {
      constructor(field, val) {
        super(!!val);
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
    return class DatePrimitive extends moment {
      constructor(field, val, ...args) {
        if (val === null || val === undefined)
          super();
        else
          super(val, ...args);
      }

      static getSchemaType(opts) {
        return new DateSchemaType(undefined, opts);
      }
    };
  });

  // Role
  const RolePrimitive = this.defineClass(() => {
    return class RolePrimitive extends StringPrimitive {};
  });

  // Array
  const CollectionSchemaType = this.defineClass((SchemaType) => {
    return class CollectionSchemaType extends SchemaType {
      constructor(ModelClass, ...args) {
        super(ModelClass || CollectionPrimitive, ...args);
      }

      initialize(consumer, type, opts, specifiedType) {
        if (!specifiedType)
          throw new Error('Array type requires an element schema type to be specified');

        return consumer.targetType(specifiedType.getModelClass());
      }
    };
  }, SchemaType);

  // We don't define a parent class here because we don't want to
  // inject application methods into the 3rd party "Readable" class
  const CollectionPrimitive = this.defineClass((LazyCollection) => {
    return class CollectionPrimitive extends LazyCollection {
      constructor(field, ...args) {
        super(...args);
      }

      static getSchemaType(opts) {
        return new CollectionSchemaType(undefined, opts);
      }

      static schema(...args) {
        null;
      }
    };
  }, LazyCollection);

  // Copy over model type methods to prototypes
  [ StringPrimitive, IntegerPrimitive, DecimalPrimitive, BooleanPrimitive, DatePrimitive, RolePrimitive, CollectionPrimitive ].forEach((klass) => {
    // const GenericSchemaType = this.defineClass((SchemaType) => {
    //   return class GenericSchemaType extends SchemaType {
    //     constructor(_, opts) {
    //       super(klass, opts);
    //     }

    //     getSchemaEngine() {
    //       return this._schemaEngine;
    //     }
    //   };
    // }, SchemaType);

    // if (!(klass.getSchemaType instanceof Function))
    //   klass['getSchemaType'] = (opts) => new GenericSchemaType(klass, opts);

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
    definePropertyRW(klass.prototype, 'getSchemaType', klass.getSchemaType);
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
