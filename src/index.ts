import { Client, ClientConfig, middleware, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import express, { Request, Response } from 'express';

interface Property {
  title: string;
  address: string;
  price: string;
}

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

  if (event.message.text === '物件検索') {
    const properties = await scrapeProperties();
    const message = formatProperties(properties);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
  }
}

async function scrapeProperties(): Promise<Property[]> {
  const url = 'https://suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040&ra=013&rn=0240&ek=024019670&ek=024037560&ek=024016710&ek=024041310&ek=024041290&ek=024031840&ek=024018010&cb=0.0&ct=20.0&mb=0&mt=9999999&md=06&md=07&md=08&md=09&md=10&et=7&cn=9999999&tc=0400501&tc=0400502&tc=0400301&shkr1=03&shkr2=03&shkr3=03&shkr4=03&sngz=&po1=09';

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const properties: Property[] = [];

  $('.cassetteitem').each((_, elem) => {
    const title = $(elem).find('.cassetteitem_content-title').text().trim();
    const address = $(elem).find('.cassetteitem_detail-col1').text().trim();
    const price = $(elem).find('.cassetteitem_price').text().trim();

    properties.push({
      title,
      address,
      price
    });
  });

  return properties;
}

function formatProperties(properties: Property[]): string {
  return properties
    .map(p => `物件名：${p.title}\n住所：${p.address}\n家賃：${p.price}\n\n`)
    .join('---\n');
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 