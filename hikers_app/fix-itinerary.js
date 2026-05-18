const fs = require('fs');
const path = require('path');

const filesToFix = [
    {
        path: 'public_html/Sunrise/Kuntibetta-sunrise-trek/index.html',
        target: `                    <div class="itinerary-content">
                            <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                            <p><span class="itinerary-time">01:30 AM</span> Reach Kunti Betta Base & Briefing</p>
                            <p><span class="itinerary-time">04:00 AM</span> Ascent Begins through rocky boulders</p>
                            <p><span class="itinerary-time">06:15 AM</span> Reach Summit & Enjoy the Sunrise over Thonnur
                            Lake</p>
                            <p><span class="itinerary-time">08:30 AM</span> Begin descent & Water activities (Optional)</span>
                    </li>
                    <li><span class="time-tag">10:00 AM</span><span>Breakfast near the lake</p>
                            <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`,
        replacement: `                    <div class="itinerary-content">
                        <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                        <p><span class="itinerary-time">01:30 AM</span> Reach Kunti Betta Base & Briefing</p>
                        <p><span class="itinerary-time">04:00 AM</span> Ascent Begins through rocky boulders</p>
                        <p><span class="itinerary-time">06:15 AM</span> Reach Summit & Enjoy the Sunrise over Thonnur Lake</p>
                        <p><span class="itinerary-time">08:30 AM</span> Begin descent & Water activities (Optional)</p>
                        <p><span class="itinerary-time">10:00 AM</span> Breakfast near the lake</p>
                        <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`
    },
    {
        path: 'public_html/Sunrise/Uttaribetta-sunrise-trek/index.html',
        target: `                    <div class="itinerary-content">
                            <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                            <p><span class="itinerary-time">01:30 AM</span> Reach Uttaribetta Base & Briefing</p>
                            <p><span class="itinerary-time">04:00 AM</span> Start trek through the seven fort gateways</span>
                    </li>
                    <li><span class="time-tag">06:15 AM</span><span>Reach Summit & Witness the wide-angle Sunrise</span>
                    </li>
                    <li><span class="time-tag">08:30 AM</span><span>Begin descent back to base</p>
                            <p><span class="itinerary-time">10:00 AM</span> Homestyle breakfast & Refreshments</p>
                            <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`,
        replacement: `                    <div class="itinerary-content">
                        <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                        <p><span class="itinerary-time">01:30 AM</span> Reach Uttaribetta Base & Briefing</p>
                        <p><span class="itinerary-time">04:00 AM</span> Start trek through the seven fort gateways</p>
                        <p><span class="itinerary-time">06:15 AM</span> Reach Summit & Witness the wide-angle Sunrise</p>
                        <p><span class="itinerary-time">08:30 AM</span> Begin descent back to base</p>
                        <p><span class="itinerary-time">10:00 AM</span> Homestyle breakfast & Refreshments</p>
                        <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`
    },
    {
        path: 'public_html/Sunrise/Makalidurga-sunrise-trek/index.html',
        target: `                    <div class="itinerary-content">
                            <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                            <p><span class="itinerary-time">01:30 AM</span> Reach Makalidurga Base & Refreshments</p>
                            <p><span class="itinerary-time">04:00 AM</span> Start the ascent through ancient gateways</span>
                    </li>
                    <li><span class="time-tag">06:15 AM</span><span>Reach Summit & Witness the iconic Railway
                            View</p>
                            <p><span class="itinerary-time">08:30 AM</span> Begin descent back to base</p>
                            <p><span class="itinerary-time">10:00 AM</span> Breakfast choice & Relaxation</p>
                            <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`,
        replacement: `                    <div class="itinerary-content">
                        <p><span class="itinerary-time">11:30 PM</span> Depart from Bangalore</p>
                        <p><span class="itinerary-time">01:30 AM</span> Reach Makalidurga Base & Refreshments</p>
                        <p><span class="itinerary-time">04:00 AM</span> Start the ascent through ancient gateways</p>
                        <p><span class="itinerary-time">06:15 AM</span> Reach Summit & Witness the iconic Railway View</p>
                        <p><span class="itinerary-time">08:30 AM</span> Begin descent back to base</p>
                        <p><span class="itinerary-time">10:00 AM</span> Breakfast choice & Relaxation</p>
                        <p><span class="itinerary-time">12:30 PM</span> Arrival back at Bangalore</p>
                    </div>`
    }
];

filesToFix.forEach(file => {
    const fullPath = path.resolve(__dirname, '..', file.path);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${file.path}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Normalize newlines to handle differences between systems
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedTarget = file.target.replace(/\r\n/g, '\n');
    const normalizedReplacement = file.replacement.replace(/\r\n/g, '\n');

    if (normalizedContent.includes(normalizedTarget)) {
        const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
        fs.writeFileSync(fullPath, updatedContent, 'utf8');
        console.log(`✅ Successfully fixed: ${file.path}`);
    } else {
        console.warn(`⚠️ Target itinerary content not matched in: ${file.path}`);
    }
});
