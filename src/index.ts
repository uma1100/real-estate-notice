import { Client, ClientConfig, middleware, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import express, { Request, Response } from 'express';
import { createPropertyFlexMessage } from './messages/propertyFlexMessage';
import { Property } from './types/property';

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

app.post('/webhook', middleware(middlewareConfig), async (req: Request, res: Response): Promise<void> => {
  try {
    const events: WebhookEvent[] = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const url = 'https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040&ra=013&rn=0240&ek=024019670&ek=024037560&ek=024016710&ek=024041310&ek=024041290&ek=024031840&ek=024018010&cb=0.0&ct=20.0&mb=0&mt=9999999&md=06&md=07&md=08&md=09&md=10&et=7&cn=9999999&tc=0400501&tc=0400502&tc=0400301&shkr1=03&shkr2=03&shkr3=03&shkr4=03&sngz=&po1=09';

  if (event.message.text.includes('検索')) {
    try {
      const properties = await scrapeProperties();
      const count = properties.length;
      const limitedProperties = properties.slice(0, 5);

      // Flex Messageを送信（altTextに件数情報を含める）
      const flexMessage = createPropertyFlexMessage(properties);
      flexMessage.altText = `物件を${count}件見つけました。${limitedProperties.length}件を表示します。`;
      await client.replyMessage(event.replyToken, [{
        type: 'text',
        text: '物件を' + count + '件見つけました。' + limitedProperties.length + '件を表示します。'
      }, flexMessage, {
        type: 'flex',
        altText: '一覧で見る',
        contents: {
          type: 'bubble',
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
                  uri: url
                }
              }
            ]
          }
        }
      }]);
    } catch (error) {
      console.error('物件情報の取得に失敗しました:', error);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '物件情報の取得に失敗しました。'
      });
    }
  } else if (event.message.text.includes('現在のリンク')) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: url
    });
  }
}

async function scrapeProperties(): Promise<Property[]> {
  const url = 'https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040&ra=013&rn=0240&ek=024019670&ek=024037560&ek=024016710&ek=024041310&ek=024041290&ek=024031840&ek=024018010&cb=0.0&ct=20.0&mb=0&mt=9999999&md=06&md=07&md=08&md=09&md=10&et=7&cn=9999999&tc=0400501&tc=0400502&tc=0400301&shkr1=03&shkr2=03&shkr3=03&shkr4=03&sngz=&po1=09';

  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const $ = cheerio.load(response.data);
    const properties: Property[] = [];

    $('.cassetteitem').each((_, elem) => {
      const title = $(elem).find('.cassetteitem_content-title').text().trim().replace(/\s+/g, ' ');
      const address = $(elem).find('.cassetteitem_detail-col1').text().trim().replace(/\s+/g, ' ');
      // const imageUrl = $(elem).find('.casssetteitem_other-thumbnail-img').attr('src') || 'https://example.com/default-image.jpg';
      const imageUrl = $(elem).find('.js-linkImage').attr('rel') || '';
      const detailUrl = 'https://suumo.jp' + $(elem).find('.js-cassette_link').attr('href');

      // アクセス情報を取得
      const access: string[] = [];
      $(elem).find('.cassetteitem_detail-col2 .cassetteitem_detail-text').each((_, accessElem) => {
        const accessText = $(accessElem).text().trim().replace(/\s+/g, ' ');
        if (accessText) {
          access.push(accessText);
        }
      });

      // 各物件の詳細情報を取得
      $(elem).find('.js-cassette_link').each((_, roomElem) => {
        const floor = $(roomElem).find('td:nth-child(3)').text().trim();
        const rent = $(roomElem).find('.cassetteitem_price--rent .cassetteitem_other-emphasis').text().trim();
        const managementFee = $(roomElem).find('.cassetteitem_price--administration').text().trim();
        const deposit = $(roomElem).find('.cassetteitem_price--deposit').text().trim();
        const gratuity = $(roomElem).find('.cassetteitem_price--gratuity').text().trim();
        const layout = $(roomElem).find('.cassetteitem_madori').text().trim();
        const menseki = $(roomElem).find('.cassetteitem_menseki').text().trim();
        const age = $(elem).find('.cassetteitem_detail-col3').text().trim().replace(/\s+/g, ' ');
        const layoutImageUrl = $(roomElem).find('.casssetteitem_other-thumbnail-img').attr('rel') || '';

        // タグ情報を取得
        const tags: string[] = [];
        $(roomElem).find('.cassetteitem-tag').each((_, tagElem) => {
          const tag = $(tagElem).text().trim();
          if (tag) {
            tags.push(tag);
          }
        });

        // 詳細リンクを取得
        const detailUrl = 'https://suumo.jp' + $(roomElem).find('.cassetteitem_other-linktext').attr('href');

        // 最初の8件のみを取得
        if (properties.length < 8) {
          properties.push({
            title,
            address,
            price: rent,
            layout,
            menseki,
            age,
            access,
            imageUrl: layoutImageUrl,
            detailUrl,
            floor,
            rent,
            managementFee,
            deposit,
            gratuity,
            tags
          });
        }
      });
    });

    return properties;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('SUUMOへのアクセスに失敗しました:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
    } else {
      console.error('予期せぬエラーが発生しました:', error);
    }
    throw new Error('物件情報の取得に失敗しました。しばらく時間をおいて再度お試しください。');
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 