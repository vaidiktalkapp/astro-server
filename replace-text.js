const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (f !== 'node_modules' && f !== '.next' && f !== 'dist' && f !== '.git') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

walkDir('d:/AstroSolution Updated', (filePath) => {
    if (filePath.match(/\.(ts|tsx|js|md)$/)) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            let updated = false;
            if (/Vaidik\s*talk/i.test(content) || /AstroSolution/i.test(content)) {
                // Avoid replacing in package.json or package-lock.json to avoid breaking npm dependencies, though we excluded .json now
                content = content.replace(/Vaidik\s*talk/gi, 'AstroSolution');
                content = content.replace(/AstroSolution/gi, 'AstroSolution');
                updated = true;
            }
            if (updated) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        } catch (err) {
            console.error(`Error reading/writing ${filePath}:`, err);
        }
    }
});
console.log('Done replacing in codebase.');
