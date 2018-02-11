describe('SchemaType', function() {
  beforeEach(async function(done) {
    this.model = await this.createTestModel();
    done();
  });

  describe('Internal functionality', function() {
  });

  describe('External functionality', function() {
    it('should be able to create a valid model', async function(done) {
      await this.testModel(this.model, true);
      done();
    });
  });
});
