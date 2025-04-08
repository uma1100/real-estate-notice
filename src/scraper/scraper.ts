import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types/property';

export async function scrapeProperties(url: string): Promise<Property[]> {
  console.log('Starting scraping process...');

  try {
    console.log('Sending request to SUUMO...');
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    console.log('Response received from SUUMO');

    const $ = cheerio.load(response.data);
    const properties: Property[] = [];

    console.log('Starting property extraction...');
    $('.cassetteitem').each((_, elem) => {
      const title = $(elem).find('.cassetteitem_content-title').text().trim().replace(/\s+/g, ' ');
      console.log('Processing property:', { title });
      const address = $(elem).find('.cassetteitem_detail-col1').text().trim().replace(/\s+/g, ' ');
      const imageUrl = $(elem).find('.casssetteitem_other-thumbnail-img').attr('src') || 'https://example.com/default-image.jpg';
      const detailUrl = 'https://suumo.jp' + $(elem).find('.js-cassette_link').attr('href');

      // アクセス情報を取得
      const access: string[] = [];
      $(elem).find('.cassetteitem_detail-col2 .cassetteitem_detail-text').each((_, accessElem) => {
        const accessText = $(accessElem).text().trim().replace(/\s+/g, ' ');
        if (accessText) {
          access.push(accessText);
        }
      });

      $(elem).find('.js-cassette_link').each((_, roomElem) => {
        console.log('Processing room...');

        // 各行の階、賃料、管理費、敷金、礼金、間取り、面積を取得
        const floor = $(roomElem).find('td').eq(2).text().trim().replace(/\s+/g, ' ');
        const rent = $(roomElem).find('td').eq(3).find('.cassetteitem_price--rent').text().trim();
        const managementFee = $(roomElem).find('td').eq(3).find('.cassetteitem_price--administration').text().trim();
        const deposit = $(roomElem).find('td').eq(4).find('.cassetteitem_price--deposit').text().trim();
        const gratuity = $(roomElem).find('td').eq(4).find('.cassetteitem_price--gratuity').text().trim();
        const layout = $(roomElem).find('td').eq(5).find('.cassetteitem_madori').text().trim();
        const menseki = $(roomElem).find('td').eq(5).find('.cassetteitem_menseki').text().trim();
        const age = $(elem).find('.cassetteitem_detail-col3').eq(0).text().trim(); // 年齢は建物から取得
        const layoutImageUrl = $(roomElem).find('.casssetteitem_other-thumbnail-img').attr('rel') || '';
        const roomDetailUrl = 'https://suumo.jp' + $(roomElem).find('td').eq(8).find('a').attr('href');

        // タグ情報を取得（部屋ごとではなく物件全体から取得）
        const tags: string[] = [];
        $(elem).find('.cassetteitem_other-col .ui-tag--outline').each((_, tagElem) => {
          const tagText = $(tagElem).text().trim();
          if (tagText) {
            tags.push(tagText);
          }
        });

        properties.push({
          title,
          address,
          floor,
          rent,
          managementFee,
          deposit,
          gratuity,
          layout,
          menseki,
          age,
          imageUrl: layoutImageUrl, // 建物の画像URLを使用
          detailUrl: roomDetailUrl, // 各部屋の詳細URLを使用
          access,
          tags
        });
      });
    });

    return properties.slice(0, 10); // 最大10件までに制限
  } catch (error) {
    console.error('Error during scraping:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    throw new Error('物件情報の取得に失敗しました。');
  }
} 
