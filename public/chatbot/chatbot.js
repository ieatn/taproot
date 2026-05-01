const DEFAULT_LABELS = {
  title: 'Questions?',
  kicker: 'Ask our assistant',
  placeholder: 'Message…',
  send: 'Send',
  opener: 'Hi — how can we help today?',
};

function readConfig() {
  const el = document.getElementById('chatbot-site-config');
  if (!el) return { siteId: '', labels: DEFAULT_LABELS };
  try {
    const parsed = JSON.parse(el.textContent || '{}');
    return {
      siteId: typeof parsed.siteId === 'string' ? parsed.siteId.trim() : '',
      labels: { ...DEFAULT_LABELS, ...(parsed.labels || {}) },
    };
  } catch {
    return { siteId: '', labels: DEFAULT_LABELS };
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function appendBubble(container, role, text) {
  const cls = role === 'user' ? 'user' : 'bot';
  container.appendChild(el('div', `site-chatbot-msg ${cls}`, text));
}

function scrollBottom(box) {
  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight;
  });
}

async function postChat(siteId, messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Could not reach assistant (${res.status}).`);
  }
  if (!data.reply || typeof data.reply !== 'string') {
    throw new Error('Unexpected response from assistant.');
  }
  return data.reply.trim();
}

function mount() {
  const { siteId, labels } = readConfig();
  if (!siteId) return;

  const messages = [];

  const fab = el('button', 'site-chatbot-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C7.03 3 3 6.58 3 11c0 2.13 1.17 4.05 3 5.35V21l4.09-2.18c.93.27 1.91.41 2.91.41 4.97 0 9-3.58 9-8s-4.03-8-9-8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const panel = el('aside', 'site-chatbot-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', labels.title);

  const head = el('div', 'site-chatbot-head');
  const headText = el('div', '');
  headText.appendChild(el('div', 'site-chatbot-title', labels.title));
  headText.appendChild(el('div', 'site-chatbot-sub', labels.kicker));
  const closeBtn = el('button', 'site-chatbot-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close chat');
  head.appendChild(headText);
  head.appendChild(closeBtn);

  const msgs = el('div', 'site-chatbot-msgs');
  const botIntro = el('div', 'site-chatbot-msg bot', labels.opener);
  msgs.appendChild(botIntro);

  const row = el('div', 'site-chatbot-row');
  const input = el('input', 'site-chatbot-input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = labels.placeholder;

  const send = el('button', 'site-chatbot-send', labels.send);
  send.type = 'button';

  row.appendChild(input);
  row.appendChild(send);

  panel.appendChild(head);
  panel.appendChild(msgs);
  panel.appendChild(row);

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  let open = false;
  let scrollLockActive = false;
  let savedScrollY = 0;

  function mobileSheetMq() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches;
  }

  function applyMobileScrollLock() {
    if (scrollLockActive || !mobileSheetMq()) return;
    scrollLockActive = true;
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('site-chatbot-scroll-lock');
    Object.assign(document.body.style, {
      position: 'fixed',
      top: `-${savedScrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
      overflow: 'hidden',
    });
  }

  function releaseMobileScrollLock() {
    if (!scrollLockActive) return;
    scrollLockActive = false;
    document.documentElement.classList.remove('site-chatbot-scroll-lock');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
  }

  function setOpen(v) {
    open = v;
    panel.classList.toggle('open', open);
    fab.style.visibility = open ? 'hidden' : 'visible';
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-modal', open ? 'true' : 'false');

    if (open) {
      if (mobileSheetMq()) {
        applyMobileScrollLock();
        input.blur();
      } else {
        releaseMobileScrollLock();
        input.focus();
      }
    } else {
      releaseMobileScrollLock();
      input.blur();
      fab.focus();
    }
  }

  fab.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));

  window.addEventListener('resize', () => {
    if (!open) {
      releaseMobileScrollLock();
      return;
    }
    if (mobileSheetMq()) {
      applyMobileScrollLock();
    } else {
      releaseMobileScrollLock();
      input.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  function pushUser(text) {
    messages.push({ role: 'user', content: text });
    appendBubble(msgs, 'user', text);
    scrollBottom(msgs);
  }

  function pushAssistant(text) {
    messages.push({ role: 'assistant', content: text });
    appendBubble(msgs, 'assistant', text);
    scrollBottom(msgs);
  }

  function pushErr(text) {
    msgs.appendChild(el('div', 'site-chatbot-msg err', text));
    scrollBottom(msgs);
  }

  function setTyping(on) {
    let typing = msgs.querySelector('.site-chatbot-typing-wrap');
    if (on) {
      if (typing) return;
      typing = el('div', 'site-chatbot-msg bot site-chatbot-typing-wrap');
      typing.innerHTML =
        '<span class="site-chatbot-typing"><span></span><span></span><span></span></span>';
      msgs.appendChild(typing);
      scrollBottom(msgs);
    } else if (typing) {
      typing.remove();
    }
  }

  let busy = false;

  async function submit() {
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    pushUser(text);
    busy = true;
    send.disabled = true;
    input.disabled = true;
    setTyping(true);
    try {
      const reply = await postChat(siteId, messages);
      setTyping(false);
      pushAssistant(reply);
    } catch (err) {
      setTyping(false);
      pushErr(err.message || 'Something went wrong.');
    } finally {
      busy = false;
      send.disabled = false;
      input.disabled = false;
      if (!mobileSheetMq()) {
        input.focus();
      } else {
        input.blur();
      }
    }
  }

  send.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
