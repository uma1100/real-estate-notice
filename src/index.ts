import { Client, ClientConfig, middleware, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import axios from 'axios';
import express, { Request, Response } from 'express';
import { checkExistingProperties, saveProperties } from './lib/propertySaver';
import { getScrapingUrl, upsertScrapingUrl } from './lib/scrapingUrls';
import { createPropertyFlexMessage } from './messages/propertyFlexMessage';
import { scrapeProperties } from './scraper/scraper';

// axiosのデフォルト設定
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
axios.defaults.timeout = 10000; // 10秒のタイムアウト

const clientConfig: ClientConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.CHANNEL_SECRET!
};

const middlewareConfig: MiddlewareConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.CHANNEL_SECRET!
};

const client = new Client(clientConfig);
const app = express();

app.get('/health', (req: Request, res: Response) => {
  console.log('Health check accessed:', {
    timestamp: new Date().toISOString(),
    path: req.path
  });
  res.status(200).json({ status: 'ok' });
});

app.post('/webhook', middleware(middlewareConfig), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Webhook received:', {
      timestamp: new Date().toISOString(),
      body: req.body
    });

    const events: WebhookEvent[] = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', {
      timestamp: new Date().toISOString(),
      error: err
    });
    res.status(500).end();
  }
});

async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('Skipping non-text message:', {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      messageType: event.type === 'message' ? event.message.type : null
    });
    return;
  }

  let sourceId: string | undefined;
  if (event.source.type === 'group') {
    sourceId = event.source.groupId;
  } else if (event.source.type === 'user') {
    sourceId = event.source.userId;
  }

  if (!sourceId) {
    console.error('Could not determine source ID (userId or groupId) from event:', event.source);
    return;
  }

  if (event.message.text.includes('検索')) {
    console.log('Search command received:', {
      timestamp: new Date().toISOString(),
      source: event.source,
      message: event.message.text
    });

    try {
      console.log(`Starting property scraping for sourceId: ${sourceId}`);
      const scrapingUrl = await getScrapingUrl(sourceId);

      if (!scrapingUrl) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'このトークルームに紐づくスクレイピングURLが見つかりません。設定を確認してください。'
        });
        console.log(`Scraping URL not found for sourceId: ${sourceId}`);
        return;
      }

      const properties = await scrapeProperties(scrapingUrl.url);
      console.log('Raw property data:', properties);

      if (!properties || properties.length === 0) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '物件が見つかりませんでした。'
        });
        return;
      }

      // 既存の物件をチェック
      const detailUrls = properties.map(p => p.detailUrl);
      const existingUrls = await checkExistingProperties(detailUrls, scrapingUrl.id);

      // 新規物件のみを抽出
      const newProperties = properties.filter(p => !existingUrls.has(p.detailUrl));

      if (newProperties.length === 0) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '新規の物件は見つかりませんでした。'
        });
        return;
      }

      // 新規物件をデータベースに保存
      const savedCount = await saveProperties(newProperties, scrapingUrl.id);
      console.log(`Saved ${savedCount} new properties to database`);

      // 新規物件のみを通知
      const flexMessage = createPropertyFlexMessage(newProperties);
      flexMessage.altText = `物件を見つけました。最大10件を表示しています。`;

      // console.log('Flex Message payload to be sent:', JSON.stringify(flexMessage, null, 2));

      await client.replyMessage(event.replyToken, [flexMessage, {
        type: 'flex',
        altText: '一覧で見る',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '上記のリストは､最大10件を表示しています｡',
                size: 'xs',
                align: 'center',
                color: '#aaaaaa'
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                style: 'link',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '一覧で見る',
                  uri: scrapingUrl.url
                }
              }
            ]
          }
        }
      }]);
      console.log('Messages sent successfully');
    } catch (error) {
      console.error('Error in property search:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '物件情報の取得に失敗しました。'
      });
    }
  } else if (event.message.text.includes('現在のリンク')) {
    console.log('Link request received');
    const scrapingUrl = await getScrapingUrl(sourceId);
    if (!scrapingUrl) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'このトークルームに紐づくURLが見つかりません。'
      });
      return;
    }
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `現在のリンク\n${scrapingUrl.url}`
    });
  } else if (event.message.text.startsWith('更新')) {
    console.log('Update command received:', {
      timestamp: new Date().toISOString(),
      source: event.source,
      message: event.message.text
    });

    const messageText = event.message.text;
    const httpsIndex = messageText.indexOf('https://');

    let newUrl = '';
    if (httpsIndex !== -1) {
      newUrl = messageText.substring(httpsIndex).trim();
    }

    if (!newUrl) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'メッセージ内に有効なURL (https:// で始まるもの) が見つかりませんでした。'
      });
      return;
    }

    try {
      console.log(`Attempting to upsert URL for sourceId: ${sourceId}`);
      await upsertScrapingUrl(sourceId, newUrl);
      console.log(`URL upsert successful for sourceId: ${sourceId}`);

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '更新が完了しました。'
      });

    } catch (error) {
      console.error('Error during URL upsert:', {
        timestamp: new Date().toISOString(),
        sourceId: sourceId,
        error: error
      });
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'URLの更新に失敗しました。システム管理者に確認してください。'
      });
    }
  } else {
    console.log('Unknown command received:', event.message.text);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 