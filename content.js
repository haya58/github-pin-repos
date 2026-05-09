async function loadPAT() {
  return new Promise((resolve) => {
    chrome.storage.local.get('gh_pat', (result) => {
      resolve(result.gh_pat || null);
    });
  });
}

async function fetchMyRepos(token) {
  // per_page最大100, ページネーション必要なら繰り返し取得
  let repos = [];
  let page = 1, perPage = 100;
  while (true) {
    const res = await fetch(`https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`, {
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
  // name, full_name, html_url, private など
  return repos.map(r => ({ label: r.full_name, url: r.html_url }));
}

function getPinnedRepos() {
  try {
    const json = localStorage.getItem('gh-pinned-repos');
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function savePinnedRepos(repoList) {
  localStorage.setItem('gh-pinned-repos', JSON.stringify(repoList));
}


// UI描画
function renderPinnedSection(repos, allRepos) {
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
        savePinnedRepos(newRepos);
        renderPinnedSection(newRepos, allRepos);
      }
    }
  };

  Array.from(box.querySelectorAll('button[data-unpin]')).forEach(btn => {
    btn.onclick = () => {
      const label = btn.getAttribute('data-unpin');
      const newRepos = repos.filter(r => r.label !== label);
      savePinnedRepos(newRepos);
      renderPinnedSection(newRepos, allRepos);
    };
  });
}

// メイン
(async function () {
  console.log("Extension load")

  // ページを一度に複数回初期化しないようにする
  if (document.getElementById('gh-pinned-sidebar')) return;

  const pat = await loadPAT();
  if (!pat) {
    // 設定誘導
    renderPinnedSection([], []);
    let sidebar = document.querySelector('.Layout-sidebar, [data-testid="sidebar"]');
    if (sidebar) {
      sidebar.prepend(document.createTextNode("アクセストークンが未設定です。設定画面から入力してください。"));
    }
    return;
  }

  let allRepos;
  try {
    allRepos = await fetchMyRepos(pat);
  } catch (e) {
    renderPinnedSection([], []);
    let sidebar = document.querySelector('.Layout-sidebar, [data-testid="sidebar"]');
    if (sidebar) {
      sidebar.prepend(document.createTextNode("リポジトリ取得に失敗しました。アクセストークンや権限を確認してください。"));
    }
    return;
  }

  const pinned = getPinnedRepos()
    .map(label => allRepos.find(r => r.label === (typeof label === "string" ? label : label.label)))
    .filter(Boolean);

  renderPinnedSection(pinned, allRepos);
})();
