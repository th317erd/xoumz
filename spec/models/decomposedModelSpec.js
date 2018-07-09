describe('SchemaType', function() {
  beforeEach(function() {
    const { LazyCollection } = this.app.requireModule('./base/collections');
    this.LazyCollection = LazyCollection;

    this.user = this.createTestUser();
  });

  describe('Internal functionality', function() {
  });

  describe('External functionality', function() {
    fit('should be able to decompose a valid model', async function(done) {
      var user = this.user;

      expect(user.firstName).toBe('derp');
      expect(user.lastName).toBe('dude');
      expect(user.userName).toBe('test');
      expect(user.age).toBe(31);

      var roles = await user.roles.all();
      expect(roles).toBeType(Array);
      expect(roles.length).toBe(4);
      expect(roles.join(',')).toBe('derp,test,stuff,hello');

      var decomposed = user.decompose();

      done();
    });

    it('should be able to set properties on a model', async function(done) {
      var user = this.user;

      user.firstName = 'WOW!!!';
      expect(user.firstName).toBeType(String);
      expect(user.firstName.valueOf()).toBe('WOW!!!');

      user.roles = ['hello', 'world'];
      expect(user.roles).toBeType(this.app.Models.Collection);
      expect(user.roles.length).toBe(2);

      // Should not be able to set a virtual property
      user.age = 52;
      expect(user.age).toBeType(Number);
      expect(user.age.valueOf()).toBe(31);

      done();
    });
  });
});
