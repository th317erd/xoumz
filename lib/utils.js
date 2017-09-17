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

function isType(type) {
  for (var i = 1, il = arguments.length; i < il; i++) {
    var testType = arguments[i];

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

module.exports = Object.assign(module.exports, {
  definePropertyRO: defineProperty.bind(this, RO),
  definePropertyRW: defineProperty.bind(this, RW),
  isType,
  typeName
});
