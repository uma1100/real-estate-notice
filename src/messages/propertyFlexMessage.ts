import { FlexBubble, FlexMessage } from '@line/bot-sdk';
import { Property } from '../types/property';

export function createPropertyFlexMessage(properties: Property[]): FlexMessage {
  // 物件数を3件に制限
  const limitedProperties = properties.slice(0, 5);
  const count = properties.length;

  return {
    type: 'flex',
    altText: `物件を${count}件見つけました。${limitedProperties.length}件を表示します。`,
    contents: {
      type: 'carousel',
      contents: limitedProperties.map(property => {
        const bubble: FlexBubble = {
          type: 'bubble',
          hero: {
            type: 'image',
            url: property.imageUrl,
            size: 'full',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: property.title,
                weight: 'bold',
                size: 'xl',
                wrap: true
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '住所',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: property.address,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '階層',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: property.floor,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '家賃/管理費',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: `${property.rent}/${property.managementFee}`,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        weight: 'bold',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '間取り',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: property.layout,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '面積',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: property.menseki,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: '築年数',
                        color: '#aaaaaa',
                        size: 'sm',
                        flex: 1
                      },
                      {
                        type: 'text',
                        text: property.age,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        flex: 5
                      }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                      {
                        type: 'text',
                        text: 'アクセス',
                        color: '#aaaaaa',
                        size: 'sm'
                      },
                      ...property.access.map(access => ({
                        type: 'text' as const,
                        text: access,
                        wrap: true,
                        color: '#666666',
                        size: 'sm',
                        margin: 'xs'
                      }))
                    ]
                  }
                ]
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'link',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '詳細を見る',
                  uri: property.detailUrl
                }
              }
            ]
          }
        };
        return bubble;
      })
    }
  };
} 