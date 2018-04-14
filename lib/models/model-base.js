module.exports = function(root, requireModule) {
  const { definePropertyRW, noe } = requireModule('./base/utils');
  const { Permissible } = requireModule('./security/permissible');
  const { DecomposedModel } = requireModule('./schema/decomposed-model');
  // const { LazyCollection, LazyItem } = requireModule('./base/collections');
  // const Logger = requireModule('./base/logger');

  function defineModelField(fieldName, field) {
    function convertPrimitiveValue(rawValue, helperFunc = 'getter') {
      var helperFunc = field.getProp(helperFunc),
          value = (typeof helperFunc === 'function') ? helperFunc.call(this, rawValue, field) : rawValue;

      if (typeof ModelClass.primitive !== 'function' || !ModelClass.primitive())
        return value;

      if (!(value instanceof ModelClass)) {
        if (value === undefined)
          value = new ModelClass();
        else
          value = new ModelClass((value !== null) ? value.valueOf() : value);
      }

      return value;
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
        return convertPrimitiveValue.call(this, this[realValueKey]);
      },
      set: (val) => {
        this[realValueKey] = convertPrimitiveValue.call(this, val, 'setter');
        return val;
      }
    });
  }

  class ModelBase extends Permissible {
    constructor(_decomposedModel, ...args) {
      super(...args);

      definePropertyRW(this, '_rolesCache', null);

      // Get this models schema
      var schema = this.getSchema();

      // First define non-virtual fields
      for (var [ fieldName, field ] of schema.entries({ virtual: false }))
        defineModelField.call(this, fieldName, field);

      // Next define virtual fields
      for (var [ fieldName, field ] of schema.entries({ virtual: true }))
        defineModelField.call(this, fieldName, field);

      // If a decomposed model wasn't passed in, then convert it to a decomposed model
      var decomposedModel = (_decomposedModel instanceof DecomposedModel)
            ? _decomposedModel
            : new DecomposedModel(_decomposedModel || {}, { schema });

      // Setup model
      this.onCreate.call(this, decomposedModel, ...args);
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

    // schema(...args) {
    //   return this.constructor.schema(...args);
    // }

    // // Calculate how far target is from owner
    // // 0 = has no relation to owner
    // // 1 = is owner
    // // >1 = decedent of owner (2 = immediate child, 3 = grandchild, etc...)

    // calculateOwnerGeneration(target) {
    //   function ownerLevel(model, level = 1) {
    //     if (model.schema().getTypeName() === typeName && model.id === myID)
    //       return level;

    //     if (!model.owner)
    //       return 0;

    //     return ownerLevel(model.owner, level + 1);
    //   }

    //   if (noe(target) || !(target instanceof ModelBase))
    //     return 0;

    //   var myID = this.id,
    //       typeName = this.schema().getTypeName();

    //   return ownerLevel(target);
    // }

    // onValidate(_fieldValues, _opts) {
    //   var opts = _opts || {},
    //       fieldValues = _fieldValues || {},
    //       modelType = this.schema(),
    //       typeInfo = modelType.getTypeInfo(),
    //       isPrimitive = (!!typeInfo.primitiveType);

    //   try {
    //     if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
    //       fieldValues = JSON.parse(fieldValues);

    //     var thisOpts = Object.assign({}, opts, { owner: this }),
    //         errors = modelType.validate(fieldValues, thisOpts);

    //     return (errors.length) ? errors.map((err) => err.message) : [];
    //   } catch (e) {
    //     return [e.message];
    //   }
    // }

    // onCreate(_fieldValues, _opts) {
    //   var opts = _opts || {},
    //       fieldValues = _fieldValues || {},
    //       modelType = this.schema(),
    //       typeInfo = modelType.getTypeInfo(),
    //       isPrimitive = (!!typeInfo.primitiveType);

    //   // Run 'init' phase validators
    //   if (opts.validate) {
    //     var errors = this.onValidate(_fieldValues, Object.assign({}, _opts, { op: 'init' }));
    //     if (!noe(errors))
    //       throw new ValidationErrors(errors);
    //   }

    //   try {
    //     if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
    //       fieldValues = JSON.parse(fieldValues);

    //     // if (!noe(ownerFieldName) && opts.owner)
    //     //   definePropertyRW(this, ownerFieldName, opts.owner);

    //     var thisOpts = Object.assign({}, opts, { owner: this });

    //     modelType.iterateFields((field, fieldName) => {
    //       var privateFieldName = `_${fieldName}`,
    //           getter = field.getProp('getter'),
    //           setter = field.getProp('setter'),
    //           fieldValue = fieldValues[fieldName];

    //       if (!getter)
    //         getter = (field) => this[privateFieldName];

    //       if (!setter)
    //         setter = (field, val) => this[privateFieldName] = val;

    //       Object.defineProperty(this, fieldName, {
    //         enumerable: true,
    //         configurable: true,
    //         get: getter.bind(this, field),
    //         set: setter.bind(this, field)
    //       });

    //       if (fieldValue instanceof LazyCollection) {
    //         fieldValue.itemMutator((item, index) => {
    //           this.setModelOwner(field, item, index, thisOpts);
    //           return item;
    //         });
    //       }

    //       this[fieldName] = field.instantiate(fieldValue, thisOpts);
    //     });

    //     // Run 'construct' phase validators
    //     if (opts.validate) {
    //       var errors = this.onValidate(_fieldValues, Object.assign({}, _opts, { op: 'construct' }));
    //       if (!noe(errors))
    //         throw new ValidationErrors(errors);
    //     }
    //   } catch (e) {
    //     Logger.warn(`Unable to create new model: ${e.message}`, e, fieldValues);
    //   }
    // }

    // setModelOwner(ownerField, childModel, order, _opts) {
    //   var opts = _opts || {},
    //       application = this.getApplication(),
    //       modelType = this.schema(),
    //       ownerFieldFlags = modelType.getFieldFlags(ownerField);

    //   var childTypeName = ownerField.getTypeName(),
    //       childModelType = application.getModelType(childTypeName, Object.assign({}, opts, { operation: 'create', modelType: childTypeName, model: childModel }));

    //   if (!childModelType)
    //     throw new Error(`Unable to instantiate value for ${ownerField.getProp('field')}: Unknown model type`);

    //   var ownerPrimaryKey = modelType.retrievePrimaryKeyValue(this),
    //       childOwnerOrderFieldName = childModelType.getFieldProp(childModelType.getOwnerOrderField(), 'field'),
    //       childOwnerFieldFieldName = childModelType.getFieldProp(childModelType.getOwnerFieldField(), 'field'),
    //       childOwnerTypeFieldName = childModelType.getFieldProp(childModelType.getOwnerTypeField(), 'field'),
    //       childOwnerIDFieldName = childModelType.getFieldProp(childModelType.getOwnerIDField(), 'field');

    //   if (childOwnerIDFieldName)
    //     definePropertyRW(childModel, childOwnerIDFieldName, ownerPrimaryKey);

    //   if (childOwnerTypeFieldName)
    //     definePropertyRW(childModel, childOwnerTypeFieldName, modelType.getTypeName());

    //   if (childOwnerFieldFieldName)
    //     definePropertyRW(childModel, childOwnerFieldFieldName, ownerField.getProp('field'));

    //   if (childOwnerOrderFieldName && (order !== undefined || order !== null))
    //     definePropertyRW(childModel, childOwnerOrderFieldName, order);

    //   definePropertyRW(childModel, childModelType.getOwnerFieldName(), this);
    // }

    // decompose(opts) {
    //   return this.schema().decompose(this, { owner: this, ...opts });
    // }

    // validate(opts) {
    //   return this.schema().validate(this, { owner: this, ...opts });
    // }

    // save(_opts) {
    //   var application = this.getApplication();
    //   return application.save(this, _opts);
    // }

    // where(...args) {
    //   return this.query(...args);
    // }

    // query(_opts) {
    //   var application = this.getApplication();
    //   return application.query(this.schema(), _opts);
    // }

    // destroy(_opts) {
    //   var application = this.getApplication();
    //   return application.destroy(this, _opts);
    // }
  }

  root.export({
    ModelBase
  });
};
