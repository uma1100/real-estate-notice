import axios from 'axios';
import * as cheerio from 'cheerio';
import { phantomJSCloudClient } from '../lib/phantomJsCloud';
import { Property } from '../types/property';

export async function scrapeCanaryProperties(url: string): Promise<Property[]> {
  console.log('👻 Starting Canary scraping with PhantomJSCloud...');

  try {
    if (!process.env.PHANTOMJSCLOUD_API_KEY) {
      console.error('❌ PHANTOMJSCLOUD_API_KEY environment variable is not set');
      const errorProperty: Property = {
        title: 'PhantomJSCloud設定エラー',
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
        access: ['PHANTOMJSCLOUD_API_KEYを環境変数に設定してください'],
        tags: ['設定エラー']
      };
      return [errorProperty];
    }

    console.log('👻 Fetching Canary page content via PhantomJSCloud...');

    // PhantomJSCloudでページを取得（JavaScript実行有効）
    const htmlContent = await phantomJSCloudClient.scrapeUrl(url, {
      renderJs: true,       // JavaScript実行を有効化
      blockAds: true,       // 広告をブロック
    });


    const $ = cheerio.load(htmlContent);

    const properties: Property[] = [];
    const seenUrls = new Set<string>(); // 重複チェック用

    // 検索結果件数を取得
    const resultCountElement = $('*').filter((_, el) => {
      const text = $(el).text();
      return !!text.match(/検索結果\d+件|検索結果.*\d+.*件|\d+件の物件|物件\d+件/);
    }).first();

    let maxResults = 20; // デフォルト値
    if (resultCountElement.length > 0) {
      const countMatch = resultCountElement.text().match(/(\d+)件/);
      if (countMatch) {
        maxResults = parseInt(countMatch[1], 10);
          }
    }

    // メインセレクターで物件を検索
    const roomElements = $('[data-testid="search-result-room-thumbail"]');
    console.log(`📦 Found ${roomElements.length} property elements with [data-testid="search-result-room-thumbail"]`);
    console.log(`🎯 Will process up to ${maxResults} properties`);

    // 代替セレクターも試す
    const altElements1 = $('.sc-eba299fd-2');
    console.log(`📦 Found ${altElements1.length} elements with .sc-eba299fd-2 (property titles)`);

    const altElements2 = $('.sc-25310353-0');
    console.log(`📦 Found ${altElements2.length} elements with .sc-25310353-0 (room cards)`);

    // デバッグ: 最初の要素の詳細を確認
    if (roomElements.length > 0) {
      const firstElement = $(roomElements[0]);
      console.log('🔍 First element HTML:', firstElement.html()?.substring(0, 500));
      console.log('🔍 First element parent classes:', firstElement.parent().attr('class'));
      console.log('🔍 First element closest container classes:', firstElement.closest('div').attr('class'));
    }

    roomElements.each((_, element) => {
      try {
        const roomLink = $(element);

        // 検索条件以降の要素はスキップ
        const elementText = roomLink.closest('div').parent().text();
        if (elementText.includes('検索条件') || elementText.includes('で絞り込まれた物件')) {
          return false; // ループを終了
        }

        // 詳細URLを先に取得して重複チェック
        const detailUrl = roomLink.attr('href') || '';
        if (!detailUrl || seenUrls.has(detailUrl)) {
          return; // 重複またはURLなしの場合はスキップ
        }
        seenUrls.add(detailUrl);


        // 建物名を取得（複数のパターンを試す）
        let title = '';

        // 建物名を取得
        const titleElement = roomLink.closest('div').parent().find('p').filter((_, el) => {
          const text = $(el).text().trim();
          return text.length > 5 && !text.includes('徒歩') && !text.includes('万円');
        }).first();
        title = titleElement.text()?.trim() || '';

        // HTML構造をデバッグで確認
        const propertyContainer = roomLink.closest('div').parent();

        // 画像URL
        const imageElement = roomLink.find('img').first();
        const imageUrl = imageElement.attr('src') || 'https://example.com/default-image.jpg';

        // 全テキストから正規表現で抽出（元に戻す）
        const fullText = propertyContainer.text();

        // 家賃（"16.5万円"の形式）
        const rentMatch = fullText.match(/(\d+(?:\.\d+)?)万円(?=\s*\/\s*管理費)/);
        const rent = rentMatch ? `${rentMatch[1]}万円` : '';

        // 管理費（"管理費12,500円"の形式）
        const managementFeeMatch = fullText.match(/管理費([\d,]+円)/);
        const managementFee = managementFeeMatch ? managementFeeMatch[1] : '';

        // 敷金（"敷16.5万円"の形式）
        const depositMatch = fullText.match(/敷(\d+(?:\.\d+)?万円|無料)/);
        const deposit = depositMatch ? depositMatch[1] : '';

        // 礼金（"礼16.5万円"の形式）
        const gratuityMatch = fullText.match(/礼(\d+(?:\.\d+)?万円|無料)/);
        const gratuity = gratuityMatch ? gratuityMatch[1] : '';

        // 間取り・面積・階数（"2DK / 49.28㎡ / 2階"の形式）
        const layoutInfoMatch = fullText.match(/(\d+[SLDK]+)\s*\/\s*([\d.]+㎡)\s*\/\s*(\d+階)/);
        const layout = layoutInfoMatch ? layoutInfoMatch[1] : '';
        const menseki = layoutInfoMatch ? layoutInfoMatch[2] : '';
        const floor = layoutInfoMatch ? layoutInfoMatch[3] : '';

        // 築年数（"築18年"の形式）
        const ageMatch = fullText.match(/築(\d+年)/);
        const age = ageMatch ? `築${ageMatch[1]}` : '';

        // 住所（"東京都..."の形式）
        const addressMatch = fullText.match(/(東京都[^0-9]*?)(?=\d+(?:\.\d+)?万円)/);
        const address = addressMatch ? addressMatch[1].trim() : '';

        // アクセス情報（"京王線 / 初台駅 徒歩6分"の形式）
        const accessMatches = fullText.match(/[^\n]*?駅\s*徒歩\d+分/g);
        const access = accessMatches ? accessMatches.map(match => {
          // "フェニックス笹塚駅前弐番館京王線 / 笹塚駅 徒歩2分" を "/" でsplitして最後の要素を取得
          const parts = match.split('/');
          const lastPart = parts[parts.length - 1].trim();
          return lastPart;
        }).slice(0, 3) : [];

        // タグ情報（"賃貸マンション"など）
        const tags: string[] = [];
        if (fullText.includes('賃貸マンション')) tags.push('賃貸マンション');
        if (fullText.includes('賃貸アパート')) tags.push('賃貸アパート');


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
            access,
            tags
          });

          // 指定された件数に達したらループを終了
          if (properties.length >= maxResults) {
            return false;
          }
        }
      } catch (error) {
        // Skip this property on error
      }
    });

    console.log(`✅ PhantomJSCloud: Extracted ${properties.length} properties from Canary`);

    // 取得した物件数が検索結果件数を超えている場合、先頭から検索結果件数分だけに制限
    if (properties.length > maxResults) {
      console.log(`🔧 Limiting properties from ${properties.length} to ${maxResults} based on search results count`);
      return properties.slice(0, maxResults);
    }

    return properties;

  } catch (error) {
    console.error('Error during Canary scraping with PhantomJSCloud:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });

    // PhantomJSCloudのエラーの場合は、より詳細なエラー情報を返す
    if (error instanceof Error && error.message.includes('PhantomJSCloud')) {
      const errorProperty: Property = {
        title: 'PhantomJSCloudエラー',
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
        access: ['PhantomJSCloudのAPI設定を確認してください'],
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
