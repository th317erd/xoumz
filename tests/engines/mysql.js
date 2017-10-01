import { ServiceEngine } from '../../lib/service-engine';

class MySQLEngine extends ServiceEngine {
  getServiceName() {
    return 'sql';
  }
}

module.exports = Object.assign(module.exports, {
  MySQLEngine
});
