const DEFAULT_DOMAIN = 'github.com';

async function getDomains() {
  return new Promise((resolve) => {
    chrome.storage.local.get('domains', (result) => {
      resolve(result.domains || { [DEFAULT_DOMAIN]: { token: '' } });
    });
  });
}

async function saveDomains(domains) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ domains }, resolve);
  });
}

async function renderDomainList() {
  const domains = await getDomains();
  const listEl = document.getElementById('domain-list');
  listEl.innerHTML = '';

  for (const [domain, config] of Object.entries(domains)) {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.dataset.domain = domain;

    const isDefault = domain === DEFAULT_DOMAIN;
    const deleteBtn = isDefault
      ? ''
      : `<button class="btn-delete" data-domain="${domain}">削除</button>`;
    const defaultBadge = isDefault
      ? '<span class="default-badge">(デフォルト)</span>'
      : '';

    item.innerHTML = `
      <div class="domain-header">
        <span class="domain-name">${domain}${defaultBadge}</span>
      </div>
      <div class="token-row">
        <input type="password" class="token-input" data-domain="${domain}"
               value="${config.token || ''}" placeholder="アクセストークン">
        <div class="button-row">
          <button class="btn-save-token" data-domain="${domain}">保存</button>
          ${deleteBtn}
        </div>
      </div>
    `;
    listEl.appendChild(item);
  }

  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async () => {
      const domain = btn.dataset.domain;
      if (confirm(`ドメイン "${domain}" を削除しますか？`)) {
        const domains = await getDomains();
        delete domains[domain];
        await saveDomains(domains);
        renderDomainList();
      }
    };
  });

  listEl.querySelectorAll('.btn-save-token').forEach(btn => {
    btn.onclick = async () => {
      const domain = btn.dataset.domain;
      const input = listEl.querySelector(`.token-input[data-domain="${domain}"]`);
      const token = input.value.trim();
      const domains = await getDomains();
      if (!domains[domain]) {
        domains[domain] = {};
      }
      domains[domain].token = token;
      await saveDomains(domains);
      btn.textContent = '保存しました。';
      setTimeout(() => { btn.textContent = '保存'; }, 1500);
    };
  });
}

document.getElementById('btn-add-domain').onclick = () => {
  document.getElementById('add-form').classList.add('visible');
  document.getElementById('btn-add-domain').style.display = 'none';
};

document.getElementById('btn-cancel').onclick = () => {
  document.getElementById('add-form').classList.remove('visible');
  document.getElementById('btn-add-domain').style.display = '';
  document.getElementById('new-domain').value = '';
  document.getElementById('new-token').value = '';
};

document.getElementById('btn-save-new').onclick = async () => {
  const domain = document.getElementById('new-domain').value.trim();
  const token = document.getElementById('new-token').value.trim();

  if (!domain) {
    alert('ドメイン名を入力してください');
    return;
  }

  if (domain === DEFAULT_DOMAIN) {
    alert('github.com はデフォルトで登録されています');
    return;
  }

  const domains = await getDomains();
  if (domains[domain]) {
    alert(`ドメイン "${domain}" は既に登録されています`);
    return;
  }

  domains[domain] = { token };
  await saveDomains(domains);

  document.getElementById('new-domain').value = '';
  document.getElementById('new-token').value = '';
  document.getElementById('add-form').classList.remove('visible');
  document.getElementById('btn-add-domain').style.display = '';
  renderDomainList();
};

renderDomainList();
