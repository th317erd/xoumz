import { ServiceEngine } from '../../../index';

class JSONEngine extends ServiceEngine {
  getServiceName() {
    return 'json';
  }
}

module.exports = Object.assign(module.exports, {
  JSONEngine
});
