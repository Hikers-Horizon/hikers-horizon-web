import { chromium } from 'playwright';
import { readFile, copyFile, mkdir } from 'fs/promises';
import path from 'path';

const guideHtmlPath = path.resolve('c:\Users\shiva\Clone\public_html\swiftseat\swift-seat-guide.html');
const primaryPdfPath = path.resolve('c:\Users\shiva\Clone\Swift_Seat_Customer_Guide.pdf');
const secondaryPdfPath = path.resolve('c:\Users\shiva\Clone\public_html\swiftseat\Swift_Seat_Customer_Guide.pdf');

async function main() {
    try {
        console.log('Rendering user-friendly PDF...');
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const htmlContent = await readFile(guideHtmlPath, 'utf8');

        await page.setContent(htmlContent, { waitUntil: 'networkidle' });

        await mkdir(path.dirname(primaryPdfPath), { recursive: true });

        console.log(`Generating PDF at: ${primaryPdfPath}...`);
        await page.pdf({
            path: primaryPdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            }
        });

        await copyFile(primaryPdfPath, secondaryPdfPath);
        
        console.log('PDF generated successfully!');
        await browser.close();
    } catch (err) {
        console.error('Error rendering PDF:', err);
        process.exit(1);
    }
}

main();
