import { login, signup, logout, getUser, updateUser, requestPasswordRecovery, handleAuthCallback, acceptInvite, MissingIdentityError, onAuthChange } from '@netlify/identity';
import { videoSource } from './video.ts';

const select = selector => document.querySelector(selector);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function status(selector, message, tone = '') {
  const node = select(selector);
  if (!node) return;
  node.textContent = message;
  node.className = `status ${tone}`;
}

function errorMessage(error) {
  if (error instanceof MissingIdentityError) return 'Accounts are not available yet. Please contact the church or try again after deployment.';
  if (error?.status === 401 || error?.status === 400) return 'Unable to sign in. Check your details and confirm your email if you have just registered.';
  return error?.message || 'Something went wrong. Please try again.';
}

async function api(endpoint, options = {}) {
  await getUser();
  const response = await fetch(`/.netlify/functions/${endpoint}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error('This feature is temporarily unavailable. Please try again later.'); }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

async function busy(form, action) {
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Please wait…';
  try { await action(); } finally { button.disabled = false; button.textContent = label; }
}

function actionButton(label, action, className = 'text-button') {
  const button = element('button', label, className);
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await action(); } catch (error) { status('#admin-status', error.message, 'error'); }
    finally { button.disabled = false; }
  });
  return button;
}

async function navigation() {
  const links = select('.nav-links');
  if (!links) return;
  const user = await getUser();
  let account = links.querySelector('a[href="account.html"]');
  if (!account) {
    account = element('a', '', 'account-nav');
    account.href = 'account.html';
    links.append(account);
  }
  account.textContent = user ? 'Your account' : 'Log in / Register';
  if (user?.roles?.includes('admin') && !links.querySelector('a[href="admin.html"]')) {
    const adminLink = element('a', 'Admin');
    adminLink.href = 'admin.html';
    links.append(adminLink);
  }
  let menu = select('.menu');
  if (!menu) {
    menu = element('button', '☰', 'menu');
    menu.type = 'button';
    menu.setAttribute('aria-label', 'Toggle navigation');
    menu.setAttribute('aria-expanded', 'false');
    links.before(menu);
  }
  if (!document.querySelector('script[src="script.js"]')) {
    menu.addEventListener('click', () => {
      const opened = links.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(opened));
    });
  }
}

async function accountPage(callback) {
  const form = select('#auth-form');
  if (!form) return;
  let mode = 'login';
  let inviteToken = callback?.type === 'invite' ? callback.token : null;

  function setMode(value) {
    mode = value;
    const passwordMode = !['recovery'].includes(mode);
    const emailMode = !['reset', 'invite'].includes(mode);
    select('#auth-panel').hidden = false;
    select('#member-panel').hidden = true;
    select('#name-field').hidden = mode !== 'signup';
    form.elements.name.disabled = mode !== 'signup';
    form.elements.name.required = mode === 'signup';
    select('#email-field').hidden = !emailMode;
    form.elements.email.disabled = !emailMode;
    select('#password-field').hidden = !passwordMode;
    form.elements.password.disabled = !passwordMode;
    form.elements.password.minLength = mode === 'login' ? 1 : 10;
    form.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    form.elements.password.value = '';
    select('#password-help').hidden = !['signup', 'reset', 'invite'].includes(mode);
    select('#forgot-password').hidden = mode !== 'login';
    select('.tab-row').hidden = ['reset', 'invite'].includes(mode);
    const titles = { login: 'Welcome back', signup: 'Join the church family', recovery: 'Reset your password', reset: 'Choose a new password', invite: 'Accept your invitation' };
    const labels = { login: 'Log in', signup: 'Create account', recovery: 'Send reset link', reset: 'Save password', invite: 'Set password & join' };
    select('#auth-title').textContent = titles[mode];
    select('#auth-submit').textContent = labels[mode];
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.classList.toggle('selected', button.dataset.authMode === mode);
      button.setAttribute('aria-pressed', String(button.dataset.authMode === mode));
    });
  }

  async function showMember(user) {
    select('#auth-panel').hidden = true;
    select('#member-panel').hidden = false;
    select('#member-greeting').textContent = user.name ? `Welcome, ${user.name}` : 'Welcome to the family';
    select('#member-email').textContent = user.email || '';
    select('#profile-form').elements.name.value = user.name || '';
    select('#admin-link').hidden = !user.roles?.includes('admin');
    await navigation();
  }

  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => { setMode(button.dataset.authMode); status('#account-status', ''); }));
  select('#forgot-password').addEventListener('click', () => { setMode('recovery'); status('#account-status', 'Enter your email to receive a password reset link.'); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    busy(form, async () => {
      try {
        status('#account-status', '');
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        if (mode === 'recovery') {
          await requestPasswordRecovery(email);
          status('#account-status', 'If an account exists for this address, check your email for a password reset link.', 'success');
        } else if (mode === 'signup') {
          const user = await signup(email, password, { full_name: form.elements.name.value.trim() });
          form.elements.password.value = '';
          if (user.confirmedAt) {
            await showMember(user);
            status('#account-status', 'Your account is ready.', 'success');
          } else {
            status('#account-status', 'Check your email and confirm your account before logging in.', 'success');
          }
        } else if (mode === 'reset') {
          const user = await updateUser({ password });
          form.elements.password.value = '';
          await showMember(user);
          status('#account-status', 'Your password has been updated.', 'success');
        } else if (mode === 'invite') {
          const user = await acceptInvite(inviteToken, password);
          inviteToken = null;
          form.elements.password.value = '';
          await showMember(user);
          status('#account-status', 'Invitation accepted. Welcome!', 'success');
        } else {
          const user = await login(email, password);
          form.elements.password.value = '';
          await showMember(user);
          status('#account-status', 'You are logged in.', 'success');
        }
      } catch (error) { status('#account-status', errorMessage(error), 'error'); }
    });
  });
  select('#logout').addEventListener('click', async () => {
    try { await logout(); location.assign('account.html'); } catch (error) { status('#account-status', errorMessage(error), 'error'); }
  });
  select('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    busy(event.currentTarget, async () => {
      try {
        const user = await updateUser({ data: { full_name: select('#profile-form').elements.name.value.trim() } });
        await showMember(user);
        status('#account-status', 'Your name has been updated.', 'success');
      } catch (error) { status('#account-status', errorMessage(error), 'error'); }
    });
  });
  if (callback?.type === 'recovery') { setMode('reset'); status('#account-status', 'Choose a new password for your account.'); }
  else if (callback?.type === 'invite') { setMode('invite'); status('#account-status', 'Choose a password to accept your church invitation.'); }
  else {
    const user = await getUser();
    if (user) await showMember(user); else setMode('login');
    status('#account-status', callback?.type === 'confirmation' ? 'Your email is confirmed. Welcome!' : '');
  }
}

function renderVideo(item) {
  const source = videoSource(item.url);
  const card = element('article', undefined, 'video-card');
  card.dataset.platform = source.platform;
  const preview = element('div', undefined, 'video-preview');
  preview.append(element('strong', `${source.platform} · ${item.title}`), element('p', `Loading this video connects to ${source.platform}, which may use cookies.`, 'field-help'));
  const load = element('button', 'Load video', 'button button-gold');
  load.type = 'button';
  load.addEventListener('click', () => {
    const frame = element('iframe');
    frame.src = source.embed;
    frame.title = `${item.title} — ${source.platform}`;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    preview.replaceWith(frame);
  });
  preview.append(load);
  const details = element('div', undefined, 'video-card-body');
  details.append(element('span', source.platform, 'badge'), element('h3', item.title));
  if (item.description) details.append(element('p', item.description));
  const link = element('a', `Watch on ${source.platform} ↗`, 'text-link');
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  details.append(link);
  card.append(preview, details);
  return card;
}

async function publicContent() {
  const pathname = location.pathname;
  const kind = pathname.endsWith('online.html') || pathname === '/online' ? 'video' : pathname.endsWith('sermons.html') || pathname === '/sermons' ? 'sermon' : pathname.endsWith('events.html') || pathname === '/events' ? 'event' : null;
  if (!kind) return;
  const section = element('section', undefined, 'public-content');
  const container = element('div', undefined, 'container');
  container.append(element('div', 'From our church family', 'kicker'), element('h2', { video: 'Services & social videos', sermon: 'Latest sermons', event: 'Special gatherings' }[kind]));
  const message = element('p', 'Loading church updates…', 'status');
  message.setAttribute('role', 'status');
  container.append(message);
  const list = element('div', undefined, kind === 'event' ? 'event-list' : 'video-library');
  container.append(list);
  section.append(container);
  const hero = select('.page-hero');
  hero.after(section);
  try {
    const { items } = await api(`content?kind=${kind}`);
    if (!items.length) {
      message.textContent = { video: 'New services and social videos appear here when the church publishes them.', sermon: 'Sermons appear here when the church publishes a message.', event: 'No special events have been published yet. Our regular gatherings are listed below.' }[kind];
      message.className = 'empty-state';
      return;
    }
    message.remove();
    if (kind === 'event') items.sort((first, second) => new Date(first.eventDate) - new Date(second.eventDate));
    for (const item of items) {
      if (kind !== 'event') { list.append(renderVideo(item)); continue; }
      const article = element('article', undefined, 'event');
      const date = element('div', new Date(item.eventDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), 'date');
      const details = element('div');
      details.append(element('h3', item.title), element('p', item.description));
      if (item.location) details.append(element('strong', item.location));
      article.append(date, details);
      list.append(article);
    }
  } catch {
    message.textContent = 'Church updates are unavailable right now. Please try again later or contact the church.';
    message.className = 'status error';
  }
}

async function administration() {
  const workspace = select('#admin-workspace');
  if (!workspace) return;
  const currentUser = await getUser();
  if (!currentUser?.roles?.includes('admin')) {
    select('#admin-denied').hidden = false;
    status('#admin-status', '');
    return;
  }
  const form = select('#content-form');
  let items = [];
  let page = 1;

  function fields() {
    const isEvent = form.elements.kind.value === 'event';
    select('#event-fields').hidden = !isEvent;
    select('#video-url-field').hidden = isEvent;
    form.elements.url.required = !isEvent;
    form.elements.url.disabled = isEvent;
    form.elements.eventDate.required = isEvent;
    form.elements.eventDate.disabled = !isEvent;
  }

  function resetEditor() {
    form.reset();
    form.elements.id.value = '';
    select('#editor-title').textContent = 'Publish an update';
    select('#content-save').textContent = 'Publish update';
    select('#cancel-edit').hidden = true;
    fields();
  }

  function edit(item) {
    for (const key of ['id', 'kind', 'title', 'description', 'url', 'location']) form.elements[key].value = item[key] || '';
    form.elements.published.checked = item.published;
    if (item.eventDate) {
      const date = new Date(item.eventDate);
      form.elements.eventDate.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } else form.elements.eventDate.value = '';
    fields();
    select('#editor-title').textContent = 'Edit church content';
    select('#content-save').textContent = 'Save changes';
    select('#cancel-edit').hidden = false;
    form.elements.title.focus();
    form.scrollIntoView({ block: 'center' });
  }

  function renderItems() {
    const list = select('#admin-content');
    list.replaceChildren();
    const filter = select('#content-filter').value;
    const filtered = items.filter(item => filter === 'all' || item.kind === filter);
    if (!filtered.length) list.append(element('p', 'No content here yet. Add a video, sermon, or event using the editor.', 'empty-state'));
    for (const item of filtered) {
      const card = element('article', undefined, 'management-item');
      card.append(element('span', item.kind, 'badge'), element('span', item.published ? 'Published' : 'Draft', `badge ${item.published ? '' : 'draft'}`), element('h3', item.title), element('p', item.description));
      if (item.eventDate) card.append(element('p', new Date(item.eventDate).toLocaleString()));
      const actions = element('div', undefined, 'item-actions');
      actions.append(actionButton('Edit', () => edit(item)), actionButton('Delete', async () => {
        if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
        await api('content', { method: 'DELETE', body: JSON.stringify({ id: item.id }) });
        if (form.elements.id.value === item.id) resetEditor();
        await loadItems();
        status('#admin-status', 'Content deleted.', 'success');
      }, 'text-button danger'));
      card.append(actions);
      list.append(card);
    }
  }

  async function loadItems() {
    select('#admin-content').replaceChildren(element('p', 'Loading your church library…', 'status'));
    const data = await api('content?manage=true');
    items = data.items;
    renderItems();
  }

  async function loadUsers() {
    const list = select('#user-list');
    list.replaceChildren(element('p', 'Loading user accounts…', 'status'));
    try {
      const data = await api(`users?page=${page}`);
      list.replaceChildren();
      select('#users-previous').disabled = page === 1;
      select('#users-next').disabled = !data.hasMore;
      select('#users-page').textContent = `Page ${page}`;
      if (!data.users.length) list.append(element('p', 'No user accounts on this page.', 'empty-state'));
      for (const user of data.users) {
        const card = element('article', undefined, 'management-item');
        const isAdmin = user.roles.includes('admin');
        card.append(element('span', isAdmin ? 'Administrator' : 'Member', 'badge'), element('h3', user.name || user.email || 'Church member'), element('p', user.email || ''), element('p', user.confirmedAt ? 'Email confirmed' : 'Awaiting email confirmation', 'field-help'));
        if (user.id !== currentUser.id) {
          const actions = element('div', undefined, 'item-actions');
          actions.append(actionButton(isAdmin ? 'Remove admin role' : 'Make administrator', async () => {
            if (!window.confirm(`${isAdmin ? 'Remove administrator access from' : 'Grant full administrator access to'} ${user.email || 'this user'}?`)) return;
            await api('users', { method: 'PATCH', body: JSON.stringify({ id: user.id, isAdmin: !isAdmin }) });
            await loadUsers();
            status('#admin-status', 'User role updated. The user should log out and back in to refresh their navigation.', 'success');
          }), actionButton('Delete account', async () => {
            if (!window.confirm(`Permanently delete ${user.email || 'this user account'}?`)) return;
            await api('users', { method: 'DELETE', body: JSON.stringify({ id: user.id }) });
            await loadUsers();
            status('#admin-status', 'User account deleted.', 'success');
          }, 'text-button danger'));
          card.append(actions);
        } else card.append(element('p', 'Your account · managed from Your account', 'field-help'));
        list.append(card);
      }
    } catch (error) {
      list.replaceChildren(element('p', error.message, 'status error'));
      status('#admin-status', error.message, 'error');
    }
  }

  form.elements.kind.addEventListener('change', fields);
  select('#cancel-edit').addEventListener('click', resetEditor);
  select('#content-filter').addEventListener('change', renderItems);
  form.addEventListener('submit', event => {
    event.preventDefault();
    busy(form, async () => {
      try {
        const payload = Object.fromEntries(new FormData(form));
        payload.published = form.elements.published.checked;
        payload.eventDate = form.elements.eventDate.value ? new Date(form.elements.eventDate.value).toISOString() : '';
        if (payload.kind !== 'event') videoSource(payload.url);
        await api('content', { method: payload.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        await loadItems();
        status('#admin-status', payload.published ? 'Saved and published on the website.' : 'Saved as a private draft.', 'success');
      } catch (error) { status('#admin-status', error.message, 'error'); return; }
      resetEditor();
    }).then(() => { select('#content-save').textContent = form.elements.id.value ? 'Save changes' : 'Publish update'; });
  });
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', async () => {
    const users = button.dataset.adminTab === 'users';
    select('#content-panel').hidden = users;
    select('#users-panel').hidden = !users;
    document.querySelectorAll('[data-admin-tab]').forEach(tab => { tab.classList.toggle('selected', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
    if (users) await loadUsers();
  }));
  select('#refresh-users').addEventListener('click', loadUsers);
  select('#users-previous').addEventListener('click', () => { page = Math.max(1, page - 1); loadUsers(); });
  select('#users-next').addEventListener('click', () => { page += 1; loadUsers(); });
  fields();
  try {
    await loadItems();
    workspace.hidden = false;
    status('#admin-status', 'Signed in as an administrator.', 'success');
  } catch (error) { status('#admin-status', `${error.message} Reload this page to retry.`, 'error'); }
}

async function start() {
  const hasCallback = /(?:^#|&)(?:confirmation_token|recovery_token|invite_token|access_token|email_change_token)=/.test(location.hash);
  if (hasCallback && !select('#auth-form')) {
    location.replace(`/account.html${location.hash}`);
    return;
  }
  let callback;
  let callbackError;
  try { callback = await handleAuthCallback(); } catch (error) { callbackError = error; }
  await navigation();
  await accountPage(callback);
  if (callbackError) status('#account-status', 'This account link is invalid or expired. Request a new link or contact the church.', 'error');
  await Promise.all([publicContent(), administration()]);
  onAuthChange(event => {
    if (event === 'logout' && select('#admin-workspace')) {
      select('#admin-workspace').hidden = true;
      select('#admin-denied').hidden = false;
      status('#admin-status', 'Your session ended. Log in again to continue.');
    }
  });
}

start().catch(() => {
  status('#account-status', 'Accounts are temporarily unavailable. Please reload or contact the church.', 'error');
  status('#admin-status', 'Administration is temporarily unavailable. Please reload to try again.', 'error');
});
