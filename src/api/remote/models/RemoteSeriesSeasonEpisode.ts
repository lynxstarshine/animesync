import * as api from '..';
import * as clv from 'class-validator';
import * as nsg from '@nestjs/swagger';

export class RemoteSeriesSeasonEpisode {
  constructor(source?: RemoteSeriesSeasonEpisode, sourcePatch?: Partial<RemoteSeriesSeasonEpisode>) {
    this.imageUrl = api.property('imageUrl', source, sourcePatch, undefined);
    this.name = api.property('name', source, sourcePatch, '');
    this.title = api.property('title', source, sourcePatch, '');
    this.synopsis = api.property('synopsis', source, sourcePatch, undefined);
    this.url = api.property('url', source, sourcePatch, '');
    this.number = api.property('number', source, sourcePatch, undefined);
    this.order = api.property('order', source, sourcePatch, undefined);
  }

  @clv.IsOptional()
  @clv.IsString()
  @clv.IsUrl({require_tld: false})
  @nsg.ApiPropertyOptional()
  readonly imageUrl?: string;

  @clv.IsString()
  @clv.IsNotEmpty()
  @nsg.ApiProperty()
  readonly name: string;

  @clv.IsOptional()
  @clv.IsString()
  @nsg.ApiPropertyOptional()
  readonly title?: string;

  @clv.IsOptional()
  @clv.IsString()
  @clv.IsNotEmpty()
  @nsg.ApiPropertyOptional()
  readonly synopsis?: string;

  @clv.IsString()
  @clv.IsUrl()
  @nsg.ApiProperty()
  readonly url: string;

  @clv.IsOptional()
  @clv.IsNumber()
  @nsg.ApiPropertyOptional()
  readonly order?: number

  @clv.IsOptional()
  @clv.IsNumber()
  @nsg.ApiPropertyOptional()
  readonly number?: number
}
