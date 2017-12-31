const moment = require('moment');

describe('Connector IO', function() {
  beforeEach(function(done) {
    async function construct() {
      var model = this.model = await this.app.create('Test');

      var childModel = await this.app.create('Test');
      childModel.id = 'Test:2';
      childModel.string = 'child test string';
      childModel.integer = 756.78;
      childModel.boolean = false;
      childModel.date = moment('2017-12-31', 'YYYY-MM-DD');
      childModel.stringArray.push('hello');
      childModel.stringArray.push('from');
      childModel.stringArray.push('child');
      childModel.integerArray = [1, 42, 0];

      model.id = 'Test:1';
      model.string = 'test string';
      model.integer = 756.23;
      model.boolean = true;
      model.date = moment('2017-12-29', 'YYYY-MM-DD');
      model.stringArray.push('hello');
      model.stringArray.push('world');
      model.integerArray = [42, 0, 1];
      model.children = [childModel];

      done();
    }

    construct.call(this);

    this.testModel = function(value, datesAsMoment) {
      expect(value.id).toBe('Test:1');
      expect(value.boolean).toBe(true);
      expect((datesAsMoment) ? value.date.toISOString() : value.date).toBe('2017-12-29T07:00:00.000Z');
      expect(value.integer).toBe(756);
      expect(value.string).toBe('test string');
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
      expect(value.ownerID).toBeFalsy();
      expect(value.ownerType).toBeFalsy();
      expect(value.ownerField).toBeFalsy();
    };

    this.testChild = function(value, datesAsMoment) {
      expect(value.id).toBe('Test:2');
      expect(value.boolean).toBe(false);
      expect((datesAsMoment) ? value.date.toISOString() : value.date).toBe('2017-12-31T07:00:00.000Z');
      expect(value.integer).toBe(757);
      expect(value.string).toBe('child test string');
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
      expect(value.ownerID).toBe('Test:1');
      expect(value.ownerType).toBe('Test');
      expect(value.ownerField).toBe('children');
    };

    this.testString = function(value, ownerID, ownerField) {
      expect(value.id).toMatch(/^String:[abcdef0-9-]+/);
      expect(value.value).toBe('child');
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
      expect(value.ownerID).toBe(ownerID);
      expect(value.ownerType).toBe('Test');
      expect(value.ownerField).toBe(ownerField);
    };

    this.testInteger = function(value, ownerID, ownerField) {
      expect(value.id).toMatch(/^Integer:[abcdef0-9-]+/);
      expect(value.value).toBe(42);
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
      expect(value.ownerID).toBe(ownerID);
      expect(value.ownerType).toBe('Test');
      expect(value.ownerField).toBe(ownerField);
    };
  });

  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to decompose a model', function() {
      // Decomposition should always be in order because the field names of the model are sorted

      var decomposed = this.model.decompose();

      expect(decomposed).toBeArray(13);

      // Test Model
      this.testModel(decomposed[0].value);

      // Test Child Model
      this.testChild(decomposed[1].value);

      // String Model (Test:2)
      this.testString(decomposed[7].value, 'Test:2', 'stringArray');

      // Integer Model (Test:1)
      this.testInteger(decomposed[8].value, 'Test:1', 'integerArray');
    });

    it('should be able to save a model', function(done) {
      (async function run() {
        var ret = await this.model.save();

        expect(ret).toBeArray(1);
        expect(ret[0].errors).toBeArray(0);
        expect(ret[0].success).toBe(true);

        done();
      }).call(this);
    });

    it('should be able to load saved model', function(done) {
      (async function run() {
        var model = await this.app.query('Test').id.eq('Test:1').first;

        expect(model).toBeType(this.app.getSchemaEngine().getModelBaseClass());

        // Make sure reconstructed model and original model are different
        expect(this.model).not.toBe(model);

        // Test reconstructed model
        this.testModel(model, true);
        expect(model.children).toBeArray(1);
        expect(model.stringArray).toBeArray(2);
        expect(model.stringArray[0]).toBe('hello');
        expect(model.stringArray[1]).toBe('world');
        expect(model.integerArray).toBeArray(3);
        expect(model.integerArray[0]).toBe(42);
        expect(model.integerArray[1]).toBe(0);
        expect(model.integerArray[2]).toBe(1);

        // Test reconstructed child
        var child = model.children[0];
        expect(this.model.children[0]).not.toBe(child);
        this.testChild(child, true);
        expect(child.children).toBeArray(0);
        expect(child.stringArray).toBeArray(3);
        expect(child.stringArray[0]).toBe('hello');
        expect(child.stringArray[1]).toBe('from');
        expect(child.stringArray[2]).toBe('child');
        expect(child.integerArray).toBeArray(3);
        expect(child.integerArray[0]).toBe(1);
        expect(child.integerArray[1]).toBe(42);
        expect(child.integerArray[2]).toBe(0);

        done();
      }).call(this);
    });
  });
});
