import { ScrapingUrl, supabase } from './supabase';

export async function getScrapingUrl(sourceId: string): Promise<ScrapingUrl | null> {
  try {
    const { data, error } = await supabase
      .from('scraping_url')
      .select('*')
      .eq('target_id', sourceId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`No scraping URL found for target_id: ${sourceId}`);
        return null;
      }
      console.error('Error fetching scraping URL:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getScrapingUrl:', error);
    throw error;
  }
}

// 新しい関数: URLをupsertする
export async function upsertScrapingUrl(sourceId: string, newUrl: string): Promise<void> {
  console.log(`Upserting URL for target_id: ${sourceId}, URL: ${newUrl}`);
  try {
    const { error } = await supabase
      .from('scraping_url')
      .upsert(
        {
          target_id: sourceId, // このIDを持つ行を探すか、新しく作る
          url: newUrl,        // URLを更新または設定
          updated_at: new Date().toISOString(), // ★★★ 追加: upsert時に現在時刻を設定 ★★★
        },
        {
          onConflict: 'target_id' // target_id が重複した場合にUPDATEする
        }
      );

    if (error) {
      console.error('Error upserting scraping URL:', error);
      // RLS違反(23503など)、制約違反(23505など)の可能性
      throw error; // エラーを呼び出し元に投げる
    }
    console.log(`Successfully upserted URL for target_id: ${sourceId}`);
  } catch (error) {
    console.error('Exception during upsertScrapingUrl:', error);
    throw error; // さらに上に投げる
  }
} 