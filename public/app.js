document.addEventListener('DOMContentLoaded', () => {
    // initializeApp function remains the same...
    const initializeApp = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Could not fetch server configuration.');
            const config = await response.json();
            
            buildPage(config);
            startBackgroundRotator(config); 
            
            if (config.homePage.sideBanners) {
                const leftBanner = document.getElementById('left-banner');
                const rightBanner = document.getElementById('right-banner');
                leftBanner.style.backgroundImage = `url(${config.homePage.sideBanners.left})`;
                rightBanner.style.backgroundImage = `url(${config.homePage.sideBanners.right})`;

                const bannerOpacity = config.homePage.bannerOpacity || 0.15;
                document.documentElement.style.setProperty('--banner-opacity', bannerOpacity);
            }

        } catch (error) {
            console.error("Fatal Error:", error);
            document.body.innerHTML = '<p style="color:white; text-align:center; padding-top: 50px;">Could not load website configuration. Please try again later.</p>';
        }
    };

    // This function contains all the logic to build the page using the loaded config
    const buildPage = (config) => {
        // navbar, content, and setupScrollAnimations remain the same...
        const navbar = document.getElementById('navbar');
        const content = document.getElementById('content');

        const setupScrollAnimations = () => {
            const timelineItems = document.querySelectorAll('.timeline-item');
            if (timelineItems.length === 0) return;
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            timelineItems.forEach(item => observer.observe(item));
        };

        // --- COMPONENT RENDERING FUNCTIONS ---
        const renderHomePage = async () => {
            const aboutMeHtml = config.homePage.aboutMe.map(p => `<p>${p}</p>`).join('');
            const ghUsername = config.projects.githubUsername;
            const contributionGraphUrl = `https://ghchart.rshah.org/${ghUsername}`;

            // MODIFIED: The gallery mapping now creates a container and an overlay for the description.
            const galleryHtml = config.homePage.galleryImages.map(img => `
                <div class="gallery-item-container">
                    <img src="${img.src}" alt="${img.alt}" class="gallery-image">
                    <div class="gallery-item-overlay">
                        <p class="gallery-item-description">${img.description || ''}</p>
                    </div>
                </div>
            `).join('');

            content.innerHTML = `
                <div id="home-header"><h1>${config.homePage.title}</h1><p>${config.homePage.subtitle}</p></div>
                <div id="social-links">${config.socialLinks.map(link => `<a href="${link.url}" class="social-button" target="_blank">${link.name}</a>`).join('')}</div>
                <div class="home-section"><h2>About Me</h2><div class="about-me-text">${aboutMeHtml}</div></div>
                <div class="home-section"><h2>Experience</h2><div id="experience-timeline">${config.experience.map(item => `<div class="timeline-item"><div class="timeline-content"><h3>${item.role}</h3><p class="timeline-company">${item.company}</p><p class="timeline-date">${item.date}</p><p>${item.description}</p></div></div>`).join('')}</div></div>
                <div class="home-section" id="pinned-projects-section">
                    <h2>Pinned Projects</h2>
                    <div id="pinned-projects-list">Loading...</div>
                </div>
                <div class="home-section" id="activity-monitor-section">
                    <h2>Activity Feed</h2>
                    <div id="activity-feed-container">Loading...</div>
                </div>
                <div class="home-section" id="github-activity-section">
                    <h2>Latest GitHub Activity</h2>
                    <div class="contribution-graph">
                        <img src="${contributionGraphUrl}" alt="${ghUsername}'s Contribution Graph" />
                    </div>
                    <div id="github-activity-container">Loading...</div>
                </div>
                <div class="home-section"><h2>Gallery</h2><div id="gallery">${galleryHtml}</div></div>
                `;
            
            setupScrollAnimations();
            fetchPinnedProjects();
            fetchActivityFeed();
            fetchGitHubActivity();
        };
        
        const fetchPinnedProjects = async () => {
            const container = document.getElementById('pinned-projects-list');
            try {
                const res = await fetch('/api/projects');
                const projects = await res.json();
                const pinned = projects.filter(p => p.pinned);

                if (pinned.length === 0) {
                    container.innerHTML = '<p>No pinned projects yet.</p>';
                    return;
                }
                // CORRECTED: Use the standard 'project-list' class for the original full-sized layout
                container.className = 'project-list'; 
                // CORRECTED: Use the main renderProjectCard function for consistent, full-sized cards
                container.innerHTML = pinned.map(project => renderProjectCard(project)).join('');
            } catch (error) {
                container.innerHTML = '<p>Could not load pinned projects.</p>';
            }
        };

        const fetchActivityFeed = async () => {
             const container = document.getElementById('activity-feed-container');
            try {
                const res = await fetch('/api/activity');
                const { recentProjects, recentBlogs } = await res.json();
                let html = '<ul>';
                recentProjects.forEach(p => {
                    html += `<li>📝 New Project Added: <a href="#projects/${p.slug}">${p.name}</a></li>`;
                });
                recentBlogs.forEach(b => {
                    html += `<li>📰 New Blog Post: <a href="#blog/${b.slug}">${b.title}</a></li>`;
                });
                html += '</ul>';
                container.innerHTML = html;
            } catch (error) {
                container.innerHTML = '<p>Could not load activity feed.</p>';
            }
        };

        const fetchGitHubActivity = async () => {
            const container = document.getElementById('github-activity-container');
            try {
                const res = await fetch('/api/github-activity');
                const commits = await res.json();
                let html = '<ul class="commit-tree mini">';
                commits.forEach(c => {
                    html += `<li><div class="commit-message">${c.commit.message}</div><div class="commit-meta">by ${c.commit.author.name} on ${new Date(c.commit.author.date).toLocaleDateString()}</div></li>`;
                });
                html += '</ul>';
                container.innerHTML = html;
            } catch (error) {
                container.innerHTML = '<p>Could not load GitHub activity.</p>';
            }
        };

        const renderBlogListPage = async () => {
            content.innerHTML = '<h2>Blog</h2><div id="blog-list-container">Loading posts...</div>';
            const res = await fetch('/api/blogs');
            const posts = await res.json();
            const container = document.getElementById('blog-list-container');
            container.innerHTML = posts.map(post => {
                const thumbnail = post.thumbnail || post.Thumbnail || 'https://picsum.photos/seed/fallback/400/300';
                return `<div class="blog-post-item" data-slug="${post.slug}"><img src="${thumbnail}" alt="${post.title}" class="blog-thumbnail"><div class="blog-item-content"><h3>${post.title}</h3><p>${post.date} &bull; ${post.author}</p></div></div>`;
            }).join('');
        };

        const renderBlogPostPage = async (slug) => {
            content.innerHTML = '<h2>Blog</h2><div id="blog-post-container">Loading...</div>';
            try {
                const res = await fetch(`/api/blogs/${slug}`);
                if (!res.ok) throw new Error('Blog post not found.');
                const post = await res.json();
                const postContainer = document.getElementById('blog-post-container');
                postContainer.innerHTML = `
                    <a href="#blog" class="back-link">&larr; Back to all posts</a>
                    <div class="blog-content">${post.html}</div>
                    <hr style="margin: 3rem 0; border-color: var(--border-color);">
                    <div id="comments-section"></div>
                `;
                const oldGiscusFrame = document.querySelector('.giscus');
                if (oldGiscusFrame) {
                    oldGiscusFrame.remove();
                }
                const script = document.createElement('script');
                script.src = "https://giscus.app/client.js";
                script.setAttribute("data-repo", "listingclown3/blog");
                script.setAttribute("data-repo-id", "YOUR_REPO_ID_FROM_GISCUS");
                script.setAttribute("data-category", "Announcements");
                script.setAttribute("data-category-id", "YOUR_CATEGORY_ID_FROM_GISCUS");
                script.setAttribute("data-mapping", "pathname");
                script.setAttribute("data-strict", "0");
                script.setAttribute("data-reactions-enabled", "1");
                script.setAttribute("data-emit-metadata", "0");
                script.setAttribute("data-input-position", "bottom");
                script.setAttribute("data-theme", "dark_dimmed");
                script.setAttribute("data-lang", "en");
                script.setAttribute("crossorigin", "anonymous");
                script.async = true;
                document.getElementById('comments-section').appendChild(script);
            } catch (error) {
                console.error("Error rendering blog post:", error);
                document.getElementById('blog-post-container').innerHTML = `<p>Could not load blog post.</p>`;
            }
        };

       const renderProjectsPage = async () => {
            content.innerHTML = `<h2>Projects</h2><div id="project-list-container">Loading projects...</div>`;
            const container = document.getElementById('project-list-container');
            try {
                const res = await fetch('/api/projects');
                const projects = await res.json();
                const pinnedProjects = projects.filter(p => p.pinned);
                const otherProjects = projects.filter(p => !p.pinned);
                let html = '';
                if (pinnedProjects.length > 0) {
                    html += '<h3 class="projects-sub-header">Pinned</h3>';
                    html += '<div class="project-list">';
                    html += pinnedProjects.map(project => renderProjectCard(project)).join('');
                    html += '</div>';
                }
                if (otherProjects.length > 0) {
                    html += `<h3 class="projects-sub-header">${pinnedProjects.length > 0 ? 'Other Projects' : 'All Projects'}</h3>`;
                    html += '<div class="project-list">';
                    html += otherProjects.map(project => renderProjectCard(project)).join('');
                    html += '</div>';
                }
                container.innerHTML = html;
            } catch (error) {
                container.innerHTML = '<p>Could not load projects.</p>';
            }
        };

        const renderProjectCard = (project) => {
            const tagsHtml = (project.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
            const linksHtml = `
                <div class="project-links">
                    ${project.repoUrl ? `<a href="${project.repoUrl}" target="_blank" class="project-button">GitHub</a>` : ''}
                    ${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" class="project-button">Live Demo</a>` : ''}
                </div>`;
            return `
                <div class="project-card" data-name="${project.slug || project.name}">
                    <img src="${project.thumbnail || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTa8FV8SCzjlNqk2yzFPetRZbY7j258d8-MuA&s'}" alt="${project.name}" class="project-thumbnail">
                    <div class="project-content">
                        <h3>${project.name}</h3>
                        <p>${project.description || 'No description provided.'}</p>
                        <div class="project-tags">${tagsHtml}</div>
                        ${linksHtml}
                    </div>
                </div>`;
        };

        const renderProjectDetailPage = async (projectName) => {
            content.innerHTML = `<h2>Projects / ${projectName}</h2><div id="project-detail-container">Loading details...</div>`;
            try {
                const res = await fetch(`/api/project/${projectName}`);
                if (!res.ok) throw new Error('Project details not found.');
                const details = await res.json();
                let relatedHtml = '';
                if (details.related && details.related.length > 0) {
                    relatedHtml = `
                        <div class="related-materials">
                            <h3>Related Material</h3>
                            <ul>${details.related.map(item => `<li><a href="${item.url}" target="_blank">${item.title}</a></li>`).join('')}</ul>
                        </div>`;
                }
                if (details.isCustom) {
                    document.getElementById('project-detail-container').innerHTML = `
                        <a href="#projects" class="back-link">&larr; Back to all projects</a>
                        <div class="project-detail-layout">
                            <div class="readme-container">
                                ${details.customHtml}
                                ${relatedHtml}
                            </div>
                            <div class="commit-container">
                                <h3>Custom Project</h3>
                                <p>This is a custom project with no associated GitHub repository.</p>
                            </div>
                        </div>`;
                    return;
                }
                let branchesHtml = '';
                if (details.branches && details.branches.length > 0) {
                    branchesHtml = `
                        <div class="branches-list">
                            <h4>Branches</h4>
                            <ul>${details.branches.map(branch => `<li>${branch.name}</li>`).join('')}</ul>
                        </div>`;
                }
                document.getElementById('project-detail-container').innerHTML = `
                    <a href="#projects" class="back-link">&larr; Back to all projects</a>
                    <div class="project-detail-layout">
                        <div class="readme-container">
                            ${details.readmeHtml}
                            ${details.customHtml ? `<hr> ${details.customHtml}` : ''}
                            ${relatedHtml}
                        </div>
                        <div class="commit-container">
                            <h3>Latest Commits</h3>
                            <ul class="commit-tree">
                                ${details.commits.map(c => `<li><div class="commit-message">${c.commit.message}</div><div class="commit-meta"><span>${c.commit.author.name}</span> on <span>${new Date(c.commit.author.date).toLocaleDateString()}</span></div></li>`).join('')}
                            </ul>
                            ${branchesHtml}
                        </div>
                    </div>`;
            } catch (error) {
                document.getElementById('project-detail-container').innerHTML = `<p>Could not load project details.</p>`;
            }
        };

        const handleRouteChange = () => {
            const hash = window.location.hash.substring(1);
            const [pageName, slug] = hash.split('/');
            const targetPageName = config.pages.find(p => p.name.toLowerCase() === (pageName || 'home'))?.name || 'Home';
            navbar.querySelectorAll('a').forEach(link => link.classList.toggle('active', link.textContent === targetPageName));
            if (slug && targetPageName === 'Projects') {
                renderProjectDetailPage(slug);
            } else if (slug && targetPageName === 'Blog') {
                renderBlogPostPage(slug);
            } else {
                switch (targetPageName) {
                    case 'Home': renderHomePage(); break;
                    case 'Blog': renderBlogListPage(); break;
                    case 'Projects': renderProjectsPage(); break;
                    default: renderHomePage();
                }
            }
        };

        navbar.innerHTML = config.pages.map(page => `<a href="#${page.name.toLowerCase()}">${page.name}</a>`).join('');
        navbar.addEventListener('click', e => {
            if (e.target.tagName === 'A') { e.preventDefault(); window.location.hash = e.target.hash; }
        });
        content.addEventListener('click', e => {
        const projectCard = e.target.closest('.project-card');
        const blogItem = e.target.closest('.blog-post-item');
        const backLink = e.target.closest('.back-link');
        const projectButton = e.target.closest('.project-button'); // Add this line
        
        if (projectButton) {
            // If clicking on a project button (GitHub/Live Demo), let the default behavior happen
            return;
        } else if (projectCard) { 
            e.preventDefault(); 
            window.location.hash = `projects/${projectCard.dataset.name}`; 
        } else if (blogItem) { 
            e.preventDefault(); 
            window.location.hash = `blog/${blogItem.dataset.slug}`; 
        } else if (backLink) { 
            e.preventDefault(); 
            window.location.hash = backLink.hash; 
        }
    });
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange();
    };
    
    const startBackgroundRotator = (config) => {
        const { backgroundImages, backgroundOpacity = 0.15 } = config.homePage || {};
        if (!backgroundImages || backgroundImages.length === 0) return;
        const rotator = document.getElementById('background-rotator');
        let currentIndex = Math.floor(Math.random() * backgroundImages.length);
        const overlayAlpha = 1 - Math.min(Math.max(backgroundOpacity, 0), 1);
        rotator.style.setProperty('--bg-overlay-alpha', overlayAlpha);
        const changeImage = () => {
            rotator.style.opacity = 0;
            setTimeout(() => {
                currentIndex = (currentIndex + 1) % backgroundImages.length;
                rotator.style.backgroundImage = `url(${backgroundImages[currentIndex]})`;
                rotator.style.opacity = 1;
            }, 1000);
        };
        const img = new Image();
        img.src = backgroundImages[currentIndex];
        img.onload = () => {
            rotator.style.backgroundImage = `url(${backgroundImages[currentIndex]})`;
            rotator.style.opacity = 1;
            setInterval(changeImage, 10000);
        };
    };

    initializeApp();
});
