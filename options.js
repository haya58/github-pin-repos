// PAT保存
document.getElementById('save').onclick = async function () {
  const pat = document.getElementById('pat').value.trim();
  if (!pat) {
    document.getElementById('result').textContent = 'トークンを入力してください';
    return;
  }
  await chrome.storage.local.set({ gh_pat: pat });
  document.getElementById('result').textContent = '保存しました';
};

// 初期値セット
chrome.storage.local.get('gh_pat', ({ gh_pat }) => {
  if (gh_pat) {
    document.getElementById('pat').value = gh_pat;
  }
});
