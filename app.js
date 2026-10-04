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

  const savedSidebar = localStorage.getItem('agendazap-sidebar');
  if (savedSidebar === 'collapsed') shell.classList.add('sidebar-collapsed');

  sidebarToggle?.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('agendazap-sidebar', collapsed ? 'collapsed' : 'expanded');
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    sidebarToggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
    sidebarToggleIcon.textContent = '‹';
  });

  const preferredTheme = localStorage.getItem('agendazap-theme') ||
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