import { Application } from '../../src';
import { inspect } from './utils';

import User from './models/user';
import Dependent from './models/dependent';

import testPlugin from './test-plugin';

(async function () {
  var myApp = new Application({
    plugins: [
      testPlugin
    ]
  });

  await myApp.init((app, schema, connectors) => {
    schema.register('User', User);
    schema.register('Dependent', Dependent, 'User');
    connectors.register(new app.ConnectorCollection.MemoryConnector());
  });

  var schemaTypes = myApp.getSchema().schemaTypes,
      testModel = await myApp.createType('User', JSON.stringify({ firstName: 'Test', age: '56.453', items: '45|23|765.345' }));

  testModel.save();

  //console.log(inspect(myApp.getSchema().getTypeInfo('Dependent')));
  myApp.Logger.debug('MODEL: ', inspect(testModel));
  //myApp.Logger.debug('MODEL SCHEMA: ', inspect(testModel), inspect(myApp.getSchema().introspectType({ id: 'USER:1234', firstName: null, age: 65 })));

  var testModelLoaded = await myApp.loadType({ firstName: 'Test' }, { type: 'User' });
  myApp.Logger.debug('MODEL: ', inspect(testModelLoaded));
})();