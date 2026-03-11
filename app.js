const overlay = document.getElementById('villainOverlay');
const repoGrid = document.getElementById('githubProjectGrid');

function spawnTendrils(count = 16) {
  for (let i = 0; i < count; i += 1) {
    const line = document.createElement('span');
    line.className = 'tendril';
    line.style.setProperty('--x', `${Math.random() * 100}vw`);
    line.style.setProperty('--len', `${90 + Math.random() * 240}px`);
    line.style.setProperty('--rot', `${-30 + Math.random() * 60}deg`);
    document.body.appendChild(line);
    setTimeout(() => line.remove(), 1000);
  }
}

function triggerVillainEffect(target) {
  target.classList.remove('hit');
  void target.offsetWidth;
  target.classList.add('hit');

  overlay.classList.add('active');
  spawnTendrils();

  setTimeout(() => {
    overlay.classList.remove('active');
    target.classList.remove('hit');
  }, 800);
}

function renderRepoCard(repo) {
  const link = document.createElement('a');
  link.className = 'project-card entity anim-target';
  link.tabIndex = 0;
  link.href = repo.html_url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = repo.name;
  return link;
}

async function loadGitHubProjects() {
  if (!repoGrid) return;
  repoGrid.innerHTML = '<p>Loading projects...</p>';

  try {
    const response = await fetch('https://api.github.com/users/shahet07/repos?per_page=100&sort=updated');
    if (!response.ok) throw new Error(`GitHub API error ${response.status}`);

    const repos = await response.json();
    const publicRepos = repos
      .filter((repo) => !repo.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    if (publicRepos.length === 0) {
      repoGrid.innerHTML = '<p>No public repositories found.</p>';
      return;
    }

    repoGrid.innerHTML = '';
    publicRepos.forEach((repo) => {
      repoGrid.appendChild(renderRepoCard(repo));
    });
    addScrollAnimations();
  } catch (error) {
    repoGrid.innerHTML = '<p>Could not load projects right now. Please refresh and try again.</p>';
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('.entity');
  if (target) triggerVillainEffect(target);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target.closest('.entity');
  if (!target) return;
  event.preventDefault();
  triggerVillainEffect(target);
});

function addScrollAnimations() {
  const targets = document.querySelectorAll('.section, .card, .anim-target');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  targets.forEach((target) => observer.observe(target));
}

loadGitHubProjects();
addScrollAnimations();
