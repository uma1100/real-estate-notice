import axios from 'axios';

export class PhantomJSCloudClient {
  private apiKey: string;
  private baseUrl = 'https://phantomjscloud.com/api/browser/v2';

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
      console.log('👻 PhantomJSCloud: Starting scrape request for:', url);
      
      const requestPayload = {
        url: url,
        renderType: 'html',
        outputAsJson: false,
        requestSettings: {
          ignoreImages: options.blockAds ?? true,
          disableJavascript: !(options.renderJs ?? true),
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          waitInterval: 7000, // 7秒待機（ScrapingBeeのwait: '7000'と同等）
        }
      };

      if (options.waitForSelector) {
        requestPayload.requestSettings = {
          ...requestPayload.requestSettings,
          waitInterval: 5000
        };
      }

      console.log('👻 PhantomJSCloud: Request params:', {
        url,
        render_js: options.renderJs ?? true,
        wait_for_selector: options.waitForSelector || 'なし',
        block_ads: options.blockAds ?? true,
        api_key_present: !!this.apiKey
      });

      const response = await axios.post(`${this.baseUrl}/${this.apiKey}/`, requestPayload, {
        timeout: 60000, // 60秒のタイムアウト
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      console.log('👻 PhantomJSCloud: Response received:', {
        status: response.status,
        dataType: typeof response.data,
        bodyLength: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length,
        responseHeaders: response.headers
      });

      return response.data;

    } catch (error) {
      console.error('👻 PhantomJSCloud: Error during scraping:', {
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
        
        console.error('👻 PhantomJSCloud API Error Details:', {
          status,
          responseData: typeof responseData === 'string' ? responseData.substring(0, 500) : JSON.stringify(responseData, null, 2),
          requestUrl: url,
        });
        
        if (status === 401) {
          throw new Error('PhantomJSCloud API認証エラー: APIキーを確認してください');
        } else if (status === 403) {
          throw new Error('PhantomJSCloud API制限: 日間リクエスト数を超過している可能性があります');
        } else if (status === 422) {
          throw new Error('PhantomJSCloud API設定エラー: リクエストパラメータを確認してください');
        } else if (status === 400) {
          throw new Error(`PhantomJSCloud APIリクエストエラー: ${message}`);
        }
        
        throw new Error(`PhantomJSCloud APIエラー (${status}): ${message}`);
      }
      
      throw new Error('PhantomJSCloudでの取得に失敗しました');
    }
  }
}

// シングルトンインスタンス
export const phantomJSCloudClient = new PhantomJSCloudClient(
  process.env.PHANTOMJSCLOUD_API_KEY || ''
);