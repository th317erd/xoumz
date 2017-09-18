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
      
      def = { name: fieldName, ...baseFieldDef, ...def, fieldName };
      
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

  getTargetDefinition(target='*') {
    var def = this.targets[target];
    return (def) ? def : this.targets['*'];
  }

  formatValue(val, op, _args) {
    var args = _args || {},
        fieldDef = this.getTargetDefinition(args.target);

    if (fieldDef.formatValue instanceof Function)
      return fieldDef.formatValue.call(args.record, val, op, { ...args, target: fieldDef.target });

    var type = fieldDef.type;
    if (op === 'get') {
      if (val === undefined || val === null)
        return (!(type instanceof Array)) ? null : [];
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

      var schemaField = new SchemaField(fieldName, schema[fieldName]);
      schemaFields[fieldName] = schemaField;

      var internalFieldName = '_' + fieldName;
      definePropertyRW(instance, internalFieldName, null);
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

    getFieldValue(fieldName, target='*') {
      console.log('Getting field value for ', fieldName);
      var fieldSchema = this.getFieldSchema(fieldName),
          val = this[fieldName];

      return (fieldSchema) ? fieldSchema.formatValue.call(fieldSchema, val, 'get', { target, record: this }) : val;
    }

    setFieldValue(fieldName, val, target='*') {
      var fieldSchema = this.getFieldSchema(fieldName),
          newVal = (fieldSchema) ? fieldSchema.formatValue.call(fieldSchema, val, 'set', { target, record: this }) : val;
          
      this[fieldName] = newVal;
    }

    getFieldSchema(fieldName) {
      return this._schemaFields[fieldName];
    }

    getSchemaFields() {
      var schemaFields = this._schemaFields,
          keys = Object.keys(schemaFields || {}),
          fields = [];
      
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            schemaField = schemaFields[key];
        
        if (schemaField)
          fields.push(schemaField);
      }

      return fields;
    }

    getFields(target='*') {
      var obj = {};
  
      this.getSchemaFields().forEach((schemaField) => {
        var fieldDef = schemaField.getTargetDefinition(target),
            val = this['_' + fieldDef.fieldName];
        obj[fieldDef.name] = schemaField.formatValue.call(schemaField, val, 'get', { target, record: this });
      });

      return obj;
    }

    toString() {
      return typeName + ' ' + this.serialize({ target: 'json', spacing: 2 });
    }

    serialize(_opts) {
      function doSerialize(finalObj) {
        var spacing = opts.spacing,
            cyclicTest = [this], self = this;

        return JSON.stringify(finalObj, function(key, value) {
          if (value && key && !isType(value, 'string', 'number', 'boolean')) {
            if (cyclicTest.indexOf(value) >= 0)
              return null;
  
            cyclicTest.push(value);
          }
  
          return value;
        }, spacing || 0);
      }

      var opts = _opts || {},
          seralizableObj = this.getFields(opts.target);

      if (super.serialize instanceof Function)
        return super.serialize.call(this, seralizableObj, { ...opts, defaultSerializer: doSerialize.bind(this) });

      return doSerialize.call(this, seralizableObj);
    }

    deserialize(src, _opts) {
      function doDeserialize(src) {
        try {

        } catch (e) {

        }
      }

      //var 
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
