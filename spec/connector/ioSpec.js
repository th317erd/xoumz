const moment = require('moment');

describe('Connector IO', function() {
  beforeEach(function(done) {
    (async () => {
      this.model = await this.createTestModel();
      done();
    })();
  });

  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  fdescribe('External functionality', function() {
    it('should be able to decompose a model', function() {
      // Decomposition should always be in order because the field names of the model are sorted

      var decomposed = this.model.decompose();

      expect(decomposed).toBeArray(13);

      // Test Model
      this.testModel(decomposed[0].getValue());

      // Test Child Model
      this.testChild(decomposed[1].getValue());

      // String Model (Test:2)
      this.testString(decomposed[7].getValue(), 'Test:2', 'stringArray');

      // Integer Model (Test:1)
      this.testInteger(decomposed[8].getValue(), 'Test:1', 'integerArray');
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

        debugger;

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
