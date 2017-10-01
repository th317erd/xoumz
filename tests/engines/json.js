import { ServiceEngine } from '../../lib/service-engine';

class JSONEngine extends ServiceEngine {
  getServiceName() {
    return 'json';
  }
}

module.exports = Object.assign(module.exports, {
  JSONEngine
});
