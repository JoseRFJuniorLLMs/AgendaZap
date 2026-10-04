(() => {
  const shell = document.getElementById('appShell');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');
  const pageTitle = document.getElementById('pageTitle');
  const navItems = [...document.querySelectorAll('[data-view]')];
  const views = [...document.querySelectorAll('.view')];
  const modal = document.getElementById('actionModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalForm = document.getElementById('modalForm');
  const modalPlan = document.getElementById('modalPlan');
  const toast = document.getElementById('toast');
  const mobileMore = document.querySelector('[data-action="mobile-more"]');
  const mobileMoreMenu = document.getElementById('mobileMoreMenu');
  const voiceModeInputs = [...document.querySelectorAll('input[name="voiceMode"]')];
  const voiceApiStatus = document.getElementById('voiceApiStatus');
  const voiceVocabularySummary = document.getElementById('voiceVocabularySummary');
  const voiceTestFile = document.getElementById('voiceTestFile');
  const voiceTestResult = document.getElementById('voiceTestResult');
  const voiceTestPlayer = document.getElementById('voiceTestPlayer');
  const voiceUsageRequests = document.getElementById('voiceUsageRequests');
  const voiceUsageErrors = document.getElementById('voiceUsageErrors');
  const voiceUsageChars = document.getElementById('voiceUsageChars');
  const DEMO_TENANT = 'demo';

  const routes = {
    dashboard: '/',
    agenda: '/agenda',
    clientes: '/clientes',
    automacoes: '/automacoes',
    financeiro: '/financeiro',
    planos: '/planos'
  };

  const titles = {
    dashboard: 'Visão geral',
    agenda: 'Agenda',
    clientes: 'Clientes',
    automacoes: 'Automações',
    financeiro: 'Financeiro',
    planos: 'Planos'
  };

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function syncSidebarA11y(collapsed) {
    if (!sidebarToggle) return;
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    sidebarToggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  }

  const savedSidebar = localStorage.getItem('agendazap-sidebar');
  const initiallyCollapsed = savedSidebar === 'collapsed';
  shell?.classList.toggle('sidebar-collapsed', initiallyCollapsed);
  syncSidebarA11y(initiallyCollapsed);

  sidebarToggle?.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('agendazap-sidebar', collapsed ? 'collapsed' : 'expanded');
    syncSidebarA11y(collapsed);
    if (sidebarToggleIcon) sidebarToggleIcon.textContent = '‹';
  });

  const preferredTheme = document.documentElement.dataset.theme ||
    localStorage.getItem('agendazap-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    if (themeIcon) themeIcon.textContent = dark ? '☀' : '☾';
    if (themeLabel) themeLabel.textContent = dark ? 'Claro' : 'Escuro';
    localStorage.setItem('agendazap-theme', theme);
  }

  applyTheme(preferredTheme);

  themeToggle?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  function viewFromPath(pathname) {
    const clean = pathname.replace(/\/$/, '') || '/';
    return Object.entries(routes).find(([, route]) => route === clean)?.[0] || 'dashboard';
  }

  function renderView(name, push = false) {
    const safeName = routes[name] ? name : 'dashboard';
    navItems.forEach(item => {
      const active = item.dataset.view === safeName;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
    views.forEach(view => view.classList.toggle('active', view.id === `view-${safeName}`));
    if (pageTitle) pageTitle.textContent = titles[safeName] || 'AgendaZap';
    document.title = `${titles[safeName] || 'AgendaZap'} • AgendaZap`;
    if (push && location.pathname !== routes[safeName]) {
      history.pushState({ view: safeName }, '', routes[safeName]);
    }
  }

  navItems.forEach(item => item.addEventListener('click', () => {
    renderView(item.dataset.view, true);
    if (mobileMoreMenu) mobileMoreMenu.hidden = true;
  }));

  mobileMore?.addEventListener('click', () => {
    if (!mobileMoreMenu) return;
    mobileMoreMenu.hidden = !mobileMoreMenu.hidden;
  });

  document.addEventListener('click', event => {
    if (!mobileMoreMenu || mobileMoreMenu.hidden) return;
    const target = event.target;
    if (mobileMore?.contains(target) || mobileMoreMenu.contains(target)) return;
    mobileMoreMenu.hidden = true;
  });

  window.addEventListener('popstate', () => renderView(viewFromPath(location.pathname), false));
  renderView(viewFromPath(location.pathname), false);

  function openModal(kind, plan = '') {
    if (!modal || !modalForm || !modalTitle) return;
    modal.dataset.kind = kind;
    if (kind === 'lead') {
      modalTitle.textContent = 'Começar com o AgendaZap';
      modalPlan.value = plan;
      document.querySelector('[data-field="service"]')?.classList.add('hidden');
      document.querySelectorAll('[data-field="plan"]').forEach(el => el.classList.remove('hidden'));
    } else {
      modalTitle.textContent = 'Novo agendamento';
      modalPlan.value = '';
      document.querySelector('[data-field="service"]')?.classList.remove('hidden');
      document.querySelectorAll('[data-field="plan"]').forEach(el => el.classList.add('hidden'));
    }
    modal.showModal();
    modal.querySelector('input:not([type="hidden"])')?.focus();
  }

  document.querySelector('[data-action="new-appointment"]')?.addEventListener('click', () => openModal('appointment'));
  document.querySelector('[data-action="view-agenda"]')?.addEventListener('click', () => renderView('agenda', true));

  document.querySelectorAll('[data-plan]').forEach(button => {
    button.addEventListener('click', () => openModal('lead', button.dataset.plan || ''));
  });

  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => modal?.close());
  });

  modalForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(modalForm).entries());
    const key = modal?.dataset.kind === 'lead' ? 'agendazap-demo-leads' : 'agendazap-demo-appointments';
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    rows.push({ ...data, created_at: new Date().toISOString(), demo: true });
    localStorage.setItem(key, JSON.stringify(rows));
    modal.close();
    modalForm.reset();
    showToast(modal?.dataset.kind === 'lead'
      ? 'Lead salvo nesta demonstração. Integração com backend é o próximo passo.'
      : 'Agendamento salvo localmente na demonstração.');
  });

  let voiceConfigCache = null;

  async function voiceFetch(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let message = 'Falha no Voice AI';
      try {
        const body = await response.json();
        message = body.message || body.error || message;
      } catch {}
      throw new Error(message);
    }

    return response;
  }

  function applyVoiceConfig(config) {
    voiceConfigCache = config;
    const mode = config.responseMode || 'mirror_customer';
    localStorage.setItem('agendazap-voice-mode', mode);
    voiceModeInputs.forEach(input => { input.checked = input.value === mode; });

    if (voiceVocabularySummary) {
      const terms = config.customVocabulary || [];
      voiceVocabularySummary.textContent = terms.length
        ? terms.slice(0, 6).join(', ') + (terms.length > 6 ? ` +${terms.length - 6}` : '')
        : 'Nenhum termo personalizado configurado.';
    }
  }

  async function refreshVoiceUsage() {
    try {
      const response = await voiceFetch(`/api/voice/usage/${DEMO_TENANT}`);
      const usage = await response.json();
      if (voiceUsageRequests) voiceUsageRequests.textContent = String(usage.requests || 0);
      if (voiceUsageErrors) voiceUsageErrors.textContent = String(usage.errors || 0);
      if (voiceUsageChars) voiceUsageChars.textContent = String(usage.ttsCharacters || 0);
    } catch {}
  }

  async function initVoiceApi() {
    const fallbackMode = localStorage.getItem('agendazap-voice-mode') || 'mirror_customer';
    voiceModeInputs.forEach(input => { input.checked = input.value === fallbackMode; });

    try {
      const healthResponse = await voiceFetch('/api/voice/health');
      const health = await healthResponse.json();
      if (voiceApiStatus) {
        voiceApiStatus.textContent = health.configured ? 'Gemini conectado' : 'Gemini sem chave';
        voiceApiStatus.className = health.configured ? 'status confirmed' : 'status waiting';
      }

      const configResponse = await voiceFetch(`/api/voice/config/${DEMO_TENANT}`);
      applyVoiceConfig(await configResponse.json());
      await refreshVoiceUsage();
    } catch (error) {
      if (voiceApiStatus) {
        voiceApiStatus.textContent = 'Modo demo';
        voiceApiStatus.className = 'status waiting';
      }
    }
  }

  voiceModeInputs.forEach(input => {
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      localStorage.setItem('agendazap-voice-mode', input.value);

      try {
        const response = await voiceFetch(`/api/voice/config/${DEMO_TENANT}`, {
          method: 'PUT',
          body: JSON.stringify({ responseMode: input.value })
        });
        applyVoiceConfig(await response.json());
        showToast('Modo de voz salvo no tenant demo.');
      } catch {
        showToast('Backend indisponível; preferência mantida apenas neste navegador.');
      }
    });
  });

  document.querySelector('[data-action="voice-vocabulary"]')?.addEventListener('click', async () => {
    const current = voiceConfigCache?.customVocabulary || [];
    const raw = window.prompt(
      'Termos separados por vírgula:',
      current.join(', ')
    );
    if (raw === null) return;

    const customVocabulary = [...new Set(raw.split(',').map(v => v.trim()).filter(Boolean))];

    try {
      const response = await voiceFetch(`/api/voice/config/${DEMO_TENANT}`, {
        method: 'PUT',
        body: JSON.stringify({ customVocabulary })
      });
      applyVoiceConfig(await response.json());
      showToast('Vocabulário atualizado.');
    } catch (error) {
      showToast('Não foi possível salvar o vocabulário no backend.');
    }
  });

  document.querySelector('[data-action="voice-transcribe"]')?.addEventListener('click', async () => {
    const file = voiceTestFile?.files?.[0];
    if (!file) {
      showToast('Selecione um arquivo de áudio primeiro.');
      return;
    }

    if (voiceTestResult) voiceTestResult.textContent = 'Transcrevendo…';

    const form = new FormData();
    form.append('audio', file);

    try {
      const response = await voiceFetch(`/api/voice/transcribe/${DEMO_TENANT}`, {
        method: 'POST',
        body: form
      });
      const result = await response.json();
      if (voiceTestResult) voiceTestResult.textContent = result.text || 'Transcrição vazia.';
      await refreshVoiceUsage();
    } catch (error) {
      if (voiceTestResult) voiceTestResult.textContent = `Erro: ${error.message}`;
    }
  });

  document.querySelector('[data-action="voice-tts"]')?.addEventListener('click', async () => {
    const text = voiceTestResult?.textContent && !voiceTestResult.textContent.startsWith('Erro:')
      ? voiceTestResult.textContent
      : 'Olá! Sou o AgendaZap. Tenho horários disponíveis amanhã às quatorze e às dezesseis horas.';

    try {
      if (voiceTestResult) voiceTestResult.textContent = 'Gerando áudio…';
      const response = await voiceFetch(`/api/voice/tts/${DEMO_TENANT}`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (voiceTestPlayer) {
        if (voiceTestPlayer.dataset.objectUrl) URL.revokeObjectURL(voiceTestPlayer.dataset.objectUrl);
        voiceTestPlayer.dataset.objectUrl = url;
        voiceTestPlayer.src = url;
        voiceTestPlayer.hidden = false;
        await voiceTestPlayer.play().catch(() => {});
      }
      if (voiceTestResult) voiceTestResult.textContent = text;
      await refreshVoiceUsage();
    } catch (error) {
      if (voiceTestResult) voiceTestResult.textContent = `Erro: ${error.message}`;
    }
  });

  initVoiceApi();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }
})();