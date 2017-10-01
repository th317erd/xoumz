const RO = 0,
      RW = 1;

function defineProperty(type, obj, name, value, _getter, _setter) {
  let getter = _getter,
      setter = _setter;

  if (getter instanceof Function || setter instanceof Function) {
    Object.defineProperty(obj, name, {
      enumerable: false,
      configurable: false,
      get: getter,
      set: setter
    });
  } else {
    Object.defineProperty(obj, name, {
      writable: (type === RW),
      enumerable: false,
      configurable: false,
      value: value
    });
  }
}

function instanceOf(obj, ...args) {
  if (obj === undefined || obj === null)
    return false;

  if (args.length === 1 && args[0] === 'object')
    return !instanceOf(obj, 'string', 'number', 'boolean', 'array', 'function');

  for (var i = 0, il = args.length, objType = typeof obj; i < il; i++) {
    var type = args[i];

    if (type === objType)
      return true;
    else if (type === 'string' && (obj instanceof String))
      return true;
    else if (type === 'number' && (obj instanceof Number))
      return true;
    else if (type === 'boolean' && (obj instanceof Boolean))
      return true;
    else if (type === 'array' && (obj instanceof Array))
      return true;
    else if (type === 'function' && (obj instanceof Function))
      return true;
    else if ((type instanceof Function) && obj instanceof type)
      return true;
  }
      
  return false;
}

function typeName(obj) {
  if (obj === undefined)
    return 'undefined';
  else if (obj === null)
    return 'null';
  else if (instanceOf(obj, 'string'))
    return 'String';
  else if (instanceOf(obj, 'number'))
    return 'Number';
  else if (instanceOf(obj, 'boolean'))
    return 'Boolean';
  else if (instanceOf(obj, 'array'))
    return 'Array[' + typeName(type[0]) + ']';
  else if (instanceOf(obj, 'function'))
    return 'Function';
  else
    return 'Object';
}

module.exports = Object.assign(module.exports, {
  definePropertyRO: defineProperty.bind(this, RO),
  definePropertyRW: defineProperty.bind(this, RW),
  instanceOf,
  typeName
});
