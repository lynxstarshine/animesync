import * as app from '..';

export async function browserAsync() {
  console.log(`Launching browser ...`);
  app.settings.chromeHeadless = false;
  await app.browserAsync((page) => new Promise((resolve) => page.browser().on('disconnected', resolve))).catch(() => undefined);
}