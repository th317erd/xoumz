import D, { utils } from 'devoir';
import util from 'util';

class BaseRecord {

}

class SchemaField {
  constructor(type, name) {
    this.type = type;
    this.name = name;
  }

  validator(validator) {
    this.validator = validator;
  }
}

function schemaRecordFactory(name, schema, methods, parent) {
  function addField(type, name, helper) {
    let schema = this,
        field = new SchemaField(type, name);

    if (helper instanceof Function)
      helper.call(field);

    console.log('Adding field: ', name);
    schema[name] = field;
  }

  let Parent = parent || BaseRecord, Klass = class SchemaRecord extends Parent {
    constructor(...args) {
      super(...args);

      let keys = Object.keys(methods);
      for (var i = 0, il = keys.length; i < il; i++) {
        let key = keys[i],
            method = methods[key];

        D.setRWProperty(this, key, method.bind(this));
      }

      if (this.init instanceof Function)
        this.init();
    }
  }

  D.setROProperty(Klass, 'name', name);

  D.setROProperty(Klass, 'schema', {});
  schema.call(Klass, addField.bind(Klass.schema));

  D.setROProperty(Klass, 'inspect', (function(_depth) {
    function s(count) {
      return (new Array((count + 1) * 2 + 1)).join(' ');
    }

    let parts = [],
        depth = _depth || 0,
        keys = Object.keys(this),
        options = {color: true, depth: null};

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          field = this[key];

      parts.push('\n' + s(depth) + key + ': [' + field.type.name + '] {');
      if (field.type && field.type.inspect instanceof Function)
        parts.push(field.type.inspect(depth + 1));
      else
        parts.push('\n' + s(depth + 1) + util.inspect(field, options));

      parts.push('\n' + s(depth) + '}');
    }

    return (depth === 0) ? ('\n{' + parts.join('') + '\n}\n') : parts.join('');
  }).bind(Klass.schema));

  return Klass;
}

module.exports = Object.assign(module.exports, {
  BaseRecord,
  SchemaField,
  schemaRecordFactory
});
