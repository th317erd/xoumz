const { Application } = require('../../lib');

beforeAll(function(done) {
  class TestApplication extends Application {
    constructor(opts) {
      super({
        ...(opts || {})
      });
    }

    async onStartupCheck() {
      // Skip startup check for tests
    }

    async onPersistSave(key, data) {
      if (!this._persistentStorage)
        this.Utils.definePropertyRO(this, '_persistentStorage', {});

      this.Utils.setProp(this._persistentStorage, key, data);
    }

    async onPersistLoad(key, defaultValue) {
      this.Utils.getProp(this._persistentStorage, key, defaultValue);
    }

    async onInit(schemaEngine, connectorEngine) {
      schemaEngine.registerModelType('User', this.Models.User);
      schemaEngine.registerModelType('Test', function(ModelBase) {
        return class TestModel extends ModelBase {
          static schema(self, types) {
            return {
              'test': types.String
            };
          }
        };
      });

      connectorEngine.register(new this.SQLiteConnector());
    }

    async onAfterInit(schemaEngine, connectorEngine) {
      // Initialize SQLite memory connector
      await this.getConnector('sqlite').migrate(schemaEngine);
    }

    async start(...args) {
      await super.start(...args);
      done();
    }
  }

  this.app = new TestApplication();
  this.app.start();
});

afterAll(function(done) {
  this.app.stop().then(done);
});
