const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { marked } = require('marked');
const matter = require('gray-matter'); // New dependency

// --- START OF NEW UTILITY/HELPER FUNCTIONS ---

// New: Function to log suspicious activity
const logSuspiciousActivity = (req, message) => {
    const logMessage = `[${new Date().toISOString()}] SUSPICIOUS ACTIVITY: ${message} | IP: ${req.ip} | Path: ${req.path}\n`;
    fs.appendFile('suspicious_activity.log', logMessage, (err) => {
        if (err) console.error("Failed to write to suspicious log:", err);
    });
};

// New: Load image library from JSON file
const imageLibrary = JSON.parse(fs.readFileSync(path.join(__dirname, 'image_library.json'), 'utf8'));

// New: Function to load project data from the 'projects' directory
const getProjectsFromMarkdown = () => {
    const projectsDir = path.join(__dirname, 'projects');
    try {
        const files = fs.readdirSync(projectsDir).filter(file => file.endsWith('.md'));
        return files.map(file => {
            const filePath = path.join(projectsDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const { data, content } = matter(fileContent); // Use gray-matter to parse
            
            // Resolve thumbnail from image library
            if (data.thumbnail && imageLibrary.projectThumbnails[data.thumbnail]) {
                data.thumbnail = imageLibrary.projectThumbnails[data.thumbnail];
            }

            return {
                ...data,
                slug: path.parse(file).name,
                customContent: content // The notes/to-do section
            };
        });
    } catch (error) {
        console.error("Could not read projects directory:", error);
        return [];
    }
};

// --- START OF CONFIGURATION ---
const config = {
    homePage: {
        title: '',
        subtitle: '',
        aboutMe: [
            'Lorem',
            'ipsum',
            'i forgot the rest'
        ],
        galleryImages: imageLibrary.galleryImages,
        backgroundImages: imageLibrary.backgroundImages,
        sideBanners: imageLibrary.sideBanners,
        backgroundOpacity: 0.1,
        bannerOpacity: 0.6
    },
    experience: [
         {
            role: 'Full Stack Developer',
            company: 'Team 2073 Robotics FRC',
            date: '2024 - Present',
            description: ''
        },
        {
            role: 'Full Stack Developer',
            company: 'Zylink Tech',
            date: '2023 - Present',
            description: ''
        },
    ],
    projects: {
        githubUsername: 'listingclown3',
        fetchFromGitHub: true,
        featuredRepoForActivity: 'blog' 
    },
    socialLinks: [
        { name: 'GitHub', url: 'https://github.com/listingclown3' },
        { name: 'YouTube', url: 'https://www.youtube.com/@list3andtableofcontents112' },
    ],
    pages: [
        { name: 'Home' },
        { name: 'Projects' },
        { name: 'Blog' },
    ]
};

// --- END OF CONFIGURATION ---

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

app.get('/api/config', (req, res) => {
    res.json(config);
});

// Modified: The Projects API now uses the Markdown-based system
app.get('/api/projects', async (req, res) => {
    let finalProjects = [];
    const localProjects = getProjectsFromMarkdown(); // Get projects from /projects/*.md

    if (config.projects.fetchFromGitHub) {
        try {
            const githubRepos = await fetchGitHubRepos(config.projects.githubUsername);
            finalProjects = githubRepos.map(repo => {
                const localOverride = localProjects.find(p => p.name.toLowerCase() === repo.name.toLowerCase());
                return localOverride ? { ...repo, ...localOverride } : repo;
            });

            // Add projects from Markdown that were not found on GitHub
            localProjects.forEach(localProject => {
                if (!finalProjects.some(p => p.name.toLowerCase() === localProject.name.toLowerCase())) {
                    finalProjects.push(localProject);
                }
            });

        } catch (error) {
            console.error("Failed to fetch from GitHub:", error.message);
            logSuspiciousActivity(req, "GitHub API fetch failed.");
            finalProjects = localProjects; // Fallback to local projects
        }
    } else {
        finalProjects = localProjects;
    }
    
    res.json(finalProjects);
});


// Modified: The Project Detail API now includes custom content and related materials
app.get('/api/project/:name', async (req, res) => {
    try {
        const repoName = req.params.name;
        const owner = config.projects.githubUsername;

        const localProject = getProjectsFromMarkdown().find(p => p.slug.toLowerCase() === repoName.toLowerCase());
        if (!localProject) {
            logSuspiciousActivity(req, `Attempted to access non-existent project: ${repoName}`);
            return res.status(404).json({ message: 'Project not found.' });
        }

        const customHtml = localProject.customContent ? marked(localProject.customContent) : '';

        // If it's a custom project (no repoUrl), return only local data
        if (!localProject.repoUrl) {
            return res.json({
                isCustom: true,
                customHtml,
                related: localProject.related || [],
                name: localProject.name || repoName,
            });
        }

        // If it's a GitHub project, fetch all details
        const [readme, commits, branches] = await Promise.all([
            fetchGitHubFile(owner, repoName, 'README.md'),
            fetchGitHubCommits(owner, repoName),
            fetchGitHubBranches(owner, repoName) // New: Fetch branches
        ]);
        
        const readmeHtml = readme ? marked(readme) : '<p>No README file found for this project.</p>';

        res.json({
            readmeHtml,
            customHtml,
            related: localProject.related || [],
            commits: commits ? commits.slice(0, 10) : [],
            branches: branches || [], // Send branches
            name: localProject.name || repoName,
        });

    } catch (error) {
        console.error(`Error fetching project details for ${req.params.name}:`, error.message);
        res.status(500).json({ message: 'Could not fetch project details.' });
    }
});

// New: API endpoint for the homepage activity feed
app.get('/api/activity', (req, res) => {
    const projects = getProjectsFromMarkdown()
        .sort((a, b) => (fs.statSync(path.join(__dirname, 'projects', `${b.slug}.md`)).mtime) - (fs.statSync(path.join(__dirname, 'projects', `${a.slug}.md`)).mtime))
        .slice(0, 3);
    
    const blogs = getBlogPosts()
        .slice(0, 2);

    res.json({ recentProjects: projects, recentBlogs: blogs });
});

// New: API endpoint for the GitHub activity monitor
app.get('/api/github-activity', async (req, res) => {
    const repoName = config.projects.featuredRepoForActivity;
    if (!repoName) {
        return res.status(404).json({ message: "No featured repository is set in the configuration." });
    }
    try {
        const commits = await fetchGitHubCommits(config.projects.githubUsername, repoName);
        res.json(commits.slice(0, 5)); // Send the latest 5 commits
    } catch (error) {
        console.error(`Could not fetch commits for ${repoName}:`, error);
        res.status(500).json({ message: "Could not fetch GitHub activity." });
    }
});


// Blog API endpoints (modified slightly for reuse)
const getBlogPosts = () => {
    const blogsDir = path.join(__dirname, 'blogs');
    try {
        const files = fs.readdirSync(blogsDir).filter(file => file.endsWith('.md'));
        return files.map(file => {
            const metadata = getPostMetadata(path.join(blogsDir, file));
            return { slug: path.parse(file).name, ...metadata };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error("Could not read blogs directory:", error);
        return [];
    }
};

app.get('/api/blogs', (req, res) => {
    const posts = getBlogPosts();
    if (posts.length === 0) {
        return res.status(500).json({ message: "Error reading blog posts." });
    }
    res.json(posts);
});


app.get('/api/blogs/:slug', (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, 'blogs', `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        logSuspiciousActivity(req, `Attempted to access non-existent blog post: ${slug}`);
        return res.status(404).json({ message: 'Blog post not found.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { content } = matter(fileContent); // Use gray-matter here as well for consistency
    const htmlContent = marked(content);
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

function fetchGitHubBranches(owner, repo) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/branches`,
            headers: { 'User-Agent': 'Node.js-Portfolio-App' }
        };
        https.get(options, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`GitHub API for branches responded with ${res.statusCode}`));
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