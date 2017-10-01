import { definePropertyRO, definePropertyRW, instanceOf } from './utils';
import SelectorEngine from './selector-engine';

const se = new SelectorEngine();

class SchemaField {
  constructor(rawSchema, fieldKey) {
    Object.assign(this, rawSchema);
    if (!rawSchema.hasOwnProperty('key'))
      this.key = fieldKey;
  }
}

class Schema {
  constructor(rawSchema, modelClass) {
    if (!modelClass)
      throw new Error('Class type required for Model');

    definePropertyRO(this, '_modelClass', modelClass);
    definePropertyRO(this, '_schema', rawSchema);
    definePropertyRW(this, '_cachedFields', null);
  }

  fields() {
    if (this._cachedFields)
      return this._cachedFields;

    var schema = this._schema,
        keys = Object.keys(schema),
        fields = [];
    
    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          field = schema[key];
      
      if (!(field instanceof SchemaField))
        continue;
      
      fields.push(field);
    }

    this._cachedFields = fields;

    return fields;
  }

  field(fieldKey) {
    return this._schema[fieldKey];
  }

  fieldValue(model, fieldKey, value) {
    if (!model || !fieldKey)
      return;

    var field = this.field(fieldKey);
    if (!field)
      return;

    var fieldValueFunc = (arguments.length === 2) ? (model.getFieldValue || field.getValue) : (model.setFieldValue || field.setValue);

    if (arguments.length === 2) {
      return (fieldValueFunc instanceof Function) ? fieldValueFunc.call(this, model, fieldKey) : model[fieldKey];
    } else {
      return (fieldValueFunc instanceof Function) ? fieldValueFunc.call(this, model, fieldKey, value) : (model[fieldKey] = value);
    }
  }

  serialize(model) {
    function getModelForSerializing(model) {
      var obj = {},
          fields = self.fields();
      
      for (var i = 0, il = fields.length; i < il ; i++) {
        var field = fields[i];
        obj[field.field] = self.fieldValue(model, field.key);
      }
        
      return obj;
    }

    var serializeFunc = model.serialize || this._schema.serialize,
        self = this,
        serializable = getModelForSerializing(model);

    if (serializeFunc instanceof Function)
      return serializeFunc.call(this, serializable);
    
    return JSON.stringify(serializable);
  }

  unserialize(rawData) {
    function instatiate(data) {
      var model = new self._modelClass(),
          fields = self.fields();
      
      for (var i = 0, il = fields.length; i < il ; i++) {
        var field = fields[i];
        self.fieldValue(model, field.key, data[field.field]);
      };

      return model;
    }

    var unserializeFunc = this._modelClass.unserialize || this._schema.unserialize,
        self = this;

    if (unserializeFunc instanceof Function)
      return unserializeFunc.call(this, rawData);
    
    var obj = JSON.parse(rawData);
    return instatiate(obj);
  }
}

function sanitizeRawSchema(rawSchema, modelClass) {
  var keys = Object.keys(rawSchema),
      schema = {};

  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i],
        val = rawSchema[key];
    
    if (instanceOf(val, 'array', 'function'))
      val = { type: val, field: key };
    else if (instanceOf(val, 'string'))
      val = { type: String, field: key };
    else if (instanceOf(val, 'number'))
      val = { type: Number, field: key };
    else if (instanceOf(val, 'boolean'))
      val = { type: Boolean, field: key };

    if (!instanceOf(val.type, 'array', 'function'))
      throw new Error('"type" field required for schema');

    if (!val.key)
      val.key = key;

    if (!val.field)
      val.field = val.key;

    if (!(val instanceof SchemaField))
      val = new SchemaField(val);

    schema[key] = val;
  }

  return new Schema(schema, modelClass);
}

function defineSchema(modelClass, resolver) {
  var selector = modelClass.schema = se.createSelector((engine) => engine, function(engine) {
    var schema = resolver(engine);
    return (schema instanceof Schema) ? schema : sanitizeRawSchema(schema, modelClass);
  });

  modelClass.prototype.schema = selector;

  return selector;
}

function filterSchemaToEngine(schema, engineName) {
  function filterField(field) {
    var fieldKeys = Object.keys(field),
        finalField = {};

    for (var j = 0, jl = fieldKeys.length; j < jl; j++) {
      var fieldKey = fieldKeys[j];
      if (fieldKey.indexOf(':') > 0)
        continue;
      
      finalField[fieldKey] = (field.hasOwnProperty(fieldKey + keyFilter)) ? field[fieldKey + keyFilter] : field[fieldKey];
    }

    return finalField;
  }

  if (schema instanceof Schema)
    return schema;

  var keys = Object.keys(schema),
      finalSchema = {},
      keyFilter = ':' + engineName;

  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i],
        field = schema[key];

    if (!instanceOf(field, 'object')) {
      finalSchema[key] = field;
      continue;
    }

    finalSchema[key] = filterField(field);
  }

  return finalSchema;
}

module.exports = Object.assign(module.exports, {
  Schema,
  defineSchema,
  filterSchemaToEngine
});
