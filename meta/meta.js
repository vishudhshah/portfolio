import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let xScale;
let yScale;
let data, commits, timeScale;
let filteredCommits;


async function loadData() {
    const data = await d3.csv('./loc.csv', (row) => ({
        ...row,
        line: Number(row.line), // or just +row.line
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));

    return data;
}

function processCommits(data) {
    return d3
        .groups(data, d => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;
            let ret = {
                id: commit,
                url: 'https://github.com/vishudhshah/portfolio/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };
            Object.defineProperty(ret, 'lines', {
                value: lines,
                writable: false,
                configurable: true,
                enumerable: false
            });
            return ret;
        })
        .sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(data, commits) {
    // Create the <dl> element with class "stats"
    const dl = d3
        .select('#stats')
        .append('dl')
        .attr('class', 'stats');

    // Total lines of code (LOC)
    const totalLOC = dl.append('div').attr('class', 'stat');
    totalLOC.append('dt').html('Total <abbr title="Lines of Code">LOC</abbr>');
    totalLOC.append('dd').text(data.length);

    // Total commits
    const totalCommits = dl.append('div').attr('class', 'stat');
    totalCommits.append('dt').text('Commits');
    totalCommits.append('dd').text(commits.length);

    // Number of files
    const numFiles = d3.group(data, d => d.file).size;

    const numFilesStat = dl.append('div').attr('class', 'stat');
    numFilesStat.append('dt').text('Files');
    numFilesStat.append('dd').text(numFiles);

    // Average file length (lines)
    const fileLengths = d3.rollups(
        data,
        v => d3.max(v, d => d.line), // longest line number in each file
        d => d.file
    );
    const avgFileLength = d3.mean(fileLengths, d => d[1]);

    const avgFileLengthStat = dl.append('div').attr('class', 'stat');
    avgFileLengthStat.append('dt').text('Average lines');
    avgFileLengthStat.append('dd').text(Math.round(avgFileLength));

    // Time of day most work is done
    const workByPeriod = d3.rollups(
        data,
        v => v.length,
        d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })  // e.g., "morning", "afternoon"
    );
    let maxPeriod = d3.greatest(workByPeriod, d => d[1])?.[0];  // e.g., "evening"

    maxPeriod = maxPeriod.split(' ')
    maxPeriod = maxPeriod[maxPeriod.length - 1]
    maxPeriod = maxPeriod.charAt(0).toUpperCase() + maxPeriod.slice(1); // Capitalize first letter
    
    const activeTime = dl.append('div').attr('class', 'stat');
    activeTime.append('dt').text('Active time');
    activeTime.append('dd').text(maxPeriod);
    
    
    // Most active day of the week
    const dayOfWeek = d3.rollups(
        data,
        v => v.length,
        d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
    );
    const topDay = d3.greatest(dayOfWeek, d => d[1])?.[0];

    const activeDay = dl.append('div').attr('class', 'stat');
    activeDay.append('dt').text('Active day');
    activeDay.append('dd').text(topDay);
}

function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');

    if (Object.keys(commit).length === 0) return;

    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
        dateStyle: 'full',
    });
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 5}px`;
    tooltip.style.top = `${event.clientY + 5}px`;
}

function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 20 };

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom
    };

    // Create the SVG element
    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    // Create scales
    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);

    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
    const rScale = d3
        .scaleSqrt()
        .domain([minLines, maxLines])
        .range([5, 50]); // Adjust to control circle sizes based on experimentation

    // Helper function to get color based on hour
    function getHourColor(hour) {
        if (hour >= 5 && hour < 12) return '#f4a261';  // Morning – orange
        if (hour >= 12 && hour < 17) return '#e76f51'; // Afternoon – red-orange
        if (hour >= 17 && hour < 21) return '#2a9d8f'; // Evening – teal
        return '#264653';                              // Night – dark blue
    }

    // Add grid lines
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    gridlines.call(
        d3
            .axisLeft(yScale)
            .tickFormat('')              // no tick labels
            .tickSize(-usableArea.width) // full-width horizontal lines
    );

    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

    // Add x-axis
    svg
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    // Add y-axis
    svg
        .append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // Sort commits by total lines to make it easier to hover over overlapping dots
    const sortedCommits = d3.sort(commits, d => -d.totalLines);

    // Render dots
    const dots = svg
        .append('g')
        .attr('class', 'dots');

    dots
        .selectAll('circle')
        .data(sortedCommits, (d) => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .style('--r', d => rScale(d.totalLines))
        .attr('fill', d => getHourColor(d.hourFrac))
        .attr('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
            // d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mousemove', (event) => {
            updateTooltipPosition(event);
        })
        .on('mouseleave', () => {
            // d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });

    function brushed(event) {
        const selection = event.selection;
        d3.selectAll('circle').classed('selected', d => isCommitSelected(selection, d));
        renderSelectionCount(selection, commits);
        renderLanguageBreakdown(selection, commits);
    }

    // Create brush for selection
    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(data, commits) {
    const svg = d3.select('#chart svg');
    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([5, 50]);
    xScale.domain(d3.extent(commits, d => d.datetime));

    const xAxis = d3.axisBottom(xScale);
    svg.select('g.x-axis').call(xAxis);

    const dots = svg.select('g.dots');
    const sortedCommits = d3.sort(commits, d => -d.totalLines);

    dots
        .selectAll('circle')
        .data(sortedCommits, (d) => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .style('--r', d => rScale(d.totalLines))
        .attr('fill', d => {
            const hour = d.hourFrac;
            if (hour >= 5 && hour < 12) return '#f4a261';
            if (hour >= 12 && hour < 17) return '#e76f51';
            if (hour >= 17 && hour < 21) return '#2a9d8f';
            return '#264653';
        })
        .attr('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mousemove', (event) => {
            updateTooltipPosition(event);
        })
        .on('mouseleave', () => {
            updateTooltipVisibility(false);
        });
}

function isCommitSelected(selection, commit) {
    if (!selection) return false;

    const [x0, x1] = selection.map(d => d[0]);
    const [y0, y1] = selection.map(d => d[1]);

    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection, commits) {
    const selectedCommits = selection
        ? commits.filter(d => isCommitSelected(selection, d))
        : [];

    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

    return selectedCommits;
}

function renderLanguageBreakdown(selection, commits) {
    const selectedCommits = selection
        ? commits.filter(d => isCommitSelected(selection, d))
        : [];

    const container = document.getElementById('language-breakdown');
    const statsContainer = document.getElementById('language-stats');

    if (selectedCommits.length === 0) {
        container.setAttribute('hidden', 'true');
        return;
    }
    container.removeAttribute('hidden');

    // Flatten all the lines across selected commits
    const lines = selectedCommits.flatMap(d => d.lines);

    // Count lines per language
    const breakdown = d3.rollup(
        lines,
        v => v.length,
        d => d.type
    );

    statsContainer.innerHTML = '';

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);

        statsContainer.innerHTML += `
            <div class="stat">
                <dt>${language}</dt>
                <dd>${count} lines<br>(${formatted})</dd>
            </div>
        `;
    }
}

// Tab functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // If switching to files tab, update file display
            if (targetTab === 'files-tab') {
                updateFileDisplay(filteredCommits);
            }
        });
    });
}

function updateFileDisplay(filteredCommits) {
    let colors = d3.scaleOrdinal(d3.schemeTableau10);
    let lines = filteredCommits.flatMap(d => d.lines);
    let files = d3
        .groups(lines, d => d.file)
        .map(([name, lines]) => {
            return { name, lines };
        })
        .sort((a, b) => b.lines.length - a.lines.length);

    let filesContainer = d3
        .select('#files')
        .selectAll('div')
        .data(files, d => d.name)
        .join(
            (enter) =>
                enter.append('div').call((div) => {
                    div.append('dt').append('code');
                    div.append('dd');
                })
        );

    filesContainer.select('dt > code').html(d => `${d.name}<small>${d.lines.length} lines</small>`);
    filesContainer
        .select('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'loc')
        .attr('style', d => `--color: ${colors(d.type)}`);
}

function onStepEnter(response) {
    const commitDate = response.element.__data__.datetime;
    const maxTime = commitDate;
    filteredCommits = commits.filter(d => d.datetime <= maxTime);
    updateScatterPlot(data, filteredCommits);
    
    // Update file display if files tab is active
    const filesTab = document.getElementById('files-tab');
    if (filesTab.classList.contains('active')) {
        updateFileDisplay(filteredCommits);
    }
    
    console.log(`Active commit: ${commitDate}`);
}

function onFileStepEnter(response) {
    const commitDate = response.element.__data__.datetime;
    const maxTime = commitDate;
    const fileFilteredCommits = commits.filter(d => d.datetime <= maxTime);
    updateFileDisplay(fileFilteredCommits);
    
    // Update the step indicator
    const stepIndex = response.index;
    const totalSteps = commits.length;
    const currentCommitEl = document.getElementById('current-commit');
    if (currentCommitEl) {
        currentCommitEl.textContent = `Commit ${stepIndex + 1}`;
    }
    
    console.log(`File evolution step ${stepIndex + 1}/${totalSteps} at: ${commitDate.toLocaleDateString()}`);
}

async function initializeApp() {
    data = await loadData();
    commits = processCommits(data);
    
    timeScale = d3
        .scaleTime()
        .domain(d3.extent(data, d => d.datetime))
        .range([0, 100]);

    filteredCommits = commits;

    renderCommitInfo(data, commits);
    renderScatterPlot(data, commits);
    initializeTabs();

    // Set up total commits count
    const totalCommitsEl = document.getElementById('total-commits');
    if (totalCommitsEl) {
        totalCommitsEl.textContent = commits.length;
    }

    // Create scrollytelling content for commits
    d3
        .select('#scatter-story')
        .selectAll('.step')
        .data(commits)
        .join('div')
        .attr('class', 'step')
        .html(
            (d, i) => `
                On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
            })},
                I made <a href="${d.url}" target="_blank">${
            i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
            }</a>.
                I edited ${d.totalLines} lines across ${
            d3.rollups(
                d.lines,
                (D) => D.length,
                (d) => d.file,
            ).length
            } files.
                Then I looked over all I had made, and I saw that it was very good.
            `,
        );

    // Create scrollytelling content for file evolution
    d3
        .select('#file-story')
        .selectAll('.step')
        .data(commits)
        .join('div')
        .attr('class', 'step')
        .html(
            (d, i) => {
                const fileCount = d3.rollups(
                    d.lines,
                    (D) => D.length,
                    (d) => d.file,
                ).length;
                
                const languages = d3.rollups(
                    d.lines,
                    v => v.length,
                    d => d.type
                );
                
                const languageText = languages.length > 1 
                    ? `${languages.length} different languages`
                    : `${languages[0]?.[0] || 'code'}`;
                
                return `
                    <h3>Commit ${i + 1}: ${d.datetime.toLocaleDateString('en', { dateStyle: 'medium' })}</h3>
                    <p>Modified <strong>${d.totalLines} lines</strong> across <strong>${fileCount} files</strong> 
                    using ${languageText}. Watch how the codebase structure evolves with each commit.</p>
                    <small>Time: ${d.datetime.toLocaleTimeString('en', { timeStyle: 'short' })}</small>
                `;
            }
        );

    // Initialize scrollama for commits tab
    const commitsScroller = scrollama();
    commitsScroller
        .setup({
            container: '#scrolly-1',
            step: '#scatter-story .step',
        })
        .onStepEnter(onStepEnter);

    // Initialize scrollama for files tab
    const filesScroller = scrollama();
    filesScroller
        .setup({
            container: '#file-scrolly',
            step: '#file-story .step',
        })
        .onStepEnter(onFileStepEnter);
}

// Initialize the app
initializeApp();