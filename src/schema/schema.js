import { definePropertyRO, prettify } from '../utils';
import * as SchemaTypes from './schema-types';
import * as Validators from './validators';

(function(root) {
  class Schema {
    constructor(baseRecordType) {
      definePropertyRO(this, 'registeredCallbacks', []);

      var schemaTypes = {};
      SchemaTypes.iterateDefaultSchemaTypes((name, type) => {
        SchemaTypes.defineSchemaType(schemaTypes, name, type);
      });

      definePropertyRW(this, 'schemaTypes', schemaTypes);
      definePropertyRW(this, 'baseRecordType', baseRecordType);
    }

    register(typeName, callback) {
      var className = prettify(typeName),
          TypeKlass = class GenericSchemaType extends SchemaTypes.SchemaType {
            constructor() {
              super(className);
            }

            instantiate(...args) {
              return registrationScope.creator(...args);
            }
          },
          registrationScope = {
            typeName: className,
            callback,
            TypeKlass
          };

      this.schemaTypes[className] = new TypeKlass();

      registeredCallbacks.push(registrationScope);
    }

    initialize() {
      return Promise.resolve().then(async () => {
        var registeredCallbacks = this.registeredCallbacks,
            schemaTypes = this.schemaTypes,
            promises = [];

        for (var i = 0, il = registeredCallbacks.length; i < il; i++) {
          var r = registeredCallbacks[i];

          promises.push(r.callback.call(this, schemaTypes, this.baseRecordType));
        }
      });
    }
  }

  Object.assign(root, SchemaTypes, {
    Validators,
    Schema
  });
})(module.exports);

// import { definePropertyRO, definePropertyRW, instanceOf, generateUUID } from './utils';
// import { SelectorEngine } from './selector-engine';

// const se = new SelectorEngine();

// function generateDefaultUUID(model) {
//   return (('' + modelClass.name).toUpperCase() + '_' + generateUUID());
// }

// class ID {
//   constructor(value) {
//     this.value = value;
//   }
// }

// class SchemaField {
//   constructor(rawSchema, fieldKey) {
//     Object.assign(this, rawSchema);
//     if (!rawSchema.hasOwnProperty('key'))
//       this.key = fieldKey;
//   }
// }

// class Schema {
//   constructor(rawSchema, modelClass) {
//     if (!modelClass)
//       throw new Error('Class type required for Model');

//     definePropertyRO(this, '_modelClass', modelClass);
//     definePropertyRO(this, '_schema', rawSchema);
//     definePropertyRW(this, '_cachedFields', null);
//   }

//   fields() {
//     if (this._cachedFields)
//       return this._cachedFields;

//     var schema = this._schema.fields,
//         keys = Object.keys(schema),
//         fields = [];
    
//     for (var i = 0, il = keys.length; i < il; i++) {
//       var key = keys[i],
//           field = schema[key];
      
//       if (!(field instanceof SchemaField))
//         continue;
      
//       fields.push(field);
//     }

//     this._cachedFields = fields;

//     return fields;
//   }

//   field(fieldKey) {
//     return this._schema.fields[fieldKey];
//   }

//   fieldValue(model, fieldKey, value) {
//     if (!model || !fieldKey)
//       return;

//     var field = this.field(fieldKey);
//     if (!field)
//       return;

//     var fieldValueFunc = (arguments.length === 2) ? (model.getFieldValue || field.getValue) : (model.setFieldValue || field.setValue);

//     if (arguments.length === 2) {
//       return (fieldValueFunc instanceof Function) ? fieldValueFunc.call(this, model, fieldKey) : model[fieldKey];
//     } else {
//       return (fieldValueFunc instanceof Function) ? fieldValueFunc.call(this, model, fieldKey, value) : (model[fieldKey] = value);
//     }
//   }
// }

// class Model {
//   getSchema(engine) {
//     return this.constructor.schema(engine);
//   }
// }

// function sanitizeSchema(rawSchema, modelClass) {
//   if (rawSchema instanceof Schema)
//     return rawSchema;

//   var fields = rawSchema.fields,
//       fieldKeys = Object.keys(fields || {}),
//       schemaFields = {},
//       schema = { fields: schemaFields },
//       generateID = rawSchema.generateID || generateDefaultUUID;

//   if (!fields)
//     throw new Error('"fields" key must be present in schema');

//   for (var i = 0, il = fieldKeys.length; i < il; i++) {
//     var key = fieldKeys[i],
//         val = fields[key];
    
//     if (instanceOf(val, 'array', 'function'))
//       val = { type: val, field: key };
//     else if (instanceOf(val, 'string'))
//       val = { type: String, field: key };
//     else if (instanceOf(val, 'number'))
//       val = { type: Number, field: key };
//     else if (instanceOf(val, 'boolean'))
//       val = { type: Boolean, field: key };

//     if (!instanceOf(val.type, 'array', 'function'))
//       throw new Error('"type" field required for schema');

//     if (!val.key)
//       val.key = key;

//     if (!val.field)
//       val.field = val.key;
    
//     if (!(val instanceof SchemaField))
//       val = new SchemaField(val);

//     schemaFields[val.key] = val;
//   }

//   if (!schemaFields.id) {
//     schemaFields.id = new SchemaField({
//       type: ID,
//       field: 'id',
//       key: 'id',
//       getValue: function(model, fk) {
//         if (model[fk])
//           return model[fk];
//         return generateID(model);
//       },
//       setValue: function(model, fk, _value) {
//         var value = _value || generateID(model);
//         return (model[fk] = value);
//       }
//     });
//   }

//   return new Schema(schema, modelClass);
// }

// function defineSchema(modelClass, resolver) {
//   var selector = modelClass.schema = se.create((engine) => engine, function(engine) {
//     var schema = resolver(engine);
//     return sanitizeSchema(schema, modelClass);
//   });

//   modelClass.prototype.schema = selector;

//   return selector;
// }

// function filterSchemaToEngine(schema, engine) {
//   function filterField(field) {
//     var fieldKeys = Object.keys(field),
//         finalField = {};

//     for (var j = 0, jl = fieldKeys.length; j < jl; j++) {
//       var fieldKey = fieldKeys[j];
//       if (fieldKey.indexOf(':') > 0)
//         continue;
      
//       finalField[fieldKey] = (engine && field.hasOwnProperty(fieldKey + keyFilter)) ? field[fieldKey + keyFilter] : field[fieldKey];
//     }

//     return finalField;
//   }

//   if (schema instanceof Schema)
//     return schema;

//   var keys = Object.keys(schema),
//       finalSchema = {},
//       keyFilter = ':' + ((engine && engine.getServiceName instanceof Function) ? engine.getServiceName() : engine);

//   for (var i = 0, il = keys.length; i < il; i++) {
//     var key = keys[i],
//         field = schema[key];

//     if (!instanceOf(field, 'object')) {
//       finalSchema[key] = field;
//       continue;
//     }

//     finalSchema[key] = filterField(field);
//   }

//   return finalSchema;
// }

// Object.assign(Schema, {
//   defineSchema,
//   filterSchemaToEngine
// });

// module.exports = Object.assign(module.exports, {
//   ID,
//   Schema,
//   Model
// });
