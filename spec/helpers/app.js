const { Application } = require('../../lib'),
      util = require('util');

const customMatchers = {
  toBeArray: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        if (!(actual instanceof Array))
          return { pass: false, message: `Expected ${actual} to be an instance of an Array` };

        if (expected !== undefined && actual.length !== expected)
          return { pass: false, message: `Expected Array of length ${actual.length} to be an Array of length ${expected}` };

        return { pass: true, message: null };
      }
    };
  },
  toBeType: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        if (!(actual instanceof expected))
          return { pass: false, message: `Expected ${actual} to be an instance of ${expected.name}` };

        return { pass: true, message: null };
      }
    };
  }
};

beforeAll(function(done) {
  jasmine.addMatchers(customMatchers);

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
              'string': types.String,
              'integer': types.Integer,
              'boolean': types.Boolean,
              'date': types.Date,
              'stringArray': types.ArrayOf(types.String),
              'integerArray': types.ArrayOf(types.Integer),
              'children': types.ArrayOf(types.Test)
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

  this.inspect = function(obj) {
    console.log(util.inspect(obj, { depth: null, colors: true }));
  };
});

afterAll(function(done) {
  this.app.stop().then(done);
});
