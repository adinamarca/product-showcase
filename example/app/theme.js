// The app keeps its theme in localStorage.theme (light|dark), like many apps.
document.documentElement.dataset.theme = localStorage.getItem('theme')
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
