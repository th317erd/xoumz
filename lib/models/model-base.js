module.exports = function(root, requireModule) {
  function defineModelField(fieldName, field, valueCache) {
    function runAttrAccessors(model, newValue, type) {
      if (model && typeof model[type] === 'function')
        return model[type].call(model, newValue, field, fieldName);

      return model;
    }

    function convertPrimitiveValue(rawValue, helperFuncName = 'getter') {
      function convertValue() {
        var primitiveType = (typeof ModelClass.primitive === 'function') ? ModelClass.primitive() : null;

        if (helperFuncName === 'getter' && value != null && primitiveType)
          return value.valueOf();

        if (value != null && !instanceOf(value, ModelClass))
          value = new ModelClass(field, value.valueOf());

        return value;
      }

      var helperFunc = field.getProp(helperFuncName),
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

    // WIP: Get raw fields
    Object.defineProperty(this, `getRawField_${fieldName}`, {
      writable: true,
      enumerable: false,
      configurable: true,
      value: convertPrimitiveValue.call(this, defaultValue)
    });
  }

  const { definePropertyRW, definePropertyRO, instanceOf } = requireModule('./base/utils');
  const { Permissible } = requireModule('./security/permissible');
  const { DecomposedModel } = requireModule('./schema/decomposed-model');
  const { generateModelMethods } = requireModule('./schema/model-schema');
  // const { LazyCollection, LazyItem } = requireModule('./base/collections');
  // const Logger = requireModule('./base/logger');

  const ModelBase = generateModelMethods(this.defineClass((Permissible) => {
    return class ModelBase extends Permissible {
      constructor(field, _decomposedModel, ...args) {
        super(...args);

        definePropertyRO(this, '_fieldDefinition', field);
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
              : new DecomposedModel(_decomposedModel || {}, { model: this, schema, field });

        // Setup model
        this.onCreate.call(this, decomposedModel, ...args);
      }

      onCreate(decomposedModel, _opts) {
        function setFieldValue(fieldName, field) {
          if (!decomposedModelData.hasOwnProperty(fieldName))
            return;

          this[fieldName] = decomposedModelData[fieldName];
        }

        var schema = this.getSchema(),
            decomposedModelData = decomposedModel.getValue();

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

      getRawField(fieldName) {
        var getFunc = this[`getRawField_${fieldName}`];
        if (typeof getFunc !== 'function')
          return;

        return getFunc.call(this);
      }
    };
  }, Permissible));

  root.export({
    ModelBase
  });
};
