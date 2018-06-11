module.exports = function(root, requireModule) {
  function defineModelField(fieldName, field, valueCache) {
    function runAttrAccessors(model, newValue, type) {
      if (model && typeof model[type] === 'function')
        return model[type].call(model, newValue, field, fieldName);

      return model;
    }

    function convertPrimitiveValue(rawValue, helperFunc = 'getter') {
      function convertValue() {
        // if (typeof ModelClass.primitive !== 'function' || !ModelClass.primitive())
        //   return value;

        if (!instanceOf(value, ModelClass)) {
          if (value !== undefined && value !== null)
            value = new ModelClass(field, value.valueOf());
        }

        return value;
      }

      var helperFunc = field.getProp(helperFunc),
          value = (typeof helperFunc === 'function') ? helperFunc.call(this, rawValue, field) : rawValue;

      return convertValue.call(this);
    }

    var realValueKey = `_${fieldName}`,
        ModelClass = field.getModelClass(),
        defaultValue = field.getProp('value');

    if (typeof defaultValue === 'function')
      defaultValue = defaultValue.call(this, field);

    Object.defineProperty(this, realValueKey, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: convertPrimitiveValue.call(this, defaultValue)
    });

    Object.defineProperty(this, fieldName, {
      enumerable: true,
      configurable: true,
      get: () => {
        var cachedValue = valueCache[fieldName];
        if (cachedValue)
          return runAttrAccessors(cachedValue, 'onAccess');

        var value = valueCache[fieldName] = runAttrAccessors(convertPrimitiveValue.call(this, this[realValueKey], 'getter'), undefined, 'onAccess');
        return value;
      },
      set: (val) => {
        var newValue = this[realValueKey] = convertPrimitiveValue.call(this, val, 'setter');
        runAttrAccessors(newValue, val, 'onAssign');

        return val;
      }
    });
  }

  const { definePropertyRW, instanceOf } = requireModule('./base/utils');
  const { Permissible } = requireModule('./security/permissible');
  const { DecomposedModel } = requireModule('./schema/decomposed-model');
  // const { LazyCollection, LazyItem } = requireModule('./base/collections');
  // const Logger = requireModule('./base/logger');

  const ModelBase = this.defineClass((Permissible) => {
    return class ModelBase extends Permissible {
      constructor(_decomposedModel, ...args) {
        super(...args);

        definePropertyRW(this, '_rolesCache', null);

        // Get this models schema
        var schema = this.getSchema(),
            valueCache = {};

        // First define non-virtual fields
        for (var [ fieldName, field ] of schema.entries({ virtual: false }))
          defineModelField.call(this, fieldName, field, valueCache);

        // Next define virtual fields
        for (var [ fieldName, field ] of schema.entries({ virtual: true }))
          defineModelField.call(this, fieldName, field, valueCache);

        // If a decomposed model wasn't passed in, then convert it to a decomposed model
        var decomposedModel = (instanceOf(_decomposedModel, DecomposedModel))
              ? _decomposedModel
              : new DecomposedModel(_decomposedModel || {}, { schema });

        // Setup model
        this.onCreate.call(this, decomposedModel, ...args);
      }

      static primitive() {
        return null;
      }

      primitive() {
        return null;
      }

      onCreate(decomposedModel, _opts) {
        function setFieldValue(fieldName, field) {
          if (!decomposedModel.hasOwnProperty(fieldName))
            return;

          this[fieldName] = decomposedModel[fieldName];
        }

        var opts = _opts || {},
            schema = this.getSchema();

        // First set non-virtual fields
        for (var [ fieldName, field ] of schema.entries({ virtual: false }))
          setFieldValue.call(this, fieldName, field);

        // Next set virtual fields
        for (var [ fieldName, field ] of schema.entries({ virtual: true }))
          setFieldValue.call(this, fieldName, field);
      }

      permissableType() {
        return 'model';
      }
    };
  }, Permissible);

  root.export({
    ModelBase
  });
};
