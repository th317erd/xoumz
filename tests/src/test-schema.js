const { Application } = require('../../lib'),
      { inspect } = require('./utils'),
      User = require('./models/user'),
      Dependent = require('./models/dependent'),
      testPlugin = require('./test-plugin');

(async function () {
  try {
    var myApp = new Application({
      plugins: [
        testPlugin
      ]
    });

    await myApp.init((app, schema, connectors) => {
      schema.registerModelType('User', User);
      schema.registerModelType('Dependent', Dependent, 'User');
      connectors.register(new app.ConnectorEngine.MemoryConnector());
    });

    var schemaTypes = myApp.getSchemaEngine().schemaTypes,
        testModel = await myApp.create('User', JSON.stringify({ firstName: 'Test', age: '56.453', items: '45|23|765.345' }));

    testModel.save();

    //console.log(inspect(myApp.getSchemaEngine().getTypeInfo('Dependent')));
    myApp.Logger.debug('MODEL: ', inspect(testModel));
    //myApp.Logger.debug('MODEL SCHEMA: ', inspect(testModel), inspect(myApp.getSchemaEngine().introspectType({ id: 'USER:1234', firstName: null, age: 65 })));

    var testModelLoaded = await myApp.load({ firstName: 'Test' }, { schemaType: 'User' });
    myApp.Logger.debug('MODEL: ', inspect(testModelLoaded));
  } catch (e) {
    console.error(e);
  }
})();
