const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'public_html');

const OPTIMIZED_SCRIPT = `<!-- JavaScript -->
    <script>
        // Optimized WhatsApp Drag Functionality (Zero-Jank, Mobile-Safe)
        (function() {
            const btn = document.getElementById('enquiryButton');
            if (!btn) return;
            let isDragging = false;
            let startX, startY, initialRight, initialBottom;
            let hasMoved = false;
            const dragThreshold = 5;

            function constrainPosition() {
                const rect = btn.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                let currentRight = parseFloat(btn.style.right || '30px');
                let currentBottom = parseFloat(btn.style.bottom || '30px');
                currentRight = Math.max(0, Math.min(currentRight, maxX));
                currentBottom = Math.max(0, Math.min(currentBottom, maxY));
                btn.style.right = currentRight + 'px';
                btn.style.bottom = currentBottom + 'px';
            }

            function startDrag(e) {
                isDragging = true;
                hasMoved = false;
                btn.style.transition = 'none';
                const computedStyle = window.getComputedStyle(btn);
                initialRight = parseFloat(computedStyle.right);
                initialBottom = parseFloat(computedStyle.bottom);

                if (e.type === 'touchstart') {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    document.addEventListener('touchmove', doDrag, { passive: false });
                    document.addEventListener('touchend', stopDrag, { passive: true });
                    document.addEventListener('touchcancel', stopDrag, { passive: true });
                } else {
                    startX = e.clientX;
                    startY = e.clientY;
                    document.addEventListener('mousemove', doDrag);
                    document.addEventListener('mouseup', stopDrag);
                }
            }

            function doDrag(e) {
                if (!isDragging) return;
                let currentX, currentY;
                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX;
                    currentY = e.touches[0].clientY;
                } else {
                    currentX = e.clientX;
                    currentY = e.clientY;
                }
                const deltaX = startX - currentX;
                const deltaY = currentY - startY;

                if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
                    hasMoved = true;
                    btn.style.right = (initialRight + deltaX) + 'px';
                    btn.style.bottom = (initialBottom - deltaY) + 'px';
                    constrainPosition();
                }
            }

            function stopDrag(e) {
                if (!isDragging) return;
                if (!hasMoved) {
                    window.open(btn.href, '_blank');
                }
                isDragging = false;
                btn.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', doDrag);
                document.removeEventListener('touchend', stopDrag);
                document.removeEventListener('touchcancel', stopDrag);
            }

            btn.addEventListener('mousedown', startDrag);
            btn.addEventListener('touchstart', startDrag, { passive: true });
        })();
    </script>`;

// Precision regex to target only the WhatsApp drag script block
const REGEX_DRAG_SCRIPT = /<!--\s*(?:JavaScript|WhatsApp Button logic)\s*-->\s*<script>[\s\S]*?const\s+enquiryButton\s*=\s*document\.getElementById\(['"]enquiryButton['"]\);[\s\S]*?<\/script>/i;
const REGEX_FALLBACK = /<script>[\s\S]*?const\s+enquiryButton\s*=\s*document\.getElementById\(['"]enquiryButton['"]\);[\s\S]*?<\/script>/i;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

console.log('🔍 Starting search for buggy WhatsApp drag scripts...');
let filesUpdated = 0;

walkDir(TARGET_DIR, filePath => {
    if (path.extname(filePath) === '.html') {
        let content = fs.readFileSync(filePath, 'utf8');
        let matched = false;

        if (REGEX_DRAG_SCRIPT.test(content)) {
            content = content.replace(REGEX_DRAG_SCRIPT, OPTIMIZED_SCRIPT);
            matched = true;
        } else if (REGEX_FALLBACK.test(content)) {
            // Check if it's the right script inside REGEX_FALLBACK
            let matches = content.match(REGEX_FALLBACK);
            if (matches && matches.some(m => m.includes('doDrag') && m.includes('constrainPosition'))) {
                content = content.replace(REGEX_FALLBACK, OPTIMIZED_SCRIPT);
                matched = true;
            }
        }

        if (matched) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated: ${path.relative(TARGET_DIR, filePath)}`);
            filesUpdated++;
        }
    }
});

console.log(`\n🎉 Process complete! Updated ${filesUpdated} files.`);
