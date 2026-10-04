async function dotLogin(){
  const username=document.getElementById('username').value.trim().toLowerCase();
  const password=document.getElementById('password').value;
  const err=document.getElementById('loginError'); err.textContent='';
  if(!username||!password){err.textContent='Enter your DOT username and password.';return}

  // Always clear the previous operator session before changing accounts.
  // This prevents a browser that was previously signed in as dot2 from
  // carrying that identity into a new login attempt.
  await sb.auth.signOut({scope:'local'}).catch(()=>{});
  sessionStorage.removeItem('dot_operator');

  const {data,error}=await sb.auth.signInWithPassword({email:`${username}@unionrpdot.local`,password});
  if(error||!data?.user){err.textContent='Invalid username or password.';return}

  const {data:staff,error:staffErr}=await sb.from('dot_staff')
    .select('id,username,role,enabled')
    .eq('id',data.user.id)
    .single();
  if(staffErr||!staff||!staff.enabled){await sb.auth.signOut();err.textContent='This DOT account is not authorised.';return}

  // Keep only the authenticated profile as a display hint. admin.html still
  // verifies it against Supabase on every load.
  sessionStorage.setItem('dot_operator',JSON.stringify({id:staff.id,username:staff.username,role:staff.role}));
  location.replace('admin.html');
}
document.addEventListener('keydown',e=>{if(e.key==='Enter')dotLogin()});
(async()=>{
  const {data}=await sb.auth.getSession();
  if(data.session) location.replace('admin.html');
})();
