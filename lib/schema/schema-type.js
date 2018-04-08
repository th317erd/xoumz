module.exports = function(root, requireModule) {
  const { Chainable, ChainableConsumer } = requireModule('./base/chainable');
  const { required } = requireModule('./base/validation');

  const DEFAULT_VALIDATION_PHASE = 'validate';

  function addValidator(context, validator, _opts) {
    if (!(validator instanceof Function))
      throw new Error('Validator must be a function');

    var opts = _opts || {},
        phase = opts.phase || DEFAULT_VALIDATION_PHASE,
        validators = context.validators[phase];

    if (!validators)
      validators = context.validators[phase] = [];

    validators.push(function(val, _userOpts) {
      var userOpts = _userOpts || {},
          errors = [];

      try {
        var ret = validator.call(this, val, Object.assign({}, opts, userOpts));
        if (ret)
          errors = errors.concat(ret);
      } catch (e) {
        errors.push(e.message);
      }

      return (errors.length) ? errors : undefined;
    });
  }

  class FieldDefinition extends ChainableConsumer {
    getBaseModelClass() {
      return this._modelClass.getBaseModelClass();
    }

    getModelClass() {
      return this._modelClass;
    }

    instantiate(...args) {
      var modelClass = this.getModelClass();
      return new modelClass(...args);
    }

    start(_modelClass) {
      // Pull _modelClass stored on Proxy (if it exists)
      var modelClass = _modelClass._modelClass || _modelClass;
      if (!modelClass)
        throw new Error('Unknown or invalid model type');

      var fieldDefintion = this;

      Object.defineProperty(this, '_modelClass', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: class GenericModelClass extends modelClass {
          getBaseModelClass() {
            return modelClass;
          }

          getFieldDefinition() {
            return fieldDefintion;
          }

          static getBaseModelClass() {
            return modelClass;
          }

          static getFieldDefinition() {
            return fieldDefintion;
          }
        }
      });

      return super.start({
        value: null,
        field: null,
        maxLength: null,
        validators: {},
        nullable: true,
        primaryKey: false,
        virtual: false
      });
    }

    $virtual(context, propName, value) {
      if (arguments.length < 3)
        context.virtual = true;
      else
        context.virtual = value;
    }

    $required(context, propName) {
      if (arguments.length > 2)
        return;

      addValidator.call(this, context, required);
    }

    $validate(context, propName, validator, _opts) {
      if (arguments.length < 3)
        return;

      addValidator.call(this, context, validator, _opts);
    }

    $context(context, propName, newContext = '*') {
      if (arguments.length < 3)
        return;

      return this.chainableConsumerProxy(this, undefined, undefined, newContext);
    }

    $maxLength(context, propName, len) {
      if (arguments.length < 3)
        return;

      context.maxLength = len;
    }

    $nullable(context, propName, value) {
      if (arguments.length < 3)
        return;

      context.nullable = value;
    }

    $field(context, propName, value) {
      if (arguments.length < 3)
        return;

      context.field = value;
    }

    $value(context, propName, value) {
      if (arguments.length < 3)
        return;

      context.value = value;
    }

    $getter(context, propName, value) {
      if (arguments.length < 3)
        return;

      context.getter = value;
    }

    $setter(context, propName, value) {
      if (arguments.length < 3)
        return;

      context.setter = value;
    }

    $_default(context, propName, value) {
      if (arguments.length < 3) {
        context[propName] = true;
        return;
      }

      context[propName] = value;
    }
  }

  class SchemaType extends Chainable {
    constructor(type, ...args) {
      super(type, ...args);
      var proxy = this.createProxy(type, ...args);

      Object.defineProperty(proxy, '_modelClass', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: type
      });

      return proxy;
    }

    createNewConsumer(type) {
      var consumer = new FieldDefinition(type);
      return consumer.start(type);
    }
  }

  root.export({
    DEFAULT_VALIDATION_PHASE,
    SchemaType
  });
};
