import { definePropertyRO, definePropertyRW, isType } from './utils';

// function constructType(_type, value) {
//   var type = _type;

//   if (isType(type, String)) {
//     return (utils.noe(value)) ? '' : ('' + value);
//   } else if (isType(type, Number)) {
//     return (utils.noe(value)) ? 0 : value;
//   } else if (isType(type, Boolean)) {
//     return !!value;
//   } else if (isType(type, Array)) {
//     if (utils.noe(value) || !(value instanceof Array))
//       return [];

//     type = type[0];
//     var ret = new Array(value.length);
//     for (var i = 0, il = value.length; i < il; i++)
//       ret[i] = constructType(type, value[i]);

//     return ret;
//   }

//   if (value === undefined || value === null)
//     return null;

//   try {
//     return new type(value);  
//   } catch (e) {
//     return null;
//   }
// }

function keysRequired(context, ...args) {
  for (var i = 1, il = args.length; i < il; i++) {
    var key = args[i];
    if (!context[key])
      throw new Error('Schema field "' + key + '" required for field "' + context.name + '"');
  }
}

function getSchemaDefinition(def) {
  if (def instanceof Array) {
    if (def[0] instanceof Function)
      return [{ type: def }];

    return def;
  }

  if (def instanceof Function)
    return [{ type: def }];

  return [ def ];
}

function isPrimitive(type) {
  return (type === String || type === Number || type === Boolean);
}

class SchemaField {
  constructor(fieldName, _fieldDef) {
    var targets = {},
        fieldDefs = getSchemaDefinition(_fieldDef),
        baseFieldDef;
    
    // Find base field definition
    for (var i = 0, il = fieldDefs.length; i < il; i++) {
      var def = fieldDefs[i];
      if (!def)
        continue;
      
      if (!def.target || def.target === '*') {
        baseFieldDef = def;
        break;
      }
    }

    if (!baseFieldDef)
      baseFieldDef = {};

    // Loop through other fields definitions, merging with base field definition
    for (var i = 0, il = fieldDefs.length; i < il; i++) {
      var def = fieldDefs[i];
      if (!def)
        continue;
      
      def = { name: fieldName, ...baseFieldDef, ...def };
      
      if (!def.target)
        def.target = '*';

      keysRequired(def, 'type');

      if (!(def.type instanceof Function) && !((def.type instanceof Array) && (def.type[0] instanceof Function)))
        throw new Error('Schema type for field "' + def.name + '" is not a class');

      if (targets.hasOwnProperty(def.target))
        throw new Error('Schema target "' + def.target + '" already specified for field "' + def.name + '"');

      targets[def.target] = def;
    }

    if (!targets.hasOwnProperty('*'))
      throw new Error('Schema target "*" required for field "' + def.name + '"');

    definePropertyRO(this, 'targets', targets);
  }

  formatValue(val, op, _args) {
    var args = _args || {},
        currentTarget = args.target || '*',
        target = this.targets[currentTarget];

    if (!target) {
      currentTarget = '*';
      target = this.targets[currentTarget];
    }

    if (target.formatValue instanceof Function)
      return target.formatValue.call(args.record, val, op, { ...args, target: currentTarget });

    var type = target.type;
    if (op === 'get') {
      if (val === undefined || val === null)
        return (!(target.type instanceof Array)) ? null : [];
      else
        return (type instanceof Array) ? ([].concat(val)) : (isPrimitive(type)) ? new type(val) : val;
    } else if (op === 'set') {
      return (val === undefined || val === null) ? null : val;
    }
  }
}

function defineTypeSchema(typeName, klass, schemaGetter) {
  function schemaFieldGetterFactory(instance, internalFieldName, schemaField) {
    return function() {
      var target = instance._defaultTarget || '*';
      return schemaField.formatValue.call(schemaField, instance[internalFieldName], 'get', { target, record: this });
    };
  }

  function schemaFieldSetterFactory(instance, internalFieldName, schemaField) {
    return function(val) {
      var target = instance._defaultTarget || '*';
      instance[internalFieldName] = schemaField.formatValue.call(schemaField, val, 'set', { target, record: this });
    };
  }

  function injectSchemaFields(instance) {
    var schema = schemaGetter.call(instance, SchemaTypeKlass),
        keys = Object.keys(schema),
        schemaFields = {};

    definePropertyRO(instance, '_schemaFields', schemaFields);
    for (var i = 0, il = keys.length; i < il; i++) {
      var fieldName = keys[i];
      if (!fieldName)
        continue;

      var schemaField = new SchemaField(fieldName, schema[fieldName]),
          internalFieldName = '_' + fieldName;
          
      definePropertyRW(instance, internalFieldName, null);
      schemaFields[fieldName] = schemaField;

      Object.defineProperty(instance, fieldName, {
        enumerable: true,
        configurable: false,
        get: schemaFieldGetterFactory(instance, internalFieldName, schemaField),
        set: schemaFieldSetterFactory(instance, internalFieldName, schemaField)
      });
    }
  }

  var SchemaTypeKlass = (class SchemaType extends klass {
    constructor(...args) {
      super(...args);

      injectSchemaFields(this);
    }

    getFieldSchema(fieldName) {
      return this._schemaFields[fieldName];
    }

    targetOperation(target='*', cb) {
      var currentTarget = this._defaultTarget;
      
      try {
        definePropertyRW(this, '_defaultTarget', target);
        return cb.call(this);
      } catch (e) {
        throw e;
      } finally {
        definePropertyRW(this, '_defaultTarget', currentTarget);
      }
    }

    toString() {
      return typeName + ' ' + this.serialize({ target: 'json', spacing: 2 });
    }

    serialize(_opts) {
      function doSerialize() {
        var { target, spacing } = opts,
            cyclicTest = [this], self = this;

        return this.targetOperation(target, () => {
          return JSON.stringify(this, function(key, value) {
            if (value && key && !isType(value, 'string', 'number', 'boolean')) {
              if (cyclicTest.indexOf(value) >= 0)
                return null;
    
              cyclicTest.push(value);
              return value;
            }
    
            return value;
          }, spacing || 0);
        });
      }

      var opts = _opts || {};
      if (super.serialize instanceof Function)
        return super.serialize.call(this, { ...opts, defaultSerializer: doSerialize.bind(this) });

      return doSerialize.call(this);
    }
  });

  Object.assign(SchemaTypeKlass, {
    schemaTypeName: typeName,
    schemaGetter,
    injectSchemaFields
  });

  return SchemaTypeKlass;
}

module.exports = Object.assign(module.exports, {
  SchemaField,
  defineTypeSchema
});
