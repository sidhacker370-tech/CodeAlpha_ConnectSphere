import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Self-healing function to initialize the storage bucket
export const initializeStorage = async () => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets.some((b) => b.id === 'shared-files');
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket('shared-files', {
        public: true,
        fileSizeLimit: 25 * 1024 * 1024, // 25MB
      });
      if (createError) {
        console.warn('Could not auto-create "shared-files" bucket. Make sure it exists and RLS allows access:', createError.message);
      } else {
        console.log('Successfully auto-created "shared-files" bucket in Supabase Storage.');
      }
    }
  } catch (err: any) {
    console.warn('Storage bucket check/initialization bypassed or failed:', err.message || err);
  }
};
