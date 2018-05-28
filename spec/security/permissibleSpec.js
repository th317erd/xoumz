describe('Security', function() {
  const moment = require('moment');

  beforeEach(function() {
    this.schemaEngine = this.app.getEngine('schema');

    this.model = this.createTestModel();
    this.user = this.createTestUser();

    this.session = this.schemaEngine.create('Session', {
      validAt: moment().toISOString()
    });
  });

  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to get perspective permissions on child', function() {
      debugger;
      console.log('OWNER VALUE', this.session.owner);
      this.session.owner = this.user;
      debugger;
      var level = this.model.getPermissionLevel(this.model.children[0]);
      expect(level).toBeTheSame(this.app.Role.PERMISSION.READ);
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
