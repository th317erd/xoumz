module.exports = function(root, requireModule) {
  const { definePropertyRW, noe, ValidationErrors } = requireModule('./utils');
  const { Permissible } = requireModule('./security/permissible');
  const Logger = requireModule('./logger');

  function defineModelField(field, fieldName) {
    Object.defineProperty(this, fieldName, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: field.getProp('value')
    });
  }

  class ModelBase extends Permissible {
    constructor(data, ...args) {
      super(...args);

      definePropertyRW(this, '_rolesCache', null);

      //console.trace();
      this.schema().iterateFields(defineModelField.bind(this));

      if (this.onCreate instanceof Function)
        this.onCreate.call(this, data, ...args);
    }

    schema(...args) {
      return this.constructor.schema(...args);
    }

    // Calculate how far target is from owner
    // 0 = has no relation to owner
    // 1 = is owner
    // >1 = decedent of owner (2 = immediate child, 3 = grandchild, etc...)

    calculateOwnerGeneration(target) {
      function ownerLevel(model, level = 1) {
        if (model.schema().getTypeName() === typeName && model.id === myID)
          return level;

        if (!model.owner)
          return 0;

        return ownerLevel(model.owner, level + 1);
      }

      if (noe(target) || !(target instanceof ModelBase))
        return 0;

      var myID = this.id,
          typeName = this.schema().getTypeName();

      return ownerLevel(target);
    }

    onValidate(_fieldValues, _opts) {
      var opts = _opts || {},
          fieldValues = _fieldValues || {},
          modelType = this.schema(),
          typeInfo = modelType.getTypeInfo(),
          isPrimitive = (!!typeInfo.primitiveType);

      try {
        if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
          fieldValues = JSON.parse(fieldValues);

        var thisOpts = Object.assign({}, opts, { owner: this }),
            errors = modelType.validate(fieldValues, thisOpts);

        return (errors.length) ? errors.map((err) => err.message) : [];
      } catch (e) {
        return [e.message];
      }
    }

    onCreate(_fieldValues, _opts) {
      var opts = _opts || {},
          fieldValues = _fieldValues || {},
          modelType = this.schema(),
          typeInfo = modelType.getTypeInfo(),
          isPrimitive = (!!typeInfo.primitiveType),
          ownerFieldName = modelType.getOwnerFieldName();

      // Run 'init' phase validators
      if (opts.validate) {
        var errors = this.onValidate(_fieldValues, Object.assign({}, _opts, { op: 'init' }));
        if (!noe(errors))
          throw new ValidationErrors(errors);
      }

      try {
        if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
          fieldValues = JSON.parse(fieldValues);

        if (!noe(ownerFieldName) && opts.owner)
          definePropertyRW(this, ownerFieldName, opts.owner);

        var thisOpts = Object.assign({}, opts, { owner: this });

        modelType.iterateFields((field, fieldName) => {
          var setter = field.getProp('setter'),
              fieldValue = fieldValues[fieldName],
              val = setter.call(field, fieldValue, thisOpts);

          this[fieldName] = field.instantiate(val, thisOpts);
        });

        // Run 'construct' phase validators
        if (opts.validate) {
          var errors = this.onValidate(_fieldValues, Object.assign({}, _opts, { op: 'construct' }));
          if (!noe(errors))
            throw new ValidationErrors(errors);
        }
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

    destroy(_opts) {
      var application = this.getApplication();
      return application.destroy(this, _opts);
    }
  }

  Object.assign(root, {
    ModelBase
  });
};
