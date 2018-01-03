const path = require('path'),
      fs = require('fs'),
      moment = require('moment');

module.exports = function(root, requireModule) {
  const { noe, instanceOf } = requireModule('./utils');
  const { Migration } = requireModule('./migration/migration');
  const Logger = requireModule('./logger');

  class MigrationEngine {
    constructor() {
    }

    async onInit() {
    }

    getBaseMigrationClass() {
      var application = this.getApplication();
      return application.wrapClass(Migration);
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
        '    async run({ Logger }) {',
        `${(cb instanceof Function) ? tabify(cb(), 3) : '      // Put migration code here'}`,
        '    }',
        '  };',
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

    async getMigrations(_filter) {
      try {
        var filter = _filter,
            migrationPath = this.getMigrationsPath(),
            migrationFiles = fs.readdirSync(migrationPath);

        migrationFiles = migrationFiles.map((i) => path.join(migrationPath, i));

        if (!noe(filter)) {
          filter = ('' + filter).toLowerCase().replace(/^.[.\/\\]+/, '');
          migrationFiles = migrationFiles.filter((name) => (('' + name).toLowerCase().indexOf(filter) >= 0));
        }

        return this.migrationFilesToMigrationObjects(migrationFiles);
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

    async executeMigration(_migration) {
      var migration = _migration;
      if (instanceOf(migration, 'string'))
        migration = (await this.getMigrations(migration))[0];

      if (noe(migration))
        return;

      var application = this.getApplication(),
          migrationBaseType = application.wrapClass(this.getBaseMigrationClass()),
          thisModule = require(migration.fileName),
          MigrationClass = thisModule(application, migrationBaseType, application.requireModule),
          migrationInstance = new MigrationClass({ application });

      Logger.info(`Running: migration ${migration.fileName}...`);
      await migrationInstance.run(application);
      await migrationInstance.finalize();
      Logger.info(`Success: migration ${migration.fileName}`);

      return migration;
    }

    async executeMigrations(migrations) {
      if (noe(migrations))
        return;

      var application = this.getApplication(),
          lastRunTime = 0;

      try {
        for (var i = 0, il = migrations.length; i < il; i++) {
          var migration = await this.executeMigration(migrations[i]);
          lastRunTime = migration.ts;
        }
      } finally {
        // Write the last successful migration to persistent storage so that the successful migrations are not run again
        await application.onPersistSave('lastMigrationRunTime', lastRunTime + 1);
      }
    }
  }

  Object.assign(root, {
    Migration,
    MigrationEngine
  });
};
