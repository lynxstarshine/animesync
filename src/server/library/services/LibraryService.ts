import * as app from '..';
import * as ncm from '@nestjs/common';
import crypto from 'crypto'
import path from 'path';
import sanitizeFilename from 'sanitize-filename';

@ncm.Injectable()
export class LibraryService {
  private readonly fileService: app.FileService;
  private readonly imageService: app.ImageService;
  private readonly loggerService: app.LoggerService;
  private readonly remoteService: app.RemoteService;
  private readonly supervisor: app.Supervisor;

  constructor(fileService: app.FileService, imageService: app.ImageService, loggerService: app.LoggerService, remoteService: app.RemoteService) {
    this.fileService = fileService;
    this.imageService = imageService;
    this.loggerService = loggerService;
    this.remoteService = remoteService;
    this.supervisor = new app.Supervisor();
  }

  async contextAsync() {
    const coreInfo = await app.CoreInfo.loadAsync(this.fileService);
    const series: Array<app.api.LibraryContextSeries> = [];
    await Promise.all(coreInfo.rootPaths.map(async (rootPath) => {
      const seriesNames = await this.fileService.listAsync(rootPath).catch(() => []);
      await Promise.all(seriesNames.map(async (seriesName) => {
        const seriesPath = path.join(rootPath, seriesName);
        const seriesInfo = await app.SeriesInfo.loadAsync(this.fileService, seriesPath).catch(() => {});
        const seriesValue = createValue(seriesPath, seriesInfo);
        if (seriesInfo && seriesValue) series.push(new app.api.LibraryContextSeries(seriesValue));
      }));
    }));
    series.sort((a, b) => a.title.localeCompare(b.title));
    return new app.api.LibraryContext({...coreInfo, series});
  }

  async contextPostAsync(rootPath: string, url: string) {
    const series = await this.remoteService.seriesAsync({url});
    if (series.error) {
      throw new ncm.HttpException(series.error.message, series.statusCode);
    } else if (series.value) {
      const seriesName = sanitizeFilename(series.value.title);
      const seriesPath = path.join(rootPath ?? app.settings.path.library, seriesName);
      await app.CoreInfo.saveAsync(this.fileService, rootPath);
      await this.saveSeriesAsync(seriesPath, series.value);
    }
  }

  async seriesAsync(seriesPath: string) {
    const seasons: Array<app.api.LibrarySeriesSeason> = [];
    const seriesInfo = await app.SeriesInfo.loadAsync(this.fileService, seriesPath);
    const seriesValue = createValue(seriesPath, {...seriesInfo, seasons});
    const seasonNames = await this.fileService.listAsync(seriesPath).catch(() => []);
    await Promise.all(seasonNames.map(async (seasonName, seasonIndex) => {
      const episodes: Array<app.api.LibrarySeriesSeasonEpisode> = [];
      const seasonPath = path.join(seriesPath, seasonName);
      const seasonValue = createValue(seasonPath, {episodes, season: seasonIndex + 1, title: seasonName});
      const episodeNames = await this.fileService.listAsync(seasonPath).then(x => [...new Set(x.map(y => path.parse(y).name))]).catch(() => []);
      await Promise.all(episodeNames.map(async (episodeName) => {
        const episodePath = path.join(seasonPath, episodeName);
        const episodeInfo = await app.EpisodeInfo.loadAsync(this.fileService, episodePath).catch(() => {});
        const episodeValue = createValue(episodePath, episodeInfo);
        if (episodeInfo && episodeValue) {
          const active = this.supervisor.contains(episodePath);
          const available = await this.episodeAsync(episodePath).then(x => this.fileService.existsAsync(x));
          episodes.push(new app.api.LibrarySeriesSeasonEpisode({...episodeValue, active, available}));
        }
      }));
      if (!episodes.length) return;
      episodes.sort((a, b) => a.episode - b.episode);
      seasons.push(new app.api.LibrarySeriesSeason(seasonValue));
    }));
    seasons.sort((a, b) => a.season - b.season);
    return new app.api.LibrarySeries(seriesValue);
  }

  async seriesDeleteAsync(seriesPath: string) {
    if (this.supervisor.contains(seriesPath)) return false;
    await this.fileService.deleteAsync(seriesPath);
    return true;
  }

  async seriesPutAsync(seriesPath: string, url: string) {
    const series = await this.remoteService.seriesAsync({url});
    if (series.error) {
      throw new ncm.HttpException(series.error.message, series.statusCode);
    } else if (series.value) {
      await this.saveSeriesAsync(seriesPath, series.value);
    }
  }

  async seriesImageAsync(seriesPath: string) {
    return await app.SeriesImage
      .findAsync(this.imageService, seriesPath)
      .then(x => x.filePath)
      .catch(() => {});
  }

  episodeAsync(episodePath: string) {
    const filePath = `${episodePath}.mkv`;
    return Promise.resolve(filePath);
  }

  async episodeDeleteAsync(episodePath: string) {
    if (this.supervisor.contains(episodePath)) return false;
    await this.fileService.deleteAsync(await this.episodeSubtitleAsync(episodePath));
    await this.fileService.deleteAsync(await this.episodeAsync(episodePath));
    return true;
  }

  async episodePutAsync(episodePath: string, url: string) {
    const subtitlePath = await this.episodeSubtitleAsync(episodePath);
    await this.saveEpisodeAsync(episodePath, subtitlePath, url);
  }

  async episodeImageAsync(episodePath: string) {
    return await app.EpisodeImage
      .findAsync(this.imageService, episodePath)
      .then(x => x.filePath)
      .catch(() => {});
  }

  async episodeSubtitleAsync(episodePath: string) {
    const id = createId(episodePath);
    const subtitlePath = path.join(app.settings.path.cache, id.substring(0, 2), `${id.substring(2)}.zip`);
    if (await this.fileService.existsAsync(subtitlePath)) return subtitlePath;
    await this.saveEpisodeSubtitleAsync(episodePath, subtitlePath);
    return subtitlePath;
  }

  private async saveEpisodeAsync(episodePath: string, subtitlePath: string, url: string) {
    const filePath = await this.episodeAsync(episodePath);
    return await this.supervisor.createOrAttachAsync(episodePath, async () => {
      const incompletePath = `${episodePath}.incomplete`;
      const runner = new app.Runner(this.fileService, this.loggerService, this.remoteService);
      await runner.runAsync(filePath, incompletePath, subtitlePath, url);
    });
  }

  private async saveEpisodeSubtitleAsync(episodePath: string, subtitlePath: string) {
    const filePath = await this.episodeAsync(episodePath);
    await this.supervisor.createOrAttachAsync(episodePath, async () => {
      if (!await this.fileService.existsAsync(filePath)) return;
      const extractor = new app.SubtitleExtractor(this.fileService, this.loggerService);
      await extractor.runAsync(filePath, subtitlePath);
    });
  }

  private async saveSeriesAsync(seriesPath: string, series: app.api.RemoteSeries) {
    await this.supervisor.createOrAttachAsync(seriesPath, async () => {
      await app.SeriesInfo.saveAsync(this.fileService, seriesPath, app.SeriesInfo.from(series));
      await app.SeriesImage.saveAsync(this.imageService, seriesPath, series).catch(() => {});
      await Promise.all(series.seasons.map(async (season, seasonIndex) => {
        const seasonName = fetchSeasonName(season.title);
        const seasonPath = path.join(seriesPath, seasonName);
        await Promise.all(season.episodes.map(async (episode, episodeIndex) => {
          const episodeName = fetchSeasonEpisodeName(series, season, episode);
          const episodePath = path.join(seasonPath, episodeName);
          await app.EpisodeInfo.saveAsync(this.fileService, episodePath, app.EpisodeInfo.from(season.number !== undefined ? season.number : (seasonIndex + 1), episodeIndex, episode));
          await app.EpisodeImage.saveAsync(this.imageService, episodePath, episode).catch(() => {});
        }));
      }));
    });
  }
}

function createId(resourcePath: string) {
  const hash = crypto.createHash('sha1');
  hash.update(resourcePath, 'binary');
  return hash.digest('hex'); 
}

function createValue<T>(resourcePath: string, value: T) {
  const id = createId(resourcePath);
  const path = createValuePath(resourcePath);
  return {...value, id, path};
}

function createValuePath(resourcePath: string) {
  const resource = path.parse(resourcePath);
  return path.join(resource.dir, resource.name);
}

function fetchSeasonName(seasonTitle: string) {
  const match = seasonTitle.match(/^(Season) ([0-9]+)$/);
  const name = match ? `${match[1]} ${match[2].padStart(2, '0')}` : seasonTitle;
  return sanitizeFilename(name);
}

function fetchSeasonEpisodeName(series: app.api.RemoteSeries, season: app.api.RemoteSeriesSeason, episode: app.api.RemoteSeriesSeasonEpisode) {
  const match = season.title.match(/^(Season) ([0-9]+)$/);
  const name = match ? `${series.title} S${parseInt(match[2], 10)}` : season.title;
  return sanitizeFilename(`${name} ${episode.name.padStart(2, '0')} [AnimeSync]`)
}
