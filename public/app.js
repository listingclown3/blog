document.addEventListener('DOMContentLoaded', () => {
    // This is the main function that starts the application
    const initializeApp = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Could not fetch server configuration.');
            const config = await response.json();
            
            buildPage(config);
            startBackgroundRotator(config); // This function is now fixed

        } catch (error) {
            console.error("Fatal Error:", error);
            document.body.innerHTML = '<p style="color:white; text-align:center; padding-top: 50px;">Could not load website configuration. Please try again later.</p>';
        }
    };

    // This function contains all the logic to build the page using the loaded config
    const buildPage = (config) => {
        const navbar = document.getElementById('navbar');
        const content = document.getElementById('content');

        // --- HELPER & SETUP FUNCTIONS (DEFINED FIRST) ---
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
        const renderHomePage = () => {
            content.innerHTML = `
                <div id="home-header"><h1>${config.homePage.title}</h1><p>${config.homePage.subtitle}</p></div>
                <div id="social-links">${config.socialLinks.map(link => `<a href="${link.url}" class="social-button" target="_blank">${link.name}</a>`).join('')}</div>
                <div class="home-section"><h2>About Me</h2><p class="about-me-text">${config.homePage.aboutMe}</p></div>
                <div class="home-section"><h2>Experience</h2><div id="experience-timeline">${config.experience.map(item => `<div class="timeline-item"><div class="timeline-content"><h3>${item.role}</h3><p class="timeline-company">${item.company}</p><p class="timeline-date">${item.date}</p><p>${item.description}</p></div></div>`).join('')}</div></div>
                <div class="home-section"><h2>Gallery</h2><div id="gallery">${config.homePage.galleryImages.map(img => `<img src="${img.src}" alt="${img.alt}" class="gallery-image">`).join('')}</div></div>`;
            setupScrollAnimations();
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

                // Render the blog post content
                const postContainer = document.getElementById('blog-post-container');
                postContainer.innerHTML = `
                    <a href="#blog" class="back-link">&larr; Back to all posts</a>
                    <div class="blog-content">${post.html}</div>
                    <hr style="margin: 3rem 0; border-color: var(--border-color);">
                    <div id="comments-section"></div>
                `;

                // --- START OF GISCUS IMPLEMENTATION ---
                
                // Remove any old Giscus instance to prevent conflicts when navigating between posts
                const oldGiscusFrame = document.querySelector('.giscus');
                if (oldGiscusFrame) {
                    oldGiscusFrame.remove();
                }

                // Create the new Giscus script tag
                const script = document.createElement('script');
                script.src = "https://giscus.app/client.js";
                
                // Paste all the "data-*" attributes from the script Giscus gave you here.
                // Below are examples - use the ones you generated on the Giscus website!
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

                // Append the script to your new comments section
                document.getElementById('comments-section').appendChild(script);
                // --- END OF GISCUS IMPLEMENTATION ---

            } catch (error) {
                console.error("Error rendering blog post:", error);
                document.getElementById('blog-post-container').innerHTML = `<p>Could not load blog post.</p>`;
            }
        };
        const renderProjectsPage = async () => {
            content.innerHTML = `<h2>Projects</h2><div id="project-list">Loading projects...</div>`;
            const res = await fetch('/api/projects');
            const projects = await res.json();
            document.getElementById('project-list').innerHTML = projects.map(project => `<div class="project-card" data-name="${project.name}"><img src="${project.thumbnail || 'https://picsum.photos/seed/project/800/600'}" alt="${project.name}" class="project-thumbnail"><div class="project-content"><h3>${project.name}</h3><p>${project.description || 'No description provided.'}</p><div class="project-tags">${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div><div class="project-links"><a href="${project.repoUrl}" target="_blank" class="project-button">GitHub</a>${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" class="project-button">Live Demo</a>` : ''}</div></div></div>`).join('');
        };
        const renderProjectDetailPage = async (projectName) => {
            content.innerHTML = `<h2>Projects / ${projectName}</h2><div id="project-detail-container">Loading details...</div>`;
            try {
                const res = await fetch(`/api/project/${projectName}`);
                if (!res.ok) throw new Error('Project details not found.');
                const details = await res.json();
                const projectConfig = (config.projects.overrides || []).find(p => p.name === projectName) || {};
                document.getElementById('project-detail-container').innerHTML = `<a href="#projects" class="back-link">&larr; Back to all projects</a>${projectConfig.liveUrl ? `<a href="${projectConfig.liveUrl}" target="_blank" class="project-button live-demo-button">Live Demo</a>` : ''}<div class="project-detail-layout"><div class="readme-container">${details.readmeHtml}</div><div class="commit-container"><h3>Latest Commits</h3><ul class="commit-tree">${details.commits.map(c => `<li><div class="commit-message">${c.commit.message}</div><div class="commit-meta"><span>${c.commit.author.name}</span> on <span>${new Date(c.commit.author.date).toLocaleDateString()}</span></div></li>`).join('')}</ul></div></div>`;
            } catch (error) {
                document.getElementById('project-detail-container').innerHTML = `<p>Could not load project details.</p>`;
            }
        };

        // --- NAVIGATION & ROUTING ---
        const handleRouteChange = () => {
            const hash = window.location.hash.substring(1);
            const [pageName, slug] = hash.split('/');
            const targetPageName = config.pages.find(p => p.name.toLowerCase() === (pageName || 'home'))?.name || 'Home';
            navbar.querySelectorAll('a').forEach(link => link.classList.toggle('active', link.textContent === targetPageName));
            if (slug && targetPageName === 'Projects') renderProjectDetailPage(slug);
            else if (slug && targetPageName === 'Blog') renderBlogPostPage(slug);
            else {
                switch (targetPageName) {
                    case 'Home': renderHomePage(); break;
                    case 'Blog': renderBlogListPage(); break;
                    case 'Projects': renderProjectsPage(); break;
                    default: renderHomePage();
                }
            }
        };

        // --- EVENT LISTENERS & INITIAL SETUP ---
        navbar.innerHTML = config.pages.map(page => `<a href="#${page.name.toLowerCase()}">${page.name}</a>`).join('');
        navbar.addEventListener('click', e => {
            if (e.target.tagName === 'A') { e.preventDefault(); window.location.hash = e.target.hash; }
        });
        content.addEventListener('click', e => {
            const projectCard = e.target.closest('.project-card');
            const blogItem = e.target.closest('.blog-post-item');
            const backLink = e.target.closest('.back-link');
            if (projectCard) { e.preventDefault(); window.location.hash = `projects/${projectCard.dataset.name}`; } 
            else if (blogItem) { e.preventDefault(); window.location.hash = `blog/${blogItem.dataset.slug}`; } 
            else if (backLink) { e.preventDefault(); window.location.hash = backLink.hash; }
        });
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange();
    };
    
    // --- BACKGROUND ROTATOR (FIXED) ---
    const startBackgroundRotator = (config) => {
        const { backgroundImages, backgroundOpacity = 0.15 } = config.homePage;
        if (!backgroundImages || backgroundImages.length === 0) return;

        const rotator = document.getElementById('background-rotator');
        let currentIndex = 0;

        // Set the darkness of the overlay based on the configured opacity
        // A higher opacity (brighter image) means a more transparent overlay.
        const overlayAlpha = 1 - Math.min(Math.max(backgroundOpacity, 0), 1);
        rotator.style.setProperty('--bg-overlay-alpha', overlayAlpha);
        
        // Function to change the image
        const changeImage = () => {
            // Fade out
            rotator.style.opacity = 0;

            // After fade out is complete, change image and fade back in
            setTimeout(() => {
                currentIndex = (currentIndex + 1) % backgroundImages.length;
                rotator.style.backgroundImage = `url(${backgroundImages[currentIndex]})`;
                rotator.style.opacity = 1; // Fade in
            }, 1000); // This must match the CSS transition duration
        };

        // Preload the first image and start the rotator
        const img = new Image();
        img.src = backgroundImages[0];
        img.onload = () => {
            rotator.style.backgroundImage = `url(${backgroundImages[0]})`;
            rotator.style.opacity = 1; // Fade in initially
            setInterval(changeImage, 5000); // Rotate every 5 seconds
        };
    };

    // --- START THE APP ---
    initializeApp();
});