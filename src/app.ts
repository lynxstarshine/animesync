import * as app from '.';
import commander from 'commander';

commander.createCommand()
  .description(require('../package').description)
  .version(require('../package').version)
  .addCommand(commander.createCommand('browser')
    .description('Launch browser.')
    .action(app.actions.browserAsync))
  .addCommand(commander.createCommand('download')
    .description('Downloads series.')
    .action(app.actions.downloadAsync))
  .addCommand(commander.createCommand('series')
    .description('Manages series.')
    .addCommand(commander.createCommand('add')
      .arguments('<seriesUrl> [rootPath]')
      .description('Adds the series.')
      .action(app.actions.seriesAddAsync))
    .addCommand(commander.createCommand('list')
      .description('Lists each series.')
      .action(app.actions.seriesListAsync))
    .addCommand(commander.createCommand('remove')
      .arguments('<seriesUrl>')
      .description('Removes the series.')
      .action(app.actions.seriesRemoveAsync)))
  .parseAsync();
