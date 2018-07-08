const { Application } = require('../../lib'),
      fs = require('fs');

const DATABASE_PATH = '/tmp/xoumz.sqlite';
class TestApplication extends Application {
  constructor(opts) {
    super({
      ...(opts || {}),
      environment: 'development',
      appName: 'test'
    });
  }

  async initialize() {
    const { ModelBase, User, Session, Scope, OwnerScope, Collection } = this.Models;
    const { SchemaEngine } = this.Schema;
    const { ConnectorEngine, SQLiteConnector } = this.Connectors;

    const Test = this.defineClass((ModelBase) => {
      return class Test extends ModelBase {
        static schema(defineSchema) {
          return defineSchema(null, {
            schema: function({ String, Integer, Boolean, Date, Test, Collection }) {
              return {
                'string': String.size(255),
                'integer': Integer,
                'boolean': Boolean,
                'date': Date,
                'stringArray': Collection(String),
                'integerArray': Collection(Integer),
                'children': Collection(Test)
              };
            },
            demote: (values) => values,
            promote: (values) => values,
          });
        }
      };
    }, ModelBase);

    this.registerEngine(new SchemaEngine([
      Scope,
      OwnerScope,
      Session,
      User,
      Collection,
      Test
    ]));

    if (this.getMasterApplication() === this) {
      fs.unlinkSync(DATABASE_PATH);
      this.registerEngine(new ConnectorEngine({
        connectors: [
          new SQLiteConnector({
            databasePath: DATABASE_PATH
          })
        ]
      }));
    }

    await super.initialize();

    if (this.getMasterApplication() === this) {
      await this.addSlaveApplication(TestApplication, {
        version: 'v0.0.0'
      });
    }
  }
}

module.exports = { TestApplication };