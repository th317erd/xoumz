describe('SQLite', function() {
  describe('Schema', function() {
    it('should be able to create required tables from schema', async function() {
      var connectorEngine = this.app.getEngine('connector');
      var connection = connectorEngine.getConnector();

      await connection.buildTablesFromSchema();
    });
  });
});
