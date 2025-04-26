import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('vishudhshah');

const profileStats = document.querySelector('#profile-stats');
if (profileStats) {
    profileStats.innerHTML = `
        <div class="stats-grid">
            <div class="stat-block">
                <div class="stat-label">Followers</div>
                <div class="stat-value">${githubData.followers}</div>
            </div>
            <div class="stat-block">
                <div class="stat-label">Following</div>
                <div class="stat-value">${githubData.following}</div>
            </div>
            <div class="stat-block">
                <div class="stat-label">Public Repos</div>
                <div class="stat-value">${githubData.public_repos}</div>
            </div>
            <div class="stat-block">
                <div class="stat-label">Public Gists</div>
                <div class="stat-value">${githubData.public_gists}</div>
            </div>
        </div>
    `;
}