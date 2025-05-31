const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { marked } = require('marked');

// --- START OF CONFIGURATION ---

// Base URL for your assets. For local dev, it points to your cdn-server.
// In production, you would change this to your actual CDN domain.
const cdnBaseUrl = process.env.NODE_ENV === 'production'
    ? 'https://your-production-cdn-url.com'
    : 'http://localhost:3001';

const config = {
    homePage: {
        title: 'Christopher C. Luk',
        subtitle: 'Software Engineer & Web Developer',
        aboutMe: `
            I am a passionate software engineer with a knack for creating elegant, efficient, and user-friendly web applications. 
            With a strong foundation in both front-end and back-end development, I enjoy bringing ideas to life from concept to deployment.
        `,
        galleryImages: [
            { src: `${cdnBaseUrl}/images/gallery/a.jpg`, alt: 'Description for image 1' },
            { src: `${cdnBaseUrl}/images/gallery/b.jpg`, alt: 'Description for image 2' },
        ],
        backgroundOpacity: 1,
        backgroundImages: [
            `${cdnBaseUrl}/images/backgrounds/1.png`,
            `${cdnBaseUrl}/images/backgrounds/2.jpg`,
            `${cdnBaseUrl}/images/backgrounds/3.jpg`
        ]
    },
    experience: [
        {
            role: 'Senior Software Engineer',
            company: 'Tech Solutions Inc.',
            date: '2022 - Present',
            description: 'Leading the development of scalable web applications using Node.js and React. Mentoring junior developers and driving architectural decisions.'
        },
        {
            role: 'Junior Web Developer',
            company: 'Creative Web Agency',
            date: '2020 - 2022',
            description: 'Developed and maintained client websites, focusing on responsive design and performance. Gained expertise in HTML, CSS, and JavaScript.'
        }
    ],
    projects: {
        githubUsername: 'listingclown3',
        fetchFromGitHub: true,
        overrides: [
            {
                name: 'my-portfolio',
                thumbnail: `${cdnBaseUrl}/images/projects/portfolio-custom.jpg`,
                description: 'A custom description that is much better than the one on GitHub! This showcases the override system.',
                tags: ['Node.js', 'Express', 'JavaScript', 'Config-Driven'],
                liveUrl: 'https://your-portfolio-live-url.com'
            }
        ]
    },
    socialLinks: [
        { name: 'Email', url: 'mailto:your.email@example.com' },
        { name: 'GitHub', url: 'https://github.com/listingclown3' },
    ],
    pages: [
        { name: 'Home' },
        { name: 'Projects' },
        { name: 'Blog' }
    ]
};

// --- END OF CONFIGURATION ---

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// --- API Endpoints ---

// NEW: API endpoint to serve the configuration to the client
app.get('/api/config', (req, res) => {
    res.json(config);
});

// The "Smart" Projects API (now uses the internal config object)
app.get('/api/projects', async (req, res) => {
    let finalProjects = [];
    const overrides = config.projects.overrides || [];
    const customProjects = overrides.filter(p => p.isCustom);

    if (config.projects.fetchFromGitHub) {
        try {
            const githubRepos = await fetchGitHubRepos(config.projects.githubUsername);
            finalProjects = githubRepos.map(repo => {
                const override = overrides.find(o => o.name.toLowerCase() === repo.name.toLowerCase());
                // The override object takes precedence
                return override ? { ...repo, ...override } : repo;
            });
        } catch (error) {
            console.error("Failed to fetch from GitHub:", error.message);
            finalProjects = [];
        }
    }
    
    finalProjects.push(...customProjects);
    finalProjects.sort((a, b) => (b.thumbnail || b.description) ? 1 : -1);
    res.json(finalProjects);
});

app.get('/api/project/:name', async (req, res) => {
    try {
        const repoName = req.params.name;
        const owner = config.projects.githubUsername;

        // Fetch README and Commits in parallel
        const [readme, commits] = await Promise.all([
            fetchGitHubFile(owner, repoName, 'README.md'),
            fetchGitHubCommits(owner, repoName)
        ]);
        
        const readmeHtml = readme ? marked(readme) : '<p>No README file found for this project.</p>';

        res.json({
            readmeHtml,
            commits: commits.slice(0, 10) // Send the 10 latest commits
        });

    } catch (error) {
        console.error(`Error fetching project details for ${req.params.name}:`, error.message);
        res.status(500).json({ message: 'Could not fetch project details.' });
    }
});

// Blog API endpoints (no changes)
app.get('/api/blogs', (req, res) => {
    const blogsDir = path.join(__dirname, 'blogs');
    try {
        const files = fs.readdirSync(blogsDir).filter(file => file.endsWith('.md'));
        const posts = files.map(file => {
            const metadata = getPostMetadata(path.join(blogsDir, file));
            // ** NEW: Prepend CDN URL to relative thumbnail paths **
            if (metadata.thumbnail && !metadata.thumbnail.startsWith('http')) {
                metadata.thumbnail = `${cdnBaseUrl}/${metadata.thumbnail.replace(/^\//, '')}`;
            }
            return { slug: path.parse(file).name, ...metadata };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(posts);
    } catch (error) {
        console.error("Could not read blogs directory:", error);
        res.status(500).json({ message: "Error reading blog posts." });
    }
});

app.get('/api/blogs/:slug', (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, 'blogs', `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Blog post not found.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const contentWithoutFrontMatter = fileContent.replace(/---([\s\S]+?)---/, '').trim();
    const htmlContent = marked(contentWithoutFrontMatter);
    res.json({ html: htmlContent });
});


// --- Helper Functions ---
function getPostMetadata(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const match = fileContent.match(/---([\s\S]+?)---/);
    if (!match) return {};
    const frontMatter = match[1];
    const metadata = {};
    frontMatter.split('\n').forEach(line => {
        const [key, ...value] = line.split(':');
        if (key && value.length > 0) {
            metadata[key.trim()] = value.join(':').trim();
        }
    });
    return metadata;
}

function fetchGitHubRepos(username) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/users/${username}/repos?sort=pushed`,
            method: 'GET',
            headers: { 'User-Agent': 'Node.js-Portfolio-App' }
        };
        const apiRequest = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => { data += chunk; });
            apiRes.on('end', () => {
                if (apiRes.statusCode === 200) {
                    const repos = JSON.parse(data).map(repo => ({
                        name: repo.name, description: repo.description, thumbnail: null, tags: repo.language ? [repo.language] : [], repoUrl: repo.html_url, liveUrl: repo.homepage || null,
                    }));
                    resolve(repos);
                } else {
                    reject(new Error(`GitHub API responded with status ${apiRes.statusCode}`));
                }
            });
        });
        apiRequest.on('error', (e) => reject(e));
        apiRequest.end();
    });
}

function fetchGitHubFile(owner, repo, filePath) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/contents/${filePath}`,
            headers: { 'User-Agent': 'Node.js-Portfolio-App' }
        };
        https.get(options, (res) => {
            if (res.statusCode !== 200) return resolve(null); // File not found, resolve with null
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const content = JSON.parse(data).content;
                resolve(Buffer.from(content, 'base64').toString('utf8'));
            });
        }).on('error', () => resolve(null));
    });
}

function fetchGitHubCommits(owner, repo) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/commits`,
            headers: { 'User-Agent': 'Node.js-Portfolio-App' }
        };
        https.get(options, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`GitHub API responded with ${res.statusCode}`));
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', e => reject(e));
    });
}
// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});