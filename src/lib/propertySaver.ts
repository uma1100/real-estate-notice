import { Property } from '../types/property';
import { supabase } from './supabase';

/**
 * スクレイピングで取得した物件情報を Supabase の properties テーブルに upsert する。
 * scraping_url_id と detail_url が一致する場合、既存のレコードを更新する。
 * @param properties 保存/更新する物件情報の配列
 * @param scrapingUrlId どの検索条件で取得したかのID
 * @returns 処理を試みた物件の件数 (Supabaseのupsertは更新/挿入の区別なく件数を返さない場合があるため)
 */
export async function saveProperties(
  properties: Property[],
  scrapingUrlId: number
): Promise<number> {
  if (!properties || properties.length === 0) {
    console.log('No properties to upsert.');
    return 0;
  }

  console.log(`Attempting to upsert ${properties[0].age} properties for scraping_url_id: ${scrapingUrlId}`);

  // データを挿入/更新用形式に変換 (型変換なし)
  const dataToUpsert = properties.map(p => ({
    scraping_url_id: scrapingUrlId,
    title: p.title,
    address: p.address,
    layout: p.layout,
    age: p.age,
    image_url: p.imageUrl,
    menseki: p.menseki,
    access: p.access,
    tags: p.tags.join(','),
    detail_url: p.detailUrl, // ON CONFLICT で使用するカラム
    floor: p.floor,
    rent: p.rent,
    management_fee: p.managementFee,
    deposit: p.deposit,
    gratuity: p.gratuity,
    updated_at: new Date().toISOString()
  }));


  try {
    const { error } = await supabase
      .from('properties')
      .upsert(dataToUpsert, {
        onConflict: 'scraping_url_id,detail_url', // scraping_url_id と detail_url が重複した場合に UPDATE
        // ignoreDuplicates: false // デフォルト (UPDATE する)
      });
    // .select() // upsert後にデータを取得したい場合は追加

    if (error) {
      // RLS違反、制約違反(UNIQUE以外)、データ型不一致などのエラー
      console.error('Error upserting properties:', error);
      throw error;
    }

    console.log(`Successfully processed upsert for ${properties.length} properties.`);
    // upsert は成功した行数を直接返さないことが多いので、
    // 処理を試みた全件数を返すことにする
    return properties.length;

  } catch (error) {
    console.error('Exception during saveProperties (upsert):', error);
    throw error;
  }
} 