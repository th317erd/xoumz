import { prettify } from '../../src/utils';
import { Application, MemoryConnector } from '../../src';
import { inspect } from './utils';

import User from './models/user';
import Dependent from './models/dependent';

(async function () {
  var myApp = new Application();

  await myApp.init((schema, connectors) => {
    schema.register('User', User);
    schema.register('Dependent', Dependent, 'User');
    connectors.register(new MemoryConnector());
  });

  var schemaTypes = myApp.getSchema().schemaTypes,
      testModel = myApp.createType('User', JSON.stringify({ firstName: 'Test', age: '56.453' }));

  //console.log(inspect(myApp.getSchema().getTypeInfo('Dependent')));
  console.log('MODEL: ', inspect(testModel));
})();



// 
//     var schemaType1 = SchemaTypes.String
//                       .required
//                       .notNull
//                       .primaryKey
//                       .defaultValue('test')
//                       .validate(() => true)
//                       .field('test')
//                       .getter((val) => prettify(val))
//                       .context('sql', function() {
//                         this.allowNull(true);
//                         this.validate(() => {});
//                       }),
//     schemaType2 = SchemaTypes.arrayOf(schemaType1),
//     context = 'sql';

// console.log('Type: ', inspect({
//   'field': schemaType1.getProp('field', context),
//   'notNull': schemaType1.getProp('notNull', context),
//   'primaryKey': schemaType1.getProp('primaryKey', context),
//   'forignKey': schemaType1.getProp('forignKey', context),
//   'defaultValue': schemaType1.getProp('defaultValue', context),
//   'validators': schemaType1.getProp('validators', context),
//   'getter:value': schemaType1.getProp('getter', context)('stuff')
// }));
