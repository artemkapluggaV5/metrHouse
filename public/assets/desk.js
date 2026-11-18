'use strict';
function decision(o,publish){
 dialog(publish?'Опубликовать объект?':'Отклонить объявление',`<form id="actionform" class="stack"><div><strong>${esc(o.title)}</strong><div class="muted">Версия ${o.version}</div></div>${publish?'':areaField('note','Что нужно исправить?','',1200,true)}${formError}${button(publish?'Опубликовать':'Вернуть агенту')}</form>`);
 bindForm($('#actionform'),async data=>{data.set('id',o.id);data.set('version',o.version);data.set('decision',publish?'publish':'reject');await api('moderate',{},data);modal.close();notify(publish?'Объект опубликован.':'Объект возвращён агенту.');go('#desk')});
}
function retire(o,del){
 dialog(del?'Удалить карточку?':'Перенести в архив?',`<form class="stack"><p>${esc(o.title)}<br><span class="muted">${del?'Карточка и её фотографии будут удалены.':'Объект будет снят с публикации. История заявок сохранится.'}</span></p>${formError}${button(del?'Удалить':'В архив',del?'danger':'primary')}</form>`);
 bindForm($('form',modal),async()=>{await api(del?'delete':'archive',{},{id:o.id,version:o.version});modal.close();notify(del?'Карточка удалена.':'Объект в архиве.');go('#desk')});
}
async function editor(id,epoch){
 if(session.user.role!=='agent')throw new Error('Редактирование доступно агенту.');
 const o=id?await api('detail',{id}):{photos:[],property_type:'flat',deal_type:'sale'};if(epoch!==routeVersion)return;
 if(id&&session.user.id!=o.agent_id)throw new Error('Это объект другого агента.');
 main.innerHTML=`<a class="back" href="#desk">${ic('left')} Мои объекты</a><h1 class="page-title">${id?'Редактирование объекта':'Новый объект'}</h1><form id="editor" class="panel section form-grid">
 <div class="wide">${input('title','Название',o.title,'required maxlength="255"')}</div>${sel('property_type','Тип недвижимости',types,o.property_type)}${sel('deal_type','Вид сделки',deals,o.deal_type)}
 ${input('price','Цена, ₽ (для аренды — в месяц)',o.price,'required inputmode="decimal"')}${input('area','Площадь, м²',o.area,'required inputmode="decimal"')}
 ${input('rooms','Количество комнат (0 — студия)',o.rooms,'type="number" min="0" max="999"')}${input('address','Адрес',o.address,'required maxlength="255"')}
 <div class="wide">${areaField('description','Описание',o.description,10000,true)}</div><div class="wide">${field('photos','Фотографии',`<input name="photos[]" type="file" multiple accept="image/jpeg,image/png"><small class="muted">До 8 снимков JPEG или PNG, каждый до 5 МБ и 16 Мп.</small>`)}</div>
 ${o.photos.length?`<div class="wide thumbs">${o.photos.map(p=>`<label class="photo-check"><img src="${photoURL(p)}" alt="Снимок объекта"><input type="checkbox" name="remove[]" value="${p}"> Удалить</label>`).join('')}</div>`:''}
 <div class="wide">${formError}<div class="actions">${button('Отправить на проверку')}<a class="btn" href="#desk">Отмена</a></div></div></form>`;
 const form=$('#editor');
 const syncRooms=()=>{form.elements.rooms.required=form.elements.property_type.value==='flat';form.elements.rooms.setCustomValidity('')};
 syncRooms();form.elements.property_type.onchange=syncRooms;
 bindForm(form,async data=>{if(id){data.set('id',id);data.set('version',o.version)}await api('save',{},data);deskTab='objects';notify('Карточка направлена на проверку.');go('#desk')});
}
async function desk(epoch){
 const d=await api('dashboard');if(epoch!==routeVersion)return;
 const r=session.user.role,s=Object.fromEntries(d.statuses.map(x=>[x.id,x.name]));
 const titles={agent:{objects:'Мои объекты',requests:'Заявки'},client:{requests:'Мои заявки'},moderator:{objects:'Очередь проверки'},admin:{users:'Пользователи',transfer:'Передача объектов',settings:'Настройки',statuses:'Статусы'}}[r];
 if(!Object.hasOwn(titles,deskTab))deskTab=Object.keys(titles)[0];
 main.innerHTML=`<section class="workspace"><span class="tag">${roles[r]}</span><div class="heading"><h1 class="page-title">Личный кабинет</h1>${r==='agent'?'<a href="#edit" class="btn primary">'+ic('plus')+' Добавить объект</a>':''}</div><div class="tabs">${Object.entries(titles).map(([k,n])=>`<button data-tab="${k}" class="pill ${deskTab===k?'current':''}">${n}</button>`).join('')}</div><div class="stack" id="deskitems"></div></section>`;
 main.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{deskTab=b.dataset.tab;go('#desk')});const list=$('#deskitems');
 if(deskTab==='objects'){
 list.innerHTML=d.objects.map(o=>`<article class="item"><div><h3><a href="#object/${o.id}">${esc(o.title)}</a></h3><p class="muted">${esc(o.address)}</p><span class="tag">${esc(s[o.status_id])}</span> <span class="muted">Версия ${o.version}</span>${o.status_id==3?`<p class="flow">Причина: ${esc(o.moderation_note)}</p>`:''}</div><div class="actions">${r==='moderator'?`<a class="btn primary" href="#object/${o.id}">Проверить карточку</a>`:`<a class="btn" href="#edit/${o.id}">Изменить</a>${o.status_id!=4?`<button class="btn" data-archive="${o.id}">В архив</button>`:''}${[1,3].includes(+o.status_id)?`<button class="btn danger" data-delete="${o.id}">Удалить</button>`:''}`}</div></article>`).join('')||empty(r==='moderator'?'Все карточки проверены':'Объектов пока нет');
 list.querySelectorAll('[data-archive],[data-delete]').forEach(b=>b.onclick=()=>retire(d.objects.find(o=>o.id==(b.dataset.archive||b.dataset.delete)),!!b.dataset.delete));
 }else if(deskTab==='requests'){
 list.innerHTML=d.requests.map(q=>`<article class="item"><div><span class="tag">${esc(s[q.status_id])}</span><h3>${esc(q.title)}</h3><p class="muted">${esc(q.created_at)}</p>${r==='agent'?`<p>${esc(q.full_name)} · ${esc(q.phone)}</p>`:''}${q.comment?`<p class="flow">${esc(q.comment)}</p>`:''}</div>${r==='agent'?`<div class="actions">${(+q.status_id===5?[[6,'Взять в работу']]:+q.status_id===6?[[7,'Завершить'],[8,'Закрыть']]:[]).map(([to,n])=>`<button class="btn" data-req="${q.id}" data-to="${to}">${n}</button>`).join('')}</div>`:''}</article>`).join('')||empty('Заявок пока нет',r==='client'?'<p class="muted">Откройте интересующий объект и оставьте заявку на просмотр.</p><a class="btn" href="#catalog">Открыть каталог</a>':'');
 list.querySelectorAll('[data-req]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;await api('request_status',{},{id:b.dataset.req,status:b.dataset.to});notify('Статус заявки обновлён.');go('#desk')}catch(e){notify(e.message);b.disabled=false}});
 }else if(deskTab==='users'){
 list.innerHTML=d.admin.users.map(u=>`<div class="item"><div><h3>${esc(u.full_name)}</h3><p class="muted">${esc(u.email)}</p><span class="tag">${roles[u.role]} · ${+u.is_active?'Активен':'Заблокирован'}</span></div><button class="btn" data-uid="${u.id}">Изменить доступ</button></div>`).join('');
 list.querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>{const u=d.admin.users.find(x=>x.id==b.dataset.uid);editAdmin('Доступ пользователя','user',u.id,`<p>${esc(u.full_name)}<br>${esc(u.email)}</p>`+sel('role','Роль',roles,u.role)+sel('active','Состояние',{'1':'Активен','0':'Заблокирован'},u.is_active))});
 }else if(deskTab==='settings'){
 list.innerHTML=`<form class="panel stack">${input('page_size','Объектов на странице каталога',d.admin.page_size,'type="number" min="1" max="48" required')}${formError}<div>${button('Сохранить')}</div></form>`;
 bindForm($('form',list),async data=>{await api('setting',{},data);notify('Настройки сохранены.')});
 }else if(deskTab==='transfer'){
 const agents=d.admin.users.filter(u=>u.role==='agent'&&+u.is_active);
 list.innerHTML=d.objects.map(o=>`<div class="item"><div><h3>${esc(o.title)}</h3><p class="muted">${esc(d.admin.users.find(u=>u.id==o.agent_id)?.full_name)}</p></div><button class="btn" data-transfer="${o.id}">Передать объект</button></div>`).join('')||empty('Объектов пока нет');
 list.querySelectorAll('[data-transfer]').forEach(b=>b.onclick=()=>{const o=d.objects.find(x=>x.id==b.dataset.transfer);const dest=agents.filter(u=>u.id!=o.agent_id);
 if(!dest.length){dialog('Передача объекта','<p>Сначала назначьте другого действующего агента в разделе «Пользователи».</p>');return}
 editAdmin('Передача объекта','transfer',o.id,`<p>${esc(o.title)}</p>`+sel('agent_id','Новый ответственный агент',Object.fromEntries(dest.map(u=>[u.id,u.full_name])),dest[0].id));});
 }else{
 list.innerHTML=d.statuses.map(x=>`<div class="item"><div><h3>${esc(x.name)}</h3><p class="muted">${x.entity_type==='object'?'Объект':'Заявка'} · ${esc(x.code)} · Порядок ${x.sort_order}</p></div><button class="btn" data-sid="${x.id}">Изменить</button></div>`).join('');
 list.querySelectorAll('[data-sid]').forEach(b=>b.onclick=()=>{const x=d.statuses.find(y=>y.id==b.dataset.sid);editAdmin('Название и порядок','status',x.id,input('name','Название',x.name,'required maxlength="80"')+input('sort_order','Порядок',x.sort_order,'type="number" min="0" max="65535" required'))});
 }
}
function editAdmin(title,op,id,fields){dialog(title,`<form class="stack">${fields}${formError}${button('Сохранить')}</form>`);bindForm($('form',modal),async data=>{data.set('id',id);await api(op,{},data);modal.close();notify('Изменения сохранены.');go('#desk')});}
