module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, instanceOf, humanifyArrayItems } = requireModule('./utils');
  const Logger = requireModule('./logger');
  const moment = requireModule('moment');

  function assertSchemaTypes(...types) {
    return function(val, propName) {
      if (val === undefined || val === null)
        return null;

      if (!instanceOf(val, ...types))
        throw new Error(propName + ' must be a ' + humanifyArrayItems(types));

      return val;
    };
  }

  function parseFloatValue(val) {
    var finalVal = parseFloat(('' + val).replace(/[^e\d+-.]/g, ''));
    return (!isFinite(finalVal)) ? 0 : finalVal;
  }

  function parseIntegerValue(val) {
    return Math.round(parseFloatValue(val));
  }

  function parseBooleanValue(val) {
    if (typeof val === 'string' || val instanceof String)
      return (('' + val).match(/^(n|no|not|null|nil|0|void|false)$/i)) ? false : true;
    
    return !!val;
  }

  function parseStringValue(val) {
    if (val === null || val === undefined)
      return '';
    
    if ((typeof val === 'number' || val instanceof Number ) && !isFinite(val))
      return '';
      
    return ('' + val);
  }

  function parseArrayValue(_val) {
    function parseArrayItems(val) {
      if (val instanceof String || typeof val === 'string') {
        var delimiter = this.getProp('delimiter');

        if (!delimiter)
          return [val];

        var items = [],
            startIndex = 0,
            lastIndex = 0,
            index = val.indexOf(delimiter),
            skipIndex = false;

        if (index < 0)
          return [val];

        while(index >= 0) {
          skipIndex = (delimiter.length === 1 && index > 0 && val.charAt(index - 1) === '\\');
          
          if (!skipIndex) {
            items.push(val.substring(startIndex, index).replace('\\' + delimiter, delimiter));
            startIndex = index + delimiter.length;
          }
          
          lastIndex = index + delimiter.length;
          index = val.indexOf(delimiter, lastIndex + 1);
        }

        if (startIndex <= val.length)
          items.push(val.substring(startIndex).replace('\\' + delimiter, delimiter));

        return items;
      }

      return [val];
    }

    var val = (_val instanceof Array) ? _val : parseArrayItems.call(this, _val),
        finalVal = [],
        type = this.internalType;
    
    for (var i = 0, il = val.length; i < il; i++) {
      var thisVal = val[i];
      if (thisVal === null || thisVal === undefined)
        continue;

      finalVal.push(type.instantiate(thisVal));
    }

    return finalVal;
  }

  function parseOneOfValue(val) {
    var type = this.introflect(val);
    if (!type || !(type instanceof SchemaType)) {
      Logger.warn(`Do not know what type to instantiate for oneOf #{this.getProp('field')}! Skipping! Value at fault: #{val}`);
      return null;
    }

    return type.instantiate(val);
  }

  function decomposePrimitive(val, _opts) {
    var opts = _opts || {},
        getter = this.getProp('getter', opts.context),
        value = getter(val, opts.owner);

    return (!opts.primitive) ? { schemaType: this, value: { value } } : value;
  }

  function defineDefaultSchemaTypes(SchemaType) {
    class IntegerType extends SchemaType {
      constructor(schema) {
        super(schema, 'Integer');

        this.defineStaticProp('autoIncrement', false);

        this.primitive = true;
        this.getter(root.parseIntegerValue);
        this.setter(root.parseIntegerValue);
      }

      decompose(val, opts) {
        return root.decomposePrimitive.call(this, val, opts);
      }

      instantiate(number) {
        return root.parseIntegerValue.call(this, number);
      }

      isValidValue(val) {
        var num = parseFloat(val);
        if (!isFinite(num))
          return false;
        
        return ((num % 1) !== 0) ? false : true;
      }
    }

    class DecimalType extends SchemaType {
      constructor(schema) {
        super(schema, 'Decimal');

        this.primitive = true;
        this.getter(root.parseFloatValue);
        this.setter(root.parseFloatValue);
      }

      decompose(val, opts) {
        return root.decomposePrimitive.call(this, val, opts);
      }

      instantiate(number) {
        return root.parseFloatValue.call(this, number);
      }

      isValidValue(val) {
        var num = parseFloat(val);
        if (!isFinite(num))
          return false;
        return true;
      }
    }

    class DateTimeType extends SchemaType {
      constructor(schema) {
        super(schema, 'DateTime');

        this.primitive = true;

        // Defualt format is ISO
        this.defineProp('format', undefined);

        this.getter(function(val) {
          return moment(val, this.getProp('format')).toISOString();
        });

        this.setter(function(val) {
          return moment(val, this.getProp('format'));
        });
      }

      decompose(val, opts) {
        return root.decomposePrimitive.call(this, val, opts);
      }

      instantiate(val) {
        var setter = this.getProp('setter');
        return setter(val);
      }

      isValidValue(val) {
        return moment(val, this.getProp('format')).isValid();
      }
    }

    class StringType extends SchemaType {
      constructor(schema) {
        super(schema, 'String');

        this.primitive = true;
        this.getter(root.parseStringValue);
        this.setter(root.parseStringValue);
      }

      decompose(val, opts) {
        return root.decomposePrimitive.call(this, val, opts);
      }

      instantiate(val) {
        return root.parseStringValue.call(this, val);
      }
    }

    class BooleanType extends SchemaType {
      constructor(schema) {
        super(schema, 'Boolean');

        this.primitive = true;
        this.getter(root.parseBooleanValue);
        this.setter(root.parseBooleanValue);
      }

      decompose(val, opts) {
        return root.decomposePrimitive.call(this, val, opts);
      }

      instantiate(val) {
        return root.parseBooleanValue.call(this, val);
      }
    }

    class ArrayOfType extends SchemaType {
      constructor(schema, type) {
        super(schema, 'Array');

        this.primitive = true;

        this.defineProp('delimiter', '|');

        definePropertyRO(this, 'internalType', type);

        this.getter(root.parseArrayValue);
        this.setter(root.parseArrayValue);
      }

      getTargetTypeName() {
        return [this.internalType.getTypeName()];
      }

      decompose(_val, _opts) {
        if (!this.parentSchema)
          return;

        var val = _val;
        if (noe(val))
          return;

        if (!(val instanceof Array))
          val = [val];

        var opts = _opts || {},
            parts = [],
            internalType = this.internalType,
            modelType = this.parentSchema.getModelSchema(internalType.getTypeName());

        if (!modelType)
          return;

        for (var i = 0, il = val.length; i < il; i++)
          parts.push(modelType.decompose(val[i], opts));

        return parts;
      }

      instantiate(val) {
        return root.parseArrayValue.call(this, val);
      }

      validateSchema() {
        var fieldSchema = this.internalType;
        if (!fieldSchema || !(fieldSchema instanceof SchemaType))
          throw new Error(`Schema field [subtype of ${this.getProp('field')}] must inherit from SchemaType`);
      }
    }

    Object.assign(ArrayOfType, {
      requiresArguments: true
    });

    // TODO: Complete oneOf schema type
    class OneOfType extends SchemaType {
      constructor(schema, ...types) {
        super(schema, 'Variant');

        this.primitive = true;
        
        // Default introflection
        this.defineProp('introflect', (val) => {
          var types = this.internalTypes;
          for (var i = 0, il = types.length; i < il; i++) {
            var type = types[i];
            if (type.isValidValue(val))
              return type;
          }
        }, undefined, (val, name) => {
          root.assertSchemaTypes('function')(val, name);
          return val.bind(this);
        });

        definePropertyRO(this, 'internalTypes', root.introspectionTypeOrder(types));

        this.getter(root.parseOneOfValue);
        this.setter(root.parseOneOfValue);
      }

      getTargetTypeName() {
        return this.internalTypes.map((t) => t.getTypeName());
      }

      decompose(val) {
        // TODO: Complete
      }

      instantiate(val) {
        return root.parseOneOfValue.call(this, val);
      }

      validateSchema() {
        var fieldSchemas = this.internalTypes;
        for (var i = 0, il = fieldSchemas.length; i < il; i++) {
          var fieldSchema = fieldSchemas[i];
          if (!fieldSchema || !(fieldSchema instanceof SchemaType))
            throw new Error(`Schema field [subtype of ${this.getProp('field')}@#{i}] must inherit from SchemaType`);
        }
      }
    }

    Object.assign(OneOfType, {
      requiresArguments: true
    });

    return {
      'Integer': IntegerType,
      'Decimal': DecimalType,
      'DateTime': DateTimeType,
      'String': StringType,
      'Boolean': BooleanType,
      'ArrayOf': ArrayOfType,
      'OneOf': OneOfType
    };
  }

  Object.assign(root, {
    defineDefaultSchemaTypes,
    assertSchemaTypes,
    parseFloatValue,
    parseIntegerValue,
    parseBooleanValue,
    parseStringValue,
    parseArrayValue,
    parseOneOfValue,
    decomposePrimitive
  });
};
