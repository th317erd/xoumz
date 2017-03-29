import D, { utils } from 'devoir';
import util from 'util';

class BaseRecord {

}

class SchemaField {
  constructor(type, name) {
    this.type = type;
    this.name = name;
  }
}

function isType(type) {
  for (var i = 1, il = arguments.length; i < il; i++) {
    let testType = arguments[i];

    if (type === testType)
      return true;

    if (typeof type === testType)
      return true;

    if (type === 'string' && (testType === 'string' || testType === String))
      return true;

    if (type === 'number' && (testType === 'number' || testType === Number))
      return true;

    if (type === 'boolean' && (testType === 'boolean' || testType === Boolean))
      return true;

    if ((type === 'array' || type instanceof Array) && (testType === 'array' || testType === Array))
      return true;

    if (type instanceof Function && type.prototype.constructor === testType.prototype.constructor)
      return true;
  }

  return false;
}

function typeName(type) {
  if (isType(type, String)) {
    return 'String';
  } else if (isType(type, Number)) {
    return 'Number';
  } else if (isType(type, Boolean)) {
    return 'Boolean';
  } else if (isType(type, Array)) {
    return 'Array[' + typeName(type[0]) + ']';
  }

  return type.name;
}

function constructType(_type, value) {
  let type = _type;

  if (isType(type, String)) {
    return (utils.noe(value)) ? '' : ('' + value);
  } else if (isType(type, Number)) {
    return (utils.noe(value)) ? 0 : value;
  } else if (isType(type, Boolean)) {
    return !!value;
  } else if (isType(type, Array)) {
    if (utils.noe(value) || !(value instanceof Array))
      return [];

    type = type[0];
    let ret = new Array(value.length);
    for (var i = 0, il = value.length; i < il; i++)
      ret[i] = constructType(type, value[i]);

    return ret;
  }

  if (value === undefined || value === null)
    return null;

  try {
    return new type(value);  
  } catch (e) {
    return null;
  }
}

/* TODO: Fix recursive issues */

function schemaRecordFactory(name, schema, methods, parent) {
  function addField(type, name, helper) {
    let thisSchema = this,
        field = new SchemaField(type, name);

    if (helper instanceof Function)
      helper.call(field);

    D.setRWProperty(field, 'typeName', typeName.bind(field, field.type));
    D.setRWProperty(field, 'isType', isType.bind(field, field.type));

    thisSchema[name] = field;
  }

  let Parent = parent || BaseRecord, Klass = class SchemaRecord extends Parent {
    constructor(data, ...args) {
      super(data, ...args);

      let klassSchema = Klass.schema,
          keys = Object.keys(klassSchema);

      for (var i = 0, il = keys.length; i < il; i++) {
        let fieldName = keys[i],
            field = klassSchema[fieldName],
            value = constructType(field.type, (data) ? data[fieldName] : undefined);

        this[fieldName] = (field.mutator instanceof Function) ? field.mutator.call(field, value, 'construct', {parent: this}) : value;
      }

      keys = Object.keys(methods);
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

  D.setROProperty(Klass, 'inspect', (function(_parents) {
    function s(count) {
      return (new Array((count + 1) * 2 + 1)).join(' ');
    }

    let parts = [],
        parents = _parents || [],
        keys = Object.keys(this),
        options = {color: true, depth: null},
        depth = parents.length;

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          field = this[key],
          fieldType = field.type;

      parts.push('\n' + s(depth) + key + ': [' + field.typeName() + '] ');
      if (fieldType && fieldType.inspect instanceof Function) {
        if (parents.indexOf(fieldType) >= 0) {
          parts.push('{ (cyclic) }');
        } else {
          parts.push('{' + field.type.inspect(parents.concat(fieldType)));
          parts.push('\n' + s(depth) + '}');
        }
      } else {
        let objStr = JSON.stringify(field, function(key, value) {
          if (key === 'name' || key === 'type')
            return;
          return value;
        }, 2).replace(/^[^{]*\{\s*/, '').replace(/\s*\}[^}]*$/, '').replace(/^(.)/gm, s(depth + 1) + '$1');

        if (objStr.trim().length) {
          parts.push('{\n' + objStr + '\n' + s(depth) + '}');
        } else {
          parts.push('{ }');
        }
      }
    }

    return (depth === 0) ? ('\n{' + parts.join('') + '\n}\n') : parts.join('');
  }).bind(Klass.schema));

  return Klass;
}

const ID = schemaRecordFactory('ID', function(addField) {
  addField(String, 'recordType');
});

module.exports = Object.assign(module.exports, {
  ID,
  isType,
  constructType,
  BaseRecord,
  SchemaField,
  schemaRecordFactory
});
