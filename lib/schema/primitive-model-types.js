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
  const { LazyCollection } = requireModule('./base/collections');
  const { generateModelMethods } = requireModule('./schema/model-schema');
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

        definePropertyRO(this, '_fieldDefinition', field);
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

        definePropertyRO(this, '_fieldDefinition', field);
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

        definePropertyRO(this, '_fieldDefinition', field);
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

        definePropertyRO(this, '_fieldDefinition', field);
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

        definePropertyRO(this, '_fieldDefinition', field);
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

  // Array
  const CollectionSchemaType = this.defineClass((SchemaType) => {
    return class CollectionSchemaType extends SchemaType {
      constructor(ModelClass, ...args) {
        super(ModelClass || CollectionPrimitive, ...args);
      }

      initialize(consumer, type, opts, specifiedType) {
        if (!specifiedType) {
          debugger;
          throw new Error('Array type requires an element schema type to be specified');
        }

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

        definePropertyRO(this, '_fieldDefinition', field);
      }

      static getSchemaTypeClass() {
        return CollectionSchemaType;
      }

      static schema(...args) {
        null;
      }

      static primitive() {
        return Array;
      }
    };
  }, LazyCollection);

  // Copy over model type methods to prototypes
  var primitives = {
        'String': StringPrimitive,
        'Integer': IntegerPrimitive,
        'Decimal': DecimalPrimitive,
        'Boolean': BooleanPrimitive,
        'Date': DatePrimitive,
        'Role': RolePrimitive,
        'Collection': CollectionPrimitive
      };

  Object.keys(primitives).forEach((typeName) => {
    var klass = primitives[typeName];

    if (!klass.hasOwnProperty('schema')) {
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

    if (!klass.hasOwnProperty('primitive'))
      klass['primitive'] = () => Object.getPrototypeOf(klass);

    if (!klass.prototype.hasOwnProperty('validate'))
      definePropertyRW(klass.prototype, 'validate', validateModel);

    if (!klass.prototype.hasOwnProperty('primitive'))
      definePropertyRW(klass.prototype, 'primitive', klass.primitive);

    primitives[typeName] = generateModelMethods(klass, typeName);
  });

  root.export(primitives);
};
