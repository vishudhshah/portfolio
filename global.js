console.log('IT’S ALIVE!');

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/"               // Local server
    : "/portfolio/";    // GitHub Pages repo name

function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

function setColorScheme(scheme) {
    document.documentElement.style.setProperty('color-scheme', scheme);
    select.value = scheme;
    localStorage.colorScheme = scheme;
    console.log('color scheme changed to', scheme);
}

// let navLinks = $$("nav a");
// let currentLink = navLinks.find(
//     (a) => a.host === location.host && a.pathname === location.pathname,
// );
// currentLink?.classList.add('current');

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'resume/', title: 'Resume' },
    { url: 'contact/', title: 'Contact' },
    { url: 'https://github.com/vishudhshah', title: 'GitHub' }
];

let nav = document.createElement('nav');
document.body.prepend(nav);  // Adds it to the top of the <body>

for (let p of pages) {
    let url = p.url;
    url = !url.startsWith('http') ? BASE_PATH + url : url;
    let title = p.title;

    let a = document.createElement('a');
    a.href = url;
    if (a.host !== location.host) {
        a.target = "_blank";
    }
    a.textContent = title;
    if (a.host === location.host && a.pathname === location.pathname) {
        a.classList.add('current');
    }
    nav.append(a);
}

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
        Theme:
        <select>
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>
    `
);

let select = document.querySelector('.color-scheme select');
select.addEventListener('input', function (event) {
    setColorScheme(event.target.value);
});

if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
}

// Contact form
let form = document.querySelector('form');
form?.addEventListener('submit', function (event) {
    event.preventDefault(); // stop the browser from submitting normally

    let data = new FormData(form);
    let params = [];

    for (let [name, value] of data) {
        params.push(`${name}=${encodeURIComponent(value.trim())}`);
    }

    let url = form.action + '?' + params.join('&');
    location.href = url;
});

export async function fetchJSON(url) {
    try {
        // Fetch the JSON file from the given URL
        const response = await fetch(url);

        // Check if the fetch was successful
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }

        // Parse the JSON response
        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error fetching or parsing JSON data:', error);
    }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    // 1. Clear the container first
    containerElement.innerHTML = '';

    // 2. For each project, create and add an article
    projects.forEach((project) => {
        // Create a new article element
        const article = document.createElement('article');

        // Set the inside HTML of the article
        article.innerHTML = `
            <${headingLevel}>${project.title}</${headingLevel}>
            <img src="${project.image}" alt="${project.title}">
            <p>${project.description}</p>
        `;

        // Add the article to the container
        containerElement.appendChild(article);
    });
}

export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
}