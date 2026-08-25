// Background Service Worker cho FileTools Pro Extension
const API_URL = 'http://localhost:3001';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:    'compress-image',
    title: 'FileTools: Nén ảnh này',
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id:    'ocr-image',
    title: 'FileTools: Nhận dạng chữ (OCR)',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'compress-image' && info.srcUrl) {
    chrome.tabs.create({ url: `${API_URL}/image` });
  }
  if (info.menuItemId === 'ocr-image' && info.srcUrl) {
    chrome.tabs.create({ url: `${API_URL}/ocr` });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPLOAD_FILE') {
    handleUpload(msg).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }
});

async function handleUpload({ endpoint, formData, apiKey }) {
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  return res.json();
}
