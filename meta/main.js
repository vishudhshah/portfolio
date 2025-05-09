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

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
