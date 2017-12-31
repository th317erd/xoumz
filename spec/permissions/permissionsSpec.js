describe('Permissions', function() {
  beforeEach(function(done) {
    (async () => {
      this.model = await this.createTestModel();
      done();
    })();
  });

  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to get perspective permissions on child', function() {
      var level = this.model.getPermissionLevel(this.model.children[0]);
      expect(level).toBe(this.app.Role.PERMISSION.READ);
    });

    it('should be able to get perspective permissions on self', function() {
      var level = this.model.getPermissionLevel(this.model);
      expect(level).toBe(this.app.Role.PERMISSION.FULL);
    });

    it('should be blocked without admin role', function(done) {
      (async () => {
        var otherModel = await this.createTestModel();
        otherModel.roles = ['admin'];
        otherModel.id = 'User:500';

        var level = this.model.getPermissionLevel(otherModel);
        expect(level).toBe(0);

        done();
      })();
    });

    it('should be allowed with an admin role', function(done) {
      (async () => {
        var otherModel = await this.createTestModel();
        otherModel.roles = ['admin'];
        otherModel.id = 'User:500';
        this.model.roles = ['admin'];

        var level = this.model.getPermissionLevel(otherModel);
        expect(level).toBe(this.app.Role.PERMISSION.FULL);

        done();
      })();
    });
  });
});
