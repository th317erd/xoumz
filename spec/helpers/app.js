const { Application } = require('../../lib'),
      util = require('util'),
      moment = require('moment');

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
  async function construct() {
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
      }
    }

    var app = this.app = new TestApplication();
    await app.start();

    this.createTestModel = async function() {
      var model = await app.create('Test', {
            id: 'Test:1',
            string: 'test string',
            integer: 756.23,
            boolean: true,
            date: moment('2017-12-29', 'YYYY-MM-DD'),
            stringArray: ['hello', 'world'],
            integerArray: [42, 0, 1]
          }),
          childModel = await app.create('Test', {
            id: 'Test:2',
            string: 'child test string',
            integer: 756.78,
            boolean: false,
            date: moment('2017-12-31', 'YYYY-MM-DD'),
            stringArray: ['hello', 'from', 'child'],
            integerArray: [1, 42, 0]
          }, { owner: model });

      model.children = [childModel];

      return model;
    };

    done();
  }

  jasmine.addMatchers(customMatchers);

  this.testModel = function(value, datesAsMoment) {
    expect(value.id).toBe('Test:1');
    expect(value.boolean).toBe(true);
    expect((datesAsMoment) ? value.date.toISOString() : value.date).toBe('2017-12-29T07:00:00.000Z');
    expect(value.integer).toBe(756);
    expect(value.string).toBe('test string');
    expect(value.createdAt).toBeTruthy();
    expect(value.updatedAt).toBeTruthy();
    expect(value.ownerID).toBeFalsy();
    expect(value.ownerType).toBeFalsy();
    expect(value.ownerField).toBeFalsy();
  };

  this.testChild = function(value, datesAsMoment) {
    expect(value.id).toBe('Test:2');
    expect(value.boolean).toBe(false);
    expect((datesAsMoment) ? value.date.toISOString() : value.date).toBe('2017-12-31T07:00:00.000Z');
    expect(value.integer).toBe(757);
    expect(value.string).toBe('child test string');
    expect(value.createdAt).toBeTruthy();
    expect(value.updatedAt).toBeTruthy();
    expect(value.ownerID).toBe('Test:1');
    expect(value.ownerType).toBe('Test');
    expect(value.ownerField).toBe('children');
  };

  this.testString = function(value, ownerID, ownerField) {
    expect(value.id).toMatch(/^String:[abcdef0-9-]+/);
    expect(value.value).toBe('child');
    expect(value.createdAt).toBeTruthy();
    expect(value.updatedAt).toBeTruthy();
    expect(value.ownerID).toBe(ownerID);
    expect(value.ownerType).toBe('Test');
    expect(value.ownerField).toBe(ownerField);
  };

  this.testInteger = function(value, ownerID, ownerField) {
    expect(value.id).toMatch(/^Integer:[abcdef0-9-]+/);
    expect(value.value).toBe(42);
    expect(value.createdAt).toBeTruthy();
    expect(value.updatedAt).toBeTruthy();
    expect(value.ownerID).toBe(ownerID);
    expect(value.ownerType).toBe('Test');
    expect(value.ownerField).toBe(ownerField);
  };

  this.inspect = function(obj) {
    console.log(util.inspect(obj, { depth: null, colors: true }));
  };

  construct.call(this);
});

afterAll(function(done) {
  this.app.stop().then(done);
});
