describe('SQLite', function() {
  describe('Schema', function() {
    it('should be able to use a SQLiteConnector', async function() {
      const { SQLiteConnector } = this.app.Connectors;

      // Create a memory connector
      var connector = new SQLiteConnector();

      await connector.getConnection(async function() {
        await this.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY AUTOINCREMENT, string VARCHAR(255) NOT NULL, number INTEGER);');

        await this.exec({ query: 'INSERT INTO test_table (string, number) VALUES (?, ?);', values: ['test', 453] });

        var results = await this.exec('SELECT * FROM test_table ORDER BY id ASC;');
        expect(results).toBeTruthy();
        expect(results[0]).toBeTruthy();

        var result = results[0];
        expect(result.id).toBe(1);
        expect(result.string).toBe('test');
        expect(result.number).toBe(453);

        await this.exec({ query: 'INSERT INTO test_table (string, number) VALUES (?, ?);', values: ['hello', 936] });

        var results = await this.exec('SELECT * FROM test_table ORDER BY id ASC;');
        expect(results).toBeTruthy();
        expect(results[0]).toBeTruthy();
        expect(results[1]).toBeTruthy();

        var result = results[0];
        expect(result.id).toBe(1);
        expect(result.string).toBe('test');
        expect(result.number).toBe(453);

        var result = results[1];
        expect(result.id).toBe(2);
        expect(result.string).toBe('hello');
        expect(result.number).toBe(936);
      });
    });

    it('should be able to complete a transaction', async function() {
      const { SQLiteConnector } = this.app.Connectors;

      // Create a memory connector
      var connector = new SQLiteConnector();

      await connector.getConnection(async function() {
        await this.exec('CREATE TABLE test_table2 (id INTEGER PRIMARY KEY AUTOINCREMENT, string VARCHAR(255) NOT NULL, number INTEGER);');

        await this.transaction(function() {
          this.exec({ query: 'INSERT INTO test_table2 (string, number) VALUES (?, ?);', values: ['test2', 123] });
          this.exec({ query: 'INSERT INTO test_table2 (string, number) VALUES (?, ?);', values: ['hello2', 321] });
        });

        var results = await this.exec('SELECT * FROM test_table2 ORDER BY id ASC;');
        expect(results).toBeTruthy();
        expect(results).toBeArray();
        expect(results.length).toBe(2);
      });
    });

    it('should be able to rollback a failed transaction', async function() {
      const { SQLiteConnector } = this.app.Connectors;

      // Create a memory connector
      var connector = new SQLiteConnector();

      await connector.getConnection(async function() {
        await this.exec('CREATE TABLE test_table3 (id INTEGER PRIMARY KEY AUTOINCREMENT, string VARCHAR(255) NOT NULL, number INTEGER);');

        try {
          await this.transaction(function() {
            this.exec({ query: 'INSERT INTO test_table3 (string, number) VALUES (?, ?);', values: ['test2', 123] });
            this.exec({ query: 'INSERT INTO test_table3 (string, number) VALUES (?, ?);', values: ['hello2', 321] });

            // this should fail
            this.exec({ query: 'INSERT INTO derp (string, number) VALUES (?, ?);', values: ['fail', 0] });
          });
        } catch (e) {}

        // rollback should have ensured we have zero results
        var results = await this.exec('SELECT * FROM test_table3 ORDER BY id ASC;');
        expect(results).toBeTruthy();
        expect(results).toBeArray();
        expect(results.length).toBe(0);
      });
    });

    it('should be able to return results from multiple queries', async function() {
      const { SQLiteConnector } = this.app.Connectors;

      // Create a memory connector
      var connector = new SQLiteConnector();

      await connector.getConnection(async function() {
        await this.exec('CREATE TABLE test_table4 (id INTEGER PRIMARY KEY AUTOINCREMENT, string VARCHAR(255) NOT NULL, number INTEGER);');

        await this.transaction(function() {
          // also testing that a transaction inside a transaction works
          this.exec('BEGIN');
          this.exec({ query: 'INSERT INTO test_table3 (string, number) VALUES (?, ?);', values: ['test2', 123] });
          this.exec({ query: 'INSERT INTO test_table3 (string, number) VALUES (?, ?);', values: ['hello2', 321] });
          this.exec('COMMIT');
        });

        var results = await this.exec([
          { query: 'SELECT * FROM test_table3 WHERE id=?;', values: [1] },
          { query: 'SELECT * FROM test_table3 WHERE id=?;', values: [2] }
        ]);

        expect(results).toBeTruthy();
        expect(results).toBeArray();
        expect(results.length).toBe(2);

        expect(results[0]).toBeArray();
        expect(results[0].length).toBe(1);

        expect(results[1]).toBeArray();
        expect(results[1].length).toBe(1);
      });
    });
  });

  fdescribe('Schema', function() {
    it('should be able to create required tables from schema', async function() {
      var connectorEngine = this.app.getEngine('connector');
      var connection = connectorEngine.getConnector();

      await connection.buildTablesFromSchema();
    });
  });
});
