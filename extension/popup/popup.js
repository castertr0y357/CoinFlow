document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // Load existing settings
  const settings = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  if (settings.apiUrl) apiUrlInput.value = settings.apiUrl;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;

  saveBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      statusEl.innerText = "Please fill in all fields.";
      statusEl.className = "status error";
      return;
    }

    await chrome.storage.local.set({ apiUrl, apiKey });
    statusEl.innerText = "Settings saved successfully!";
    statusEl.className = "status success";
    
    setTimeout(() => {
      statusEl.innerText = "";
    }, 3000);
  });
});
