import axios from 'axios';

interface ScrapingBeeResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
}

export class ScrapingBeeClient {
  private apiKey: string;
  private baseUrl = 'https://app.scrapingbee.com/api/v1/';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async scrapeUrl(url: string, options: {
    renderJs?: boolean;
    waitFor?: number;
    blockAds?: boolean;
    customCss?: string;
  } = {}): Promise<string> {
    try {
      console.log('🐝 ScrapingBee: Starting scrape request for:', url);
      
      const params = new URLSearchParams({
        api_key: this.apiKey,
        url: url,
        render_js: String(options.renderJs ?? true),
        wait_for: String(options.waitFor ?? 3000),
        block_ads: String(options.blockAds ?? true),
        premium_proxy: 'true', // より安定した接続のため
        country_code: 'jp', // 日本のプロキシを使用
      });

      if (options.customCss) {
        params.append('css_selector', options.customCss);
      }

      console.log('🐝 ScrapingBee: Request params:', {
        url,
        render_js: options.renderJs ?? true,
        wait_for: options.waitFor ?? 3000,
        block_ads: options.blockAds ?? true,
        country_code: 'jp'
      });

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 60000, // 60秒のタイムアウト
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        }
      });

      const responseData = response.data as ScrapingBeeResponse;
      
      console.log('🐝 ScrapingBee: Response received:', {
        status: responseData.status || response.status,
        bodyLength: responseData.body?.length || response.data.length,
        responseHeaders: response.headers
      });

      // レスポンスがScrapingBeeの形式の場合
      if (responseData.body) {
        return responseData.body;
      }
      
      // 直接HTMLが返ってきた場合
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
        const message = error.response?.data?.message || error.message;
        
        if (status === 401) {
          throw new Error('ScrapingBee API認証エラー: APIキーを確認してください');
        } else if (status === 403) {
          throw new Error('ScrapingBee API制限: 月間リクエスト数を超過している可能性があります');
        } else if (status === 422) {
          throw new Error('ScrapingBee API設定エラー: リクエストパラメータを確認してください');
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