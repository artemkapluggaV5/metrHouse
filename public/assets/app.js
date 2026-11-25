'use strict';
const $ = (s, root = document) => root.querySelector(s);
const main = $('#main'),
    modal = $('#modal');
const esc = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const types = { flat: 'Квартира', house: 'Дом', office: 'Коммерческая' };
const deals = { sale: 'Продажа', rent: 'Аренда' };
const roles = { client: 'Клиент', agent: 'Агент', moderator: 'Модератор', admin: 'Администратор' };
const shapes = {
    heart: '<path d="M20.6 4.9a5.3 5.3 0 0 0-7.5 0L12 6l-1.1-1.1a5.3 5.3 0 0 0-7.5 7.5L12 21l8.6-8.6a5.3 5.3 0 0 0 0-7.5Z"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0Z"/><circle cx="12" cy="10" r="2.4"/>',
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0114 0v2"/>',
    arrow: '<path d="m7 17 10-10M7 7h10v10"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    size: '<path d="M4 10V4h6m4 0h6v6m0 4v6h-6m-4 0H4v-6"/>',
    rooms: '<path d="M4 20V5h16v15H4Zm8 0v-8h8"/>',
    sort: '<path d="M3 6h16M3 12h12M3 18h7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    logout: '<path d="M10 4H4v16h6m-1-8h12m-5-5 5 5-5 5"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
};
const ic = (k) => '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24">' + shapes[k] + '</svg>';
const num = (v) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const price = (o) => num(o.price) + ' ₽' + (o.deal_type === 'rent' ? ' <small>/ мес.</small>' : '');
const opts = (values, current) =>
    Object.entries(values)
        .map(
            ([k, v]) =>
                `<option value="${esc(k)}" ${String(k) === String(current) ? 'selected' : ''}>${esc(v)}</option>`,
        )
        .join('');
const field = (name, label, html) =>
    `<label class="field" data-field="${name}"><span>${label}</span>${html}<small class="fielderr"></small></label>`;
const input = (name, label, value = '', attrs = '') =>
    field(name, label, `<input name="${name}" value="${esc(value)}" ${attrs}>`);
const sel = (name, label, values, value) =>
    field(name, label, `<select name="${name}">${opts(values, value)}</select>`);
const areaField = (name, label, value = '', max = 10000, required = false) =>
    field(
        name,
        label,
        `<textarea ${required ? 'required' : ''} name="${name}" maxlength="${max}">${esc(value)}</textarea>`,
    );
const formError = '<div class="err" role="alert"></div>';
const button = (title, kind = 'primary') =>
    `<button class="btn ${kind}" type="submit">${title}</button>`;
const photoURL = (id) => 'index.php?api=photo&id=' + encodeURIComponent(id);
const contactRules = JSON.parse($('#contact-rules').textContent);
for (const rule of Object.values(contactRules)) {
    rule.regex = new RegExp('^(?:' + rule.pattern + ')$', 'u');
}

function fieldMessage(el, checkRequired) {
    const value = el.name === 'password' ? el.value : el.value.trim();
    if (!value) {
        return checkRequired && el.required ? 'Заполните это поле.' : '';
    }
    const key = el.name;
    const registration = !!el.form.elements.full_name;
    const contact = contactRules[key];
    if (contact && (key !== 'email' || registration) && !contact.regex.test(value)) {
        return contact.message;
    }
    if (key === 'email' && el.validity.typeMismatch) {
        return contactRules.email.message;
    }
    if (key === 'password') {
        if (registration && [...el.value].length < 8) {
            return 'Для регистрации нужно не менее 8 символов.';
        }
        if (new TextEncoder().encode(el.value).length > 72) {
            return 'Пароль должен помещаться в 72 байта.';
        }
    }
    if (['price', 'area', 'min', 'max'].includes(key)) {
        const number = value.replace(',', '.');
        const pattern = key === 'area' ? /^\d{1,6}(?:\.\d{1,2})?$/ : /^\d{1,13}(?:\.\d{1,2})?$/;
        if (!pattern.test(number)) {
            return 'Введите число (до двух знаков после запятой).';
        }
        if ((key === 'price' || key === 'area') && Number(number) <= 0) {
            return 'Значение должно быть больше нуля.';
        }
        if (
            key === 'max' &&
            el.form.elements.min.value.trim() &&
            Number(number) < Number(el.form.elements.min.value.trim().replace(',', '.'))
        ) {
            return 'Верхняя цена меньше нижней.';
        }
    }
    return '';
}

function setFieldError(el, message) {
    el.setCustomValidity(message);
    el.classList.toggle('invalid', !!message);
    el.setAttribute('aria-invalid', String(!!message));
    const output = el.closest('[data-field]')?.querySelector('.fielderr');
    if (output) {
        output.textContent = message;
    }
}

function prepareChecks(form) {
    let submitAttempted = false;
    const validate = (el) => setFieldError(el, fieldMessage(el, submitAttempted));
    const isControl = (el) => el.matches('input:not([type=checkbox]),textarea,select');
    for (const el of form.elements) {
        if (isControl(el)) {
            el.onblur = () => validate(el);
        }
    }
    form.oninput = (e) => {
        const el = e.target;
        if (!isControl(el)) {
            return;
        }
        if (
            el.validity.customError ||
            el.classList.contains('invalid') ||
            el.closest('[data-field]')?.querySelector('.fielderr')?.textContent
        ) {
            validate(el);
        }
        if (el.name === 'min' && form.elements.max.validity.customError) {
            validate(form.elements.max);
        }
    };
    const name = form.elements.full_name;
    if (name) {
        const allowed = /^[\p{L}\p{M} '\u2019\u2010\u2011-]*$/u;
        const block = (event, text) => {
            if (text && !allowed.test(text)) {
                event.preventDefault();
                const hint = name.closest('[data-field]').querySelector('.fielderr');
                hint.textContent = contactRules.full_name.message;
            }
        };
        name.onbeforeinput = (e) => {
            if (!e.isComposing) {
                block(e, e.data);
            }
        };
        name.onpaste = (e) => block(e, e.clipboardData?.getData('text/plain'));
    }
    return () => {
        submitAttempted = true;
        for (const el of form.elements) {
            if (isControl(el)) {
                validate(el);
            }
        }
        return form.reportValidity();
    };
}
let session,
    routeVersion = 0,
    lastCatalog = '#catalog',
    deskTab = '',
    timer,
    authNext = '';
async function api(op, params = {}, data = null) {
    const url = new URL('index.php', location.href);
    url.searchParams.set('api', op);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const cfg =
        data === null
            ? {}
            : {
                  method: 'POST',
                  headers: { 'X-CSRF-Token': session?.csrf || '' },
                  body: data instanceof FormData ? data : new URLSearchParams(data),
              };
    const response = await fetch(url, cfg);
    let body;
    try {
        body = await response.json();
    } catch {
        throw new Error('Сервер вернул нечитаемый ответ.');
    }
    if (!response.ok) {
        const e = new Error(body.error || 'Ошибка соединения.');
        e.field = body.field;
        throw e;
    }
    return body;
}

function notify(s) {
    const el = $('.toast');
    el.textContent = s;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (el.hidden = true), 3600);
}

function bindForm(form, action) {
    const valid = prepareChecks(form);
    form.noValidate = true;
    form.onsubmit = async (ev) => {
        ev.preventDefault();
        if (form.dataset.busy || !valid()) {
            return;
        }
        form.dataset.busy = '1';
        const submit = ev.submitter || form.querySelector('button[type=submit]');
        if (submit) {
            submit.disabled = true;
        }
        form.querySelectorAll('.fielderr,.err').forEach((x) => (x.textContent = ''));
        form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
        try {
            await action(new FormData(form));
        } catch (e) {
            const box = [...form.querySelectorAll('[data-field]')].find(
                (x) => x.dataset.field === e.field,
            );
            const target = box?.querySelector('.fielderr') || form.querySelector('.err');
            if (target) {
                target.textContent = e.message;
            } else {
                notify(e.message);
            }
            const el = box?.querySelector('input,select,textarea');
            el?.classList.add('invalid');
            el?.focus();
        } finally {
            delete form.dataset.busy;
            if (submit) {
                submit.disabled = false;
            }
        }
    };
}

function dialog(title, html) {
    $('#dialog-body').innerHTML =
        `
            <div class="heading">
                <h2>${esc(title)}</h2>
                <button type="button" class="iconbtn" data-close aria-label="Закрыть">${ic('close')}</button>
            </div>
            ${html}
        `;
    if (!modal.open) {
        modal.showModal();
    }
    $('[data-close]', modal).onclick = () => modal.close();
}

function account() {
    const u = session.user;
    $('#desk-link').hidden = !u;
    $('#account').innerHTML = u
        ? `
            <a class="btn" href="#desk" aria-label="Личный кабинет">${ic('user')} <span class="username">${esc(u.full_name)}</span></a>
            <button class="iconbtn" id="exit" aria-label="Выйти">${ic('logout')}</button>
        `
        : `<button class="btn" id="login">${ic('user')} Войти</button>`;
    if (u) {
        $('#exit').onclick = async () => {
            try {
                await api('logout', {}, {});
                session = await api('session');
                account();
                deskTab = '';
                go('#catalog');
                notify('Вы вышли из кабинета.');
            } catch (e) {
                notify(e.message);
            }
        };
    } else {
        $('#login').onclick = () => auth(false, '#desk');
    }
}

function auth(register = false, next = '#desk', favoriteId = null) {
    authNext = next;
    dialog(
        register ? 'Регистрация клиента' : 'Вход в кабинет',
        `
            <form class="stack" id="authform">
                ${
                    register
                        ? input(
                              'full_name',
                              'Имя и фамилия',
                              '',
                              'required maxlength="150" autocomplete="name" placeholder="Анна Петрова"',
                          )
                        : ''
                }
                ${
                    input(
                        'email',
                        'Электронная почта',
                        '',
                        'type="email" required maxlength="' +
                            (register ? 254 : 255) +
                            '" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="anna@example.ru"',
                    )
                }
                ${
                    input(
                        'password',
                        'Пароль',
                        '',
                        'type="password" required autocomplete="' +
                            (register ? 'new-password' : 'current-password') +
                            '" ' +
                            (register ? 'minlength="8"' : ''),
                    )
                }
                ${
                    register
                        ? '<div class="verify">Проверка · <b data-question aria-live="polite">Загрузка…</b></div>' +
                          input(
                              'answer',
                              'Ответ на пример',
                              '',
                              'required inputmode="numeric" pattern="[0-9]+" maxlength="5" autocomplete="off"',
                          )
                        : ''
                }
                ${formError}
                ${button(register ? 'Создать аккаунт' : 'Войти')}
                <button type="button" id="switch" class="linkbtn">${register ? 'Уже есть аккаунт? Войти' : 'Зарегистрироваться как клиент'}</button>
            </form>
        `,
    );
    $('#switch').onclick = () => auth(!register, next, favoriteId);
    const form = $('#authform');
    let token = '';
    let refreshTimer;
    async function refresh() {
        if (!form.isConnected || !modal.open) {
            return;
        }
        const question = $('[data-question]', form);
        const answer = form.elements.answer;
        token = '';
        answer.value = '';
        answer.disabled = true;
        question.textContent = 'Загрузка…';
        try {
            const task = await api('registration_challenge');
            token = task.token;
            question.textContent = task.question + ' = ?';
            answer.disabled = false;
            refreshTimer = setTimeout(refresh, task.expires_in * 1000);
        } catch {
            question.textContent = 'Не удалось загрузить пример. Пробуем ещё раз…';
            refreshTimer = setTimeout(refresh, 5000);
        }
    }
    if (register) {
        refresh();
    }
    bindForm(form, async (data) => {
        if (register) {
            if (!token) {
                throw new Error('Дождитесь загрузки примера.');
            }
            clearTimeout(refreshTimer);
            data.set('token', token);
        }
        try {
            session = await api(register ? 'register' : 'login', {}, data);
        } catch (e) {
            if (register) {
                await refresh();
            }
            throw e;
        }
        account();
        modal.close();
        deskTab = '';
        if (favoriteId !== null) {
            try {
                await api('favorite', {}, { id: favoriteId, saved: 1 });
                notify('Объект добавлен в избранное.');
            } catch (e) {
                notify(e.message);
            }
        }
        go(next);
    });
}

function go(hash) {
    if (location.hash === hash) {
        route();
    } else {
        location.hash = hash;
    }
}
const empty = (title, sub = '') => `<div class="empty"><h3>${esc(title)}</h3>${sub}</div>`;
function favoriteButton(o, compact = false) {
    const saved = Boolean(Number(o.is_favorite));
    const label = favoriteLabel(saved);
    return `
        <button type="button" class="favorite-toggle ${compact ? 'iconbtn' : 'btn'}"
                data-favorite="${o.id}" aria-pressed="${saved}"
                title="${label}" ${compact ? `aria-label="Избранное · ${esc(o.title)}"` : ''}>
            ${ic('heart')}${compact ? '' : `<span>${label}</span>`}
        </button>
    `;
}

function favoriteLabel(saved) {
    return saved ? 'Убрать из избранного' : 'Добавить в избранное';
}

main.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-favorite]');
    if (!toggle || toggle.disabled) {
        return;
    }
    const id = toggle.dataset.favorite;
    if (!session.user) {
        auth(false, location.hash || '#catalog', id);
        return;
    }
    const saved = toggle.getAttribute('aria-pressed') === 'false';
    toggle.disabled = true;
    try {
        await api('favorite', {}, { id, saved: saved ? 1 : 0 });
        notify(saved ? 'Объект добавлен в избранное.' : 'Объект убран из избранного.');
        if (main.dataset.route === 'favorites') {
            await route();
        } else if (toggle.isConnected) {
            toggle.setAttribute('aria-pressed', String(saved));
            toggle.title = favoriteLabel(saved);
            const label = toggle.querySelector('span');
            if (label) {
                label.textContent = toggle.title;
            }
        }
    } catch (e) {
        notify(e.message);
    } finally {
        toggle.disabled = false;
    }
});

function card(o) {
    return `<div class="card-entry">${cardLink(o)}${favoriteButton(o, true)}</div>`;
}

function cardLink(o) {
    return `
        <a class="card" href="#object/${o.id}">
            <div class="visual">
                ${o.photo_id ? `<img alt="${esc(o.title)}" src="${photoURL(o.photo_id)}" loading="lazy">` : '<span class="emptyphoto">Без фотографии</span>'}
                <span class="badge ${o.deal_type}">${deals[o.deal_type]}</span>
            </div>
            <div class="cardbody">
                <h3>${esc(o.title)}</h3>
                <div class="address">
                    ${ic('pin')}
                    ${esc(o.address)}
                </div>
                <div class="meta">
                    <span>${ic('size')}${num(o.area)} м²</span>
                    <span>${ic('rooms')}${
                        o.rooms === null
                            ? types[o.property_type]
                            : +o.rooms === 0
                              ? 'Студия'
                              : esc(o.rooms) + ' комн.'
                    }</span>
                </div>
                <div class="cardfoot">
                    <span class="price">${price(o)}</span>
                    <span class="arrow">${ic('arrow')}</span>
                </div>
            </div>
        </a>
    `;
}

async function catalog(p, epoch, favoritesOnly) {
    lastCatalog = location.hash || '#catalog';
    const listPath = favoritesOnly ? '#favorites' : '#catalog';
    if (favoritesOnly && !session.user) {
        main.innerHTML = empty(
            'Избранное',
            '<p>Войдите, чтобы открыть сохранённые объекты.</p><button class="btn primary" id="enter">Войти</button>',
        );
        $('#enter').onclick = () => auth(false, lastCatalog);
        return;
    }
    const params = Object.fromEntries(p),
        deal = params.deal_type || '';
    if ($('#filter')?.dataset.list !== listPath) {
        main.innerHTML = `
            ${favoritesOnly ? '<h1 class="page-title section">Избранное</h1>' : `<section class="hero">
                <div class="hero-copy">
                    <span class="location">${ic('pin')} Москва и область</span>
                    <h1>Каталог<br><em>недвижимости</em></h1>
                </div>
            </section>`}
            <form class="filter-panel" id="filter" data-list="${listPath}">
                <div class="tabs" aria-label="Вид сделки">
                    ${
                        Object.entries({
                            '': 'Все объекты',
                            sale: 'Купить',
                            rent: 'Снять',
                        })
                            .map(([v, n]) => `
                                <button class="pill ${deal === v ? 'current' : ''}" type="button" data-deal="${v}" aria-pressed="${deal === v}">${n}</button>
                            `)
                            .join('')
                    }
                </div>
                <div class="fields">
                    ${field('q', 'Поиск', `
                        <span class="input-icon">${ic('search')}<input name="q" placeholder="Название или адрес" maxlength="255" value="${esc(params.q)}"></span>
                    `)}
                    ${
                        sel(
                            'property_type',
                            'Тип недвижимости',
                            { '': 'Все типы', ...types },
                            params.property_type,
                        )
                    }
                    <div class="field">
                        <span>Цена, ₽</span>
                        <div class="range">
                            <input name="min" aria-label="Цена от" placeholder="От" inputmode="decimal" value="${esc(params.min)}">
                            <span>–</span>
                            <input name="max" aria-label="Цена до" placeholder="До" inputmode="decimal" value="${esc(params.max)}">
                        </div>
                    </div>
                    ${button(ic('search') + ' Найти')}
                </div>
                ${formError}
            </form>
            <section aria-label="Результаты поиска">
                <div class="heading">
                    <h2>${favoritesOnly ? 'Сохранённые объекты' : 'Предложения'}<span class="count" id="total">…</span></h2>
                    <label class="sortwrap">
                        ${ic('sort')}
                        <select class="sort" aria-label="Сортировка">${
                            opts(
                                {
                                    new: 'Сначала новые',
                                    cheap: 'Сначала дешевле',
                                    expensive: 'Сначала дороже',
                                    area: 'По площади',
                                },
                                params.sort || 'new',
                            )
                        }</select>
                    </label>
                </div>
                <div id="results" aria-live="polite">
                    <p class="muted">Загрузка объектов…</p>
                </div>
            </section>
        `;
    }
    const f = $('#filter');
    for (const key of ['q', 'property_type', 'min', 'max']) {
        f.elements[key].value = params[key] ?? '';
    }
    $('.sort').value = params.sort || 'new';
    $('.err', f).textContent = '';
    for (const tab of f.querySelectorAll('[data-deal]')) {
        const selected = tab.dataset.deal === deal;
        tab.classList.toggle('current', selected);
        tab.setAttribute('aria-pressed', String(selected));
    }
    const valid = prepareChecks(f);
    f.noValidate = true;
    const search = (extra = {}) => {
        if (!valid()) {
            return;
        }
        const d = {
            ...Object.fromEntries(new FormData(f)),
            deal_type: deal,
            sort: $('.sort').value,
            ...extra,
        };
        const q = new URLSearchParams(
            Object.entries(d).filter(([k, v]) => v && !(k === 'sort' && v === 'new')),
        ).toString();
        go(listPath + (q ? '?' + q : ''));
    };
    f.onsubmit = (e) => {
        e.preventDefault();
        search();
    };
    f.querySelectorAll('[data-deal]').forEach(
        (b) => (b.onclick = () => search({ deal_type: b.dataset.deal })),
    );
    $('.sort').onchange = () => search();
    let list;
    try {
        list = await api('catalog', { ...params, favorites: favoritesOnly ? '1' : '0' });
    } catch (e) {
        if (epoch !== routeVersion) {
            return;
        }
        $('.err', f).textContent = e.message;
        $('#results').innerHTML = '';
        $('#total').textContent = '—';
        return;
    }
    if (epoch !== routeVersion) {
        return;
    }
    $('#total').textContent = list.total;
    const results = $('#results');
    const filtered = ['q', 'deal_type', 'property_type', 'min', 'max'].some((key) => params[key]);
    if (list.total) {
        results.innerHTML = `<div class="cards">${list.rows.map(card).join('')}</div>`;
    } else if (favoritesOnly && !filtered) {
        results.innerHTML = empty(
            'В избранном пока пусто',
            '<p>Нажмите сердечко на понравившемся объекте.</p><a class="btn" href="#catalog">Перейти в каталог</a>',
        );
    } else {
        results.innerHTML = empty(
            'Объектов по этим условиям нет',
            `<p class="muted">Измените диапазон цен или тип недвижимости.</p><a class="btn" href="${listPath}">Сбросить фильтры</a>`,
        );
    }
    if (list.pages > 1) {
        const indices = [...new Set([1, list.page - 1, list.page, list.page + 1, list.pages])]
            .filter((i) => i >= 1 && i <= list.pages)
            .sort((a, b) => a - b);
        $('#results').insertAdjacentHTML(
            'beforeend',
            '<nav class="pagination" aria-label="Страницы каталога">' +
                indices
                    .map(
                        (i, n) =>
                            (n && i > indices[n - 1] + 1 ? '…' : '') +
                            `<button class="pill ${i === list.page ? 'current' : ''}" data-page="${i}">${i}</button>`,
                    )
                    .join('') +
                '</nav>',
        );
        main.querySelectorAll('[data-page]').forEach(
            (b) => (b.onclick = () => search({ page_no: b.dataset.page })),
        );
    }
}

async function application(id) {
    const task = await api('challenge');
    dialog(
        'Заявка на просмотр',
        `
            <form id="application" class="stack">
                ${
                    input(
                        'phone',
                        'Телефон',
                        '',
                        'type="tel" autocomplete="tel" maxlength="30" required placeholder="+7 (___) ___-__-__"',
                    )
                }
                ${areaField('comment', 'Комментарий (по желанию)', '', 2000)}
                <span class="verify">Проверка · <b id="sum">${esc(task.question)}</b> = ?</span>
                ${
                    input(
                        'answer',
                        'Ответ',
                        '',
                        'inputmode="numeric" pattern="[0-9]+" required maxlength="5"',
                    )
                }
                ${formError}
                ${button('Отправить заявку')}
            </form>
        `,
    );
    let token = task.token;
    bindForm($('#application'), async (data) => {
        data.set('token', token);
        data.set('id', id);
        try {
            await api('apply', {}, data);
        } catch (e) {
            const refreshed = await api('challenge');
            token = refreshed.token;
            $('#sum').textContent = refreshed.question;
            $('#application [name=answer]').value = '';
            throw e;
        }
        modal.close();
        notify('Заявка отправлена агенту.');
        deskTab = '';
        go('#desk');
    });
}

async function detail(id, epoch) {
    const o = await api('detail', { id });
    if (epoch !== routeVersion) {
        return;
    }
    const u = session.user,
        staff =
            (u?.role === 'agent' && u.id == o.agent_id) ||
            (u?.role === 'moderator' && o.status_id == 1);
    const backToDesk = staff && !main.dataset.fromFavorites;
    const backLabel = backToDesk ? 'В кабинет' : main.dataset.fromFavorites ? 'В избранное' : 'К результатам поиска';
    main.innerHTML = `
        <a class="back" href="${esc(backToDesk ? '#desk' : lastCatalog)}">
            ${ic('left')}${backLabel}
        </a>
        <span class="tag">${types[o.property_type]} · ${deals[o.deal_type]}</span>
        <h1 class="page-title">${esc(o.title)}</h1>
        <div class="address">
            ${ic('pin')}
            ${esc(o.address)}
        </div>
        <div class="detail-grid">
            <div>
                <div class="gallery">
                    ${
                        o.photos.length
                            ? `<img id="bigphoto" src="${photoURL(o.photos[0])}" alt="${esc(o.title)}">`
                            : '<span class="emptyphoto">Фотографий пока нет</span>'
                    }
                </div>
                ${o.photos.length > 1 ? `
                    <div class="gallery-controls">
                        <button class="iconbtn" id="prev" aria-label="Предыдущее фото">${ic('left')}</button>
                        <span id="index">1 / ${o.photos.length}</span>
                        <button class="iconbtn" id="next" aria-label="Следующее фото">${ic('right')}</button>
                    </div>
                ` : ''}
                <section class="section">
                    <h2>Описание</h2>
                    <p class="flow">${esc(o.description)}</p>
                </section>
            </div>
            <aside class="panel">
                <div class="bigprice price">
                    ${price(o)}
                </div>
                <div class="meta">
                    <span>${ic('size')}${num(o.area)} м²</span>
                    ${o.rooms !== null ? `<span>${ic('rooms')}${+o.rooms === 0 ? 'Студия' : esc(o.rooms) + ' комн.'}</span>` : ''}
                </div>
                <hr>
                <p class="muted">Ответственный агент<br><strong>${esc(o.agent)}</strong></p>
                <div id="detail-actions" class="stack"></div>
            </aside>
        </div>
    `;
    let n = 0;
    const slide = (d) => {
        n = (n + d + o.photos.length) % o.photos.length;
        $('#bigphoto').src = photoURL(o.photos[n]);
        $('#index').textContent = n + 1 + ' / ' + o.photos.length;
    };
    if ($('#prev')) {
        $('#prev').onclick = () => slide(-1);
        $('#next').onclick = () => slide(1);
    }
    const box = $('#detail-actions');
    if (o.status_id == 2 && (!u || u.role === 'client')) {
        box.innerHTML = button('Оставить заявку');
        $('button', box).onclick = async () => {
            try {
                if (!u) {
                    auth(false, '#object/' + id);
                } else {
                    await application(id);
                }
            } catch (e) {
                notify(e.message);
            }
        };
    }
    if (staff && u.role === 'agent') {
        box.innerHTML = `<a class="btn primary" href="#edit/${id}">Редактировать</a>`;
    }
    if (staff && u.role === 'moderator') {
        box.innerHTML =
            '<p class="muted">На проверке · версия ' +
            o.version +
            '</p><button class="btn primary" id="publish">Опубликовать</button><button class="btn" id="reject">Отклонить</button>';
        $('#publish').onclick = () => decision(o, true);
        $('#reject').onclick = () => decision(o, false);
    }
    if (o.status_id == 2) {
        box.insertAdjacentHTML('beforeend', favoriteButton(o));
    }
}

async function route() {
    const epoch = ++routeVersion;
    if (modal.open) {
        modal.close();
    }
    const [path, query = ''] = (location.hash.slice(1) || 'catalog').split('?');
    const [name, id] = path.split('/');
    if (main.dataset.route !== path) {
        if (name === 'object' && main.dataset.route === 'favorites') {
            main.dataset.fromFavorites = '1';
        } else {
            delete main.dataset.fromFavorites;
        }
        main.dataset.route = path;
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    $('#catalog-link').classList.toggle('active', name === 'catalog' || (name === 'object' && !main.dataset.fromFavorites));
    $('#desk-link').classList.toggle('active', name === 'desk' || name === 'edit');
    $('#favorites-link').classList.toggle('active', name === 'favorites' || !!main.dataset.fromFavorites);
    try {
        if (name === 'catalog' || name === 'favorites') {
            await catalog(new URLSearchParams(query), epoch, name === 'favorites');
        } else if (name === 'object') {
            await detail(id, epoch);
        } else if (name === 'desk' || name === 'edit') {
            if (!session.user) {
                main.innerHTML = empty(
                    'Личный кабинет',
                    '<button class="btn" id="enter">Войти</button>',
                );
                $('#enter').onclick = () => auth(false, location.hash);
                auth(false, location.hash);
                return;
            }
            if (name === 'desk') {
                await desk(epoch);
            } else {
                await editor(id, epoch);
            }
        } else {
            go('#catalog');
        }
    } catch (e) {
        if (epoch === routeVersion) {
            main.innerHTML = empty(e.message, '<a class="btn" href="#catalog">В каталог</a>');
        }
    }
}

async function boot() {
    try {
        session = await api('session');
        account();
        window.addEventListener('hashchange', route);
        await route();
    } catch (e) {
        main.innerHTML = empty(e.message);
    }
}
window.addEventListener('DOMContentLoaded', boot);
