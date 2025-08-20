/* DPS Map front-end */
const API = location.origin + '/api';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const state = {
  map: null,
  layer: null,
  markers: new Map(),
  addMode: null, // {type, direction}
  filters: JSON.parse(localStorage.getItem('filters')||'{"dps":true,"dtp":true,"short":true,"camera":true,"dir":true}'),
  city: localStorage.getItem('city') || '',
  cid: localStorage.getItem('cid') || '',
  tiles: localStorage.getItem('tiles') || 'carto-dark'
};

function saveSettings(){
  localStorage.setItem('filters', JSON.stringify(state.filters));
  localStorage.setItem('city', state.city);
  localStorage.setItem('cid', state.cid);
  localStorage.setItem('tiles', state.tiles);
}

function cityCenter(code){
  switch(code){
    case 'MSC': return [55.751244, 37.618423];
    case 'SPB': return [59.939095, 30.315868];
    case 'KZN': return [55.796127, 49.106414];
    case 'SMR': return [53.195873, 50.100193];
    case 'KRD': return [45.035470, 38.975313];
    case 'EKB': return [56.838926, 60.605703];
    default: return null;
  }
}

function mkIcon(type){
  const color = {dps:'#4cc9f0', dtp:'#ff6b6b', short:'#ffd166', camera:'#a0d911', dir:'#c084fc', custom:'#c084fc'}[type] || '#cccccc';
  return L.divIcon({
    className: 'marker',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 4px rgba(255,255,255,0.08)"></div>`,
    iconSize: [12,12]
  });
}

function ttlBadge(p){
  if (!p.expires_at) return '<span class="marker-badge">бессрочно</span>';
  const sec = Math.max(0, Math.floor((new Date(p.expires_at).getTime() - Date.now())/1000));
  const m = Math.floor(sec/60), s = sec%60;
  return `<span class="marker-badge">${m}м ${s}с</span>`;
}

function renderPopup(p){
  const name = p.name || p.type.toUpperCase();
  const desc = p.description ? `<div>${p.description}</div>` : '';
  const votes = `<span class="vote yes">Стоят: ${p.votes_yes||0}</span> · <span class="vote no">Уехали: ${p.votes_no||0}</span>`;
  const ttl = ttlBadge(p);
  const owner = p.owner_cid ? `<div class="marker-badge">владелец: ${String(p.owner_cid).slice(0,6)}…</div>` : '';

  const canVote = !!state.cid;
  const voteBtns = canVote ? `
    <div class="popup-actions">
      <button class="btn xs" data-act="vote" data-id="${p.id}" data-val="1">Стоят</button>
      <button class="btn xs" data-act="vote" data-id="${p.id}" data-val="-1">Уехали</button>
      <button class="btn xs ghost" data-act="complain" data-id="${p.id}">Пожаловаться</button>
      ${p.owner_cid === state.cid ? `<button class="btn xs ghost" data-act="delete" data-id="${p.id}">Удалить</button>`:''}
    </div>` : `<div class="marker-badge">Чтобы голосовать — зарегистрируйтесь в боте</div>`;

  return `<div>
    <strong>${name}</strong> ${ttl}
    ${owner}
    ${desc}
    <div>${votes}</div>
    ${voteBtns}
  </div>`;
}

async function fetchPosts(){
  const types = Object.entries(state.filters).filter(([k,v])=>v).map(([k])=>k).join(',');
  const b = state.map.getBounds();
  const bbox = [b.getNorth(), b.getSouth(), b.getEast(), b.getWest()].join(',');
  const city = state.city || '';
  const res = await fetch(`${API}/posts?types=${types}&bbox=${bbox}&city_code=${city}`);
  const data = await res.json();
  // remove deleted
  for (const [id, m] of state.markers){
    if (!data.find(p=>p.id==id)){
      state.map.removeLayer(m);
      state.markers.delete(id);
    }
  }
  // add/update
  data.forEach(p=>{
    let m = state.markers.get(p.id);
    if (!m){
      m = L.marker([p.lat, p.lng], { icon: mkIcon(p.type) }).addTo(state.map);
      m.on('click', ()=> m.bindPopup(renderPopup(p)).openPopup());
      state.markers.set(p.id, m);
    } else {
      m.setPopupContent(renderPopup(p));
    }
  });
}

function setTiles(which){
  if (state.layer) state.map.removeLayer(state.layer);
  if (which === 'osm'){
    state.layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OSM'});
  } else {
    state.layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom: 20, attribution:'&copy; CARTO'});
  }
  state.layer.addTo(state.map);
}

function initMap(){
  const center = cityCenter(state.city) || [55.751244, 37.618423];
  state.map = L.map('map', { zoomControl: true }).setView(center, 12);
  setTiles(state.tiles);

  state.map.on('moveend', fetchPosts);

  // click to place new marker when addMode
  state.map.on('click', e => {
    if (!state.addMode) return;
    const t = state.addMode.type;
    const dir = t==='dir' ? $('#dirSelect').value : null;
    const name = $('#postName').value.trim();
    const description = $('#postDesc').value.trim();
    if (!state.cid){
      alert('Сначала зарегистрируйтесь в боте, затем укажите CID в настройках.');
      return;
    }
    const payload = { lat:e.latlng.lat, lng:e.latlng.lng, type:t, direction:dir, name, description, city_code: state.city, cid: state.cid };
    fetch(`${API}/posts`, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-cid':state.cid},
      body: JSON.stringify(payload)
    }).then(r=>r.json()).then(p=>{
      state.addMode = null;
      $('#bottomSheet').classList.add('hidden');
      fetchPosts();
    });
  });

  // ask geolocation
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      if (!state.city){
        state.map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      }
      if (state.cid){
        fetch(`${API}/users/lastpos`, {method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({cid:state.cid, lat:pos.coords.latitude, lng:pos.coords.longitude})});
      }
    });
  }

  fetchPosts();
  setInterval(fetchPosts, 15000);
}

function wireUI(){
  // add marker flow
  $('#btnAdd').addEventListener('click', ()=>{
    if (!state.cid) alert('Без регистрации нельзя добавлять метки. Откройте бот и нажмите "Регистрация".');
    $('#bottomSheet').classList.remove('hidden');
  });
  $('#btnCancel').addEventListener('click', ()=> $('#bottomSheet').classList.add('hidden'));
  $$('#bottomSheet .type-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.addMode = { type: b.dataset.type };
      $('#dirChooser').classList.toggle('hidden', b.dataset.type!=='dir');
    });
  });

  // mine drawer
  $('#btnMine').addEventListener('click', async ()=>{
    if (!state.cid) return alert('Нужна регистрация (CID).');
    const b = await (await fetch(`${API}/posts?types=dps,dtp,short,camera,dir&bbox=-90,-90,90,90&city_code=${state.city}`)).json();
    const mine = b.filter(x=>x.owner_cid===state.cid);
    const el = $('#mineList');
    el.innerHTML = '';
    mine.forEach(p=>{
      const item = document.createElement('div');
      item.style.margin = '6px 0';
      item.innerHTML = `<strong>${p.name || p.type}</strong> · id ${p.id}
        <div class="marker-badge">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
        <div>
          <button class="btn xs" data-go="${p.id}">Показать</button>
          <button class="btn xs ghost" data-del="${p.id}">Удалить</button>
        </div>`;
      el.appendChild(item);
    });
    $('#mineDrawer').classList.remove('hidden');
    el.addEventListener('click', ev=>{
      const go = ev.target.getAttribute('data-go');
      const del = ev.target.getAttribute('data-del');
      if (go){
        const m = state.markers.get(Number(go));
        if (m){ state.map.setView(m.getLatLng(), 16); m.openPopup(); }
      } else if (del){
        fetch(`${API}/posts/${del}`, { method:'DELETE', headers:{'x-cid':state.cid}}).then(()=>fetchPosts());
        ev.target.closest('div').remove();
      }
    }, { once:true });
  });
  $('#btnCloseMine').addEventListener('click', ()=> $('#mineDrawer').classList.add('hidden'));

  // settings
  $('#btnSettings').addEventListener('click', ()=> {
    $('#settingsModal').classList.remove('hidden');
    $('#cidShow').textContent = state.cid || '(не задан)';
    $('#tileSelect').value = state.tiles;
    $('#citySelect').value = state.city;
    $('#regStatus').textContent = 'проверяем...';
    if (state.cid){
      fetch(`${API}/users/me?cid=${encodeURIComponent(state.cid)}`).then(r=>r.json()).then(j=>{
        $('#regStatus').textContent = j.registered ? 'зарегистрирован' : 'не зарегистрирован';
      });
    } else {
      $('#regStatus').textContent = 'не зарегистрирован';
    }
  });
  $('#btnCloseSettings').addEventListener('click', ()=>{
    $('#settingsModal').classList.add('hidden');
    saveSettings();
    fetchPosts();
  });
  $('#tileSelect').addEventListener('change', e=>{
    state.tiles = e.target.value; saveSettings(); setTiles(state.tiles);
  });
  $('#citySelect').addEventListener('change', e=>{
    state.city = e.target.value; saveSettings();
    const c = cityCenter(state.city);
    if (c) state.map.setView(c, 12);
    fetchPosts();
  });
  $('#btnSetCid').addEventListener('click', ()=>{
    const v = prompt('Введите CID (вам напишет бот после регистрации)');
    if (v) { state.cid = v.trim(); saveSettings(); $('#cidShow').textContent = state.cid; }
  });

  // modal tabs
  $$('.tabs button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab').forEach(t=>t.classList.add('hidden'));
      const id = 'tab-' + btn.dataset.tab;
      document.getElementById(id).classList.remove('hidden');
    });
  });

  // popup actions (vote/complain/delete)
  document.body.addEventListener('click', ev=>{
    const act = ev.target.getAttribute('data-act');
    if (!act) return;
    if (act==='vote'){
      const id = Number(ev.target.getAttribute('data-id'));
      const val = Number(ev.target.getAttribute('data-val'));
      fetch(`${API}/vote`, {method:'POST', headers:{'Content-Type':'application/json','x-cid':state.cid}, body: JSON.stringify({post_id:id, value:val, cid:state.cid})})
        .then(()=>fetchPosts());
    } else if (act==='complain'){
      const id = Number(ev.target.getAttribute('data-id'));
      const reason = prompt('Причина жалобы');
      if (reason){
        fetch(`${API}/complaint`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({post_id:id, author_cid:state.cid, reason})})
          .then(()=>alert('Жалоба отправлена'));
      }
    } else if (act==='delete'){
      const id = Number(ev.target.getAttribute('data-id'));
      if (confirm('Удалить метку?')){
        fetch(`${API}/posts/${id}`, { method:'DELETE', headers:{'x-cid':state.cid}}).then(()=>fetchPosts());
      }
    }
  });

  // filters
  $$('#tab-filters input[type=checkbox]').forEach(ch=>{
    ch.checked = !!state.filters[ch.dataset.filter];
    ch.addEventListener('change', ()=>{
      state.filters[ch.dataset.filter] = ch.checked;
      saveSettings();
      fetchPosts();
    });
  });
}

initMap();
wireUI();
