import * as Schema from './schema';
import * as BaseRecord from './base-record';
import * as Application from './application';

(function(root) {
  Object.assign(root, Schema, BaseRecord, Application, {
    
  });
})(module.exports);
