describe('Default Schema Types', function() {
  beforeEach(function() {
    this.defaultSchemaTypes = this.app.requireModule('./schema/primitive-model-types');
    this.field = this.defaultSchemaTypes.StringPrimitive.getType().field('test_field').value('derp').required.maxLength(10).nullable(false);
  });

  it('should be able to define a field', function() {
    var field = this.field.finalize();

    expect(field.getProp('field')).toBe('test_field');
    expect(field.getProp('value')).toBe('derp');
    expect(field.getProp('maxLength')).toBe(10);
    expect(field.getProp('nullable')).toBe(false);
  });

  it('should be able to specify contexts', function() {
    this.field.context('test').field('test_field2').maxLength(20).nullable(true);
    var field = this.field.finalize();

    // Test default context
    expect(field.getProp('field')).toBe('test_field');
    expect(field.getProp('value')).toBe('derp');
    expect(field.getProp('maxLength')).toBe(10);
    expect(field.getProp('nullable')).toBe(false);

    // Test "test" context
    expect(field.getProp('field', 'test')).toBe('test_field2');

    // This should fallback to the default context
    expect(field.getProp('value', 'test')).toBe('derp');
    expect(field.getProp('maxLength', 'test')).toBe(20);
    expect(field.getProp('nullable', 'test')).toBe(true);
  });

  it('should be able to specify validators', function() {
    this.field.validate((val, opts) => {});
    var field = this.field.finalize();

    // Test default context
    expect(field.getProp('field')).toBe('test_field');
    expect(field.getProp('value')).toBe('derp');
    expect(field.getProp('maxLength')).toBe(10);
    expect(field.getProp('nullable')).toBe(false);
    expect(field.getProp('validators')['validate'][0]).toBeType(Function);
    expect(field.getProp('validators')['validate'][1]).toBeType(Function);
  });

  it('should be able to create a model', function() {
    var field = this.field.finalize(),
        model = field.instantiate(''),
        errors = model.validate();

    expect(errors).toBeArray(1);
    expect(errors[0]).toBe('Value required for test_field');
    expect(model.valueOf()).toBe('');

    var model2 = field.instantiate('Test'),
        errors2 = model2.validate();

    expect(errors2).toBe(undefined);
    expect(model2.valueOf()).toBe('Test');

    var field2 = this.defaultSchemaTypes.StringPrimitive.getType().finalize();
    expect(model instanceof model2.getBaseModelClass()).toBe(true);
    expect(model instanceof field2.getBaseModelClass()).toBe(true);
  });
});
