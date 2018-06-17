module.exports = function(root, requireModule) {
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

  function addSchemaMutator(context, mutator) {
    if (!(mutator instanceof Function))
      throw new Error('Child schema initializer must be a function');

    var mutators = context.schemaMutators;
    mutators.push(mutator);
  }

  const { Chainable, ChainableConsumer } = requireModule('./base/chainable');
  const { Context } = requireModule('./base/context');
  const { required } = requireModule('./base/validation');

  const DEFAULT_VALIDATION_PHASE = 'validate';

  const FieldDefinition = this.defineClass((ChainableConsumer) => {
    return class FieldDefinition extends ChainableConsumer {
      getContext(...args) {
        return new Context({ name: 'field', group: 'schema' }, ...args);
      }

      getModelClass() {
        return this._modelClass;
      }

      instantiate(...args) {
        var modelClass = this.getModelClass();
        return new modelClass(this, ...args);
      }

      start(_modelClass, _opts, ...args) {
        // Pull _modelClass stored on Proxy (if it exists)
        var modelClass = _modelClass._modelClass || _modelClass;
        if (!modelClass)
          throw new Error('Unknown or invalid model type');

        // Wrap the prototype to include 'getFieldDefinition' as an instance method
        // modelClass.prototype = Object.create(modelClass.prototype);
        // Object.defineProperty(modelClass.prototype, 'getFieldDefinition', {
        //   enumerable: false,
        //   configurable: false,
        //   get: () => fieldDefintion,
        //   set: () => {}
        // });

        Object.defineProperty(this, '_modelClass', {
          writable: false,
          enumerable: false,
          configurable: false,
          value: modelClass
        });

        return super.start({
          value: null,
          field: null,
          maxLength: null,
          validators: {},
          schemaMutators: [],
          nullable: true,
          primaryKey: false,
          virtual: false,
          abstract: false,
          hidden: false
        }, ...args);
      }

      $virtual(context, propName, value) {
        if (arguments.length < 3)
          context.virtual = true;
        else
          context.virtual = value;
      }

      $abstract(context, propName, value) {
        if (arguments.length < 3)
          context.abstract = true;
        else
          context.abstract = value;
      }

      $hidden(context, propName, value) {
        if (arguments.length < 3)
          context.hidden = true;
        else
          context.hidden = value;
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

      $hostSchemaMutator(context, propName, mutator) {
        if (arguments.length < 3)
          return;

        addSchemaMutator.call(this, context, mutator);
      }

      $context(context, propName, newContext = '*') {
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
    };
  }, ChainableConsumer);

  const SchemaType = this.defineClass((Chainable) => {
    return class SchemaType extends Chainable {
      constructor(type, _opts, ...args) {
        var opts = _opts || {};
        super(type, opts, ...args);

        var proxy = this.createProxy(type, opts, ...args);

        Object.defineProperty(proxy, '_modelClass', {
          writable: false,
          enumerable: false,
          configurable: false,
          value: type
        });

        return proxy;
      }

      getContext(...args) {
        return new Context({ name: 'type', group: 'schema' }, ...args);
      }

      createNewConsumer(type, ...args) {
        var consumer = new FieldDefinition(type, ...args);
        return consumer.start(type, ...args);
      }
    };
  }, Chainable);

  root.export({
    DEFAULT_VALIDATION_PHASE,
    SchemaType
  });
};
