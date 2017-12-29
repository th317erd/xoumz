module.exports = function(root, requireModule) {
  const Logger = requireModule('./logger');

  function defineModelField(field, fieldName) {
    Object.defineProperty(this, fieldName, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: field.getProp('value')
    });
  }

  class ModelBase {
    constructor(...args) {
      //console.trace();
      this.schema().iterateFields(defineModelField.bind(this));

      if (this.onCreate instanceof Function)
        this.onCreate.call(this, ...args);
    }

    schema(...args) {
      return this.constructor.schema(...args);
    }

    onCreate(_fieldValues) {
      var fieldValues = _fieldValues || {},
          typeInfo = this.schema().getTypeInfo(),
          isPrimitive = (!!typeInfo.primitiveType);

      try {
        if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
          fieldValues = JSON.parse(fieldValues);

        this.schema().iterateFields((field, fieldName) => {
          var setter = field.getProp('setter'),
              fieldValue = fieldValues[fieldName],
              val = setter.call(field, fieldValue, { owner: this });

          this[fieldName] = field.instantiate(val);
        });
      } catch (e) {
        Logger.warn(`Unable to create new model: ${e.message}`, e, fieldValues);
      }
    }

    decompose(opts) {
      return this.schema().decompose(this, { owner: this, ...opts });
    }

    validate(opts) {
      return this.schema().validate(this, { owner: this, ...opts });
    }

    save(_opts) {
      var application = this.getApplication();
      return application.save(this, _opts);
    }

    where(...args) {
      return this.query(...args);
    }

    query(_opts) {
      var application = this.getApplication();
      return application.query(this.schema(), _opts);
    }
  }

  Object.assign(root, {
    ModelBase
  });
};
