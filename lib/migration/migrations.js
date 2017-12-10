import path from 'path';
import fs from 'fs';
import moment from 'moment';

module.exports = function(root, requireModule) {
  const { noe } = requireModule('./utils');
  const { Migration } = requireModule('./migration/migration');
  const Logger = requireModule('./logger');

  class MigrationEngine {
    constructor() {
    }

    async onInit() {
    }

    getBaseMigrationClass() {
      return Migration;
    }

    getMigrationTemplate(name, cb) {
      function tabify(_content, minTabs) {
        var content = ('' + _content),
            minSpaces = 9999;

        content = content.replace(/^[\s\t]*\n/, '').replace(/^[\s\t]*/gm, function(m) {
          var ws = m.replace(/\t/g, '  ');
          
          if (ws.length < minSpaces)
            minSpaces = ws.length;
          
          return ws;
        }).replace(/[\s\t\n]*$/, '');

        var spaceLen = (minTabs * 2) - minSpaces;
        if (!spaceLen)
          return content;

        return ('' + content).replace(/^\s*/gm, function(m) {
          if (spaceLen < 0)
            return m.slice(spaceLen * -1);
          else
            return `${(new Array(spaceLen + 1)).join(' ')}${m}`;
        });
      }

      var migrationTemplate = [
        'module.exports = function(app, Migration, requireModule) {',
        '  return class AppMigration extends Migration {',
        '    constructor(...args) {',
        '      super(...args);',
        '    }',
        '',
        '    async run() {',
        `${(cb instanceof Function) ? tabify(cb(), 3) : '      // Put migration code here'}`,
        '    }',
        '  }',
        '};',
        ''
      ];

      return migrationTemplate.join('\n');
    }

    getMigrationsPath() {
      return path.resolve(path.dirname(require.main.filename), './migrations');
    }

    migrationFilesToMigrationObjects(migrationFiles) {
      if (noe(migrationFiles))
        return [];

      var migrationObjects = [];

      for (var i = 0, il = migrationFiles.length; i < il; i++) {
        var migrationFile = migrationFiles[i],
            name = path.basename(migrationFile),
            parts = ('' + name).match(/^(\d{13})-(.*)\.js$/);

        if (!parts)
          continue;
        
        var ts = parseInt(parts[1], 10);
        if (!isFinite(ts))
          continue;
        
        migrationObjects.push({ fileName: migrationFile, name: parts[2], ts });
      }

      return migrationObjects;
    }

    async getMigrations() {
      try {
        var migrationPath = this.getMigrationsPath(),
            migrationFiles = fs.readdirSync(migrationPath);
        return this.migrationFilesToMigrationObjects(migrationFiles.map((i) => path.join(migrationPath, i)));
      } catch (e) {
        Logger.warn(`Unable to find any migrations: ${e}`);
        return [];
      }
    }

    async createNew(name, cb) {
      var migrationPath = this.getMigrationsPath(),
          fullName = path.resolve(migrationPath, `./${moment().valueOf()}-${name.replace(/\.js$/i, '')}.js`);

      if (fs.existsSync(fullName))
        throw new Error(`Attempting to create migration ${fullName} but migration already exists`);

      fs.writeFileSync(fullName, this.getMigrationTemplate(name, cb));
      Logger.info(`Migration ${fullName} created successfully!`);
    }

    filterMigrations(migrations, _lastMigration) {
      if (noe(migrations))
        return [];

      var lastMigrationRanAt = _lastMigration || 0;
      return migrations.filter((mo) => (mo.ts > lastMigrationRanAt));
    }

    async getPendingMigrations(lastMigrationRanAt) {
      var migrations = await this.getMigrations(),
          pendingMigrations = this.filterMigrations(migrations, lastMigrationRanAt);

      return pendingMigrations;
    }

    async executeMigrations(migrations) {
      if (noe(migrations))
        return;
      
      var application = this.getApplication(),
          migrationBaseType = application.wrapClass(this.getBaseMigrationClass());

      try {
        for (var i = 0, il = migrations.length; i < il; i++) {
          var migration = migrations[i],
              thisModule = require(migration.fileName),
              migration = thisModule(application, migrationBaseType, application.requireModule),
              migrationInstance = new migration({ application });

          await migrationInstance.run();
          await migrationInstance.finalize();
          await application.onPersistSave('lastMigrationRunTime', moment().valueOf());
        }
      } catch (e) {
        Logger.error(e);
      }
    }
  }

  Object.assign(root, {
    Migration,
    MigrationEngine
  });
};
