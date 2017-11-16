import * as Schema from './schema';
import * as Connectors from './connectors';
import * as BaseRecord from './base-record';
import * as Application from './application';

(function(root) {
  Object.assign(root, Schema, Connectors, BaseRecord, Application, {
    
  });
})(module.exports);
