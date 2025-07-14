import axios from 'axios';
import * as cheerio from 'cheerio';
// Vercel用の設定
let chromium: any;
let puppeteerCore: any;
let puppeteer: any;

try {
  chromium = require('chrome-aws-lambda');
  puppeteerCore = require('puppeteer-core');
} catch (error) {
  console.log('Chrome AWS Lambda not available, using local Puppeteer');
  puppeteer = require('puppeteer-core');
}
import { Property } from '../types/property';

export async function scrapeCanaryProperties(url: string): Promise<Property[]> {
  console.log('Starting Canary scraping with Puppeteer...');
  
  let browser;
  try {
    console.log('Launching browser...');
    
    // Vercel環境かどうかを判定
    const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (isVercel && chromium && puppeteerCore) {
      console.log('Using Chrome AWS Lambda for Vercel...');
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      console.log('Using local Puppeteer...');
      // ローカル開発環境用
      if (!puppeteer) {
        puppeteer = require('puppeteer');
      }
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }

    const page = await browser.newPage();
    
    // ユーザーエージェントを設定
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to Canary URL...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Waiting for property elements to load...');
    // 物件要素が読み込まれるまで待機
    try {
      await page.waitForSelector('[data-testid="search-result-room-thumbail"]', { 
        timeout: 10000 
      });
      console.log('✅ Property elements found');
    } catch (timeoutError) {
      console.log('⚠️ Timeout waiting for property elements, trying alternative selectors...');
      // 代替セレクターを試す
      try {
        await page.waitForSelector('a[href*="/chintai/rooms/"]', { timeout: 5000 });
        console.log('✅ Alternative property elements found');
      } catch (altTimeoutError) {
        console.log('❌ No property elements found with any selector');
      }
    }

    console.log('Extracting property data...');
    const properties = await page.evaluate(() => {
      const propertyList: any[] = [];
      const seenUrls = new Set(); // 重複チェック用
      
      // メインセレクターで物件を検索
      const roomElements = document.querySelectorAll('[data-testid="search-result-room-thumbail"]');
      
      roomElements.forEach((roomElement) => {
        try {
          const roomLink = roomElement as HTMLAnchorElement;
          
          // 詳細URLを先に取得して重複チェック
          const detailUrl = roomLink.href ? roomLink.href : '';
          if (!detailUrl || seenUrls.has(detailUrl)) {
            return; // 重複またはURLなしの場合はスキップ
          }
          seenUrls.add(detailUrl);
          
          // 物件コンテナを見つける（より具体的に）
          let propertyContainer = roomLink.closest('[style*="margin-bottom: 16px"]');
          if (!propertyContainer) {
            // より広い範囲で探す
            let current = roomLink.parentElement;
            while (current && !current.querySelector('.sc-eba299fd-2')) {
              current = current.parentElement;
            }
            propertyContainer = current;
          }
          
          if (!propertyContainer) return;

          // 建物名を取得（このコンテナ内から）
          const titleElement = propertyContainer.querySelector('.sc-eba299fd-2');
          const title = titleElement?.textContent?.trim() || '';

          // アクセス情報を取得（このコンテナ内のみから）
          const accessElements = propertyContainer.querySelectorAll('.sc-b58b0813-3');
          const access: string[] = [];
          accessElements.forEach(elem => {
            const text = elem.textContent?.trim();
            if (text) access.push(text);
          });

          // 住所（最後のアクセス要素）
          const address = access.length > 0 ? access[access.length - 1] : '';

          // 部屋のサムネイル画像（roomLink内から）
          const imageElement = roomLink.querySelector('.sc-25310353-2') as HTMLImageElement;
          const imageUrl = imageElement?.src || 'https://example.com/default-image.jpg';

          // 家賃情報（roomLink内から）
          const rentElement = roomLink.querySelector('.sc-a9d9171a-0');
          const rentText = rentElement?.textContent?.trim() || '';
          const rent = rentText ? `${rentText}万円` : '';

          // 管理費（roomLink内から）
          const managementFeeElement = roomLink.querySelector('.sc-25310353-3');
          let managementFee = managementFeeElement?.textContent?.trim() || '';
          managementFee = managementFee.replace(rent, '').replace(' / ', '').trim();

          // 敷金・礼金（roomLink内から）
          const depositElement = roomLink.querySelector('.sc-ba5c86c1-0');
          const deposit = depositElement?.textContent?.replace('敷', '').trim() || '';

          const gratuityElement = roomLink.querySelector('.sc-ec8edb4e-0');
          const gratuity = gratuityElement?.textContent?.replace('礼', '').trim() || '';

          // 間取り・面積・階数（roomLink内から）
          const layoutElement = roomLink.querySelector('.sc-25310353-5');
          const layoutInfo = layoutElement?.textContent?.trim() || '';
          const layoutParts = layoutInfo.split(' / ');
          const layout = layoutParts[0] || '';
          const menseki = layoutParts[1] || '';
          const floor = layoutParts[2] || '';

          // 築年数（このコンテナのアクセス情報から）
          const age = access.find(a => a.includes('築')) || '';

          // タグ情報（このコンテナ内のみから）
          const tags: string[] = [];
          const tagElements = propertyContainer.querySelectorAll('.sc-8dc067f-0');
          tagElements.forEach(tagElem => {
            const tagText = tagElem.textContent?.trim();
            if (tagText && tagText !== 'イチオシ') {
              tags.push(tagText);
            }
          });

          if (title && rent) {
            propertyList.push({
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

      return propertyList;
    });

    console.log(`✅ Extracted ${properties.length} properties from Canary`);
    return properties;

  } catch (error) {
    console.error('Error during Canary scraping with Puppeteer:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    throw new Error('Canary物件情報の取得に失敗しました。');
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
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
