import axios from 'axios';
import * as cheerio from 'cheerio';
import { scrapingBeeClient } from '../lib/scrapingBee';
import { Property } from '../types/property';

export async function scrapeCanaryProperties(url: string): Promise<Property[]> {
  console.log('🐝 Starting Canary scraping with ScrapingBee...');
  
  try {
    if (!process.env.SCRAPINGBEE_API_KEY) {
      console.error('❌ SCRAPINGBEE_API_KEY environment variable is not set');
      const errorProperty: Property = {
        title: 'ScrapingBee設定エラー',
        address: 'APIキーが設定されていません',
        floor: '-',
        rent: '-',
        managementFee: '-',
        deposit: '-',
        gratuity: '-',
        layout: '-',
        menseki: '-',
        age: '-',
        imageUrl: 'https://example.com/config-error.jpg',
        detailUrl: url,
        access: ['SCRAPINGBEE_API_KEYを環境変数に設定してください'],
        tags: ['設定エラー']
      };
      return [errorProperty];
    }

    console.log('🐝 Fetching Canary page content via ScrapingBee...');
    
    // ScrapingBeeでページを取得（JavaScript実行有効）
    const htmlContent = await scrapingBeeClient.scrapeUrl(url, {
      renderJs: true,       // JavaScript実行を有効化
      blockAds: true,       // 広告をブロック
    });


    console.log('🐝 ScrapingBee response received, parsing with Cheerio...');
    const $ = cheerio.load(htmlContent);
    
    console.log('🔍 Searching for property elements...');
    console.log('📄 HTML length:', htmlContent.length);
    console.log('🔍 Sample HTML (first 500 chars):', htmlContent.substring(0, 500));
    
    const properties: Property[] = [];
    const seenUrls = new Set<string>(); // 重複チェック用

    // メインセレクターで物件を検索
    const roomElements = $('[data-testid="search-result-room-thumbail"]');
    console.log(`📦 Found ${roomElements.length} property elements with [data-testid="search-result-room-thumbail"]`);
    
    // 代替セレクターも試す
    const altElements1 = $('.sc-eba299fd-2');
    console.log(`📦 Found ${altElements1.length} elements with .sc-eba299fd-2 (property titles)`);
    
    const altElements2 = $('.sc-25310353-0');
    console.log(`📦 Found ${altElements2.length} elements with .sc-25310353-0 (room cards)`);

    roomElements.each((_, element) => {
      try {
        const roomLink = $(element);
        
        // 詳細URLを先に取得して重複チェック
        const detailUrl = roomLink.attr('href') || '';
        if (!detailUrl || seenUrls.has(detailUrl)) {
          return; // 重複またはURLなしの場合はスキップ
        }
        seenUrls.add(detailUrl);
        
        // 物件コンテナを見つける
        let propertyContainer = roomLink.closest('[style*="margin-bottom: 16px"]');
        if (propertyContainer.length === 0) {
          // より広い範囲で探す
          let current = roomLink.parent();
          while (current.length > 0 && current.find('.sc-eba299fd-2').length === 0) {
            current = current.parent();
          }
          propertyContainer = current;
        }
        
        if (propertyContainer.length === 0) return;

        // 建物名を取得
        const titleElement = propertyContainer.find('.sc-eba299fd-2');
        const title = titleElement.text()?.trim() || '';

        // アクセス情報を取得
        const access: string[] = [];
        propertyContainer.find('.sc-b58b0813-3').each((_, elem) => {
          const text = $(elem).text()?.trim();
          if (text) access.push(text);
        });

        // 住所（最後のアクセス要素）
        const address = access.length > 0 ? access[access.length - 1] : '';

        // 部屋のサムネイル画像（2番目のサムネイル）
        const imageElement = roomLink.find('.sc-25310353-2');
        const imageUrl = imageElement.attr('src') || 'https://example.com/default-image.jpg';

        // 家賃情報
        const rentElement = roomLink.find('.sc-a9d9171a-0');
        const rentText = rentElement.text()?.trim() || '';
        const rent = rentText ? `${rentText}万円` : '';

        // 管理費
        const managementFeeElement = roomLink.find('.sc-25310353-3');
        let managementFee = managementFeeElement.text()?.trim() || '';
        managementFee = managementFee.replace(rent, '').replace(' / ', '').trim();

        // 敷金・礼金
        const depositElement = roomLink.find('.sc-ba5c86c1-0');
        const deposit = depositElement.text()?.replace('敷', '').trim() || '';

        const gratuityElement = roomLink.find('.sc-ec8edb4e-0');
        const gratuity = gratuityElement.text()?.replace('礼', '').trim() || '';

        // 間取り・面積・階数
        const layoutElement = roomLink.find('.sc-25310353-5');
        const layoutInfo = layoutElement.text()?.trim() || '';
        const layoutParts = layoutInfo.split(' / ');
        const layout = layoutParts[0] || '';
        const menseki = layoutParts[1] || '';
        const floor = layoutParts[2] || '';

        // 築年数
        const age = access.find(a => a.includes('築')) || '';

        // タグ情報
        const tags: string[] = [];
        propertyContainer.find('.sc-8dc067f-0').each((_, tagElem) => {
          const tagText = $(tagElem).text()?.trim();
          if (tagText && tagText !== 'イチオシ') {
            tags.push(tagText);
          }
        });

        if (title && rent) {
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
            imageUrl,
            detailUrl,
            access: access.slice(0, -1), // 住所以外
            tags
          });
        }
      } catch (error) {
        console.error('Error processing property element:', error);
      }
    });

    console.log(`✅ ScrapingBee: Extracted ${properties.length} properties from Canary`);
    return properties;

  } catch (error) {
    console.error('Error during Canary scraping with ScrapingBee:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    
    // ScrapingBeeのエラーの場合は、より詳細なエラー情報を返す
    if (error instanceof Error && error.message.includes('ScrapingBee')) {
      const errorProperty: Property = {
        title: 'ScrapingBeeエラー',
        address: error.message,
        floor: '-',
        rent: '-',
        managementFee: '-',
        deposit: '-',
        gratuity: '-',
        layout: '-',
        menseki: '-',
        age: '-',
        imageUrl: 'https://example.com/scraping-error.jpg',
        detailUrl: url,
        access: ['ScrapingBeeのAPI設定を確認してください'],
        tags: ['APIエラー']
      };
      return [errorProperty];
    }
    
    throw new Error('Canary物件情報の取得に失敗しました。');
  }
}

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

    return properties;
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
