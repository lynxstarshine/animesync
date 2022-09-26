export type Artwork = {
  height: number;
  width: number;
  source: string;
};

export type Collection<T> = {
  items: Array<T>;
};

export type Episode = {
  description?: string;
  episode?: string;
  episode_number?: number;
  id: string;
  images: Record<string, Array<Array<Artwork>>>;
  title: string;
  sequence_number?: number;
};

export type Season = {
  id: string;
  title: string;
  season_number: number;
}

export type Series = {
  description?: string;
  images: Record<string, Array<Array<Artwork>>>;
  title: string;
};

export type Streams = {
  streams: Record<string, Record<string, {hardsub_locale: string, url: string}>>;
  subtitles: Record<string, Subtitle>;
};

export type Subtitle = {
  format: 'ass';
  locale: 'ar-ME' | 'fr-FR' | 'de-DE' | 'en-US' | 'es-LA' | 'es-ES' | 'it-IT' | 'pt-BR' | 'ru-RU' | 'tr-TR';
  url: string;
};
