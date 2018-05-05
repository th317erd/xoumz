describe('SchemaType', function() {
  beforeEach(function() {
    const { SchemaEngine } = this.app.requireModule('./schema/schema-engine');
    const { ModelSchema } = this.app.requireModule('./schema/model-schema');
    const { Session } = this.app.requireModule('./models');
    const { User } = this.app.requireModule('./models');
    const { LazyCollection } = this.app.requireModule('./base/collections');

    this.SchemaEngine = SchemaEngine;
    this.ModelSchema = ModelSchema;
    this.LazyCollection = LazyCollection;

    this.schemaEngine = new SchemaEngine({
      Session,
      User
    });

    this.user = this.schemaEngine.create('User', {
      firstName: 'derp',
      lastName: 'dude',
      userName: 'test',
      dob: '1986-10-16T00:00:00.000Z',
      roles: ['derp', 'test', 'stuff', 'hello']
    });
  });

  describe('Internal functionality', function() {
  });

  describe('External functionality', function() {
    it('should be able to decompose a valid model', async function(done) {
      var user = this.user;

      expect(user.firstName.valueOf()).toBe('derp');
      expect(user.lastName.valueOf()).toBe('dude');
      expect(user.userName.valueOf()).toBe('test');
      expect(user.age.valueOf()).toBe(31);

      var roles = await user.roles.all();
      expect(roles).toBeType(Array);
      expect(roles.length).toBe(4);
      expect(roles.join(',')).toBe('derp,test,stuff,hello');

      done();
    });

    it('should be able to set properties on a model', async function(done) {
      var user = this.user;

      user.firstName = 'WOW!!!';
      expect(user.firstName).toBeType(String);
      expect(user.firstName.valueOf()).toBe('WOW!!!');

      user.roles = ['hello', 'world'];
      expect(user.roles).toBeType(this.LazyCollection);
      expect(user.roles.length).toBe(2);

      // Should not be able to set a virtual property
      user.age = 52;
      expect(user.age).toBeType(Number);
      expect(user.age.valueOf()).toBe(31);

      done();
    });
  });
});
