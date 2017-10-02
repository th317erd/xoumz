import { ServiceEngine } from '../../../index';

class MySQLEngine extends ServiceEngine {
  getServiceName() {
    return 'sql';
  }
}

module.exports = Object.assign(module.exports, {
  MySQLEngine
});
