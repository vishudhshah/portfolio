import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
    projectsTitle.textContent = `${projects.length} Projects`;
}

// PIE CHART

let selectedIndex = -1;

function renderPieChart(projectsGiven) {
    // re-calculate rolled data
    let rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );
    // re-calculate data
    let data = rolledData.map(([year, count]) => ({
        value: count,
        label: year
    }));

    // re-calculate slice generator, arc data, arc, etc.
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let sliceGenerator = d3.pie().value((d) => d.value);
    let arcData = sliceGenerator(data);
    let arcs = arcData.map((d) => arcGenerator(d));

    // set color scheme to slices
    let colors = d3.scaleOrdinal(d3.schemePaired);

    // clear up paths and legends
    let svg = d3.select('svg');
    let legend = d3.select('.legend');
    svg.selectAll('path').remove();
    legend.selectAll('li').remove();

    arcs.forEach((arc, i) => {
        svg
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(i))
            .on('click', () => {
                selectedIndex = selectedIndex === i ? -1 : i;

                svg
                    .selectAll('path')
                    .attr('class', (_, idx) => (
                        // filter idx to find correct pie slice and apply CSS from above
                        idx === selectedIndex ? 'selected' : ''
                    ));

                legend
                    .selectAll('li')
                    .attr('class', (_, idx) => (
                        // filter idx to find correct legend and apply CSS from above
                        idx === selectedIndex ? 'selected' : ''
                    ));

                // filter projects by selected year
                if (selectedIndex === -1) {
                    // no selection, show all projects
                    renderProjects(projects, projectsContainer, 'h2');
                } else {
                    const selectedYear = data[selectedIndex].label;
                    const filteredProjects = projects.filter((project) => project.year === selectedYear);
                    renderProjects(filteredProjects, projectsContainer, 'h2');
                }
            });
    });

    data.forEach((d, i) => {
        legend
            .append('li')
            .attr('style', `--color:${colors(i)}`) // set the style attribute while passing in parameters
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
    });
}

// Call on load
renderPieChart(projects);

// SEARCH BAR

let query = '';
let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
    // update query value
    query = event.target.value;

    // filter projects
    let filteredProjects = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });
    
    // re-render filtered projects and pie chart
    renderProjects(filteredProjects, projectsContainer, 'h2');
    renderPieChart(filteredProjects);
});