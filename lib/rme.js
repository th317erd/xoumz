
import { definePropertyRW } from './utils';
import { SchemaField, BaseRecord, RecordSchemaDefinition } from './schema';

class RecordManagementEngine {
  constructor() {
    definePropertyRW(this, 'types', {});
  }

  getBaseRecordType() {
    return BaseRecord;
  }

  defineType(typeName, registrar) {
    this.types[typeName] = new RecordSchemaDefinition(typeName, registrar.call(this, this.getBaseRecordType()));
  }

  addDataEngine() {

  }
}

module.exports = Object.assign(module.exports, {
  RecordManagementEngine
});
