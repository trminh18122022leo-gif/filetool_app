const APP_URL = 'http://localhost:5173';

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const path = btn.getAttribute('data-path');
    chrome.tabs.create({ url: `${APP_URL}${path}` });
  });
});

document.getElementById('openDashboard').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});

document.getElementById('openHome').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: APP_URL });
});
