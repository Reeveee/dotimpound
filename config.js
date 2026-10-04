const SUPABASE_URL='https://oshtfqlrivophkysdzdo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_hbjQWFcGWnESnnriBiicGA_U_n4L7Jq';
if(window.supabase?.createClient){
  window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
}
