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
      return this._type;
    }

    getModelClass() {
      return this._modelClass;
    }

    instantiate(...args) {
      var modelClass = this.getModelClass();
      return new modelClass(...args);
    }

    start(modelType) {
      if (!modelType)
        throw new Error('Unknown or invalid model type');

      var fieldDef = this;

      Object.defineProperty(this, '_type', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: modelType
      });

      Object.defineProperty(this, '_modelClass', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: class Model extends modelType {
                  schema() {
                    return fieldDef;
                  }
                }
      });

      return super.start({
        value: null,
        field: null,
        maxLength: null,
        validators: {},
        nullable: true,
        primaryKey: false
      });
    }

    $required(context, _opts) {
      if (arguments.length > 1)
        return;

      addValidator.call(this, context, required);
    }

    $validate(context, validator, _opts) {
      if (arguments.length < 2)
        return;

      addValidator.call(this, context, validator, _opts);
    }

    $context(context, newContext = '*') {
      if (arguments.length < 2)
        return;

      return this.chainableConsumerProxy(this, undefined, newContext);
    }

    $maxLength(context, len) {
      if (arguments.length < 2)
        return;

      context.maxLength = len;
    }

    $nullable(context, value) {
      if (arguments.length < 2)
        return;

      context.nullable = value;
    }

    $field(context, value) {
      if (arguments.length < 2)
        return;

      context.field = value;
    }

    $value(context, value) {
      if (arguments.length < 2)
        return;

      context.value = value;
    }
  }

  class SchemaType extends Chainable {
    constructor(...args) {
      super(...args);
      return this.createProxy(...args);
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
