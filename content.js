const DEFAULT_DOMAIN = 'github.com';

function isGitHubPage() {
  return !!document.querySelector('meta[name="github-"]') ||
         !!document.querySelector('meta[property="og:site_name"][content="GitHub"]') ||
         window.location.hostname === DEFAULT_DOMAIN ||
         !!document.querySelector('[data-octo-dimensions]');
}

function getApiBaseUrl(hostname) {
  if (hostname === DEFAULT_DOMAIN) {
    return 'https://api.github.com';
  }
  return `https://${hostname}/api/v3`;
}

async function loadConfig(hostname) {
  return new Promise((resolve) => {
    chrome.storage.local.get('domains', (result) => {
      const domains = result.domains || {};
      resolve(domains[hostname] || { token: '' });
    });
  });
}

async function fetchMyRepos(token, apiBaseUrl) {
  let repos = [];
  let page = 1, perPage = 100;
  while (true) {
    const res = await fetch(`${apiBaseUrl}/user/repos?per_page=${perPage}&page=${page}&sort=updated`, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!res.ok) {
      throw new Error('APIエラー: ' + res.status);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    repos = repos.concat(data);
    if (data.length < perPage) break;
    page++;
  }
  return repos.map(r => ({ label: r.full_name, url: r.html_url }));
}

function getPinnedReposKey(hostname) {
  return `gh-pinned-repos-${hostname}`;
}

function getPinnedRepos(hostname) {
  try {
    const json = localStorage.getItem(getPinnedReposKey(hostname));
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function savePinnedRepos(hostname, repoList) {
  localStorage.setItem(getPinnedReposKey(hostname), JSON.stringify(repoList));
}

function renderPinnedSection(hostname, repos, allRepos) {
  let sidebar = document.querySelector('.dashboard-sidebar');
  if (!sidebar) return;
  let exist = document.getElementById('gh-pinned-sidebar');
  if (exist) exist.remove();

  let box = document.createElement('div');
  box.id = 'gh-pinned-sidebar';
  box.style.marginBottom = '1em';
  box.innerHTML = `
    <div class="gh-pinned-sidebar-title">Pined repositories</div>
    <div class="gh-pinned-sidebar-select-container">
      <select id="gh-pin-repo-select">
        <option value="">Select repos to pin...</option>
        ${allRepos.filter(r =>
          !repos.some(p=>p.label===r.label)
        ).map(r => `<option value="${r.label}">${r.label}</option>`).join('')}
      </select>
      <button id="gh-pin-add">Pin</button>
    </div>
    <ul class="gh-pinned-sidebar-list">
      ${repos.map(repo => `<li><a href="${repo.url}" target="_blank">${repo.label}</a>
        <button data-unpin="${repo.label}" class="gh-pinned-sidebar-unpin">×</button></li>`).join('')}
    </ul>
  `;
  sidebar.prepend(box);

  box.querySelector('#gh-pin-add').onclick = () => {
    let val = box.querySelector('#gh-pin-repo-select').value;
    if (val) {
      const repo = allRepos.find(r => r.label === val);
      if (!repos.some(p=>p.label===repo.label)) {
        let newRepos = [...repos, repo];
        savePinnedRepos(hostname, newRepos);
        renderPinnedSection(hostname, newRepos, allRepos);
      }
    }
  };

  Array.from(box.querySelectorAll('button[data-unpin]')).forEach(btn => {
    btn.onclick = () => {
      const label = btn.getAttribute('data-unpin');
      const newRepos = repos.filter(r => r.label !== label);
      savePinnedRepos(hostname, newRepos);
      renderPinnedSection(hostname, newRepos, allRepos);
    };
  });
}

(async function () {
  if (!isGitHubPage()) return;

  console.log("Extension loaded on:", window.location.hostname);

  if (document.getElementById('gh-pinned-sidebar')) return;

  const hostname = window.location.hostname;
  const config = await loadConfig(hostname);

  if (!config.token) {
    renderPinnedSection(hostname, [], []);
    return;
  }

  const apiBaseUrl = getApiBaseUrl(hostname);
  let allRepos;
  try {
    allRepos = await fetchMyRepos(config.token, apiBaseUrl);
  } catch {
    return;
  }

  const pinned = getPinnedRepos(hostname)
    .map(label => allRepos.find(r => r.label === (typeof label === "string" ? label : label.label)))
    .filter(Boolean);

  renderPinnedSection(hostname, pinned, allRepos);
})();
