import { FlexBubble, FlexMessage } from '@line/bot-sdk';
import { Property } from '../types/property';

/**
 * 物件情報からFlexMessageを作成する
 * @param properties 物件情報の配列
 * @param startIndex 表示開始インデックス（0から開始）
 * @param endIndex 表示終了インデックス（この数値は含まない）
 * @param totalCount 全物件数
 * @returns FlexMessage
 */
export function createPropertyFlexMessage(
  properties: Property[],
  startIndex: number,
  endIndex: number,
  totalCount: number
): FlexMessage {
  // 指定範囲の物件を抽出
  const targetProperties = properties.slice(startIndex, endIndex);

  return {
    type: 'flex',
    altText: `物件を${totalCount}件見つけました。${startIndex + 1}件目から${Math.min(endIndex, totalCount)}件目を表示します。`,
    contents: {
      type: 'carousel',
      contents: targetProperties.map(property => {
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
                        text: property.age.replace(/\s+/g, ''),
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
                  uri: property.detailUrl.startsWith('http') ? property.detailUrl : `https://web.canary-app.jp${property.detailUrl}`
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