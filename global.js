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

// Contact form stuff

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