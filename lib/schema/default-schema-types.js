module.exports = function(root, requireModule) {
  const { definePropertyRO, noe, instanceOf, humanifyArrayItems } = requireModule('./utils');
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

  function getPrimitiveSchemaTypes(SchemaType, ModelType) {
    function coerceValue(val) {
      if (val instanceof ModelType)
        return val.value;

      if ((typeof val === 'string' || (val instanceof String)) ||
          (typeof val === 'number' || (val instanceof Number)) ||
          (typeof val === 'boolean' || (val instanceof Boolean)))
            return val;

      return (val) ? (val.value || val) : val;
    }

    function parseFloatValue(val) {
      var finalVal = parseFloat(('' + coerceValue(val)).replace(/[^e\d+-.]/g, ''));
      return (!isFinite(finalVal)) ? 0 : finalVal;
    }

    function parseIntegerValue(val) {
      return Math.round(parseFloatValue(val));
    }

    function parseBooleanValue(_val) {
      var val = coerceValue(_val);
      if (typeof val === 'string' || val instanceof String)
        return !(('' + val).match(/^(n|no|not|null|nil|0|void|false)$/i));

      return !!val;
    }

    function parseStringValue(_val) {
      var val = coerceValue(_val);

      if (val === null || val === undefined)
        return '';

      if ((typeof val === 'number' || val instanceof Number) && !isFinite(val))
        return '';

      return ('' + val);
    }

    function parseStringValueNull(...args) {
      var val = parseStringValue(...args);
      return (!val) ? null : val;
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

          while (index >= 0) {
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
          schemaEngine = this.getSchemaEngine(),
          modelType = this.getTargetModelType(),
          typeName = modelType.getTypeName(),
          typeInfo = schemaEngine.getTypeInfo(typeName);

      for (var i = 0, il = val.length; i < il; i++) {
        var thisVal = val[i];
        if (thisVal === null || thisVal === undefined)
          continue;

        if (typeInfo.primitiveType)
          finalVal.push((new typeInfo.primitiveType(schemaEngine, modelType)).instantiate(thisVal));
        else
          finalVal.push(modelType.instantiate(thisVal));
      }

      return finalVal;
    }

    function parseOneOfValue(val) {
      var type = this.introflect(val);
      if (!type || !(type instanceof SchemaType)) {
        Logger.warn(`Do not know what type to instantiate for oneOf ${this.getProp('field')}! Skipping! Value at fault: ${val}`);
        return null;
      }

      return type.instantiate(val);
    }

    function decomposePrimitive(_val, asPrimitive, _opts) {
      var val = coerceValue(_val),
          opts = _opts || {},
          modelType = this.getModelType(),
          getter = this.getProp('getter', opts.context),
          value = getter(val, opts);

      return (asPrimitive) ? value : modelType.instantiate({ value: value }).decompose(opts);
    }

    function decomposeOwnerField(typeName, _val, _opts) {
      var opts = _opts || {},
          owner = opts.owner,
          ownerField = opts.ownerField,
          ownerType = opts.ownerType;

      if (!owner || !ownerField || !ownerType)
        return null;

      if (!ownerType || !(ownerType instanceof ModelType))
        throw new Error('Trying to decompose a primitive when the owner is not a valid model');

      if (!(ownerField instanceof SchemaType))
        throw new Error('Trying to decompose a primitive when the ownerField is not a valid schema type');

      var myModelType = this.getModelType();
      if (!myModelType)
        return;

      if (typeName === 'OwnerType') {
        return ownerType.getTypeName();
      } else if (typeName === 'OwnerID') {
        var getterID = ownerType.getFieldProp('id', 'getter', opts.context);

        if (noe(owner.id))
          throw new Error('Owner ID is empty and yet I belong to an owner');

        return getterID(owner.id);
      } else if (typeName === 'OwnerField') {
        return ownerField.getProp('field');
      }

      return null;
    }

    class IntegerType extends SchemaType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'Integer');

        this.defineStaticProp('autoIncrement', false);

        this.primitive = true;
        this.getter(parseIntegerValue);
        this.setter(parseIntegerValue);
      }

      decompose(val, opts) {
        return decomposePrimitive.call(this, val, true, opts);
      }

      decomposeAsModel(val, opts) {
        return decomposePrimitive.call(this, val, false, opts);
      }

      instantiate(number) {
        return parseIntegerValue.call(this, number);
      }

      isValidValue(val) {
        var num = parseFloat(val);
        if (!isFinite(num))
          return false;

        return (num % 1) === 0;
      }
    }

    class DecimalType extends SchemaType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'Decimal');

        this.primitive = true;
        this.getter(parseFloatValue);
        this.setter(parseFloatValue);
      }

      decompose(val, opts) {
        return decomposePrimitive.call(this, val, true, opts);
      }

      decomposeAsModel(val, opts) {
        return decomposePrimitive.call(this, val, false, opts);
      }

      instantiate(number) {
        return parseFloatValue.call(this, number);
      }

      isValidValue(val) {
        var num = parseFloat(val);
        if (!isFinite(num))
          return false;
        return true;
      }
    }

    class DateType extends SchemaType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'Date');

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
        return decomposePrimitive.call(this, val, true, opts);
      }

      decomposeAsModel(val, opts) {
        return decomposePrimitive.call(this, val, false, opts);
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
      constructor(schemaEngine, model, type) {
        super(schemaEngine, model, type || 'String');

        this.primitive = true;
        this.max(255);

        this.getter(parseStringValueNull);
        this.setter(parseStringValueNull);
      }

      decompose(val, opts) {
        return decomposePrimitive.call(this, val, true, opts);
      }

      decomposeAsModel(val, opts) {
        return decomposePrimitive.call(this, val, false, opts);
      }

      instantiate(val) {
        return parseStringValueNull.call(this, val);
      }
    }

    class BooleanType extends SchemaType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'Boolean');

        this.primitive = true;
        this.getter(parseBooleanValue);
        this.setter(parseBooleanValue);
      }

      decompose(val, opts) {
        return decomposePrimitive.call(this, val, true, opts);
      }

      decomposeAsModel(val, opts) {
        return decomposePrimitive.call(this, val, false, opts);
      }

      instantiate(val) {
        return parseBooleanValue.call(this, val);
      }
    }

    class ArrayOfType extends SchemaType {
      constructor(schemaEngine, model, type) {
        super(schemaEngine, model, 'Array');

        this.primitive = true;

        this.defineProp('delimiter', '|');

        definePropertyRO(this, 'internalType', type);

        this.getter(parseArrayValue);
        this.setter(parseArrayValue);
      }

      getTargetTypeName() {
        return [this.internalType.getTypeName()];
      }

      getTargetModelType() {
        return this.getSchemaEngine().getModelType(this.internalType.getTypeName());
      }

      decompose(_val, _opts) {
        if (!this.schemaEngine)
          return [];

        var val = _val;
        if (noe(val))
          return [];

        if (!(val instanceof Array))
          val = [val];

        var opts = _opts || {},
            parts = [],
            internalType = this.internalType;

        if (!internalType)
          return [];

        for (var i = 0, il = val.length; i < il; i++) {
          var decomposedValue = internalType.decomposeAsModel(val[i], opts);
          parts = parts.concat(decomposedValue);
        }

        return parts;
      }

      instantiate(val) {
        return parseArrayValue.call(this, val);
      }

      validateSchema() {
        var fieldSchema = this.internalType;
        if (!fieldSchema || !(fieldSchema instanceof SchemaType))
          throw new Error(`Schema field [subtype of ${this.getProp('field')}] must inherit from SchemaType`);
      }

      async validate(_val, _opts) {
        if (!this.schemaEngine)
          return;

        var val = _val;
        if (noe(val))
          return [];

        if (!(val instanceof Array))
          val = [val];

        var opts = _opts || {},
            promises = [],
            internalType = this.internalType,
            modelType = this.schemaEngine.getModelType(internalType.getTypeName());

        if (!modelType)
          return [];

        for (var i = 0, il = val.length; i < il; i++)
          promises.push(modelType.validate(val[i], opts));

        return await Promise.all(promises);
      }
    }

    Object.assign(ArrayOfType, {
      requiresArguments: true
    });

    // TODO: Complete oneOf schema type
    class OneOfType extends SchemaType {
      constructor(schemaEngine, model, ...types) {
        super(schemaEngine, model, 'Variant');

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

        this.getter(parseOneOfValue);
        this.setter(parseOneOfValue);
      }

      getTargetTypeName() {
        return this.internalTypes.map((t) => t.getTypeName());
      }

      decompose(val) {
        // TODO: Complete
      }

      instantiate(val) {
        return parseOneOfValue.call(this, val);
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

    class OwnerType extends StringType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'OwnerType');
        this.max(64);
      }

      decompose(val, opts) {
        return decomposeOwnerField.call(this, 'OwnerType', val, opts);
      }
    }

    class OwnerID extends StringType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'OwnerID');
        this.max(64);
      }

      decompose(val, opts) {
        return decomposeOwnerField.call(this, 'OwnerID', val, opts);
      }
    }

    class OwnerField extends StringType {
      constructor(schemaEngine, model) {
        super(schemaEngine, model, 'OwnerField');
        this.max(64);
      }

      decompose(val, opts) {
        return decomposeOwnerField.call(this, 'OwnerField', val, opts);
      }
    }

    Object.assign(OneOfType, {
      requiresArguments: true
    });

    return {
      'Integer': IntegerType,
      'Decimal': DecimalType,
      'Date': DateType,
      'String': StringType,
      'Boolean': BooleanType,
      'ArrayOf': ArrayOfType,
      'OneOf': OneOfType,
      'OwnerType': OwnerType,
      'OwnerID': OwnerID,
      'OwnerField': OwnerField
    };
  }

  Object.assign(root, {
    getPrimitiveSchemaTypes,
    assertSchemaTypes
  });
};
