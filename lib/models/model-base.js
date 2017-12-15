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
      var fieldValues = _fieldValues || {};

      try {
        if (typeof fieldValues === 'string' || fieldValues instanceof String)
          fieldValues = JSON.parse(fieldValues);

        this.schema().iterateFields((field, fieldName) => {
          var val = fieldValues[fieldName],
              setter = field.getProp('setter');

          this[fieldName] = field.instantiate(setter(val, this));
        });
      } catch (e) {
        Logger.warn(`Unable to create new model: ${e.message}`, e);
      }
    }

    decompose(opts) {
      return this.schema().decompose(this, opts);
    }

    validate(opts) {
      return this.schema().validate(this, opts);
    }

    save(_opts) {
      var application = this.getApplication();
      return application.saveType(this, _opts);
    }

    where(params, _opts) {
      var opts = _opts || {},
          application = this.getApplication();

      return application.loadType(params, {
        ...opts,
        modelType: this
      });
    }
  }

  Object.assign(root, {
    ModelBase
  });
};
