const fs = require('fs');
const path = require('path');

const targetDir = 'd:\\server-vaidik\\vaidik-server-main\\src';
const url1 = 'https://web-vaidik-git-test-server-vadik-talks-projects.vercel.app';
const url2 = 'https://vaidik-admin-git-test-server-vadik-talks-projects.vercel.app';

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Find arrays that look like CORS origins
            if (content.includes('app.vaidiktalk.com')) {
                // If it doesn't already have our new URL
                if (!content.includes(url1)) {
                    // Inject our URLs after 'https://app.vaidiktalk.com',
                    content = content.replace(
                        /'https:\/\/app\.vaidiktalk\.com',/g,
                        `'https://app.vaidiktalk.com',\n      '${url1}',\n      '${url2}',`
                    );
                }
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated CORS in: ' + fullPath);
            }
        }
    }
}

processDirectory(targetDir);
console.log('CORS update complete!');
