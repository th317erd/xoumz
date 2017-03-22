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

  D.setROProperty(Klass, 'inspect', (function(_depth) {
    function s(count) {
      return (new Array((count + 1) * 2 + 1)).join(' ');
    }

    let parts = [],
        depth = _depth || 0,
        keys = Object.keys(this),
        options = {color: true, depth: null};

    console.log(depth);

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
  isType,
  constructType,
  BaseRecord,
  SchemaField,
  schemaRecordFactory
});
