const { Application } = require('../../lib'),
      util = require('util'),
      moment = require('moment');

const customMatchers = {
  toBeTheSame: function(util, customEqualityTesters) {
    return {
      compare: function(_actual, _expected) {
        var actual = (_actual !== undefined && _actual !== null) ? _actual.valueOf() : _actual,
            expected = (_expected !== undefined && _expected !== null) ? _expected.valueOf() : _expected;

        return {
          pass: util.equals(actual, expected, customEqualityTesters),
          message: `Expected ${actual} to be the same as ${expected}`
        };
      }
    };
  },
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
  },
  toBeValidISODate: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        return {
          pass: !!('' + actual).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
          message: `Expected ${actual} to be a valid ISO date`
        };
      }
    };
  },
  toBeValidID: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        return {
          pass: !!('' + actual).match(new RegExp(`^${expected}:[a-f0-9-]+$`)),
          message: `Expected ${actual} to be a valid ID of model type ${expected}`
        };
      }
    };
  },
  toBePrimitiveModel: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        var rawValue = expected.value,
            ownerID = expected.ownerID || 'Test:1',
            ownerField = expected.ownerField || 'children',
            ownerType = expected.ownerType || 'Test';

        if (!actual)
          return { pass: false, message: `Expected ${actual} to be a string model` };

        if (!actual.id.match(/^String:[abcdef0-9-]+/))
          return { pass: false, message: `Expected ${actual}.id to be a valid id` };

        if (actual.value !== rawValue)
          return { pass: false, message: `Expected ${actual}.value to be ${rawValue}` };

        if (!actual.createdAt)
          return { pass: false, message: `Expected ${actual}.createdAt to be truthy` };

        if (!actual.updatedAt)
          return { pass: false, message: `Expected ${actual}.updatedAt to be truthy` };

        if (actual.ownerID !== ownerID)
          return { pass: false, message: `Expected ${actual}.ownerID to be ${ownerID}` };

        if (actual.ownerID !== ownerID)
          return { pass: false, message: `Expected ${actual}.ownerID to be ${ownerID}` };

        if (actual.ownerType !== ownerType)
          return { pass: false, message: `Expected ${actual}.ownerType to be ${ownerType}` };

        if (actual.ownerField !== ownerField)
          return { pass: false, message: `Expected ${actual}.ownerField to be ${ownerField}` };

        return { pass: true };
      }
    };
  }
};

beforeAll(function(done) {
  async function construct() {
    class TestApplication extends Application {
      constructor(opts) {
        super({
          ...(opts || {}),
          appName: 'test'
        });
      }

      async loadAppConfig() {
        return {
          test: {
            http: {
              enabled: true
            }
          }
        };
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

      async onSchemaEngineBeforeStart() {
        var schemaEngine = this.getSchemaEngine(),
            connectorEngine = this.getConnectorEngine();

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

      // async onRouteEngineStart() {
      //   var routeEngine = this.getRouteEngine();
      //   routeEngine.registerRoute((Route) => {
      //     return class TestRoute extends Route {

      //     };
      //   });
      // }

      async onAfterStart() {
        var schemaEngine = this.getSchemaEngine();

        // Startialize SQLite memory connector
        await this.getConnector('sqlite').migrate(schemaEngine);
      }

      async start(...args) {
        await super.start(...args);
      }
    }

    application = this.app = new TestApplication();
    await application.start();

    done();
  }

  async function modelTester(testData, ownerData, value, datesAsMoment) {
    expect(value.id).toBeTheSame(testData.id);
    expect(value.boolean).toBeTheSame(testData.boolean);
    expect((datesAsMoment) ? value.date.toISOString() : value.date).toBeTheSame(testData.date.toISOString());
    expect(value.integer).toBeTheSame(Math.round(testData.integer));
    expect(value.string).toBeTheSame(testData.string);

    this.testLazyCollection(value.stringArray, testData.stringArray);
    this.testLazyCollection(value.integerArray, testData.integerArray);

    expect(value.createdAt).toBeTruthy();
    expect(value.updatedAt).toBeTruthy();

    if (!ownerData) {
      expect(value.ownerID).toBeFalsy();
      expect(value.ownerType).toBeFalsy();
      expect(value.ownerField).toBeFalsy();

      this.testLazyCollection(value.children, testData.children, (item, index, staticArray) => {
        this[`testChildModel${index}`](item, true);
      });
    } else {
      expect(value.ownerID).toBeTheSame(ownerData.id);
      expect(value.ownerType).toBeTheSame('Test');
      expect(value.ownerField).toBeTheSame('children');
    }
  }

  jasmine.addMatchers(customMatchers);

  var application;
  const testChildModelData = {
          id: 'Test:2',
          string: 'child test string',
          integer: 876.78,
          boolean: false,
          date: moment('2017-12-31', 'YYYY-MM-DD'),
          stringArray: ['hello', 'from', 'child'],
          integerArray: [1, 42, 0]
        },
        testModelData = {
          id: 'Test:1',
          string: 'test string',
          integer: 756.23,
          boolean: true,
          date: moment('2017-12-29', 'YYYY-MM-DD'),
          stringArray: ['hello', 'world'],
          integerArray: [42, 0, 1],
          children: [testChildModelData]
        };

  this.testLazyCollection = async (collection, staticArray, _compareFunc) => {
    var compareFunc = _compareFunc || ((item, index) => expect(item).toBeTheSame(staticArray[index]));

    var testArray = await collection.map((item, index) => {
      compareFunc(item, index, staticArray);
      return item;
    });

    for (var i = 0, il = testArray.length; i < il; i++)
      compareFunc(testArray[i], i, staticArray);
  };

  this.createTestModel = async () => {
    var model = await application.create(testModelData, 'Test');
    return model;
  };

  this.testModel = modelTester.bind(this, testModelData, null);
  this.testChildModel0 = modelTester.bind(this, testChildModelData, testModelData);

  this.inspect = function(obj) {
    console.log(util.inspect(obj, { depth: null, colors: true }));
  };

  construct.call(this);
});

afterAll(function(done) {
  this.app.stop().then(done);
});
