'use strict';
function decision(o, publish) {
    dialog(
        publish ? 'Опубликовать объект?' : 'Отклонить объявление',
        `
            <form id="actionform" class="stack">
                <div>
                    <strong>${esc(o.title)}</strong>
                    <div class="muted">Версия
                        ${o.version}
                    </div>
                </div>
                ${publish ? '' : areaField('note', 'Что нужно исправить?', '', 1200, true)}
                ${formError}
                ${button(publish ? 'Опубликовать' : 'Вернуть агенту')}
            </form>
        `,
    );
    bindForm($('#actionform'), async (data) => {
        data.set('id', o.id);
        data.set('version', o.version);
        data.set('decision', publish ? 'publish' : 'reject');
        await api('moderate', {}, data);
        modal.close();
        notify(publish ? 'Объект опубликован.' : 'Объект возвращён агенту.');
        go('#desk');
    });
}

function retire(o, del) {
    dialog(
        del ? 'Удалить карточку?' : 'Перенести в архив?',
        `
            <form class="stack">
                <p>${esc(o.title)}<br><span class="muted">${
                    del
                        ? 'Карточка и её фотографии будут удалены.'
                        : 'Объект будет снят с публикации. История заявок сохранится.'
                }</span></p>
                ${formError}
                ${button(del ? 'Удалить' : 'В архив', del ? 'danger' : 'primary')}
            </form>
        `,
    );
    bindForm($('form', modal), async () => {
        await api(del ? 'delete' : 'archive', {}, { id: o.id, version: o.version });
        modal.close();
        notify(del ? 'Карточка удалена.' : 'Объект в архиве.');
        go('#desk');
    });
}

async function editor(id, epoch) {
    const moderator = session.user.role === 'moderator';
    if (session.user.role !== 'agent' && !(moderator && id)) {
        throw new Error('Нет доступа к редактору объекта.');
    }
    const o = id
        ? await api('detail', { id })
        : { photos: [], property_type: 'flat', deal_type: 'sale' };
    if (epoch !== routeVersion) {
        return;
    }
    if (moderator && o.status_id != 1) {
        throw new Error('Модератор может изменить только объект на проверке.');
    }
    if (id && !moderator && session.user.id != o.agent_id) {
        throw new Error('Это объект другого агента.');
    }
    const back = moderator ? '#object/' + o.id : '#desk';
    main.innerHTML = `
        <a class="back" href="${back}">${ic('left')} ${moderator ? 'К проверке объекта' : 'Мои объекты'}</a>
        <h1 class="page-title">${id ? 'Редактирование объекта' : 'Новый объект'}</h1>
        <form id="editor" class="panel section form-grid">
            <div class="wide">
                ${input('title', 'Название', o.title, 'required maxlength="255"')}
            </div>
            ${sel('property_type', 'Тип недвижимости', types, o.property_type)}
            ${sel('deal_type', 'Вид сделки', deals, o.deal_type)}
            ${
                input(
                    'price',
                    'Цена, ₽ (для аренды — в месяц)',
                    o.price,
                    'required inputmode="decimal"',
                )
            }
            ${input('area', 'Площадь, м²', o.area, 'required inputmode="decimal"')}
            ${
                input(
                    'rooms',
                    'Количество комнат (0 — студия)',
                    o.rooms,
                    'type="number" min="0" max="999"',
                )
            }
            ${input('address', 'Адрес', o.address, 'required maxlength="255"')}
            <div class="wide">
                ${areaField('description', 'Описание', o.description, 10000, true)}
            </div>
            <div class="wide">
                ${field('photos', 'Фотографии', `
                    <input name="photos[]" type="file" multiple accept="image/jpeg,image/png">
                    <small class="muted">До 8 снимков JPEG или PNG, каждый до 5 МБ и 16 Мп.</small>
                `)}
            </div>
            ${o.photos.length ? `
                <div class="wide thumbs">
                    ${o.photos.map((p) => `
                        <label class="photo-check">
                            <img src="${photoURL(p)}" alt="Снимок объекта">
                            <input type="checkbox" name="remove[]" value="${p}"> Удалить
                        </label>
                    `).join('')}
                </div>
            ` : ''}
            <div class="wide">
                ${formError}
                <div class="actions">
                    ${button(moderator ? 'Сохранить изменения' : 'Отправить на проверку')}
                    <a class="btn" href="${back}">Отмена</a>
                </div>
            </div>
        </form>
    `;
    const form = $('#editor');
    const syncRooms = () => {
        form.elements.rooms.required = form.elements.property_type.value === 'flat';
        form.elements.rooms.setCustomValidity('');
    };
    syncRooms();
    form.elements.property_type.onchange = syncRooms;
    bindForm(form, async (data) => {
        if (id) {
            data.set('id', id);
            data.set('version', o.version);
        }
        await api('save', {}, data);
        deskTab = 'objects';
        notify(moderator ? 'Изменения сохранены. Объект на проверке.' : 'Карточка направлена на проверку.');
        go(back);
    });
}

async function desk(epoch) {
    const filters = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
    const r = session.user.role;
    const titles = {
        agent: { objects: 'Мои объекты', requests: 'Заявки' },
        client: { requests: 'Мои заявки' },
        moderator: { objects: 'Очередь проверки' },
        admin: {
            users: 'Пользователи',
            transfer: 'Передача объектов',
            settings: 'Настройки',
            statuses: 'Статусы',
        },
    }[r];
    if (filters.tab && Object.hasOwn(titles, filters.tab)) {
        deskTab = filters.tab;
    }
    if (!Object.hasOwn(titles, deskTab)) {
        deskTab = Object.keys(titles)[0];
    }
    const d = await api('dashboard', { ...filters, tab: deskTab });
    if (epoch !== routeVersion) {
        return;
    }
    const s = Object.fromEntries(d.statuses.map((x) => [x.id, x.name]));
    function showTab(tab, params = {}) {
        const qs = new URLSearchParams({ ...params, tab });
        for (const [k, v] of [...qs]) {
            if (!v) {
                qs.delete(k);
            }
        }
        go('#desk?' + qs);
    }
    main.innerHTML = `
        <section class="workspace">
            <span class="tag">${roles[r]}</span>
            <div class="heading">
                <h1 class="page-title">Личный кабинет</h1>
                ${
                    r === 'agent'
                        ? '<a href="#edit" class="btn primary">' + ic('plus') + ' Добавить объект</a>'
                        : ''
                }
            </div>
            <div class="tabs">
                ${
                    Object.entries(titles)
                        .map(([k, n]) => `<button data-tab="${k}" class="pill ${deskTab === k ? 'current' : ''}">${n}</button>`)
                        .join('')
                }
            </div>
            <div class="stack" id="deskitems"></div>
        </section>
    `;
    main.querySelectorAll('[data-tab]').forEach(
        (b) =>
            (b.onclick = () => {
                showTab(b.dataset.tab);
            }),
    );
    const list = $('#deskitems');
    if (deskTab === 'objects') {
        list.innerHTML =
            d.objects
                .map(
                    (o) =>
                        `
                            <article class="item">
                                <div>
                                    <h3><a href="#object/${o.id}">${esc(o.title)}</a></h3>
                                    <p class="muted">${esc(o.address)}</p>
                                    <span class="tag">${esc(s[o.status_id])}</span>
                                    <span class="muted">Версия ${o.version}</span>
                                    ${o.status_id == 3 ? `<p class="flow">Причина: ${esc(o.moderation_note)}</p>` : ''}
                                </div>
                                <div class="actions">
                                    ${r === 'moderator' ? `
                                        <a class="btn primary" href="#object/${o.id}">Проверить карточку</a>
                                        <a class="btn" href="#edit/${o.id}">Редактировать</a>
                                        <button class="btn" data-reject="${o.id}">Отклонить</button>
                                    ` : `
                                        <a class="btn" href="#edit/${o.id}">Изменить</a>
                                        ${o.status_id != 4 ? `<button class="btn" data-archive="${o.id}">В архив</button>` : ''}
                                        ${[1, 3].includes(+o.status_id) ? `<button class="btn danger" data-delete="${o.id}">Удалить</button>` : ''}
                                    `}
                                </div>
                            </article>
                        `,
                )
                .join('') ||
            empty(r === 'moderator' ? 'Все карточки проверены' : 'Объектов пока нет');
        list.querySelectorAll('[data-reject]').forEach((button) => {
            button.onclick = () => decision(d.objects.find((o) => o.id == button.dataset.reject), false);
        });
        list.querySelectorAll('[data-archive],[data-delete]').forEach(
            (b) =>
                (b.onclick = () =>
                    retire(
                        d.objects.find((o) => o.id == (b.dataset.archive || b.dataset.delete)),
                        !!b.dataset.delete,
                    )),
        );
    } else if (deskTab === 'requests') {
        list.innerHTML =
            d.requests
                .map(
                    (q) =>
                        `
                            <article class="item">
                                <div>
                                    <span class="tag">${esc(s[q.status_id])}</span>
                                    <h3>${esc(q.title)}</h3>
                                    <p class="muted">${esc(q.created_at)}</p>
                                    ${r === 'agent' ? `<p>${esc(q.full_name)} · ${esc(q.phone)}</p>` : ''}
                                    ${q.comment ? `<p class="flow">${esc(q.comment)}</p>` : ''}
                                </div>
                                ${r === 'agent' ? `
                                    <div class="actions">
                                        ${
                                            (+q.status_id === 5
                                                ? [[6, 'Взять в работу']]
                                                : +q.status_id === 6
                                                  ? [
                                                        [7, 'Завершить'],
                                                        [8, 'Закрыть'],
                                                    ]
                                                  : []
                                            )
                                                .map(([to, n]) => `<button class="btn" data-req="${q.id}" data-to="${to}">${n}</button>`)
                                                .join('')
                                        }
                                    </div>
                                ` : ''}
                            </article>
                        `,
                )
                .join('') ||
            empty(
                'Заявок пока нет',
                r === 'client'
                    ? '<p class="muted">Откройте интересующий объект и оставьте заявку на просмотр.</p><a class="btn" href="#catalog">Открыть каталог</a>'
                    : '',
            );
        list.querySelectorAll('[data-req]').forEach(
            (b) =>
                (b.onclick = async () => {
                    try {
                        b.disabled = true;
                        await api(
                            'request_status',
                            {},
                            { id: b.dataset.req, status: b.dataset.to },
                        );
                        notify('Статус заявки обновлён.');
                        go(location.hash);
                    } catch (e) {
                        notify(e.message);
                        b.disabled = false;
                    }
                }),
        );
    } else if (deskTab === 'users') {
        const filterBar = `
            <form class="panel" id="user-filter">
                <div class="form-grid">
                    ${
                        input(
                            'q',
                            'Имя или электронная почта',
                            filters.q || '',
                            'maxlength="255" placeholder="Например, Анна или anna@example.ru"',
                        )
                    }
                    ${sel('role', 'Роль', { '': 'Все роли', ...roles }, filters.role || '')}
                    ${
                        sel(
                            'active',
                            'Состояние',
                            { '': 'Все состояния', 1: 'Активен', 0: 'Заблокирован' },
                            filters.active ?? '',
                        )
                    }
                    <div class="actions">
                        ${button('Найти')}
                        <button class="btn" type="button" data-reset>Сбросить</button>
                    </div>
                </div>
            </form>
        `;
        const pager =
            d.admin.pages > 1
                ? `
                    <div class="actions">
                        <button class="btn" data-step="-1" ${d.admin.page === 1 ? 'disabled' : ''}>Назад</button>
                        <span>Страница ${d.admin.page} из ${d.admin.pages}</span>
                        <button class="btn" data-step="1" ${d.admin.page === d.admin.pages ? 'disabled' : ''}>Далее</button>
                    </div>
                `
                : '';
        list.innerHTML =
            filterBar +
            '<span class="muted">Найдено пользователей: ' +
            d.admin.total +
            '</span>' +
            (d.admin.users
                .map(
                    (u) =>
                        `
                            <div class="item">
                                <div>
                                    <h3>${esc(u.full_name)}</h3>
                                    <p class="muted">${esc(u.email)}</p>
                                    <p class="muted">Дата регистрации · ${esc(u.created_at.slice(0, 10).split('-').reverse().join('.'))}</p>
                                    <span class="tag">${roles[u.role]} · ${+u.is_active ? 'Активен' : 'Заблокирован'}</span>
                                </div>
                                <div class="actions">
                                    <button class="btn" data-uid="${u.id}">Изменить доступ</button>
                                    ${u.id != session.user.id ? `<button class="btn danger" data-delete-user="${u.id}">Удалить</button>` : ''}
                                </div>
                            </div>
                        `,
                )
                .join('') || empty('Пользователи не найдены')) +
            pager;
        const f = $('#user-filter');
        const show = (values) => showTab(deskTab, values);
        f.onsubmit = (e) => {
            e.preventDefault();
            show(Object.fromEntries(new FormData(f)));
        };
        $('[data-reset]', f).onclick = () => show({});
        list.querySelectorAll('[data-delete-user]').forEach((button) => {
            button.onclick = () => confirmUserDeletion(d.admin.users.find((u) => u.id == button.dataset.deleteUser));
        });
        list.querySelectorAll('[data-step]').forEach(
            (b) =>
                (b.onclick = () =>
                    show({ ...filters, page: d.admin.page + Number(b.dataset.step) })),
        );
        list.querySelectorAll('[data-uid]').forEach(
            (b) =>
                (b.onclick = () => {
                    const u = d.admin.users.find((x) => x.id == b.dataset.uid);
                    editAdmin(
                        'Доступ пользователя',
                        'user',
                        u.id,
                        `<p>${esc(u.full_name)}<br>${esc(u.email)}</p>` +
                            sel('role', 'Роль', roles, u.role) +
                            sel(
                                'active',
                                'Состояние',
                                { 1: 'Активен', 0: 'Заблокирован' },
                                u.is_active,
                            ),
                    );
                }),
        );
    } else if (deskTab === 'settings') {
        list.innerHTML = `
            <form class="panel stack">
                ${
                    input(
                        'page_size',
                        'Объектов на странице каталога',
                        d.admin.page_size,
                        'type="number" min="1" max="48" required',
                    )
                }
                ${formError}
                <div>
                    ${button('Сохранить')}
                </div>
            </form>
        `;
        bindForm($('form', list), async (data) => {
            await api('setting', {}, data);
            notify('Настройки сохранены.');
        });
    } else if (deskTab === 'transfer') {
        list.innerHTML =
            d.objects
                .map(
                    (o) =>
                        `
                            <div class="item">
                                <div>
                                    <h3>${esc(o.title)}</h3>
                                    <p>${esc(o.address)}</p>
                                    <p class="muted">${esc(o.agent_name)}</p>
                                </div>
                                <button class="btn" data-transfer="${o.id}">Передать объект</button>
                            </div>
                        `,
                )
                .join('') || empty('Объектов пока нет');
        list.querySelectorAll('[data-transfer]').forEach(
            (b) =>
                (b.onclick = () => chooseAgent(d.objects.find((o) => o.id == b.dataset.transfer))),
        );
    } else {
        list.innerHTML = d.statuses
            .map(
                (x) =>
                    `
                        <div class="item">
                            <div>
                                <h3>${esc(x.name)}</h3>
                                <p class="muted">${x.entity_type === 'object' ? 'Объект' : 'Заявка'} · ${esc(x.code)} · Порядок ${x.sort_order}</p>
                            </div>
                            <button class="btn" data-sid="${x.id}">Изменить</button>
                        </div>
                    `,
            )
            .join('');
        list.querySelectorAll('[data-sid]').forEach(
            (b) => (b.onclick = () => editStatus(d.statuses.find((x) => x.id == b.dataset.sid))),
        );
    }
    if (d.pagination) {
        const { total, page, pages } = d.pagination;
        const hint =
            deskTab === 'requests'
                ? 'Клиент, объект, адрес или телефон'
                : deskTab === 'transfer'
                  ? 'Название, адрес или агент'
                  : 'Название или адрес';
        const states = d.statuses.filter(
            (x) => x.entity_type === (deskTab === 'requests' ? 'request' : 'object'),
        );
        if (!total && (filters.q || filters.status)) {
            list.innerHTML = empty('По этим условиям ничего не найдено');
        }
        list.insertAdjacentHTML(
            'afterbegin',
            `
                <form class="panel" id="desk-filter">
                    <div class="form-grid">
                        ${
                            input(
                                'q',
                                'Поиск',
                                filters.q || '',
                                'maxlength="255" placeholder="' + hint + '"',
                            )
                        }
                        ${
                            r === 'agent'
                                ? sel(
                                      'status',
                                      'Статус',
                                      Object.fromEntries([
                                          ['', 'Все статусы'],
                                          ...states.map((x) => [x.id, x.name]),
                                      ]),
                                      filters.status || '',
                                  )
                                : ''
                        }
                        <div class="actions">
                            ${button('Найти')}
                            <button class="btn" type="button" data-reset>Сбросить</button>
                        </div>
                    </div>
                </form>
                <span class="muted">Найдено: ${total}</span>
            `,
        );
        const form = $('#desk-filter');
        form.onsubmit = (e) => {
            e.preventDefault();
            showTab(deskTab, Object.fromEntries(new FormData(form)));
        };
        $('[data-reset]', form).onclick = () => showTab(deskTab);
        if (pages > 1) {
            list.insertAdjacentHTML('beforeend', deskPager(page, pages));
            list.querySelectorAll('[data-turn]').forEach(
                (b) =>
                    (b.onclick = () =>
                        showTab(deskTab, { ...filters, page: page + Number(b.dataset.turn) })),
            );
        }
    }
}

function deskPager(page, pages) {
    return `
        <div class="actions">
            <button type="button" class="btn" data-turn="-1" ${page <= 1 ? 'disabled' : ''}>Назад</button>
            <span>Страница ${page} из ${pages}</span>
            <button type="button" class="btn" data-turn="1" ${page >= pages ? 'disabled' : ''}>Далее</button>
        </div>
    `;
}

function chooseAgent(object) {
    dialog(
        'Передача объекта',
        `
            <p><strong>${esc(object.title)}</strong><br>Сейчас отвечает: ${esc(object.agent_name)}</p>
            <form class="stack" data-search>
                ${
                    input(
                        'q',
                        'Поиск агента',
                        '',
                        'maxlength="255" placeholder="Имя или электронная почта"',
                    )
                }
                ${button('Найти', '')}
            </form>
            <div class="section" data-matches></div>
        `,
    );
    const search = $('[data-search]', modal),
        matches = $('[data-matches]', modal);
    let sequence = 0;
    async function load(term, page) {
        const current = ++sequence;
        matches.textContent = 'Загрузка…';
        try {
            const result = await api('transfer_agents', {
                exclude: object.agent_id,
                q: term,
                page,
            });
            if (current !== sequence || !matches.isConnected) {
                return;
            }
            if (!result.total) {
                matches.textContent = term
                    ? 'Подходящих агентов нет. Попробуйте другое имя.'
                    : 'Нет другого активного агента. Назначьте его в разделе «Пользователи».';
                return;
            }
            const choices = Object.fromEntries(
                result.rows.map((u) => [u.id, u.full_name + ' · ' + u.email]),
            );
            matches.innerHTML =
                `
                    <form class="stack">
                        ${
                            sel(
                                'agent_id',
                                'Новый ответственный агент',
                                { '': 'Выберите агента', ...choices },
                                '',
                            )
                        }
                        ${formError}
                        ${button('Передать объект')}
                    </form>
                ` +
                (result.pages > 1 ? deskPager(result.page, result.pages) : '');
            const form = $('form', matches);
            form.elements.agent_id.required = true;
            bindForm(form, async (data) => {
                data.set('id', object.id);
                await api('transfer', {}, data);
                modal.close();
                notify('Объект передан агенту.');
                go(location.hash);
            });
            matches
                .querySelectorAll('[data-turn]')
                .forEach(
                    (b) => (b.onclick = () => load(term, result.page + Number(b.dataset.turn))),
                );
        } catch (e) {
            if (current === sequence) {
                matches.textContent = e.message;
            }
        }
    }
    search.onsubmit = (e) => {
        e.preventDefault();
        load(search.elements.q.value.trim(), 1);
    };
    load('', 1);
}

function editStatus(status) {
    const labels = {
        pending: ['На проверке', 'Ожидает проверки'],
        published: ['Опубликован', 'В каталоге'],
        rejected: ['Отклонён', 'Публикация отклонена'],
        archived: ['В архиве', 'Архивный'],
        new: ['Новая', 'Получена'],
        working: ['В работе', 'В обработке'],
        done: ['Завершена', 'Выполнена'],
        closed: ['Закрыта', 'Обращение закрыто'],
    };
    const choices = new Set([status.name, ...(labels[status.code] || [])]);
    const options = Object.fromEntries(Array.from(choices, (label) => [label, label]));
    options[''] = 'Своё название…';
    dialog(
        'Название и порядок',
        `
            <form class="stack">
                ${sel('preset', 'Название статуса', options, status.name)}
                ${input('name', 'Своё название', '', 'required maxlength="80"')}
                ${
                    input(
                        'sort_order',
                        'Порядок в списке',
                        status.sort_order,
                        'type="number" min="0" max="65535" required',
                    )
                }
                <small class="muted">Чем меньше число, тем выше статус в своей группе. Например, 15 ставит его между 10 и 20.</small>
                ${formError}
                ${button('Сохранить')}
            </form>
        `,
    );
    const form = $('form', modal),
        preset = form.elements.preset,
        custom = form.elements.name;
    const toggle = () => {
        custom.disabled = preset.value !== '';
        custom.closest('label').hidden = custom.disabled;
        if (!custom.disabled) {
            custom.focus();
        }
    };
    preset.onchange = toggle;
    toggle();
    bindForm(form, async (data) => {
        if (preset.value) {
            data.set('name', preset.value);
        }
        data.delete('preset');
        data.set('id', status.id);
        await api('status', {}, data);
        modal.close();
        notify('Статус сохранён.');
        go(location.hash);
    });
}

function confirmUserDeletion(user) {
    dialog('Удалить пользователя?', `
        <form class="stack">
            <p><strong>${esc(user.full_name)}</strong><br>${esc(user.email)}</p>
            <p>Учётная запись и избранное будут удалены. Заявки останутся в истории агента.</p>
            ${formError}
            <div class="actions">
                <button class="btn" type="button" data-cancel>Отмена</button>
                ${button('Удалить пользователя', 'danger')}
            </div>
        </form>
    `);
    $('[data-cancel]', modal).onclick = () => modal.close();
    bindForm($('form', modal), async () => {
        await api('delete_user', {}, { id: user.id });
        modal.close();
        notify('Пользователь удалён.');
        go(location.hash);
    });
}

function editAdmin(title, op, id, fields) {
    dialog(title, `<form class="stack">${fields}${formError}${button('Сохранить')}</form>`);
    bindForm($('form', modal), async (data) => {
        data.set('id', id);
        await api(op, {}, data);
        modal.close();
        notify('Изменения сохранены.');
        go(location.hash);
    });
}
