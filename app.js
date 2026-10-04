(() => {
  const shell = document.getElementById('appShell');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');
  const pageTitle = document.getElementById('pageTitle');
  const navItems = [...document.querySelectorAll('.nav-item')];
  const views = [...document.querySelectorAll('.view')];

  function syncSidebarA11y(collapsed) {
    if (!sidebarToggle) return;
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    sidebarToggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  }

  const savedSidebar = localStorage.getItem('agendazap-sidebar');
  const initiallyCollapsed = savedSidebar === 'collapsed';
  shell.classList.toggle('sidebar-collapsed', initiallyCollapsed);
  syncSidebarA11y(initiallyCollapsed);

  sidebarToggle?.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('agendazap-sidebar', collapsed ? 'collapsed' : 'expanded');
    syncSidebarA11y(collapsed);
    sidebarToggleIcon.textContent = '‹';
  });

  const preferredTheme = document.documentElement.dataset.theme ||
    localStorage.getItem('agendazap-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    themeIcon.textContent = dark ? '☀' : '☾';
    themeLabel.textContent = dark ? 'Claro' : 'Escuro';
    localStorage.setItem('agendazap-theme', theme);
  }

  applyTheme(preferredTheme);

  themeToggle?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  const titles = {
    dashboard: 'Visão geral', agenda: 'Agenda', clientes: 'Clientes',
    automacoes: 'Automações', financeiro: 'Financeiro', planos: 'Planos'
  };

  navItems.forEach(item => item.addEventListener('click', () => {
    const name = item.dataset.view;
    navItems.forEach(n => n.classList.toggle('active', n === item));
    views.forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    pageTitle.textContent = titles[name] || 'AgendaZap';
  }));
})();