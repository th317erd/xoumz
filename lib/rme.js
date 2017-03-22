import D, { utils } from 'devoir';

class RME {
  constructor(schema) {
    D.setROProperty(this, 'schema', schema);
  }

  compose(type, _data) {
    function coerce(value, type) {

    }

    function hydrate(schema, instance, data) {
      if (!data)
        return instance;
      
      let fieldNames = Object.keys(schema),
          errors = [];

      for (var i = 0, il = keys.length; i < il; i++) {
        let fieldName = fieldNames[i],
            field = schema[fieldName],
            value = data[field.name];

        if (field.type instanceof Array) {
          /* TODO: Add type helper function as part of schema */
          let valueType = field.type[0];
          if (value instanceof Array) {
            for (var j = 0, jl = value.length; j < jl; j++)
              value[j] = compose(valueType, value[j]);
          }
        }

        if (field.mutate instanceof Function)
          value = field.mutate.call(field, value, 'hydrate', {data: data});

        if (field.validate instanceof Function) {
          let ret = field.validate.call(field, value, 'hydrate', {data: data});
          if (ret && ret !== true) {
            errors.push(ret);
            continue;
          }
        }
      }
    }

    var data = _data;
    if (data instanceof String || typeof data === 'string')
      data = JSON.parse(data);

    let typeName = type;
    if (typeName instanceof Function)
      typeName = typeName.name || typeName.displayName;

    let typeSchema = this.schema[typeName] || type.schema;
    if (!typeSchema)
      throw new Error('Unable to convert data to unknown type: ' + typeName);

    return hydrate(typeSchema, createInstance(typeSchema.type), data);
  }

  decompose(obj, handler) {

  }
}
