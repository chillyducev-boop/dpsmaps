const API = location.origin + '/api';
const $ = s => document.querySelector(s);

let ADM = localStorage.getItem('adm') || '';

function authHeaders(){
  return ADM ? {'x-admin-token': ADM, 'Content-Type':'application/json'} : {'Content-Type':'application/json'};
}

$('#admLogin').addEventListener('click', async ()=>{
  ADM = $('#admToken').value.trim();
  if (!ADM) return;
  const r = await fetch(API + '/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token: ADM})});
  const j = await r.json();
  if (j.ok){ localStorage.setItem('adm', ADM); alert('OK'); } else { alert('bad token'); }
});

document.querySelectorAll('.admin-tabs button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const tab = b.dataset.tab;
    openTab(tab);
  });
});

async function openTab(tab){
  if (tab==='posts'){
    const r = await fetch(API + '/admin/posts', { headers: authHeaders() }); const rows = await r.json();
    const html = ['<h2>Метки</h2><table><tr><th>ID</th><th>Тип</th><th>Имя</th><th>TTL</th><th>Голос</th><th>Город</th><th>Действия</th></tr>'];
    rows.forEach(p=>{
      html.push(`<tr>
        <td>${p.id}</td>
        <td>${p.type}</td>
        <td>${p.name||''}</td>
        <td>${p.ttl_minutes||'∞'}</td>
        <td>+${p.votes_yes||0}/-${p.votes_no||0}</td>
        <td>${p.city_code||''}</td>
        <td>
          <button data-extend="${p.id}">+30m</button>
          <button data-del="${p.id}">Удалить</button>
        </td>
      </tr>`);
    });
    html.push('</table>');
    $('#adminView').innerHTML = html.join('');
    $('#adminView').addEventListener('click', ev=>{
      const e = ev.target.getAttribute('data-extend');
      const d = ev.target.getAttribute('data-del');
      if (e){
        fetch(API+'/admin/posts/'+e+'/extend', {method:'POST', headers: authHeaders(), body: JSON.stringify({minutes:30})}).then(()=>openTab('posts'));
      } else if (d){
        fetch(API+'/admin/posts/'+d, {method:'DELETE', headers: authHeaders()}).then(()=>openTab('posts'));
      }
    }, { once: true });
  } else if (tab==='users'){
    const r = await fetch(API + '/users', { headers: authHeaders() }); const rows = await r.json();
    const html = ['<h2>Пользователи</h2><table><tr><th>ID</th><th>tg_id</th><th>username</th><th>имя</th><th>последняя гео</th><th>последний визит</th><th>CID</th></tr>'];
    rows.forEach(u=>{
      html.push(`<tr>
        <td>${u.id}</td><td>${u.tg_id||''}</td><td>${u.username||''}</td><td>${(u.first_name||'')+' '+(u.last_name||'')}</td>
        <td>${u.last_lat?.toFixed?.(5)||''}, ${u.last_lng?.toFixed?.(5)||''}</td>
        <td>${u.last_seen||''}</td><td>${u.cid||''}</td>
      </tr>`);
    });
    html.push('</table>');
    $('#adminView').innerHTML = html.join('');
  } else if (tab==='complaints'){
    const r = await fetch(API + '/complaint', { headers: authHeaders() }); const rows = await r.json();
    const html = ['<h2>Жалобы</h2><table><tr><th>ID</th><th>post_id</th><th>author_cid</th><th>reason</th><th>status</th><th>created</th><th>action</th></tr>'];
    rows.forEach(c=>{
      html.push(`<tr>
        <td>${c.id}</td><td>${c.post_id||''}</td><td>${c.author_cid}</td><td>${c.reason}</td><td>${c.status}</td><td>${c.created_at}</td>
        <td>
          <button data-status='in_progress' data-id='${c.id}'>В работу</button>
          <button data-status='resolved' data-id='${c.id}'>Решено</button>
        </td>
      </tr>`);
    });
    html.push('</table>');
    $('#adminView').innerHTML = html.join('');
    $('#adminView').addEventListener('click', ev=>{
      const id = ev.target.getAttribute('data-id');
      const st = ev.target.getAttribute('data-status');
      if (id && st){
        fetch(API + '/complaint/'+id+'/status', { method:'POST', headers: authHeaders(), body: JSON.stringify({status: st}) }).then(()=>openTab('complaints'));
      }
    }, { once:true });
  } else if (tab==='stats'){
    const r = await fetch(API + '/admin/stats', { headers: authHeaders() }); const s = await r.json();
    $('#adminView').innerHTML = `<h2>Статистика</h2>
      <p>Пользователи: ${s.users}</p>
      <p>Метки: ${s.posts}</p>
      <p>Голоса: ${s.votes}</p>
      <p>Жалобы: ${s.complaints}</p>`;
  }
}
