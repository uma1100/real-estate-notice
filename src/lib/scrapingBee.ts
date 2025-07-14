import axios from 'axios';


export class ScrapingBeeClient {
  private apiKey: string;
  private baseUrl = 'https://app.scrapingbee.com/api/v1/';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async scrapeUrl(url: string, options: {
    renderJs?: boolean;
    waitForSelector?: string;
    blockAds?: boolean;
    customCss?: string;
  } = {}): Promise<string> {
    try {
      console.log('🐝 ScrapingBee: Starting scrape request for:', url);
      
      const requestParams: any = {
        api_key: this.apiKey,
        url: url,
        render_js: String(options.renderJs ?? true),
        block_ads: String(options.blockAds ?? true),
        wait: '10000',  // 10秒待機してからHTMLを取得
        premium_proxy: 'true',  // プレミアムプロキシを使用
        stealth_proxy: 'true',  // ステルスモードを有効
      };

      // wait_forはCSSセレクタを指定する場合のみ追加
      if (options.waitForSelector) {
        requestParams.wait_for = options.waitForSelector;
      }

      if (options.customCss) {
        (requestParams as any).css_selector = options.customCss;
      }

      console.log('🐝 ScrapingBee: Request params:', {
        url,
        render_js: options.renderJs ?? true,
        wait_for_selector: options.waitForSelector || 'なし',
        block_ads: options.blockAds ?? true,
        api_key_present: !!this.apiKey
      });

      const response = await axios.get(this.baseUrl, {
        params: requestParams,
        timeout: 60000, // 60秒のタイムアウト
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        }
      });

      console.log('🐝 ScrapingBee: Response received:', {
        status: response.status,
        dataType: typeof response.data,
        bodyLength: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length,
        responseHeaders: response.headers
      });

      // ScrapingBeeはHTMLを直接返すので、response.dataをそのまま返す
      return response.data;

    } catch (error) {
      console.error('🐝 ScrapingBee: Error during scraping:', {
        timestamp: new Date().toISOString(),
        url,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        const message = responseData?.message || error.message;
        
        console.error('🐝 ScrapingBee API Error Details:', {
          status,
          responseData: JSON.stringify(responseData, null, 2),
          requestUrl: url,
          requestParams: {
            api_key: this.apiKey ? '[HIDDEN]' : 'MISSING',
            render_js: String(options.renderJs ?? true),
            wait_for_selector: options.waitForSelector || 'なし',
            block_ads: String(options.blockAds ?? true)
          }
        });
        
        if (status === 401) {
          throw new Error('ScrapingBee API認証エラー: APIキーを確認してください');
        } else if (status === 403) {
          throw new Error('ScrapingBee API制限: 月間リクエスト数を超過している可能性があります');
        } else if (status === 422) {
          throw new Error('ScrapingBee API設定エラー: リクエストパラメータを確認してください');
        } else if (status === 400) {
          throw new Error(`ScrapingBee APIリクエストエラー: ${responseData?.error || message}`);
        }
        
        throw new Error(`ScrapingBee APIエラー (${status}): ${message}`);
      }
      
      throw new Error('ScrapingBeeでの取得に失敗しました');
    }
  }

  async getAccountInfo(): Promise<{ remaining_requests: number; plan: string }> {
    try {
      const response = await axios.get('https://app.scrapingbee.com/api/v1/usage', {
        params: { api_key: this.apiKey },
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('ScrapingBee account info error:', error);
      throw new Error('アカウント情報の取得に失敗しました');
    }
  }
}

// シングルトンインスタンス
export const scrapingBeeClient = new ScrapingBeeClient(
  process.env.SCRAPINGBEE_API_KEY || ''
);