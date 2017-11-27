import path from 'path';

module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf } = requireModule('./utils');

  class Migration {
    constructor() {
    }

    async run() {
      throw new Error("Migration doesn't implement a run method");
    }
  }

  Object.assign(root, {
    Migration
  });
};
