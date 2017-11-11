import util from 'util';
import { prettify } from '../../src/utils';
import { Schema, SchemaTypes } from '../../src';

console.log('SchemaTypes: ', Schema, SchemaTypes);



// var inspect = (val) => {
//       return util.inspect(val, { depth: null, colors: true, showHidden: true });
//     },
//     schemaType1 = SchemaTypes.String
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
