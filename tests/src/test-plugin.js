import { appendFile } from "fs";

function modifyLogger(loggerModule) {
  loggerModule.debug = function(...args) {
    console.log('THIS IS A PLUGIN OVERRIDE: ', ...args);
  };

  return loggerModule;
}

module.exports = function(appModule, name) {
  if (name !== 'logger')
    return appModule;
  
  return modifyLogger(appModule);
};
