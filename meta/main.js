import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
        .groups(data, d => d.commit) // group all rows by commit ID
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
                // Calculate hour as a decimal for time analysis
                // e.g., 2:30 PM = 14.5
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                // How many lines were modified?
                totalLines: lines.length,
            };
            
            // Add the lines array as a hidden property
            Object.defineProperty(ret, 'lines', {
                value: lines,
                writable: false, // default
                configurable: true,
                enumerable: false // default
            });
            
            return ret;
        });
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

    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    const xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    const yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);

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
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    // Add y-axis
    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
    const rScale = d3
        .scaleSqrt()
        .domain([minLines, maxLines])
        .range([5, 50]); // Adjust to control circle sizes based on experimentation

    const sortedCommits = d3.sort(commits, d => -d.totalLines);

    const dots = svg
        .append('g')
        .attr('class', 'dots');

    dots
        .selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', d => getHourColor(d.hourFrac))
        .attr('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mousemove', (event) => {
            updateTooltipPosition(event);
        })
        .on('mouseleave', () => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });
}

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);

renderScatterPlot(data, commits);