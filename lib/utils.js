const RO = 0,
      RW = 1;

function defineProperty(type, obj, value, getter, setter) {
  let getter = _getter,
      setter = _setter;

  if (getter instanceof Function || setter instanceof Function) {
    Object.defineProperty(obj, {
      writable: (type === RW),
      enumberable: false,
      configurable: false,
      get: getter,
      set: setter
    });
  } else {
    Object.defineProperty(obj, {
      writable: (type === RW),
      enumberable: false,
      configurable: false,
      value: value
    });
  }
}

module.exports = Object.assign(module.exports, {
  definePropertyRO: defineProperty.bind(this, RO),
  definePropertyRW: defineProperty.bind(this, RW)
});
