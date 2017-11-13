import util from 'util';
import { prettify } from '../../src/utils';
import { Application } from '../../src';

import User from './models/user';
import Dependent from './models/dependent';

function inspect(val) {
  return util.inspect(val, { depth: null, colors: true, showHidden: true });
};

(async function (){
  var myApp = new Application();

  await myApp.init((schema) => {
    schema.register('User', User);
    schema.register('Dependent', Dependent, 'User');
  });

  var schemaTypes = myApp.getSchema().schemaTypes;
  console.log('Integer: ', schemaTypes.Integer.instantiate(), schemaTypes.Integer.instantiate('472.654'));
  console.log('Decimal: ', schemaTypes.Decimal.instantiate(), schemaTypes.Decimal.instantiate('454.564'));
  console.log('Boolean: ', schemaTypes.Boolean.instantiate(), schemaTypes.Boolean.instantiate('yes'));
  console.log('String: ', schemaTypes.String.instantiate(), schemaTypes.String.instantiate('Hello world!'));
  console.log('User: ', schemaTypes.User.instantiate());
  console.log('Dependent: ', schemaTypes.Dependent.instantiate());

  console.log(inspect(myApp.getSchema().getTypeInfo('Dependent')));
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
