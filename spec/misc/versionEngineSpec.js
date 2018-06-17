describe('VersionEngine', function() {
  it('should be able to get master application', function() {
    expect(this.app.getMasterApplication()).toBe(this.app);
  });

  it('should be able to a slave application', function() {
    var versionedApp = this.app.getVersionedApplication('v0.0.0');
    expect(versionedApp).toBeType('Application');
    expect(versionedApp).not.toBe(this.app);
  });
});
