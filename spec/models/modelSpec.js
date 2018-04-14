describe('SchemaType', function() {
  beforeEach(function() {
    const { SchemaEngine } = this.app.requireModule('./schema/schema-engine');
    const { ModelSchema } = this.app.requireModule('./schema/model-schema');
    const { Session } = this.app.requireModule('./models/session');
    const { User } = this.app.requireModule('./models/user');

    this.SchemaEngine = SchemaEngine;
    this.ModelSchema = ModelSchema;

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
    it('should be able to create a valid model', async function(done) {
      var user = this.user;
      debugger;

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
  });
});
