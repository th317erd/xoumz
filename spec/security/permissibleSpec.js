describe('Security', function() {
  const moment = require('moment');

  beforeEach(function() {
    this.Permissible = this.app.requireModule('./security/permissible');
    this.schemaEngine = this.app.getEngine('schema');

    this.model = this.createTestModel();
    this.user = this.createTestUser();

    try {
      debugger;
      this.session = this.schemaEngine.create('Session', {
        owner: {

        },
        validAt: moment().toISOString()
      });
    } catch (e) {
      debugger;
    }
  });

  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to get perspective permissions on child', async function() {
      debugger;
      var owner = await this.session.owner;
      debugger;
      this.session.owner = this.user;
      debugger;
      var level = await this.model.getPermissionLevel(this.model.children[0]);
      expect(level).toBeTheSame(this.Permissible.PERMISSION_LEVEL.READ);
    });

    // it('should be able to get perspective permissions on self', function() {
    //   var level = this.model.getPermissionLevel(this.model);
    //   expect(level).toBeTheSame(this.app.Role.PERMISSION.FULL);
    // });

    // it('should be blocked without admin role', function(done) {
    //   (async () => {
    //     var otherModel = await this.createTestModel();
    //     otherModel.roles = ['admin'];
    //     otherModel.id = 'User:500';

    //     var level = this.model.getPermissionLevel(otherModel);
    //     expect(level).toBeTheSame(0);

    //     done();
    //   })();
    // });

    // it('should be allowed with an admin role', function(done) {
    //   (async () => {
    //     var otherModel = await this.createTestModel();
    //     otherModel.roles = ['admin'];
    //     otherModel.id = 'User:500';
    //     this.model.roles = ['admin'];

    //     var level = this.model.getPermissionLevel(otherModel);
    //     expect(level).toBeTheSame(this.app.Role.PERMISSION.FULL);

    //     done();
    //   })();
    // });
  });
});
